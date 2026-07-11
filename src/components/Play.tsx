import './Play.scss';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import Spin from './Spin';
import Term from './Term';
import Icon from './Icon';
import { needsStdin, extractInputPrompts } from '../backend/stdin-detect';
import type { InputPrompt } from '../backend/stdin-detect';

/** Simple djb2 string hash for cache keys (replaces crypto-js/md5). */
function hashCode(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

interface CacheEntry {
  [code: string]: {
      lastAccessTime: number,
      outputs: string[]
  }
}

export default (props: {
  lang: string,
  code: string,
  sourcePath: string,
}) => {

  const cacheKey = () => `code-emitter-cache-${props.sourcePath}`;
  const codeSum = () => hashCode(props.code);
  const stdio = createStdio();
  const [outputs, setOuptuts] = createSignal<string[]>();
  stdio.subscribe(setOuptuts);

  const hasResult = () => outputs()?.length > 0 || stdio.viewEl.hasChildNodes();

  const [running, setRunning] = createSignal(false);
  const [input, setInput] = createSignal('');
  const [showInput, setShowInput] = createSignal(false);

  // ── Pre-fill stdin (first input only, styled like interactive popup) ──
  /** First prompt label used as placeholder, null = no prompt parsed */
  const [firstPrompt, setFirstPrompt] = createSignal<string | null>(null);

  // ── Interactive stdin (Worker + SAB backend) ──
  /** Accumulated history of prompt→response pairs (cleared each run). */
  interface StdinHistoryItem { prompt: string; response: string }
  const [stdinHistory, setStdinHistory] = createSignal<StdinHistoryItem[]>([]);
  /** Current prompt from a live input() call, null = no interactive input pending */
  const [interactivePrompt, setInteractivePrompt] = createSignal<string | null>(null);
  /** Current value of the interactive input field */
  const [interactiveInput, setInteractiveInput] = createSignal('');

  /** Record current interaction to history and unblock Worker. */
  const submitInteractiveStdin = () => {
    const val = interactiveInput();
    const prompt = interactivePrompt() || '';
    setStdinHistory(prev => [...prev, { prompt, response: val }]);
    stdio.provideStdin(val);
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  /** Cancel: record empty response and unblock Worker. */
  const cancelInteractiveStdin = () => {
    const prompt = interactivePrompt() || '';
    setStdinHistory(prev => [...prev, { prompt, response: '' }]);
    stdio.provideStdin('');
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  /** Ref to the interactive <input> so we can auto-focus it each time it appears. */
  let interactiveInputRef: HTMLInputElement | undefined;

  /** Pre-fill value: one line for the first input(). */
  const getStdinValue = (): string => input();

  /** Parse only the first prompt, show single-field pre-fill (matching interactive popup style). */
  const showInputWithFirstPrompt = () => {
    if (needsStdin(props.lang, props.code) && props.lang === 'python') {
      const parsed = extractInputPrompts(props.lang, props.code);
      setFirstPrompt(parsed.length > 0 ? parsed[0].label : null);
    }
    setShowInput(true);
  };

  const run = async () => {
    // Auto-show the pre-fill form when stdin is needed.
    if (needsStdin(props.lang, props.code)) {
      stdio.clear();
      if (props.lang !== 'python') {
        stdio.write(
          'This program requires stdin input which is currently only supported for Python.\n' +
          '本程序需要标准输入，目前仅支持 Python。'
        );
        return;
      }

      // First click: show the single-field pre-fill form but DON'T execute yet.
      if (!showInput()) {
        showInputWithFirstPrompt();
        return;
      }
    }

    setRunning(true);
    setShowInput(false);
    // Seed history with first pre-fill entry for visual continuity with later popups
    const seedVal = input();
    const seedPrompt = firstPrompt();
    if (seedVal) {
      setStdinHistory([{ prompt: seedPrompt || '', response: seedVal }]);
    } else {
      setStdinHistory([]);
    }
    try {
      stdio.setStdin(getStdinValue());
      const engine = backend[props.lang];
      await engine(props.code, stdio);
    } finally {
      setRunning(false);
    }
  };

  const closeInput = () => {
    setShowInput(false);
    setInput('');
    setFirstPrompt(null);
  };

  const readFromCache = async () => {
    // eslint-disable-next-line no-restricted-syntax
    const a = localStorage.getItem(cacheKey());
    if (!a) {
      return undefined;
    }
    const b = JSON.parse(a) as CacheEntry;
    const c = b[codeSum()];
    if (!c) {
      return undefined;
    }
    return c.outputs;
  };
  const writeToCache = () => {
    // eslint-disable-next-line no-restricted-syntax
    const a = localStorage.getItem(cacheKey());
    const b: CacheEntry = a ? JSON.parse(a) : {};
    b[codeSum()] = {
      outputs: outputs(),
      lastAccessTime: Date.now()
    };
    // eslint-disable-next-line no-restricted-syntax
    localStorage.setItem(cacheKey(), JSON.stringify(b));
  };

  onMount(async () => {
    const r = await readFromCache();
    if (r) {
      stdio.set(r);
    }
    // Subscribe to interactive stdin requests from the Worker backend.
    // When the Worker calls waitForInteractiveStdin(prompt), this sets
    // the prompt signal, which shows the inline input field.
    // Each input() call triggers a NEW request, so the box re-appears.
    stdio.onStdinRequest((prompt: string) => {
      setInteractivePrompt(prompt);
      setInteractiveInput('');
      // Auto-focus after DOM renders the input element
      setTimeout(() => interactiveInputRef?.focus(), 0);
    });
  });

  onCleanup(writeToCache);

  const stop = () => {
    const engine = backend[props.lang];
    if (engine.terminate) {
      engine.terminate();
    }
    setRunning(false);
    setInteractivePrompt(null);
    setInteractiveInput('');
  };

  return <>
    <div class="code-emitter-block solid">
      <Show when={ !running() && !hasResult() && !showInput()}>
        <div class="code-emitter-actions">
          <i aria-label="toggle-input" class="button-input-toggle" onClick={() => { showInput() ? closeInput() : showInputWithFirstPrompt(); }} title="Toggle input area">
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="0.7em" height="0.6em" viewBox="0 0 160 112"><rect x="12" y="10" width="136" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="41" cy="36" r="7" fill="currentColor"/><circle cx="67" cy="36" r="7" fill="currentColor"/><circle cx="93" cy="36" r="7" fill="currentColor"/><circle cx="119" cy="36" r="7" fill="currentColor"/><circle cx="41" cy="58" r="7" fill="currentColor"/><circle cx="67" cy="58" r="7" fill="currentColor"/><circle cx="93" cy="58" r="7" fill="currentColor"/><circle cx="119" cy="58" r="7" fill="currentColor"/><rect x="41" y="72" width="78" height="14" rx="7" fill="currentColor"/></svg>
          </i>
          <i aria-label="play" class="button-play" onClick={run}><Icon name="play"/></i>
        </div>
      </Show>

      <Show when={showInput()}>
        <hr class="code-seprator code-seprator-input"/>
        <div class="code-input-area">
          <div class="code-interactive-stdin">
            <span class="code-interactive-stdin-close" onClick={closeInput} title="Close input">
              <Icon name="clear"/>
            </span>
            <input
              class="code-interactive-stdin-input"
              placeholder={firstPrompt() || 'Enter input for first prompt…'}
              value={input()}
              onInput={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run();
              }}
            />
            <i aria-label="run" class="code-prefill-run" onClick={run} title="Run (Enter)">
              <Icon name="play"/>
            </i>
          </div>
        </div>
      </Show>

      <Show when={running() || hasResult() }>
        <hr class="code-seprator"/>
        <div class="code-output">

          {/* Input history — always visible during & after run */}
          <Show when={stdinHistory().length > 0}>
            <div class="code-interactive-stdin-area">
              <For each={stdinHistory()}>
                {(item) => (
                  <div class="code-interactive-stdin-history">
                    <span class="stdin-history-prompt">{item.prompt}</span>
                    <span class="stdin-history-arrow">→</span>
                    <span class="stdin-history-response">{item.response}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Running: interactive input field */}
          <Show when={running() && interactivePrompt() !== null}>
            <div class="code-interactive-stdin">
              <span class="code-interactive-stdin-close" onClick={cancelInteractiveStdin} title="Cancel (send empty input)">
                <Icon name="clear"/>
              </span>
              <input
                ref={interactiveInputRef}
                class="code-interactive-stdin-input"
                placeholder={interactivePrompt() || ''}
                value={interactiveInput()}
                onInput={(e) => setInteractiveInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitInteractiveStdin();
                  if (e.key === 'Escape') cancelInteractiveStdin();
                }}
              />
              <i aria-label="submit" class="code-prefill-run" onClick={submitInteractiveStdin} title="Submit (Enter)">
                <Icon name="play"/>
              </i>
            </div>
            <div class="code-interactive-actions">
              <span></span>
              <button class="code-stop-button" onClick={stop} title="Terminate execution immediately">
                <Icon name="stop"/>
                Stop
              </button>
            </div>
          </Show>

          {/* Running, waiting for next input() */}
          <Show when={running() && interactivePrompt() === null}>
            <div class="loadding"><Spin/></div>
          </Show>

          {/* Completed: output + clear button */}
          <Show when={!running() && hasResult()}>
            <Show when={stdinHistory().length > 0}>
              <hr class="code-input-output-divider"/>
            </Show>
            <div class="code-area-header">
              <span></span>
              <span class="button-area-close" onClick={() => { stdio.clear(); setStdinHistory([]); }} title="Clear output">
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
