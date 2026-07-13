import type { Backend, Stdio } from '../';
import { extractInputPrompts } from '../stdin-detect';

const default_cdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

// ── Pyodide type definitions ──
interface PyodideEngine {
  runPythonAsync(code: string): Promise<void>;
  loadPackage(name: string): Promise<void>;
  setStdout(options: { raw?: (ch: number) => void; batched?: (s: string) => void }): void;
  setStderr(options: { raw?: (ch: number) => void; batched?: (s: string) => void }): void;
  globals: {
    get(name: string): unknown;
    set(name: string, value: unknown): void;
  };
}

// ── Worker message types ──
interface WorkerMessage {
  type: 'stdout' | 'stderr' | 'stdin' | 'complete' | 'error' | 'ready';
  text?: string;
  error?: string;
  interactive?: boolean;
  prompt?: string;
}

// ── SAB detection (module init, runs once) ──
const hasSAB = (() => {
  try { new SharedArrayBuffer(1); return true; }
  catch { return false; }
})();
export { hasSAB };

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
    'var dataView = null;',
    '',
    // Called from Python via `from js import waitForInteractiveStdin as _wait_stdin`.
    // Blocks the Worker on Atomics.wait until the main thread provides input via SAB.
    // The prompt string is forwarded to the main thread so it can be displayed in the UI.
    'function waitForInteractiveStdin(prompt) {',
    '  if (!sab) return "";',
    '  self.postMessage({ type: "stdin", interactive: true, prompt: prompt || "" });',
    '  var outcome = Atomics.wait(statusView, 0, 0, 60000);',
    // Timeout after 60s: re-request (prompt will flash again in UI)
    '  if (outcome === "timed-out") {',
    '    return waitForInteractiveStdin(prompt);',
    '  }',
    '  var len = Atomics.load(lengthView, 0);',
    '  var result = "";',
    '  if (len > 0) {',
    '    var bytes = new Uint8Array(sab, 8, len);',
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
    '    self.postMessage({ type: "error", error: "Failed to load Pyodide: " + (e.message || String(e)) });',
    '    return;',
    '  }',
    '  self.loadPyodide({ indexURL: cdn }).then(function(eng) {',
    '    pyodide = eng;',
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
    '    self.postMessage({ type: "error", error: "Pyodide init failed: " + (e.message || String(e)) });',
    '  });',
    '}',
    '',
    // Two-step execution: first replace builtins.input, then run user code.
    // Pre-filled lines are consumed first; when exhausted, waitForInteractiveStdin
    // blocks the Worker until the user types something in the Obsidian UI.
    'function runCode(code, stdinLines) {',
    '  if (!pyodide) {',
    '    self.postMessage({ type: "error", error: "Pyodide not initialized" });',
    '    return;',
    '  }',
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
    '    self.postMessage({ type: "error", error: e.message || String(e) });',
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
    '      dataView = new Uint8Array(sab, 8);',
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

// ── Main-thread Pyodide engine (singleton) ──
let engine: PyodideEngine | null = null;
let enginePromise: Promise<PyodideEngine> | null = null;

async function getEngine(cdn: string): Promise<PyodideEngine> {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    console.log('[Code Runner] Loading Pyodide on main thread...');
     
    const g = window as unknown as Record<string, unknown>;
    const savedProcess = g.process;
    g.process = { browser: true };

    try {
      const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs') as { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideEngine> };
      engine = await mod.loadPyodide({ indexURL: cdn });
    } finally {
      g.process = savedProcess;
    }

    await engine.loadPackage('micropip');
    console.log('[Code Runner] Pyodide ready.');
    return engine;
  })();

  return enginePromise;
}

// ── Main-thread backend (fallback, always available) ──
function createMainThreadBackend(cdn: string): Backend {
  const backend: Backend = async (code, output) => {
    try {
      const eng = await getEngine(cdn);

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
      const setupCode = [
        '__stdin_lines = ' + linesJson,
        '__stdin_prompts = ' + promptsJson,
        '__stdin_idx = [0]',
        '__stdin_empty = [0]',
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
        '        _desc = f"第{_n}个输入（\'{_label}\'）" if _label else f"第{_n}个输入"',
        '        _msg = (',
        '            "预输入数据不完整！" + _desc + "缺少预填数据。\\n"',
        '            "已消耗 " + str(len(__stdin_lines)) + " 行预填数据，程序继续请求输入（已连续10次空输入）。\\n"',
        '            "请在输入框中补充更多行数据后重新运行。\\n\\n"',
        '            "Insufficient stdin! " + _desc + " lacks pre-filled data.\\n"',
        '            "Exhausted " + str(len(__stdin_lines)) + " pre-filled lines, "',
        '            "program continues requesting input (10 consecutive empty returns).\\n"',
        '            "Please add more lines and re-run."',
        '        )',
        '        raise RuntimeError("".join(_msg))',
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
        output.stderr('[Setup Error] ' + (e instanceof Error ? e.message : String(e)));
        return;
      }

      // ── Step 2: Inject input replacement from JavaScript ──
      try {
        const myInput = eng.globals.get('__my_input');
        if (!myInput) {
          output.stderr('[Setup Error] Failed to inject input replacement');
          return;
        }
        eng.globals.set('input', myInput);
      } catch (e: unknown) {
        output.stderr('[Setup Error] ' + (e instanceof Error ? e.message : String(e)));
        return;
      }

      // ── Step 3: Run user code ──
      try {
        await eng.runPythonAsync(code);
      } catch (e: unknown) {
        output.stderr(e instanceof Error ? e.message : String(e));
      }
      // Force-flush stdout buffer for output without trailing newline
      try { await eng.runPythonAsync('print()'); } catch {}
    } catch (e: unknown) {
      output.stderr(e instanceof Error ? e.message : String(e));
    } finally {
       
      delete (activeDocument as unknown as Record<string, unknown>)['pyodideMplTarget'];
    }
  };

  backend.loading = false;
  return backend;
}

