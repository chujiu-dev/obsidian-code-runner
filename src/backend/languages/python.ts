import type { Backend, Stdio } from '../';
import { extractInputPrompts } from '../stdin-detect';
import { failureMessage, hostOf, isOffline, OfflineError } from '../net';
import { errorText } from '../util';
import { t } from '../../i18n';
import { DEFAULT_PYODIDE_CDN } from '../../setting';

// ── Pyodide type definitions ──
interface PyodideEngine {
  runPythonAsync(code: string): Promise<void>;
  loadPackage(name: string): Promise<void>;
  setStdout(options: { raw?: (ch: number) => void; batched?: (s: string) => void }): void;
  setStderr(options: { raw?: (ch: number) => void; batched?: (s: string) => void }): void;
  setInterruptBuffer(buffer: Uint8Array | undefined): void;
  globals: {
    get(name: string): unknown;
    set(name: string, value: unknown): void;
  };
}

// ── Worker message types ──
interface WorkerMessage {
  type: 'stdout' | 'stderr' | 'stdin' | 'complete' | 'error' | 'aborted' | 'ready';
  text?: string;
  error?: string;
  code?: string;
  interactive?: boolean;
  prompt?: string;
}

// ── SAB detection (module init, runs once) ──
const hasSAB = (() => {
  try { new SharedArrayBuffer(1); return true; }
  catch { return false; }
})();
export { hasSAB };

// ── Shared stdin buffer layout ──
// The Worker and the main thread talk through one SharedArrayBuffer:
//
//   bytes  0..3   status   0 = worker waiting, 1 = a line is ready, 2 = abort
//   bytes  4..7   length   byte length of the pending line
//   byte   8      interrupt  SIGINT cell handed to pyodide.setInterruptBuffer
//   bytes 16..    data      the line itself
//
// All views are 4-byte aligned; the interrupt cell is deliberately alone on
// its own word because Pyodide reads it from the signal handler.
const SAB_SIZE = 8192;
const OFF_STATUS = 0;
const OFF_LENGTH = 4;
const OFF_INTERRUPT = 8;
const OFF_DATA = 16;
const MAX_STDIN_BYTES = SAB_SIZE - OFF_DATA;

const STATUS_WAITING = 0;
const STATUS_READY = 1;
const STATUS_ABORT = 2;

/** SIGINT, per pyodide.setInterruptBuffer: any 0 < signum < 65 triggers it. */
const SIGINT = 2;

/**
 * How long a stop waits for SIGINT to unwind the program before giving up and
 * restarting the Worker. The restart costs a full Pyodide reload, so the grace
 * period is generous — a program that ignores SIGINT is genuinely stuck.
 */
const STOP_GRACE_MS = 2500;

/**
 * How long to wait for a Worker to report that Pyodide finished loading.
 * A blocked CDN does not fail, it stalls: without this the Worker stays
 * "loading" forever and every later run queues behind it, which is
 * indistinguishable from a frozen plugin.
 */
const LOAD_TIMEOUT_MS = 60000;

