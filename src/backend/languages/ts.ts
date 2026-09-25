import type { Backend, Stdio } from '..';
import type * as typescript from 'typescript';

import { importLibrary } from '../net';
import js from './js';

/**
 * jsDelivr's `+esm` build, not `lib/typescript.min.js`.
 *
 * The plain file is the CommonJS/UMD bundle. Imported as a module it exports
 * **nothing** — `module.exports = ts` sits behind a `typeof module` guard, and
 * there is no CommonJS loader in a browser — so the import resolved to an empty
 * namespace and `window.ts` was never created. `+esm` is that same 4.7.4
 * compiler wrapped as a real ES module whose default export is the `ts`
 * namespace (`export { k7 as default }`).
 */
const TS_CDN = 'https://cdn.jsdelivr.net/npm/typescript@4.7.4/+esm';

export default (function (): Backend {
  let tsc: typeof typescript | null = null;
  let load: (() => Promise<void>) | null = null;
  const backend: Backend = async function(code: string, stdio: Stdio): Promise<void> {
    if (!tsc) {
      await load?.();
    }
    const jsCode = tsc.transpile(`(async () => { ${code} })();`, {
      module: tsc.ModuleKind.ESNext,
      target: tsc.ScriptTarget.ES2018
    });
    await js(jsCode, stdio);
  };
  backend.loading = true;

  load = async () => {
    tsc = await importLibrary(
      TS_CDN, 'TypeScript', 'transpile',
      (module) => {
        const candidate = module as typeof typescript | undefined;
        return typeof candidate?.transpile === 'function' ? candidate : null;
      },
    );
    backend.loading = false;
  };

  return backend;
})();
