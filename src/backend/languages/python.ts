import type { Backend, Stdio } from '../';

const default_cdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

// ── SharedArrayBuffer setup (for Web Worker interactive stdin) ──
// Falls back to main-thread mode if SAB is unavailable (e.g. older Safari).

const SAB_SIZE = 4096;
let sab: SharedArrayBuffer | null = null;
let statusView: Int32Array;
let lengthView: Int32Array;
let bufferView: Uint8Array;
let supportsSAB = false;

try {
  sab = new SharedArrayBuffer(SAB_SIZE);
  statusView = new Int32Array(sab, 0, 1);
  lengthView = new Int32Array(sab, 4, 1);
  bufferView = new Uint8Array(sab, 8);
  supportsSAB = true;
} catch {
  console.warn('[Code Runner] SharedArrayBuffer not available — interactive stdin disabled. Python will run on the main thread.');
  supportsSAB = false;
}

const encoder = new TextEncoder();

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (!supportsSAB) return null;
  if (!worker) {
    worker = new Worker(
      new URL('../pyodide.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.postMessage({ type: 'init', sab });
  }
  return worker;
}

// ── Main-thread Pyodide (fallback when SAB unavailable) ──

let engine: any = null;
let enginePromise: Promise<any> | null = null;

async function getEngineMainThread(cdn: string): Promise<any> {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    const mod = await import('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs');
    engine = await mod.loadPyodide({
      indexURL: cdn,
    });
    await engine.loadPackage('micropip');
    return engine;
  })();

  return enginePromise;
}

// ── Backend ──

let cache: { cdn: string; backend: Backend } | null = null;

export default (function (props?: { cdn: string }) {
  const cdn = props?.cdn ?? default_cdn;

  if (cache?.cdn === cdn) {
    return cache.backend;
  }

  const w = getWorker();

  const backend: Backend = async (code, output) => {
    // ── Web Worker path (interactive stdin supported) ──
    if (w) {
      return new Promise<void>((resolve) => {
        const onMessage = async (e: MessageEvent) => {
          switch (e.data.type) {
            case 'stdout':
              output.stdout(e.data.text);
              break;

            case 'stderr':
              output.stderr(e.data.text);
              break;

            case 'stdin':
              if (output.requestStdin) {
                const data = await output.requestStdin();
                const encoded = encoder.encode(data);
                lengthView[0] = encoded.length;
                bufferView.set(encoded.subarray(0, Math.min(encoded.length, SAB_SIZE - 8)));
              } else {
                lengthView[0] = 0;
              }
              Atomics.store(statusView, 0, 1);
              Atomics.notify(statusView, 0);
              break;

            case 'complete':
              w.removeEventListener('message', onMessage);
              resolve();
              break;

            case 'error':
              output.stderr(e.data.error);
              w.removeEventListener('message', onMessage);
              resolve();
              break;
          }
        };

        w.addEventListener('message', onMessage);
        w.postMessage({ type: 'run', code, cdn });
      });
    }

    // ── Main-thread fallback path (no interactive stdin) ──
    try {
      const eng = await getEngineMainThread(cdn);

      // Pre-fill stdin from textarea (same as before)
      const inputStr = output.getStdin();
      const stdinLines = inputStr ? inputStr.split('\n') : [];
      let stdinIndex = 0;

      // Set matplotlib target if viewEl is available
      if (output.viewEl) {
        document['pyodideMplTarget'] = output.viewEl;
      }

      await eng.runPythonAsync(code, {
        stdin: () => {
          if (stdinIndex < stdinLines.length) {
            return stdinLines[stdinIndex++] + '\n';
          }
          return '\n';
        },
        stdout: (s: string) => output.stdout(s),
        stderr: (s: string) => output.stderr(s),
      });
    } catch (e: any) {
      output.stderr(e.message || String(e));
    } finally {
      delete document['pyodideMplTarget'];
    }
  };
  backend.loading = true;

  // Mark as loaded immediately — actual Pyodide loading is deferred
  backend.loading = false;

  cache = { cdn, backend };

  return backend;
})();