// ── Worker source (embedded as string → Blob URL) ──
// Classic worker. importScripts for Pyodide IIFE, SAB for stdin blocking.
// All JS strings use double quotes — no backticks, no single quotes.
// Uses builtins.input replacement (not pyodide.setStdin) to avoid EIO on fd-0.
function workerSource(): string {
  return [
    'self.process = { browser: true };',
    '',
    'var pyodide = null;',
    'var ready = false;',
    'var pendingRuns = [];',
    'var sab = null;',
    'var statusView = null;',
    'var lengthView = null;',
    'var interruptView = null;',
    'var dataView = null;',
    // Set when an abort was requested, so the run can report "stopped" rather
    // than leaking the raw error that unwinding produced.
    'var aborted = false;',
    '',
    // Called from Python via `from js import waitForInteractiveStdin as _wait_stdin`.
    // Blocks the Worker on Atomics.wait until the main thread writes a line
    // (status 1) or asks for an abort (status 2). The prompt string is forwarded
    // to the main thread so it can be displayed in the UI.
    'function waitForInteractiveStdin(prompt) {',
    '  if (!sab) return "";',
    '  self.postMessage({ type: "stdin", interactive: true, prompt: prompt || "" });',
    '  var outcome = Atomics.wait(statusView, 0, 0, 60000);',
    // Timeout after 60s: re-request (prompt will flash again in UI)
    '  if (outcome === "timed-out") {',
    '    return waitForInteractiveStdin(prompt);',
    '  }',
    '  if (Atomics.load(statusView, 0) === 2) {',
    '    Atomics.store(statusView, 0, 0);',
    '    aborted = true;',
    // Throwing from here surfaces inside Python as an exception at the input()
    // call, which unwinds the program.
    '    throw new Error("execution aborted");',
    '  }',
    '  var len = Atomics.load(lengthView, 0);',
    '  var result = "";',
    '  if (len > 0) {',
    '    var bytes = new Uint8Array(sab, 16, len);',
    '    result = new TextDecoder().decode(bytes.slice());',
    '  }',
    '  Atomics.store(statusView, 0, 0);',
    '  Atomics.store(lengthView, 0, 0);',
    '  return result;',
    '}',
    '',
    'function initPyodide(cdn) {',
    '  try {',
    '    importScripts(cdn + "pyodide.js");',
    '  } catch (e) {',
    '    self.postMessage({ type: "error", code: "LOAD_FAILED", error: e.message || String(e) });',
    '    return;',
    '  }',
    '  self.loadPyodide({ indexURL: cdn }).then(function(eng) {',
    '    pyodide = eng;',
    // SIGINT from the main thread interrupts a running program (a busy loop
    // never reaches waitForInteractiveStdin, so the SAB alone cannot stop it).
    '    if (interruptView) { pyodide.setInterruptBuffer(interruptView); }',
    // NOTE: We do NOT use pyodide.setStdin() — Emscripten fd-0 is broken in Obsidian Electron.
    // Instead we replace builtins.input in runCode() below.
    '    pyodide.setStdout({ batched: function(s) { self.postMessage({ type: "stdout", text: s }); } });',
    '    pyodide.setStderr({ batched: function(s) { self.postMessage({ type: "stderr", text: s }); } });',
    '    return pyodide.loadPackage("micropip");',
    '  }).then(function() {',
    '    ready = true;',
    '    self.postMessage({ type: "ready" });',
    '    for (var i = 0; i < pendingRuns.length; i++) {',
    '      var r = pendingRuns[i];',
    '      runCode(r.code, r.stdinLines);',
    '    }',
    '    pendingRuns = [];',
    '  }).catch(function(e) {',
    '    self.postMessage({ type: "error", code: "INIT_FAILED", error: e.message || String(e) });',
    '  });',
    '}',
    '',
    // Two-step execution: first replace builtins.input, then run user code.
    // Pre-filled lines are consumed first; when exhausted, waitForInteractiveStdin
    // blocks the Worker until the user types something in the Obsidian UI.
    'function runCode(code, stdinLines) {',
    '  if (!pyodide) {',
    '    self.postMessage({ type: "error", code: "NOT_INITIALIZED" });',
    '    return;',
    '  }',
    '  aborted = false;',
    '  var linesJson = JSON.stringify(stdinLines || []);',
    '  var setupCode = [',
    '    "__stdin_lines = " + linesJson,',
    '    "__stdin_idx = [0]",',
    '    "",',
    '    "from js import waitForInteractiveStdin as _wait_stdin",',
    '    "",',
    '    "def __my_input(prompt=\\"\\"):",',
    '    "    if __stdin_idx[0] < len(__stdin_lines):",',
    '    "        r = __stdin_lines[__stdin_idx[0]]",',
    '    "        __stdin_idx[0] += 1",',
    '    "        return r",',
    '    "    return _wait_stdin(prompt)",',
    '    "",',
    '    "import builtins",',
    '    "builtins.input = __my_input",',
    '  ].join("\\n");',
    '  pyodide.runPythonAsync(setupCode).then(function() {',
    '    return pyodide.runPythonAsync(code);',
    '  }).then(function() {',
    '    return pyodide.runPythonAsync("print()");',
    '  }).then(function() {',
    '    self.postMessage({ type: "complete" });',
    '  }).catch(function(e) {',
    '    var msg = e && e.message ? e.message : String(e);',
    '    if (aborted) {',
    '      aborted = false;',
    '      self.postMessage({ type: "aborted" });',
    '    } else {',
    '      self.postMessage({ type: "error", error: msg });',
    '    }',
    '  });',
    '}',
    '',
    'self.onmessage = function(event) {',
    '  var data = event.data;',
    '  if (data.type === "init") {',
    '    sab = data.sab;',
    '    if (sab) {',
    '      statusView = new Int32Array(sab, 0, 1);',
    '      lengthView = new Int32Array(sab, 4, 1);',
    '      interruptView = new Uint8Array(sab, 8, 1);',
    '      dataView = new Uint8Array(sab, 16);',
    '    }',
    '    initPyodide(data.cdn);',
    '  } else if (data.type === "run") {',
    '    if (ready) {',
    '      runCode(data.code, data.stdinLines);',
    '    } else {',
    '      pendingRuns.push({ code: data.code, stdinLines: data.stdinLines });',
    '    }',
    '  }',
    '};',
  ].join('\n');
}

