import './Play.scss';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import Spin from './Spin';
import Term from './Term';
import Icon from './Icon';
import { needsStdin } from '../backend/stdin-detect';

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

  // Interactive stdin: shown when the Python Web Worker requests real-time input
  const [interactiveStdin, setInteractiveStdin] = createSignal(false);
  const [stdinPrompt, setStdinPrompt] = createSignal('');
  let stdinInputRef: HTMLTextAreaElement | undefined;

  const run = async () => {
    // Languages other than Python cannot do real-time interactive input yet
    if (needsStdin(props.lang, props.code) && props.lang !== 'python') {
      stdio.clear();
      stdio.write(
        'This program requires interactive input, and this feature is under development.\n' +
        '本程序需要交互式输入，该功能正在开发中。'
      );
      return;
    }

    // Python with stdin uses Web Worker + interactive input (no pre-fill needed)
    if (needsStdin(props.lang, props.code) && props.lang === 'python') {
      stdio.clear();
      setInteractiveStdin(true);
    }

    setRunning(true);
    try {
      stdio.setStdin(input());
      const engine = backend[props.lang];
      await engine(props.code, stdio);
    } finally {
      setRunning(false);
      setInteractiveStdin(false);
    }
  };

  // Called when the user presses Enter in the interactive stdin textarea
  const submitInteractiveStdin = () => {
    const data = stdinPrompt();
    setStdinPrompt('');
    stdio.provideStdin(data);
    // Refocus the textarea for the next input() call
    setTimeout(() => stdinInputRef?.focus(), 50);
  };

  const closeInput = () => {
    setShowInput(false);
    setInput('');
  };

  const readFromCache = async () => {
    // eslint-disable-next-line no-restricted-syntax -- localStorage is used for output caching; falls back gracefully when unavailable
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
    // eslint-disable-next-line no-restricted-syntax -- localStorage is used for output caching; falls back gracefully when unavailable
    const a = localStorage.getItem(cacheKey());
    const b: CacheEntry = a ? JSON.parse(a) : {};
    b[codeSum()] = {
      outputs: outputs(),
      lastAccessTime: Date.now()
    };
    // eslint-disable-next-line no-restricted-syntax -- localStorage is used for output caching; falls back gracefully when unavailable
    localStorage.setItem(cacheKey(), JSON.stringify(b));
  };

  onMount(async () => {
    const r = await readFromCache();
    if (r) {
      stdio.set(r);
    }
  });

  onCleanup(writeToCache);

  return <>
    <div class="code-emitter-block solid">
      <Show when={ !running() && !hasResult()}>
        <div class="code-emitter-actions">
          <i aria-label="toggle-input" class="button-input-toggle" onClick={() => setShowInput(v => !v)} title="Toggle input area">
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="0.7em" height="0.6em" viewBox="0 0 160 112"><rect x="12" y="10" width="136" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="41" cy="36" r="7" fill="currentColor"/><circle cx="67" cy="36" r="7" fill="currentColor"/><circle cx="93" cy="36" r="7" fill="currentColor"/><circle cx="119" cy="36" r="7" fill="currentColor"/><circle cx="41" cy="58" r="7" fill="currentColor"/><circle cx="67" cy="58" r="7" fill="currentColor"/><circle cx="93" cy="58" r="7" fill="currentColor"/><circle cx="119" cy="58" r="7" fill="currentColor"/><rect x="41" y="72" width="78" height="14" rx="7" fill="currentColor"/></svg>
          </i>
          <i aria-label="play" class="button-play" onClick={run}><Icon name="play"/></i>
        </div>
      </Show>

      <Show when={showInput()}>
        <hr class="code-seprator code-seprator-input"/>
        <div class="code-input-area">
          <div class="code-area-header">
            <span></span>
            <span class="button-area-close" onClick={closeInput} title="关闭输入">
              <Icon name="clear"/>
            </span>
          </div>
          <textarea
            class="code-emitter-input"
            placeholder="Standard input data (leave empty if none)&#10;Example:&#10;5&#10;1 2 3 4 5"
            value={input()}
            onInput={(e) => setInput(e.target.value)}
            rows={3}
          />
        </div>
      </Show>

      <Show when={running() || hasResult() }>
        <hr class="code-seprator"/>
        <div class="code-output">
          <Show when={running()} fallback={<>
            <div class="code-area-header">
              <span></span>
              <span class="button-area-close" onClick={stdio.clear} title="清除输出">
                <Icon name="clear"/>
              </span>
            </div>
            <div>{stdio.viewEl}</div>
            <Term lines={outputs()}/>
          </>}>

            <div class="loadding">
              <Spin/>
            </div>
          </Show>

          {/* Interactive stdin: shown when Python code calls input() */}
          <Show when={interactiveStdin()}>
            <div class="code-interactive-stdin">
              <textarea
                ref={stdinInputRef}
                class="code-interactive-stdin-input"
                placeholder="Type input and press Enter..."
                value={stdinPrompt()}
                onInput={(e) => setStdinPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitInteractiveStdin();
                  }
                }}
                rows={1}
              />
            </div>
          </Show>
        </div>

      </Show>
    </div>
  </>;
};
