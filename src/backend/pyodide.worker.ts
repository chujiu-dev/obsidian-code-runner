/**
 * Pyodide Web Worker — runs Python code off the main thread so that
 * interactive stdin (input()) can pause execution without freezing the UI.
 *
 * SharedArrayBuffer layout (4096 bytes):
 *   [0..3]   Int32  status:  0 = worker waiting for stdin
 *                             1 = main thread has written stdin data
 *   [4..7]   Int32  length:   byte length of stdin data
 *   [8..]    Uint8  buffer:   UTF-8 stdin data (up to 4088 bytes)
 */

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

let sab: SharedArrayBuffer;
let statusView: Int32Array;
let lengthView: Int32Array;
let bufferView: Uint8Array;

let pyodidePromise: Promise<any> | null = null;
let pyodide: any = null;

/** Block the worker thread until the main thread provides stdin data via the SAB. */
function waitForStdin(): string {
  // Signal main thread that we need input
  self.postMessage({ type: 'stdin' });

  // Block until main thread writes data and notifies us
  Atomics.wait(statusView, 0, 0);

  // Read the data that the main thread wrote
  const len = lengthView[0];
  const data = DECODER.decode(bufferView.subarray(0, len));

  // Reset status so the next stdin call works correctly
  Atomics.store(statusView, 0, 0);
  lengthView[0] = 0;

  return data;
}

/** Load Pyodide once and cache it. */
async function getPyodide(cdn: string): Promise<any> {
  if (pyodide) return pyodide;
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    // Dynamic import of Pyodide ESM build — string literal for review compliance
    const mod = await import('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs');
    pyodide = await mod.loadPyodide({
      indexURL: cdn,
      stdout: (text: string) => {
        self.postMessage({ type: 'stdout', text });
      },
      stderr: (text: string) => {
        self.postMessage({ type: 'stderr', text });
      },
      stdin: () => {
        return waitForStdin() + '\n';
      },
    });
    await pyodide.loadPackage('micropip');
    return pyodide;
  })();

  return pyodidePromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { type } = e.data;

  if (type === 'init') {
    // Receive SharedArrayBuffer from main thread (transferred, not copied)
    sab = e.data.sab;
    statusView = new Int32Array(sab, 0, 1);
    lengthView = new Int32Array(sab, 4, 1);
    bufferView = new Uint8Array(sab, 8);
    return;
  }

  if (type === 'run') {
    const { code, cdn } = e.data;
    try {
      const engine = await getPyodide(cdn);
      await engine.runPythonAsync(code);
      self.postMessage({ type: 'complete' });
    } catch (err: any) {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
};