// ── Runtime configuration ──
// The backend is a single shared instance (one Pyodide costs ~10 MB to load),
// so the CDN is read per run rather than baked in at import time.
let currentCdn = DEFAULT_PYODIDE_CDN;

/** Tear down the live runtime, if any. Set by whichever backend is active. */
let liveDispose: (() => void) | null = null;

// ── Load state, surfaced to the UI ──
// Loading Pyodide pulls ~10 MB from a CDN, which can take seconds or — on a
// blocked/slow CDN — forever. Without this the UI cannot tell "still
// downloading" from "program is thinking": both are just a spinner, so a
// stalled load reads as a frozen plugin.
let loading = false;
let loadingSubscribers: ((loading: boolean) => void)[] = [];

/** Subscribe to runtime load state. Fires immediately with the current value. */
export function onPythonLoading(cb: (loading: boolean) => void): () => void {
  loadingSubscribers.push(cb);
  cb(loading);
  return () => { loadingSubscribers = loadingSubscribers.filter(s => s !== cb); };
}

function setLoading(next: boolean): void {
  if (loading === next) return;
  loading = next;
  for (const subscriber of loadingSubscribers) subscriber(next);
}

/**
 * Point the Python runtime at another Pyodide build (Settings → Runtime).
 * An already-loaded runtime is discarded, so the next run reloads from the new
 * base URL.
 */
export function setPythonCdn(cdn: string): void {
  const next = (cdn ?? '').trim() || DEFAULT_PYODIDE_CDN;
  if (next === currentCdn) return;
  currentCdn = next;
  liveDispose?.();
  liveDispose = null;
}

// ── Main-thread Pyodide engine (singleton) ──
// Kept module-scoped: a WASM runtime cannot be unloaded, so re-creating the
// backend must find the same engine rather than loading a second copy.
let engine: PyodideEngine | null = null;
let enginePromise: Promise<PyodideEngine> | null = null;

