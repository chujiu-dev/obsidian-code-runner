/**
 * skeleton.ts — Put an incomplete snippet inside a runnable program.
 *
 * The decision of *what* to add is `skeleton-rules.ts`; this module is the
 * backend wrapper around it, so the completion happens in one place — the
 * language registry — and reaches every caller (`Play.tsx`'s run button and
 * `main.tsx`'s `api.execute`) without either of them knowing about it.
 *
 * Doing it at the call sites instead would break three things that read the
 * user's *original* text: `CodeBlock.tsx` renders it into the `<code>` element,
 * the output cache is keyed on its hash, and `loop-detect.ts` looks for the
 * endless loop in it.
 *
 * The notice is written to the output before the program runs, so it is the
 * first line the user reads, and it carries the code that was actually sent —
 * which is what makes the shifted line numbers in compiler diagnostics
 * recoverable (`skeleton-rules.ts` explains why no `#line` directive is used).
 */

import type { Backend } from './index';
import type { Stdio } from './store';
import { escapeHtml } from './util';
import { t } from '../i18n';
import { buildSkeleton, type SkeletonResult } from './skeleton-rules';

/** The languages `skeleton-rules.ts` knows how to complete; re-exported so the
 *  registry has one import for the whole feature. */
export { SKELETON_LANGS } from './skeleton-rules';

/** How many added pieces the collapsed line names before it stops counting. */
const MAX_SHOWN = 4;

/** The one-line, expandable notice. Escaped: `Term` renders this with innerHTML. */
function formatNotice(result: SkeletonResult): string {
  const addition = result.added.length > MAX_SHOWN
    ? [...result.added.slice(0, MAX_SHOWN), `…+${result.added.length - MAX_SHOWN}`].join(' ')
    : result.added.join(' ');
  const label = escapeHtml(t('skeleton.notice', { added: addition }));
  // Newlines encoded rather than emitted: `Term` only treats a single-line
  // `<details>…</details>` as markup, and it splits on lines.
  const code = escapeHtml(result.code).replace(/\n/g, '&#10;');
  return `<details class="code-runner-skeleton"><summary>${label}</summary><pre>${code}</pre></details>`;
}

let enabled = true;

/** Turn the feature off entirely (`Play.tsx` is untouched either way). */
export function setSkeletonEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Wrap a backend so that an incomplete snippet is completed before it is run.
 *
 * `terminate` and `loading` are copied across: `Play.tsx` decides whether to
 * offer a stop button by asking the registry for `terminate`, and the
 * TypeScript backends flip `loading` at load time, so a snapshot would go
 * stale.
 */
export function withSkeleton(lang: string, backend: Backend): Backend {
  const completed = (async (code: string, output: Stdio) => {
    // Read `enabled` now, not at wrap time: the setting changes at runtime.
    const result = enabled ? buildSkeleton(lang, code) : null;
    if (result) output.write(formatNotice(result));
    await backend(result ? result.code : code, output);
  }) as Backend;

  if (backend.terminate) completed.terminate = backend.terminate;
  if (backend.loading !== undefined) {
    Object.defineProperty(completed, 'loading', { get: () => backend.loading, enumerable: true });
  }
  return completed;
}
