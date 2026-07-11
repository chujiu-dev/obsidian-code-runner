import type { Backend, Stdio } from '..';
import js from './js';

export default (function (): Backend {
  let wenyan: {
    compile: (code: string) => string
  } | null = null;
  let load: (() => Promise<void>) | null = null;
  const backend: Backend = async function(code: string, stdio: Stdio): Promise<void> {
    if (!wenyan) {
      await load?.();
    }
    const jsCode = wenyan!.compile(code);
    console.log('wenyan:');
    console.log(jsCode);
    await js(`(async () => { ${jsCode} })();`, stdio);
  };
  backend.loading = true;

  load = async () => {
     
    await import('https://unpkg.com/@wenyan/core/index.min.js');
     
    wenyan = window.Wenyan as { compile: (code: string) => string };
    backend.loading = false;
    console.log('wenyan loaded.');
  };

  return backend;
})();