async function getEngine(cdn: string): Promise<PyodideEngine> {
  if (engine) return engine;
  // Written as a comparison rather than `if (enginePromise)`: with
  // `strictNullChecks` off the type says a Promise is always here, and a lint
  // rule that keeps Promises out of boolean positions reads the bare form as a
  // test on the Promise itself.
  if (enginePromise !== null) return enginePromise;

  enginePromise = (async () => {
    console.debug('[Code Runner] Loading Pyodide on main thread...');

    const g = window as unknown as Record<string, unknown>;
    const savedProcess = g.process;
    g.process = { browser: true };

    try {
      // The specifier is the CDN the user chose (Settings → Python → CDN), and
      // a WebAssembly runtime cannot be shipped inside `main.js` — this is the
      // one computed `import()` in the plugin that is genuinely user-supplied.
      // The community review's security lint flags it on principle; the reason
      // it is accepted here is that the URL only ever points at a host the user
      // configured themselves, and the default is jsDelivr.
      // eslint-disable-next-line no-unsanitized/method -- URL is the user's own Python CDN setting; Pyodide cannot be bundled
      const mod = await import(/* @vite-ignore */ `${cdn}pyodide.mjs`) as { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideEngine> };
      engine = await mod.loadPyodide({ indexURL: cdn });
    } finally {
      g.process = savedProcess;
    }

    await engine.loadPackage('micropip');
    console.debug('[Code Runner] Pyodide ready.');
    return engine;
  })();

  return enginePromise;
}

// ── Main-thread backend (fallback, always available) ──
// Falls back to pre-filled stdin only: the run happens on the UI thread, so
// there is no way to ask the user for input mid-run, nor to interrupt one.

/**
 * Swallows a run's outcome, so a caller's serialization chain never rejects.
 *
 * A named `void` function rather than an inline `.then(() => undefined, …)`:
 * with `strictNullChecks` off the literal's `undefined` widens to `any`, and
 * the community review's type-aware lint reads the `Promise<any>` that comes
 * out of it as an unsafe assignment.
 */
function dropOutcome(): void { /* the outcome is deliberately dropped */ }

function createMainThreadBackend(): Backend & { dispose: () => void } {
  // Runs from different code blocks share this engine, its stdout handlers and
  // the single pyodideMplTarget slot, so they are serialized.
  let chain: Promise<void> = Promise.resolve();

  const execute = async (code: string, output: Stdio): Promise<void> => {
    try {
      // Only a cold load is slow enough to be worth reporting to the UI; the
      // cached case would just flicker.
      const coldLoad = engine === null;
      if (coldLoad) setLoading(true);
      let eng: PyodideEngine;
      try {
        // Only a cold start needs the CDN; an already-loaded runtime is local
        // WASM and runs happily offline.
        if (coldLoad && isOffline()) throw new OfflineError(hostOf(currentCdn));
        eng = await getEngine(currentCdn);
      } finally {
        if (coldLoad) setLoading(false);
      }

      const inputStr = output.getStdin();
      const stdinLines = inputStr ? inputStr.split('\n') : [];

      // Parse input() prompts from the code for friendly error messages.
      const prompts = extractInputPrompts('python', code);
      const promptLabels = prompts.map(p => p.label);

      // Build setup code — pure Python, NO imports.
      // We avoid `import builtins` (and ANY import) because Pyodide's import
      // machinery might trigger sys.stdin initialization, which hits EIO.
      // All symbols used (print, RuntimeError, str, len) are builtins.
      const linesJson = JSON.stringify(stdinLines);
      const promptsJson = JSON.stringify(promptLabels);

      // Build translated error template. {label} and {consumed} are
      // Python str.format() placeholders filled at runtime.
      const errorTpl = JSON.stringify(t('stdin.insufficient.body'));
      // Label template e.g. "Input #{_n}" (en) or "输入 #{_n}" (zh)
      const labelTpl = JSON.stringify(
        t('stdin.label.input', { n: 0 }).replace('0', '{_n}')
      );

      const setupCode = [
        '__stdin_lines = ' + linesJson,
        '__stdin_prompts = ' + promptsJson,
        '__stdin_idx = [0]',
        '__stdin_empty = [0]',
        '',
        '_err_tpl = ' + errorTpl,
        '_lbl_tpl = ' + labelTpl,
        '',
        'def __my_input(prompt=""):',
        '    if __stdin_idx[0] < len(__stdin_lines):',
        '        __stdin_empty[0] = 0',
        '        r = __stdin_lines[__stdin_idx[0]]',
        '        __stdin_idx[0] += 1',
        '        return r',
        '    __stdin_empty[0] += 1',
        '    if __stdin_empty[0] >= 10:',
        '        _n = __stdin_idx[0] + 1',
        '        _label = __stdin_prompts[__stdin_idx[0]] if __stdin_idx[0] < len(__stdin_prompts) else ""',
        '        _desc = _lbl_tpl.format(_n=_n)',
        '        if _label:',
        '            _desc = _desc + " (\\\'" + _label + "\\\')"',
        '        raise RuntimeError(_err_tpl.format(label=_desc, consumed=str(len(__stdin_lines))))',
        '    print()',
        '    return ""',
        '',
      ].join('\n');

      // ── Set up stdout/stderr ──
      eng.setStdout({ batched: (s: string) => output.stdout(s) });
      eng.setStderr({ batched: (s: string) => output.stderr(s) });

      if (output.viewEl) {
        (activeDocument as unknown as Record<string, unknown>)['pyodideMplTarget'] = output.viewEl;
      }

      // ── Step 1: Run setup code to define __my_input ──
      try {
        await eng.runPythonAsync(setupCode);
      } catch (e: unknown) {
        output.stderr(t('pyodide.setupError', { message: errorText(e) }));
        return;
      }

      // ── Step 2: Inject input replacement from JavaScript ──
      try {
        const myInput = eng.globals.get('__my_input');
        if (!myInput) {
          output.stderr(t('pyodide.injectError'));
          return;
        }
        eng.globals.set('input', myInput);
      } catch (e: unknown) {
        output.stderr(t('pyodide.setupError', { message: errorText(e) }));
        return;
      }

      // ── Step 3: Run user code ──
      try {
        await eng.runPythonAsync(code);
      } catch (e: unknown) {
        output.stderr(errorText(e));
      }
      // Force-flush stdout buffer for output without trailing newline
      try { await eng.runPythonAsync('print()'); } catch { /* best-effort flush; ignore if Pyodide has already shut down */ }
    } catch (e: unknown) {
      output.stderr(failureMessage(e) ?? errorText(e));
    } finally {
      delete (activeDocument as unknown as Record<string, unknown>)['pyodideMplTarget'];
    }
  };

  const backend: Backend & { dispose: () => void } = (code, output) => {
    const task = chain.then(() => execute(code, output));
    // Keep the chain alive whatever happens to an individual run.
    chain = task.then(dropOutcome, dropOutcome);
    return task;
  };

  backend.dispose = () => {
    // A loaded WASM runtime cannot be freed here; dropping the reference would
    // just make the next run load a second copy. The new CDN applies on reload.
    if (engine) {
      console.warn('[Code Runner] Pyodide is already loaded — the new CDN applies after Obsidian is reloaded.');
    }
  };

  backend.loading = false;
  return backend;
}

