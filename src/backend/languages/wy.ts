import type { Backend, Stdio } from '..';
import { importLibrary } from '../net';
import js from './js';

/** The compiler, as an ES module with the API on its default export. */
type Wenyan = { compile: (code: string) => string };

/**
 * jsDelivr's `+esm` build of the same package unpkg serves as `index.min.js`.
 *
 * That file is a UMD bundle, and the branch it took under `import()` was
 * "assign myself to the global object" — it happened to produce a usable
 * `window.Wenyan`, i.e. the backend worked by side effect rather than by
 * contract, and a change to how the file is wrapped would have taken it away.
 * `+esm` exports the compiler deliberately, and the version is pinned here
 * (`+esm` is generated per version) so a new release cannot arrive unannounced.
 */
const WY_CDN = 'https://cdn.jsdelivr.net/npm/@wenyan/core@0.3.4/+esm';

export default (function (): Backend {
  let wenyan: Wenyan | null = null;
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
    wenyan = await importLibrary(
      WY_CDN, '文言 (wenyan)', 'compile',
      (module) => {
        const candidate = module as Wenyan | undefined;
        return typeof candidate?.compile === 'function' ? candidate : null;
      },
    );
    backend.loading = false;
    console.log('wenyan loaded.');
  };

  return backend;
})();
