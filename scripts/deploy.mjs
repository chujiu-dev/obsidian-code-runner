#!/usr/bin/env node
/**
 * Copy the build artifacts into a vault, so testing does not mean dragging
 * three files through the file manager every time.
 *
 * The destination comes from VAULT_PLUGIN_DIR in `.env` (gitignored) — it is
 * never guessed, because writing into someone's vault is not something to get
 * wrong. Nothing here runs implicitly: `npm run build` only writes `dist/` and
 * `npm run deploy` is a separate, explicit step.
 *
 * Usage:
 *   VAULT_PLUGIN_DIR=E:/vault/.obsidian/plugins/code-runner  (in .env)
 *   npm run build && npm run deploy
 */

import { readFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env reader: KEY=VALUE, `#` comments, optional surrounding quotes. */
function readEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip matching surrounding quotes, if any.
    const quote = value[0];
    if ((quote === '"' || quote === '\'') && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = { ...readEnv(join(root, '.env')), ...process.env };
const target = env.VAULT_PLUGIN_DIR;

if (!target) {
  console.error([
    'VAULT_PLUGIN_DIR is not set.',
    '',
    'Add it to .env in the project root (that file is gitignored):',
    '',
    '  VAULT_PLUGIN_DIR=E:/path/to/vault/.obsidian/plugins/code-runner',
    '',
    'Nothing was copied.',
  ].join('\n'));
  process.exit(1);
}

const ARTIFACTS = ['main.js', 'styles.css', 'manifest.json'];
const missing = ARTIFACTS.filter(f => !existsSync(join(root, 'dist', f)));
if (missing.length > 0) {
  console.error(`dist/ is missing ${missing.join(', ')} — run "npm run build" first.`);
  process.exit(1);
}

const dest = resolve(target);
if (!dest.split(sep).join('/').includes('/.obsidian/')) {
  // A typo in .env should not scatter plugin files into a random folder.
  console.warn(`Warning: ${dest}\n  does not look like a path inside an .obsidian folder.`);
}

mkdirSync(dest, { recursive: true });

for (const file of ARTIFACTS) {
  const from = join(root, 'dist', file);
  copyFileSync(from, join(dest, file));
  const kb = (statSync(from).size / 1024).toFixed(1);
  console.log(`  ${file}  (${kb} kB)`);
}

console.log(`\nDeployed to ${dest}`);
console.log('Reload the plugin in Obsidian (Settings → Community plugins → toggle) to pick it up.');