// ── Worker + SAB backend (interactive capable, requires SAB) ──
function createWorkerBackend(): Backend & { dispose: () => void } {
  let worker: Worker | null = null;
  let blobUrl: string | null = null;
  let sab: SharedArrayBuffer | null = null;
  let statusView: Int32Array | null = null;
  let lengthView: Int32Array | null = null;
  let interruptView: Uint8Array | null = null;
  let dataView: Uint8Array | null = null;

  // One Worker serves every code block, so runs are queued instead of
  // interleaved. Each entry carries its own Stdio, which is how a stop request
  // finds the run it belongs to.
  let chain: Promise<void> = Promise.resolve();
  /** Blocks whose run has not started yet, in the order they arrived. */
  const waiting: Stdio[] = [];
  const cancelled = new Set<Stdio>();
  /** Blocks currently being told a queue position, so departures can be told 0. */
  let queuedBlocks = new Set<Stdio>();

  // The run currently inside the Worker, if any.
  let activeOutput: Stdio | null = null;
  let runResolve: (() => void) | null = null;
  let killTimer: number | null = null;
  let rearmTimer: number | null = null;
  let loadTimer: number | null = null;
  /** The user asked for this run to stop, so its unwind is not an error. */
  let stopRequested = false;

  function getWorker(): Worker {
    if (worker) return worker;

    // Pyodide is fetched from a CDN, so a cold start cannot succeed without a
    // connection. Reported here (and caught by `run`) rather than letting the
    // 60s load watchdog be the one to find out.
    if (isOffline()) throw new OfflineError(hostOf(currentCdn));

    const src = workerSource();
    const blob = new Blob([src], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);

    sab = new SharedArrayBuffer(SAB_SIZE);
    statusView = new Int32Array(sab, OFF_STATUS, 1);
    lengthView = new Int32Array(sab, OFF_LENGTH, 1);
    interruptView = new Uint8Array(sab, OFF_INTERRUPT, 1);
    dataView = new Uint8Array(sab, OFF_DATA);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as WorkerMessage;
      switch (data.type) {
      case 'stdout':
        if (activeOutput && data.text) activeOutput.stdout(data.text);
        break;
      case 'stderr':
        if (activeOutput && data.text) activeOutput.stderr(data.text);
        break;
      case 'stdin':
        // Python already consumed the pre-filled lines internally, so any stdin
        // message from the Worker is a real interactive request.
        if (activeOutput) {
          const prompt = data.prompt || '';
          const target = activeOutput as Partial<Stdio>;
          // Callers outside this plugin can hand us a stand-in stdio object;
          // parking on a resolver that does not exist would hang this run — and
          // every run queued behind it — until the Worker's 60s timeout.
          if (typeof target.requestStdin !== 'function') {
            writeStdinToSAB('');
            break;
          }
          target.requestStdin(prompt).then((input: string) => {
            writeStdinToSAB(input);
          }).catch(() => {
            writeStdinToSAB('');
          });
        }
        break;
      case 'ready':
        if (loadTimer !== null) {
          window.clearTimeout(loadTimer);
          loadTimer = null;
        }
        setLoading(false);
        break;
      case 'complete':
        endRun();
        break;
      case 'aborted':
        if (activeOutput) activeOutput.stderr(t('python.aborted'));
        endRun();
        break;
      case 'error': {
        let msg: string;
        if (data.code === 'LOAD_FAILED') {
          msg = t('pyodide.loadError', { message: data.error || '' });
        } else if (data.code === 'INIT_FAILED') {
          msg = t('pyodide.initError', { message: data.error || '' });
        } else if (data.code === 'NOT_INITIALIZED') {
          msg = t('pyodide.notInitialized');
        } else {
          msg = data.error || t('pyodide.genericError', { message: '' });
        }
        // A stop delivers SIGINT, which surfaces here as a KeyboardInterrupt.
        // Reporting the raw traceback for a stop the user asked for reads as a
        // crash, so say the same thing the other stop paths say.
        if (stopRequested) {
          // `debug`, not `log`: this is a diagnostic for an already-explained
          // stop (the line above the console says "stopped"), and it is the
          // difference between "the next run is instant" and "the next run
          // refetches Pyodide" — worth keeping, not worth printing for everyone.
          console.debug('[Code Runner] Stopped via SIGINT — the runtime stays loaded.');
          if (activeOutput) activeOutput.stderr(t('python.aborted'));
        } else if (activeOutput) {
          activeOutput.stderr(msg);
        }
        endRun();
        break;
      }
      default:
        break;
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      console.error('[Code Runner] Worker error:', e.message);
      if (activeOutput) activeOutput.stderr(t('worker.error', { message: e.message || 'Unknown error' }));
      endRun();
    };

    worker.postMessage({ type: 'init', sab, cdn: currentCdn });
    setLoading(true);

    // A stalled CDN fetch never rejects, so the Worker would sit in "loading"
    // for good and every run would queue behind it. Fail loudly instead, and
    // drop the Worker so the next run starts a clean attempt (the pieces the
    // browser already cached make the retry cheaper).
    loadTimer = window.setTimeout(() => {
      loadTimer = null;
      console.warn('[Code Runner] Pyodide did not load within ' + LOAD_TIMEOUT_MS + ' ms; giving up on this Worker.');
      if (activeOutput) activeOutput.stderr(t('python.loadTimeout'));
      worker?.terminate();
      worker = null;
      revokeBlob();
      setLoading(false);
      endRun();
    }, LOAD_TIMEOUT_MS);

    return worker;
  }

  function revokeBlob() {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }
  }

  /** Signal handlers and the interrupted run are cleared together. */
  function clearInterrupt() {
    if (interruptView && Atomics.load(interruptView, 0) !== 0) {
      Atomics.store(interruptView, 0, 0);
    }
  }

  function endRun() {
    if (killTimer !== null) {
      window.clearTimeout(killTimer);
      killTimer = null;
    }
    if (rearmTimer !== null) {
      window.clearInterval(rearmTimer);
      rearmTimer = null;
    }
    clearInterrupt();
    // Nulled before resolving: a late 'complete' after a stop must not resolve
    // the same run twice.
    const resolve = runResolve;
    runResolve = null;
    activeOutput = null;
    resolve?.();
  }

  function writeStdinToSAB(data: string) {
    if (!sab || !statusView || !lengthView || !dataView || !activeOutput) return;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const len = Math.min(bytes.length, MAX_STDIN_BYTES);
    if (bytes.length > len) {
      activeOutput.stderr(t('stdin.truncated', { n: MAX_STDIN_BYTES }));
    }
    dataView.set(bytes.subarray(0, len));
    Atomics.store(lengthView, 0, len);
    Atomics.store(statusView, 0, STATUS_READY);
    Atomics.notify(statusView, 0, 1);
  }

  const run = (code: string, output: Stdio): Promise<void> => {
    const inputStr = output.getStdin();
    const stdinLines = inputStr ? inputStr.split('\n') : [];

    return new Promise<void>((resolve) => {
      activeOutput = output;
      runResolve = resolve;
      stopRequested = false;

      // A stop that arrived while the Worker was busy (rather than parked on
      // statusView) leaves the abort sentinel set. Reset the handshake before
      // this run so it is not mistaken for input the user already supplied.
      if (statusView) Atomics.store(statusView, 0, STATUS_WAITING);
      if (lengthView) Atomics.store(lengthView, 0, 0);
      clearInterrupt();

      try {
        getWorker().postMessage({ type: 'run', code, stdinLines });
      } catch (e: unknown) {
        output.stderr(failureMessage(e) ?? errorText(e));
        endRun();
      }
    });
  };

  /** Tell every waiting block how many runs are still in front of it. */
  function announceQueue() {
    // A block that *leaves* the queue must be told so: notifying only the
    // blocks still in `waiting` left the one that just started running at
    // "1 ahead" for the whole run, which the UI showed as a permanent
    // "waiting for another block to finish" notice over a program that was in
    // fact running.
    const next = new Set(waiting);
    for (const output of queuedBlocks) {
      if (!next.has(output)) output.queued(0);
    }
    queuedBlocks = next;
    // Count what is really ahead: the run inside the Worker, if any, plus the
    // queued runs in front. (An idle first-in-line block has nothing ahead of
    // it, and saying otherwise made the notice flash on every run.)
    const running = activeOutput ? 1 : 0;
    waiting.forEach((output, i) => output.queued(i + running));
  }

  const backend: Backend & { dispose: () => void } = (code, output) => {
    waiting.push(output);
    announceQueue();
    const task = chain.then(() => {
      const at = waiting.indexOf(output);
      if (at >= 0) waiting.splice(at, 1);
      announceQueue();
      // Stopped while waiting for another block's run to finish.
      if (cancelled.delete(output)) return undefined;
      return run(code, output);
    });
    chain = task.then(dropOutcome, dropOutcome);
    return task;
  };

  backend.terminate = (output?: Stdio) => {
    // Stopping a block whose run has not started yet: drop it from the queue.
    const waitingAt = output ? waiting.indexOf(output) : -1;
    // `output &&` repeats what `waitingAt >= 0` already implies (an `undefined`
    // is never in `waiting`); it is there so the type-checker sees the element
    // being added is the one that was found, without an assertion to say so.
    if (output && waitingAt >= 0) {
      waiting.splice(waitingAt, 1);
      cancelled.add(output);
      announceQueue();
      return;
    }
    if (!activeOutput) return;
    // The stop belongs to another block (or was left over from a finished run).
    if (output && output !== activeOutput) return;

    const stopped = activeOutput;
    stopRequested = true;
    // Graceful stop: SIGINT unwinds a busy loop, the sentinel releases a run
    // parked inside Atomics.wait. Pyodide only reaches its next bytecode
    // boundary if it is actually running, so both are sent.
    if (interruptView) Atomics.store(interruptView, 0, SIGINT);
    if (statusView) {
      Atomics.store(statusView, 0, STATUS_ABORT);
      Atomics.notify(statusView, 0, 1);
    }

    // Pyodide clears the interrupt cell as soon as the signal handler reads
    // it, so one shot is not enough: a program that swallows KeyboardInterrupt
    // (`while True: try: pass except: pass`) would be unkillable again.
    if (killTimer === null) {
      rearmTimer = window.setInterval(() => {
        if (interruptView) Atomics.store(interruptView, 0, SIGINT);
      }, 250);

      // If the run does not end on its own, kill the Worker. That loses the
      // loaded Pyodide instance — the next run has to fetch ~10 MB again — so
      // it is the last resort, and both the log and the message say it happened.
      killTimer = window.setTimeout(() => {
        killTimer = null;
        if (!activeOutput) return;
        console.warn(`[Code Runner] SIGINT did not stop the program within ${STOP_GRACE_MS} ms — restarting the Python runtime (the next run reloads Pyodide).`);
        worker?.terminate();
        worker = null;
        revokeBlob();
        setLoading(false);
        stopped.stderr(t('python.abortedReload'));
        endRun();
      }, STOP_GRACE_MS);
    }
  };

  backend.dispose = () => {
    endRun();
    // This instance is being thrown away (a CDN change, or unload). Blocks
    // still queued on it would otherwise wait for a run on a runtime that no
    // longer exists, so cancel them: their chained tasks settle immediately and
    // their spinners stop.
    for (const output of waiting) cancelled.add(output);
    waiting.length = 0;
    queuedBlocks = new Set();
    if (loadTimer !== null) {
      window.clearTimeout(loadTimer);
      loadTimer = null;
    }
    worker?.terminate();
    worker = null;
    revokeBlob();
    setLoading(false);
    sab = null;
    statusView = null;
    lengthView = null;
    interruptView = null;
    dataView = null;
  };

  backend.loading = false;
  return backend;
}

