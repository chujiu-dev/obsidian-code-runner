import type { Backend, Stdio } from '../';

const default_cdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

// SharedArrayBuffer: the communication channel for interactive stdin.
// Created once and reused across all Python runs.
const SAB_SIZE = 4096;
const sab = new SharedArrayBuffer(SAB_SIZE);
const statusView = new Int32Array(sab, 0, 1);   // 0=waiting, 1=data ready
const lengthView = new Int32Array(sab, 4, 1);    // byte length of stdin data
const bufferView = new Uint8Array(sab, 8);       // UTF-8 stdin buffer
const encoder = new TextEncoder();

let worker: Worker | null = null;
let workerReady = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../pyodide.worker.ts', import.meta.url),
      { type: 'module' }
    );
    // Transfer ownership of the SAB to the worker
    worker.postMessage({ type: 'init', sab });
    workerReady = true;
  }
  return worker;
}

let cache: { cdn: string; backend: Backend } | null = null;

export default (function (props?: { cdn: string }) {
  const cdn = props?.cdn ?? default_cdn;

  if (cache?.cdn === cdn) {
    return cache.backend;
  }

  const w = getWorker();

  const backend: Backend = async (code, output) => {
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
            // Worker is blocked waiting for stdin data.
            // Request input from the UI callback.
            if (output.requestStdin) {
              const data = await output.requestStdin();
              const encoded = encoder.encode(data);
              lengthView[0] = encoded.length;
              bufferView.set(encoded.subarray(0, Math.min(encoded.length, SAB_SIZE - 8)));
              Atomics.store(statusView, 0, 1);
              Atomics.notify(statusView, 0);
            } else {
              // No interactive callback — send empty line
              lengthView[0] = 0;
              Atomics.store(statusView, 0, 1);
              Atomics.notify(statusView, 0);
            }
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
  };
  backend.loading = true;

  // Mark as loaded immediately — actual loading happens in the worker
  backend.loading = false;

  cache = { cdn, backend };

  return backend;
})();
