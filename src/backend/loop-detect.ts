/**
 * loop-detect.ts — Recognise code shaped like a loop that never ends.
 *
 * Whether a program halts is undecidable in general, so nothing here can be
 * conclusive: it fires when the source has a deliberately-unbounded loop header
 * and nothing anywhere that could leave it. That is the shape of the
 * `while True: pass` that hangs a note until the user finds the stop button.
 *
 * The verdict chooses the *wording* of the running-too-long hint in
 * `run-watch.ts`; it never gates or delays a run. An earlier version asked for
 * confirmation before starting instead, which was worse on both counts: a
 * statement about code that is already running is simply more accurate ("it is
 * still going"), and it arrives while the user is watching the spinner rather
 * than interrupting the moment they wanted to start.
 *
 * Deliberately biased against false alarms — telling someone their program is
 * endless when it would have finished is worse than saying nothing. Anything
 * that might exit the loop (`break`, `return`, an exception, a call into the
 * runtime) suppresses it, as does reading stdin, since a loop that waits for
 * input can be answered.
 */

import { canonicalLang } from './languages/aliases';

/** Unconditional loop headers, per language. */
const UNBOUNDED_LOOP: Record<string, RegExp> = {
  python: /\bwhile\s*\(?\s*(?:True|1)\s*\)?\s*:/,
  c: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  cpp: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  java: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  csharp: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  js: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  ts: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
  kotlin: /\bwhile\s*\(\s*(?:true|1)\s*\)/,
  swift: /\bwhile\s+(?:true|1)\b/,
  go: /\bfor\s*\{/,
  rust: /\bloop\s*\{/,
  r: /\brepeat\s*\{/,
};

/**
 * Anything that could plausibly end the loop, or make waiting on it
 * intentional. Matched anywhere in the file: imprecise on purpose.
 */
const ESCAPE_OR_PURPOSE = new RegExp([
  '\\b(?:break|return|goto|raise|throw|panic|exit|quit|halt|abort|stop)\\b',
  // Reading stdin means the loop waits for the user rather than spinning.
  '\\b(?:input|readline|readlines|read|scanf|fgets|getchar|getline|scan|nextInt|nextLine|readLine|ReadLine|ReadKey|Scanln|Scanf|Scan)\\b',
].join('|'));

/** Comments are removed first so a `// break out later` cannot mask a real loop. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/#.*$/gm, ' ');
}

/**
 * Whether the code looks like it will run forever.
 *
 * @example
 * ```ts
 * looksInfinite('python', 'while True:\n    pass')          // => true
 * looksInfinite('python', 'while True:\n    break')         // => false
 * looksInfinite('python', 'while True:\n    input()')       // => false (waits for the user)
 * looksInfinite('python', 'for i in range(3):\n    print(i)') // => false
 * ```
 */
export function looksInfinite(lang: string, code: string): boolean {
  const header = UNBOUNDED_LOOP[canonicalLang(lang)];
  if (!header) return false;

  const clean = stripComments(code);
  return header.test(clean) && !ESCAPE_OR_PURPOSE.test(clean);
}
