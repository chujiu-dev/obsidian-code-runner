import './Play.scss';
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import { hasSAB, onPythonLoading } from '../backend/languages/python';
import Spin from './Spin';
import Term from './Term';
import Icon from './Icon';
import { needsStdin, extractInputPrompts, isInteractiveStdin, supportsStdin } from '../backend/stdin-detect';
import { looksInfinite } from '../backend/loop-detect';
import { runHint, waitedTooLong } from '../backend/run-watch';
import type { InputPrompt } from '../backend/stdin-detect';
import { t } from '../i18n';

function hashCode(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

interface CacheEntry {
  [code: string]: { lastAccessTime: number; outputs: string[] };
}

/** Cached output older than this is dropped when the cache is next written. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What to say for each verdict from `run-watch.ts`. A loop that cannot be
 * stopped gets a different sentence rather than an instruction to press a
 * button that is not on screen.
 */
const HINT_KEYS = {
  loop: 'ui.runningLongLoop',
  long: 'ui.runningLong',
  longNoStop: 'ui.runningLongNoStop',
  loopNoStop: 'ui.runningLongLoopNoStop',
} as const;

interface StdinHistoryItem { prompt: string; response: string; }

export default (props: {
  lang: string,
  code: string,
  sourcePath: string,
}) => {

  const cacheKey = () => `code-emitter-cache-${props.sourcePath}`;
  const codeSum = () => hashCode(props.code);
  const stdio = createStdio();
  const [outputs, setOuptuts] = createSignal<string[]>();

  // When this block last produced anything, for the stuck-run hint below:
  // "running for 40 seconds" only means something if nothing is coming out.
  let lastOutputAt = Date.now();
  let lastFigureCount = 0;

  stdio.subscribe((lines) => {
    lastOutputAt = Date.now();
    setOuptuts(lines);
  });

  const hasResult = () => (outputs()?.length ?? 0) > 0 || stdio.viewEl.hasChildNodes();

  const [running, setRunning] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [showInput, setShowInput] = createSignal(false);

  // ── Pre-fill stdin ──
  const [firstPrompt, setFirstPrompt] = createSignal<string | null>(null);

  // ── Non-SAB (tablet) fallback ──
  const [allPrompts, setAllPrompts] = createSignal<InputPrompt[]>([]);
  const [fieldValues, setFieldValues] = createSignal<string[]>([]);
  const [isInteractive, setIsInteractive] = createSignal(false);
  const [rawStdin, setRawStdin] = createSignal('');

  // ── Interactive stdin (Worker + SAB) ──
  const [stdinHistory, setStdinHistory] = createSignal<StdinHistoryItem[]>([]);
  const [interactivePrompt, setInteractivePrompt] = createSignal<string | null>(null);
  const [interactiveInput, setInteractiveInput] = createSignal('');
  // Runs still in front of this one, when blocks share a runtime.
  const [queueAhead, setQueueAhead] = createSignal(0);
  // True while the Python runtime is still being fetched. The spinner alone
  // cannot tell that apart from a program that is busy thinking, which is what
  // made a slow CDN look like a frozen plugin.
  const [runtimeLoading, setRuntimeLoading] = createSignal(false);

  // Registered here rather than in onMount below: onCleanup only works during
  // the component's synchronous body, and that onMount callback is async.
  onCleanup(onPythonLoading(setRuntimeLoading));

  const submitInteractiveStdin = () => {
    const val = interactiveInput();
    const prompt = interactivePrompt() || '';
    setStdinHistory(prev => [...prev, { prompt, response: val }]);
    stdio.provideStdin(val);
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  const cancelInteractiveStdin = () => {
    const prompt = interactivePrompt() || '';
    setStdinHistory(prev => [...prev, { prompt, response: '' }]);
    stdio.provideStdin('');
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  let interactiveInputRef: HTMLInputElement | undefined;

  /** Only Python has an interactive (worker) runtime; every other stdin-capable language is fed once, up front. */
  const isPython = () => props.lang === 'python';

  const showInputForm = () => {
    if (!supportsStdin(props.lang)) return;
    if (needsStdin(props.lang, props.code) && isPython()) {
      const parsed = extractInputPrompts(props.lang, props.code);
      if (hasSAB) {
        setFirstPrompt(parsed.length > 0 ? parsed[0].label : null);
      } else {
        const loop = isInteractiveStdin(props.lang, props.code);
        setIsInteractive(loop);
        setAllPrompts(parsed);
        if (loop) setRawStdin('');
        else setFieldValues(new Array(parsed.length).fill(''));
      }
    }
    setShowInput(true);
  };

  const run = async () => {
    if (needsStdin(props.lang, props.code)) {
      stdio.clear();
      if (!showInput()) {
        showInputForm();
        return;
      }
    }

    setRunning(true);
    setShowInput(false);
    // Decides the *wording* of the stuck-run hint, never whether the code runs.
    setLoopLike(looksInfinite(props.lang, props.code));

    if (!isPython()) {
      // Remote backends take the whole stdin stream in the compile request.
      // Sent unconditionally: the user can open the form for a program whose
      // input calls stdin-detect does not recognise (a C `getline`, say), and
      // silently dropping what they typed would be worse than sending nothing.
      const text = rawStdin();
      setStdinHistory(text
        ? text.split('\n').map((line, i) => ({ prompt: t('stdin.label.input', { n: i + 1 }), response: line }))
        : []);
      stdio.setStdin(text);
    } else if (needsStdin(props.lang, props.code)) {
      if (hasSAB) {
        const seedVal = input();
        const seedPrompt = firstPrompt();
        setStdinHistory(seedVal ? [{ prompt: seedPrompt || '', response: seedVal }] : []);
        stdio.setStdin(input());
      } else if (isInteractive()) {
        const lines = rawStdin().split('\n');
        const prompts = allPrompts();
        setStdinHistory(lines.map((line, i) => ({
          prompt: prompts[i]?.label || t('stdin.label.input', { n: i + 1 }),
          response: line,
        })));
        stdio.setStdin(rawStdin());
      } else {
        const values = fieldValues();
        const prompts = allPrompts();
        setStdinHistory(prompts.map((p, i) => ({ prompt: p.label, response: values[i] || '' })));
        stdio.setStdin(values.join('\n'));
      }
    }

    try {
      const engine = backend[props.lang];
      // Any previous queue hint is stale; the backend re-reports once this run
      // is actually queued.
      setQueueAhead(0);
      await engine(props.code, stdio);
    } finally {
      setRunning(false);
      setQueueAhead(0);
    }
  };

  const closeInput = () => {
    setShowInput(false);
    setInput('');
    setFirstPrompt(null);
    setAllPrompts([]);
    setFieldValues([]);
    setIsInteractive(false);
    setRawStdin('');
  };

  // Raw localStorage rather than App.loadLocalStorage: the latter needs a newer
  // Obsidian than this plugin's minAppVersion allows.
  const readFromCache = async (): Promise<string[] | undefined> => {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return undefined;
      const all = JSON.parse(raw) as CacheEntry;
      const entry = all[codeSum()];
      if (!entry) return undefined;
      // Touch on read, so a block the user keeps re-opening survives the
      // age-based pruning done on write.
      entry.lastAccessTime = Date.now();
      localStorage.setItem(cacheKey(), JSON.stringify(all));
      return entry.outputs;
    } catch {
      // A corrupt or unreadable cache is not worth failing a run over.
      return undefined;
    }
  };

  const writeToCache = () => {
    try {
      // Output is delivered to subscribers in batches, so the last few lines of
      // a run may still be sitting in the buffer — and those are exactly the
      // ones worth keeping when a run is abandoned mid-print.
      stdio.flush();
      const raw = localStorage.getItem(cacheKey());
      const all: CacheEntry = raw ? JSON.parse(raw) as CacheEntry : {};
      all[codeSum()] = { outputs: outputs() ?? [], lastAccessTime: Date.now() };

      // Without this the per-file cache only ever grew: every edit to a note
      // added another entry that was never read again.
      const cutoff = Date.now() - CACHE_MAX_AGE_MS;
      for (const key of Object.keys(all)) {
        if ((all[key]?.lastAccessTime ?? 0) < cutoff) delete all[key];
      }

      localStorage.setItem(cacheKey(), JSON.stringify(all));
    } catch (e) {
      console.warn('[Code Runner] Could not write the output cache:', e);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- SolidJS onMount accepts async callbacks; the Promise is fire-and-forget
  onMount(async () => {
    const r = await readFromCache();
    if (r) stdio.set(r);

    stdio.onStdinRequest((prompt: string) => {
      setInteractivePrompt(prompt);
      setInteractiveInput('');
      window.setTimeout(() => interactiveInputRef?.focus(), 0);
    });

    stdio.onQueued(setQueueAhead);
  });

  onCleanup(() => {
    // Leaving the note mid-run abandons the block. Without a stop, the Worker
    // stays parked waiting for input that can no longer arrive — until the 60s
    // timeout, after which it asks again — and every other block queues behind
    // it. Whatever ran so far is still worth keeping in the cache.
    if (running()) backend[props.lang]?.terminate?.(stdio);
    writeToCache();
  });

  /**
   * Only runtimes that can actually be interrupted offer a stop button — a
   * backend without `terminate` would just leave the spinner behind.
   */
  const canStop = () => typeof backend[props.lang]?.terminate === 'function';

  const stop = () => {
    // Pass this block's stdio: several blocks share one runtime, so the backend
    // needs to know which run (or queued run) the stop belongs to.
    backend[props.lang]?.terminate?.(stdio);
    setRunning(false);
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  // ── Stuck-run hint ──
  // The verdict lives in run-watch.ts (pure, and therefore testable); this is
  // only the clock. Time is counted from when this block became the executing
  // one, so a run queued behind another block — or waiting on the Pyodide
  // download — is never reported as a program that has been thinking too long.
  let activeSince = 0;
  let queuedSince = 0;
  const [watch, setWatch] = createSignal({ elapsedMs: 0, quietMs: 0, waitingMs: 0 });
  const [loopLike, setLoopLike] = createSignal(false);

  createEffect(() => {
    const active = running() && !runtimeLoading() && queueAhead() === 0;
    const queued = running() && queueAhead() > 0;

    if (active && activeSince === 0) {
      activeSince = Date.now();
      // Quiet counts from the start of the run, so a program that has printed
      // nothing at all reads as quiet rather than as never-quiet.
      lastOutputAt = activeSince;
    }
    if (!active) activeSince = 0;

    if (queued && queuedSince === 0) queuedSince = Date.now();
    if (!queued) queuedSince = 0;
  });

  createEffect(() => {
    if (!running()) {
      setWatch({ elapsedMs: 0, quietMs: 0, waitingMs: 0 });
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      // Matplotlib paints straight into viewEl and never goes through the
      // subscriber above, so a plotting program would otherwise look silent.
      const figures = stdio.viewEl.childElementCount;
      if (figures !== lastFigureCount) {
        lastFigureCount = figures;
        lastOutputAt = now;
      }
      setWatch({
        elapsedMs: activeSince ? now - activeSince : 0,
        quietMs: now - lastOutputAt,
        waitingMs: queuedSince ? now - queuedSince : 0,
      });
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  const hint = createMemo(() => runHint({
    elapsedMs: watch().elapsedMs,
    quietMs: watch().quietMs,
    loopLike: loopLike(),
    stoppable: canStop(),
  }));

  /** The hint counts seconds, so it ticks while it is on screen. */
  const hintText = () => {
    const verdict = hint();
    if (!verdict) return '';
    return t(HINT_KEYS[verdict], { n: Math.round(watch().elapsedMs / 1000), stop: t('ui.stop') });
  };

  const waitedSeconds = () => Math.round(watch().waitingMs / 1000);

  return <>
    <div class="code-emitter-block solid">
      <Show when={ !running() && !hasResult() && !showInput()}>
        <div class="code-emitter-actions">
          {/* Only languages that can be fed input get the input toggle. */}
          <Show when={supportsStdin(props.lang)}>
            <i aria-label={t('ui.toggleInput')} class="button-input-toggle" onClick={() => { if (showInput()) closeInput(); else showInputForm(); }} title={t('ui.toggleInput')}>
              <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="0.7em" height="0.6em" viewBox="0 0 160 112"><rect x="12" y="10" width="136" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="41" cy="36" r="7" fill="currentColor"/><circle cx="67" cy="36" r="7" fill="currentColor"/><circle cx="93" cy="36" r="7" fill="currentColor"/><circle cx="119" cy="36" r="7" fill="currentColor"/><circle cx="41" cy="58" r="7" fill="currentColor"/><circle cx="67" cy="58" r="7" fill="currentColor"/><circle cx="93" cy="58" r="7" fill="currentColor"/><circle cx="119" cy="58" r="7" fill="currentColor"/><rect x="41" y="72" width="78" height="14" rx="7" fill="currentColor"/></svg>
            </i>
          </Show>
          <i aria-label={t('ui.play')} class="button-play" onClick={() => { void run(); }}><Icon name="play"/></i>
        </div>
      </Show>

      <Show when={showInput()}>
        <hr class="code-seprator code-seprator-input"/>
        <div class="code-input-area">

          {/* Desktop: SAB single-field pre-fill */}
          <Show when={hasSAB && isPython()}>
            <div class="code-interactive-stdin">
              <span class="code-interactive-stdin-close" onClick={closeInput} title={t('ui.closeInput')}>
                <Icon name="clear"/>
              </span>
              <input
                class="code-interactive-stdin-input"
                placeholder={firstPrompt() || t('stdin.firstPromptPlaceholder')}
                value={input()}
                onInput={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { void run(); }
                }}
              />
              <i aria-label={t('ui.run')} class="code-prefill-run" onClick={() => { void run(); }} title={t('ui.run')}>
                <Icon name="play"/>
              </i>
            </div>
          </Show>

          {/* Everything but Python takes its input in one shot, up front. */}
          <Show when={!isPython()}>
            <div class="stdin-textarea-hint">
              {t('stdin.once.hint')}
            </div>
            <textarea
              class="code-emitter-input"
              rows={5}
              value={rawStdin()}
              onInput={(e) => setRawStdin(e.target.value)}
            />
            <div class="stdin-form-footer">
              <span class="code-interactive-stdin-close" onClick={closeInput} title={t('ui.closeInput')}>
                <Icon name="clear"/>
              </span>
              <i aria-label={t('ui.run')} class="code-prefill-run" onClick={() => { void run(); }} title={t('ui.run')}>
                <Icon name="play"/>
              </i>
            </div>
          </Show>

          {/* Tablet: sequential → labeled fields, interactive → textarea */}

          {/* Sequential (bounded): labeled multi-field form */}
          <Show when={!hasSAB && isPython() && !isInteractive()}>
            <div class="stdin-fields">
              {/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- SolidJS For callback types are not resolved by strict linting */}
              <For each={allPrompts()}>
                {(prompt, i) => (
                  <div class="stdin-field">
                    <span class="stdin-field-label">{prompt.label}</span>
                    <input
                      class="stdin-field-input"
                      placeholder={prompt.label}
                      value={fieldValues()[i()] || ''}
                      onInput={(e) => {
                        const vals = [...fieldValues()];
                        vals[i()] = e.target.value;
                        setFieldValues(vals);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { void run(); }
                      }}
                    />
                  </div>
                )}
              </For>
              {/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- re-enable rules after SolidJS For callback block */}
            </div>
            <div class="stdin-form-footer">
              <span class="code-interactive-stdin-close" onClick={closeInput} title={t('ui.closeInput')}>
                <Icon name="clear"/>
              </span>
              <i aria-label={t('ui.run')} class="code-prefill-run" onClick={() => { void run(); }} title={t('ui.run')}>
                <Icon name="play"/>
              </i>
            </div>
          </Show>

          {/* Interactive (loop): raw textarea */}
          <Show when={!hasSAB && isPython() && isInteractive()}>
            <div class="stdin-textarea-hint">
              {t('stdin.interactive.hint')}
            </div>
            <textarea
              class="code-emitter-input"
              rows={Math.max(5, allPrompts().length + 2)}
              placeholder={t('stdin.interactive.placeholder')}
              value={rawStdin()}
              onInput={(e) => setRawStdin(e.target.value)}
            />
            <div class="stdin-form-footer">
              <span class="code-interactive-stdin-close" onClick={closeInput} title={t('ui.closeInput')}>
                <Icon name="clear"/>
              </span>
              <i aria-label={t('ui.run')} class="code-prefill-run" onClick={() => { void run(); }} title={t('ui.run')}>
                <Icon name="play"/>
              </i>
            </div>
          </Show>

        </div>
      </Show>

      <Show when={running() || hasResult() }>
        <hr class="code-seprator"/>
        <div class="code-output">

          {/* Input history */}
          <Show when={stdinHistory().length > 0}>
            <div class="code-interactive-stdin-area">
              {/* eslint-disable @typescript-eslint/no-unsafe-member-access -- SolidJS For callback item types are not resolved by strict linting */}
              <For each={stdinHistory()}>
                {(item) => (
                  <div class="code-interactive-stdin-history">
                    <span class="stdin-history-prompt">{item.prompt}</span>
                    <span class="stdin-history-arrow">→</span>
                    <span class="stdin-history-response">{item.response}</span>
                  </div>
                )}
              </For>
              {/* eslint-enable @typescript-eslint/no-unsafe-member-access -- re-enable rule after SolidJS For callback block */}
            </div>
          </Show>

          {/* Interactive input popup */}
          <Show when={running() && interactivePrompt() !== null}>
            <div class="code-interactive-stdin">
              <span class="code-interactive-stdin-close" onClick={cancelInteractiveStdin} title={t('ui.cancelStdin')}>
                <Icon name="clear"/>
              </span>
              <input
                ref={interactiveInputRef}
                class="code-interactive-stdin-input"
                placeholder={interactivePrompt() || ''}
                value={interactiveInput()}
                onInput={(e) => setInteractiveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitInteractiveStdin();
                  if (e.key === 'Escape') cancelInteractiveStdin();
                }}
              />
              <i aria-label={t('ui.submit')} class="code-prefill-run" onClick={submitInteractiveStdin} title={t('ui.submit')}>
                <Icon name="play"/>
              </i>
            </div>
            <Show when={canStop()}>
              <div class="code-interactive-actions">
                <span></span>
                <button class="code-stop-button" onClick={stop} title={t('ui.terminate')}>
                  <Icon name="stop"/>
                  {t('ui.stop')}
                </button>
              </div>
            </Show>
          </Show>

          {/* Waiting for input(), queued behind another block, or just running */}
          <Show when={running() && interactivePrompt() === null}>
            <div class="loadding"><Spin/></div>
            {/* "Spinner forever" is the same picture whether the program is
                looping, queued, or the runtime is still downloading. */}
            <Show when={runtimeLoading()}>
              <div class="code-queue-hint">
                {t('python.loading')}
              </div>
            </Show>
            {/* All Python blocks share one runtime, so a second block waits its
                turn instead of interleaving its output with the first. */}
            <Show when={queueAhead() > 0}>
              <div class="code-queue-hint">
                {t('ui.queued', { n: queueAhead() })}
              </div>
            </Show>
            {/* Queued far longer than a run should take. The block in front may
                be wedged, and its own stop button is the only way out. */}
            <Show when={waitedTooLong({ waitingMs: watch().waitingMs })}>
              <div class="code-queue-hint">
                {t('ui.queuedLong', { n: waitedSeconds(), stop: t('ui.stop') })}
              </div>
            </Show>
            {/* Running far longer than it should. A line of text, not a dialog:
                whether a program halts is undecidable, so this is only ever a
                guess — see run-watch.ts for when it is allowed to speak. */}
            <Show when={hint() !== null && !runtimeLoading() && queueAhead() === 0}>
              <div class="code-queue-hint">
                {hintText()}
              </div>
            </Show>
            {/* Reachable while the program is busy — a busy loop never asks for
                input, which is exactly when a stop button matters most. */}
            <Show when={canStop()}>
              <div class="code-interactive-actions">
                <span></span>
                <button class="code-stop-button" onClick={stop} title={t('ui.terminate')}>
                  <Icon name="stop"/>
                  {t('ui.stop')}
                </button>
              </div>
            </Show>
          </Show>

          {/* Output + clear */}
          <Show when={!running() && hasResult()}>
            <Show when={stdinHistory().length > 0}>
              <hr class="code-input-output-divider"/>
            </Show>
            <div class="code-area-header">
              <span></span>
              <span class="button-area-close" onClick={() => { stdio.clear(); setStdinHistory([]); }} title={t('ui.clearOutput')}>
                <Icon name="clear"/>
              </span>
            </div>
            <div>{stdio.viewEl}</div>
            <Term lines={outputs()}/>
          </Show>
        </div>
      </Show>
    </div>
  </>;
};