// ── Worker + SAB backend (interactive capable, requires SAB) ──
function createWorkerBackend(cdn: string): Backend {
  let worker: Worker | null = null;
  let sab: SharedArrayBuffer | null = null;
  let statusView: Int32Array | null = null;
  let lengthView: Int32Array | null = null;
  let dataView: Uint8Array | null = null;

  // Per-run state
  let currentOutput: Stdio | null = null;
  let stdinLines: string[] = [];
  let stdinIndex = 0;
  let stdinEmptyCount = 0;
  let runResolve: (() => void) | null = null;

  function getWorker(): Worker {
    if (worker) return worker;

    const src = workerSource();
    const blob = new Blob([src], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);

    sab = new SharedArrayBuffer(4096);
    statusView = new Int32Array(sab, 0, 1);
    lengthView = new Int32Array(sab, 4, 1);
    dataView = new Uint8Array(sab, 8);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as WorkerMessage;
      switch (data.type) {
      case 'stdout':
        if (currentOutput && data.text) currentOutput.stdout(data.text);
        break;
      case 'stderr':
        if (currentOutput && data.text) currentOutput.stderr(data.text);
        break;
      case 'stdin':
        // __my_input in Python already consumed pre-fill lines internally.
        // Any stdin message from the Worker is a real interactive request
        // (waitForInteractiveStdin always sends interactive:true).
        if (data.interactive && currentOutput) {
          const prompt = data.prompt || '';
          currentOutput.requestStdin(prompt).then((input: string) => {
            writeStdinToSAB(input);
          }).catch(() => {
            writeStdinToSAB('');
          });
        } else if (stdinIndex < stdinLines.length) {
          // Legacy path: should not normally be reached with current Worker code.
          stdinEmptyCount = 0;
          writeStdinToSAB(stdinLines[stdinIndex++]);
        } else {
          stdinEmptyCount++;
          if (stdinEmptyCount >= 10) {
            if (currentOutput) currentOutput.stderr(
              '⚠️ 预输入数据不完整！已消耗所有 ' + stdinLines.length + ' 行预填数据。\n' +
                '程序继续请求输入（已连续10次空输入）。\n' +
                '请在输入框中补充更多行数据后重新运行。\n\n' +
                'Insufficient stdin! Exhausted all ' + stdinLines.length + ' pre-filled lines.\n' +
                'Please add more lines and re-run.'
            );
            runResolve?.();
            return;
          }
          writeStdinToSAB('');
        }
        break;
      case 'complete':
        runResolve?.();
        break;
      case 'error':
        if (currentOutput && data.error) currentOutput.stderr(data.error);
        runResolve?.();
        break;
      default:
        break;
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      console.error('[Code Runner] Worker error:', e.message);
      if (currentOutput) currentOutput.stderr('Worker error: ' + (e.message || 'Unknown error'));
      runResolve?.();
    };

    worker.postMessage({ type: 'init', sab, cdn });
    return worker;
  }

  function writeStdinToSAB(data: string) {
    if (!sab || !statusView || !lengthView || !dataView) return;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const len = Math.min(bytes.length, 4088);
    dataView.set(bytes.subarray(0, len));
    Atomics.store(lengthView, 0, len);
    Atomics.store(statusView, 0, 1);
    Atomics.notify(statusView, 0, 1);
  }

  const backend: Backend = async (code, output) => {
    currentOutput = output;
    const inputStr = output.getStdin();
    stdinLines = inputStr ? inputStr.split('\n') : [];
    stdinIndex = 0;
    stdinEmptyCount = 0;

    return new Promise<void>((resolve) => {
      runResolve = resolve;

      try {
        const w = getWorker();
        w.postMessage({ type: 'run', code, stdinLines });
      } catch (e: unknown) {
        output.stderr(e instanceof Error ? e.message : String(e));
        resolve();
      }
    });
  };

  backend.terminate = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (runResolve) {
      runResolve();
      runResolve = null;
    }
  };

  backend.loading = false;
  return backend;
}

// ── Export (auto-selects best backend) ──
let cache: { cdn: string; backend: Backend } | null = null;

export default (function (props?: { cdn: string }) {
  const cdn = props?.cdn ?? default_cdn;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- TypeScript narrows cache to non-null after guard; the return type is Backend
  if (cache !== null && cache.cdn === cdn) return cache.backend;

  let backend: Backend;
  if (hasSAB) {
    console.log('[Code Runner] SAB detected — using Worker + SAB backend (pre-fill + interactive)');
    backend = createWorkerBackend(cdn);
  } else {
    console.log('[Code Runner] SAB not available — using main-thread backend (pre-fill stdin)');
    backend = createMainThreadBackend(cdn);
  }

  cache = { cdn, backend };
  return backend;
})();
