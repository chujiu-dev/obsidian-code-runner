import { defineConfig, UserConfig, Plugin, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
// Replaces the deprecated 'builtin-modules' package with a static list of Node.js built-in modules
const builtins: readonly string[] = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'test', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
];
import * as fsp from 'fs/promises';
import { normalize } from 'path';
import { rm } from 'fs/promises';
import { exec } from 'child_process';




/**
 * The name rollup gave an asset, for `assetFileNames`.
 *
 * Read off a local shape rather than `PreRenderedAsset`, whose `name` the
 * rollup typings mark deprecated in favour of `names`: vite's own
 * `vite:css-post` calls this hook with a hand-built
 * `{ type, name, originalFileName, source }` — no `names` at all — so reading
 * only `names` fails the build with "Cannot read properties of undefined".
 * `name` first, `names` kept as the fallback for whichever rollup drops it.
 */
const assetName = (asset: { name?: string; names?: string[] }): string =>
  asset.name ?? asset.names?.[0] ?? '';

// https://vitejs.dev/config/
export default  defineConfig(async ({ mode } ) => {

  const prod = mode === 'production';
  let { OUT_DIR } = loadEnv(mode, process.cwd(), ['OUT_']);

  OUT_DIR = normalize(OUT_DIR);
  if (OUT_DIR != 'dist' && OUT_DIR != path.join(process.cwd(), 'dist')) {
    await rm('dist', { recursive: true, force: true });
    exec(process.platform === 'win32' ? `mklink /J dist ${OUT_DIR}` : `ln -s ${OUT_DIR} dist`);
  }

  const inject = (files: string[]): Plugin => {
    if (files && files.length > 0) {
      return {
        name: 'inject-code',
        async load(this, id, _options?) {
          const info = this.getModuleInfo(id);
          if (info.isEntry) {
            const code = await fsp.readFile(id, 'utf-8');
            // Called as `path.*` rather than destructured: the review's lint
            // reads a method separated from its object as an unbound `this`.
            const dir = path.dirname(id);
            const inject_code = files
              .map(v => path.relative(dir, v))
              .map(p => path.join('./', path.basename(p, path.extname(p))))
              .map(p => `import './${p}'`).join(';');
            return `
            ${inject_code};
            ${code}
            `;
          }
        },
      };
    }
  };

  return {
    plugins: [
      solidPlugin({
        // babel: {
        //   plugins: ['solid-styled-jsx/babel']
        // }
      }),
      viteStaticCopy({
        targets: [{
          src: 'manifest.json',
          dest: '.'
        }]
      }),
      prod ? undefined : inject(['src/hmr.ts'])
    ],
    build: {
      lib: {
        entry: 'src/main.tsx',
        name: 'main',
        fileName: (_) => 'main.js',
        formats: ['cjs'],
      },
      minify: prod,
      sourcemap: prod ? false : 'inline',
      cssCodeSplit: false,
      // outDir: '',
      rollupOptions: {
        output: {
          exports: 'named',
          assetFileNames: (v) => {
            const name = assetName(v);
            return name === 'style.css' ? 'styles.css' : name;
          }
        },
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/closebrackets',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/comment',
          '@codemirror/fold',
          '@codemirror/gutter',
          '@codemirror/highlight',
          '@codemirror/history',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/matchbrackets',
          '@codemirror/panel',
          '@codemirror/rangeset',
          '@codemirror/rectangular-selection',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/stream-parser',
          '@codemirror/text',
          '@codemirror/tooltip',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
          ...builtins
        ],
      }
    }
  } satisfies UserConfig;
});
