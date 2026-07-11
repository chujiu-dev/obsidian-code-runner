import './Play.scss';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import { hasSAB } from '../backend/languages/python';
import Spin from './Spin';
import Term from './Term';
import Icon from './Icon';
import { needsStdin, extractInputPrompts, isInteractiveStdin } from '../backend/stdin-detect';
import type { InputPrompt } from '../backend/stdin-detect';

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
  stdio.subscribe(setOuptuts);

  const hasResult = () => outputs()?.length > 0 || stdio.viewEl.hasChildNodes();

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

  const showInputForm = () => {
    if (needsStdin(props.lang, props.code) && props.lang === 'python') {
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
      if (props.lang !== 'python') {
        stdio.write(
          'This program requires stdin input which is currently only supported for Python.\n' +
          '本程序需要标准输入，目前仅支持 Python。'
        );
        return;
      }
      if (!showInput()) {
        showInputForm();
        return;
      }
    }

    setRunning(true);
    setShowInput(false);

    if (needsStdin(props.lang, props.code) && props.lang === 'python') {
      if (hasSAB) {
        const seedVal = input();
        const seedPrompt = firstPrompt();
        setStdinHistory(seedVal ? [{ prompt: seedPrompt || '', response: seedVal }] : []);
        stdio.setStdin(input());
      } else if (isInteractive()) {
        const lines = rawStdin().split('\n');
        const prompts = allPrompts();
        setStdinHistory(lines.map((line, i) => ({
          prompt: prompts[i]?.label || `Input #${i + 1}`,
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
      await engine(props.code, stdio);
    } finally {
      setRunning(false);
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
    if (r) stdio.set(r);

    stdio.onStdinRequest((prompt: string) => {
      setInteractivePrompt(prompt);
      setInteractiveInput('');
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
          <i aria-label="toggle-input" class="button-input-toggle" onClick={() => { showInput() ? closeInput() : showInputForm(); }} title="Toggle input area">
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="0.7em" height="0.6em" viewBox="0 0 160 112"><rect x="12" y="10" width="136" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="41" cy="36" r="7" fill="currentColor"/><circle cx="67" cy="36" r="7" fill="currentColor"/><circle cx="93" cy="36" r="7" fill="currentColor"/><circle cx="119" cy="36" r="7" fill="currentColor"/><circle cx="41" cy="58" r="7" fill="currentColor"/><circle cx="67" cy="58" r="7" fill="currentColor"/><circle cx="93" cy="58" r="7" fill="currentColor"/><circle cx="119" cy="58" r="7" fill="currentColor"/><rect x="41" y="72" width="78" height="14" rx="7" fill="currentColor"/></svg>
          </i>
          <i aria-label="play" class="button-play" onClick={run}><Icon name="play"/></i>
        </div>
      </Show>

      <Show when={showInput()}>
        <hr class="code-seprator code-seprator-input"/>
        <div class="code-input-area">

          {/* Desktop: SAB single-field pre-fill */}
          <Show when={hasSAB}>
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
          </Show>

          {/* Tablet: sequential → labeled fields, interactive → textarea */}

          {/* Sequential (bounded): labeled multi-field form */}
          <Show when={!hasSAB && !isInteractive()}>
            <div class="stdin-fields">
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
                        vals[i()] = (e.target as HTMLInputElement).value;
                        setFieldValues(vals);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') run();
                      }}
                    />
                  </div>
                )}
              </For>
            </div>
            <div class="stdin-form-footer">
              <span class="code-interactive-stdin-close" onClick={closeInput} title="Close input">
                <Icon name="clear"/>
              </span>
              <i aria-label="run" class="code-prefill-run" onClick={run} title="Run (Enter)">
                <Icon name="play"/>
              </i>
            </div>
          </Show>

          {/* Interactive (loop): raw textarea */}
          <Show when={!hasSAB && isInteractive()}>
            <div class="stdin-textarea-hint">
              This program uses interactive input. Each line feeds one input() call in order.
            </div>
            <textarea
              class="code-emitter-input"
              rows={Math.max(5, allPrompts().length + 2)}
              placeholder={"Each line = one input() call.\nExample — a 3-line pre-fill for a program that reads name, age, city:\nAlice\n25\nNew York"}
              value={rawStdin()}
              onInput={(e) => setRawStdin((e.target as HTMLTextAreaElement).value)}
            />
            <div class="stdin-form-footer">
              <span class="code-interactive-stdin-close" onClick={closeInput} title="Close input">
                <Icon name="clear"/>
              </span>
              <i aria-label="run" class="code-prefill-run" onClick={run} title="Run (Enter)">
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

          {/* Interactive input popup */}
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

          {/* Waiting for next input() */}
          <Show when={running() && interactivePrompt() === null}>
            <div class="loadding"><Spin/></div>
          </Show>

          {/* Output + clear */}
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
