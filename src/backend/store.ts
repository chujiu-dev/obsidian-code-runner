import { t } from '../i18n';

export type Message = string;
export type Stdio = ReturnType<typeof createStdio>;

/**
 * How many output lines are kept. Older ones are dropped from the top and
 * replaced by a one-line notice.
 *
 * Every retained line is one `<li>` in the DOM and one entry in the output
 * cache, and a runaway `while True: print(i)` produces six figures of lines in
 * a few seconds. Without a ceiling the renderer stops drawing entirely — which
 * also hides the "this looks like an endless loop" hint, i.e. the very message
 * that would tell the user how to get out of the loop.
 */
export const MAX_OUTPUT_LINES = 5000;

/**
 * While output is streaming, subscribers are notified at most this often.
 *
 * Notifying per line made each printed line cost O(lines so far) — both here
 * (a fresh array per line) and in every subscriber — so a fast loop degraded
 * into seconds of blocked main thread. 100 ms is well under the threshold where
 * output looks like it stopped arriving.
 */
const FLUSH_MS = 100;

export function createStdio<T = Message>() {
  // Retained lines are outputs[head .. outputs.length - 1]. The array is only
  // compacted when `head` grows past its own size, so appending stays O(1)
  // even while lines are being dropped every single time.
  let outputs: T[] = [];
  let head = 0;
  let dropped = 0;
  let subscribers: ((m: T[]) =>  void)[] = [];
  let stdinData = '';
  let flushTimer: number | null = null;
  let dirty = false;

  // A fresh array every time: subscribers (and Solid's <For>) only re-render
  // when the value they are handed is a new reference.
  const snapshot = (): T[] => {
    const kept = outputs.slice(head);
    if (dropped === 0) return kept;
    return [t('output.truncated', { n: dropped, max: MAX_OUTPUT_LINES }) as unknown as T, ...kept];
  };

  const notify = () => {
    dirty = false;
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    const snap = snapshot();
    for (const s of subscribers) {
      s(snap);
    }
  };

  const scheduleFlush = () => {
    dirty = true;
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      if (dirty) notify();
    }, FLUSH_MS);
  };

  /** Deliver whatever is buffered right now (used before reading `outputs()`). */
  const flush = () => {
    if (dirty) notify();
  };

  const append = (msg: T) => {
    outputs.push(msg);
    const excess = outputs.length - head - MAX_OUTPUT_LINES;
    if (excess > 0) {
      head += excess;
      dropped += excess;
      if (head >= MAX_OUTPUT_LINES) {
        outputs = outputs.slice(head);
        head = 0;
      }
    }
    scheduleFlush();
  };

  const update = (setter: (prev: T[]) => T[]) => {
    const next = setter(outputs.slice(head));
    head = 0;
    dropped = 0;
    // A restored cache can be longer than the cap (it was written by an older
    // version, or by a run that predates the cap), so trim it on the way in as
    // well — otherwise the tail arrives in the DOM unguarded.
    const excess = next.length - MAX_OUTPUT_LINES;
    outputs = excess > 0 ? next.slice(excess) : next;
    dropped = Math.max(0, excess);
    dirty = true;
    notify();
  };

  const set = (value: T[]) => {
    update(() => value);
  };

  const write = (...data: T[]) => {
    append(data.join(',') as unknown as T);
  };

  const stderr = (...data: T[]) => {
    append(data.join(',') as unknown as T);
  };

  // `createDiv()` (Obsidian's helper) rather than `createElement('div')`: same
  // detached element, but it is the API the community review asks for. It must
  // stay detached — this is the target `matplotlib` renders into.
  const viewEl = createDiv();
  const clear = () => {
    set([]);
    viewEl.empty();
  };

  const subscribe = (subscriber: (outputs: T[]) =>  void) => {
    subscribers.push(subscriber);
    return () => {
      subscribers = subscribers.filter(s => s !== subscriber);
    };
  };

  const setStdin = (data: string) => {
    stdinData = data;
  };

  const getStdin = () => stdinData;

  // Interactive stdin: called by the Python backend when the Web Worker
  // requests real-time user input via SharedArrayBuffer.
  let stdinResolver: ((data: string) => void) | null = null;
  let stdinSubscribers: ((prompt: string) => void)[] = [];

  const requestStdin = async (prompt: string): Promise<string> => {
    // Notify UI subscribers to show the interactive input field.
    for (const s of stdinSubscribers) {
      s(prompt);
    }
    return new Promise<string>((resolve) => {
      stdinResolver = resolve;
    });
  };

  const provideStdin = (data: string) => {
    if (stdinResolver) {
      stdinResolver(data);
      stdinResolver = null;
    }
  };

  const onStdinRequest = (cb: (prompt: string) => void) => {
    stdinSubscribers.push(cb);
    return () => {
      stdinSubscribers = stdinSubscribers.filter(s => s !== cb);
    };
  };

  // Queue position, for blocks waiting behind another run on the same runtime
  // (all Python blocks share one Worker). `ahead` counts the runs still in
  // front, so 0 means "running now".
  let queueSubscribers: ((ahead: number) => void)[] = [];

  const queued = (ahead: number) => {
    for (const s of queueSubscribers) {
      s(ahead);
    }
  };

  const onQueued = (cb: (ahead: number) => void) => {
    queueSubscribers.push(cb);
    return () => {
      queueSubscribers = queueSubscribers.filter(s => s !== cb);
    };
  };


  return {
    subscribe,
    write,
    viewEl,
    stdout: write,
    stderr,
    clear,
    update,
    set,
    flush,
    setStdin,
    getStdin,
    requestStdin,
    provideStdin,
    onStdinRequest,
    queued,
    onQueued,
  };
}
