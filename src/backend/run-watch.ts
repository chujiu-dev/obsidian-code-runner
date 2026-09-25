/**
 * run-watch.ts — Decide when a running block deserves a "this may be stuck"
 * line, and what that line should say.
 *
 * The spinner looks identical whether a program is looping, waiting on a slow
 * playground API, or half-way through a ten-second computation. This module
 * turns the clock into a verdict; `Play.tsx` owns the timers and the rendering.
 *
 * Kept as pure functions with no imports so the thresholds can be tested
 * directly — the wiring around them (SolidJS signals, `setInterval`) cannot be
 * checked outside a real Obsidian window, so the part that is *decidable* is
 * kept here.
 */

/** Enough time for any quick program to have finished. */
export const RUN_HINT_MS = 10_000;

/**
 * The same idea for runtimes the user cannot interrupt (remote playgrounds,
 * TypeScript). A slow compile is normal there, so waiting longer before
 * suggesting that something is wrong avoids crying wolf.
 */
export const RUN_HINT_SLOW_MS = 30_000;

/** Long enough that a program printing steadily is never called stuck. */
export const QUIET_MS = 4_000;

/**
 * How long a block may sit behind another before we suggest that the one in
 * front may be wedged. Deliberately generous: a legitimate long run should not
 * be accused of being stuck.
 */
export const QUEUE_HINT_MS = 120_000;

/** Which line to show. `null` means say nothing. */
export type RunHint = 'loop' | 'long' | 'loopNoStop' | 'longNoStop' | null;

/**
 * Verdict for a run that is currently the active one.
 *
 * Two independent triggers:
 * - the code has an unbounded loop and no way out of it, so say so — even while
 *   it is printing, since `while True: print(i)` is still endless;
 * - nothing has been printed for a while, which is what "stuck" actually looks
 *   like, whatever the cause.
 *
 * A loop the user cannot interrupt gets its own wording: telling them to press
 * a stop button that is not on screen would be worse than saying nothing.
 *
 * @param elapsedMs How long this block has been the active run — the caller
 *   must not count time spent queued or loading Pyodide, or a slow first run
 *   would be reported as a runaway program.
 * @param quietMs Time since the last output.
 * @param loopLike `looksInfinite(lang, code)` for the code being run.
 * @param stoppable Whether this block has a stop button at all (`canStop()`).
 */
export function runHint(state: {
  elapsedMs: number;
  quietMs: number;
  loopLike: boolean;
  stoppable: boolean;
}): RunHint {
  const threshold = state.stoppable ? RUN_HINT_MS : RUN_HINT_SLOW_MS;
  if (state.elapsedMs < threshold) return null;

  if (state.loopLike) return state.stoppable ? 'loop' : 'loopNoStop';
  if (state.quietMs < QUIET_MS) return null;
  return state.stoppable ? 'long' : 'longNoStop';
}

/**
 * Whether a block has been queued behind another for too long. This is the
 * backstop for the failure that started all of this: a stop that had to restart
 * the runtime left every later block queued behind a runtime that never became
 * ready, and nothing on screen said so.
 */
export function waitedTooLong(state: { waitingMs: number }): boolean {
  return state.waitingMs >= QUEUE_HINT_MS;
}
