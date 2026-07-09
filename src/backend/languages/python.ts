import type { Backend, Stdio } from '../';
import type { PyodideInterface } from 'pyodide';

if (typeof process !== 'undefined' && typeof process.browser === 'undefined') {
  process.browser = true;
}

const default_cdn = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

const setMplTarget = (target?: HTMLElement) => {
  if (target) {
    document['pyodideMplTarget'] = target;
  } else {
    delete document['pyodideMplTarget'];
  }
}

let cache: { cdn: string, backend: Backend } | null = null;

export default (function(props?: { cdn: string }) {
  const cdn = props?.cdn ?? default_cdn;

  if (cache?.cdn === cdn) {
    return cache.backend;
  }

  let engine: PyodideInterface | null = null;
  let stdio: Stdio | null = null;
  let load: (() => Promise<void>) | null = null;

  // Stdin buffer: shared between backend (writer) and stdin callback (reader)
  let stdinLines: string[] = [];
  let stdinIndex = 0;

  const backend: Backend = async (code, output) => {
    stdio = output;
    if (!engine) {
      await load();
    }
    try {
      // Reset stdin buffer from pre-provided input before each run
      const inputStr = output.getStdin();
      stdinLines = inputStr ? inputStr.split('\n') : [];
      stdinIndex = 0;

      setMplTarget(output.viewEl);
      await engine.runPythonAsync(code);
    } catch (e) {
      output.stderr(e);
    } finally {
      setMplTarget(undefined);
    }
  };
  backend.loading = true;
  load = async () => {
    const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs');
    engine = await pyodideModule.loadPyodide({
      stdin: () => {
        if (stdinIndex < stdinLines.length) {
          return stdinLines[stdinIndex++] + '\n';
        }
        return '\n';
      },
      indexURL: cdn,
      stdout: (s) => stdio?.stdout(s),
      stderr:(s) => stdio?.stderr(s)
    });
    await engine.loadPackage('micropip');
    console.log('python loaded.');
    backend.loading = false;
  };

  cache = {
    cdn,
    backend
  };

  return backend;
})();