// ── Public backend (delegates to the right runtime) ──
// `hasSAB` is a capability probe, so it is resolved once; the runtime itself is
// created lazily and rebuilt if the configured CDN changed since the last run.
let current: (Backend & { dispose: () => void }) | null = null;
let currentCdnBound: string | null = null;

const backend: Backend = async (code, output) => {
  if (!current || currentCdnBound !== currentCdn) {
    liveDispose?.();
    current = hasSAB ? createWorkerBackend() : createMainThreadBackend();
    liveDispose = () => current?.dispose();
    currentCdnBound = currentCdn;
    // `debug`: which of the two Python runtimes is in use decides what the
    // plugin can do (interactive input, stopping a run), so it is the first
    // thing to look for when a user reports either is missing.
    console.debug(hasSAB
      ? '[Code Runner] SAB detected — using Worker + SAB backend (pre-fill + interactive)'
      : '[Code Runner] SAB not available — using main-thread backend (pre-fill stdin)');
  }
  return current(code, output);
};

// Only the Worker runtime can be stopped: on the main thread a run occupies the
// UI thread, so offering a stop button there would be a lie.
if (hasSAB) {
  backend.terminate = (output?: Stdio) => current?.terminate?.(output);
}

backend.loading = false;

/**
 * Release the live runtime (called on plugin unload). A Worker holding a loaded
 * Pyodide would otherwise outlive the plugin that started it.
 */
export function disposePython(): void {
  liveDispose?.();
  liveDispose = null;
  current = null;
  currentCdnBound = null;
}

export default backend;
