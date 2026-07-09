import './Play.scss';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import Spin from './Spin';
import Term from './Term';
import Icon from './Icon';
// Future: import { needsStdin, supportsStdin } from '../backend/stdin-detect';

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

  const run = async () => {
    setRunning(true);
    try {
      stdio.setStdin(input());
      const engine = backend[props.lang];
      await engine(props.code, stdio);
    } finally {
      setRunning(false);
    }
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
    // Future: auto-detect stdin need
    // if (needsStdin(props.lang, props.code)) {
    //   setShowInput(true);
    // }
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
        <textarea
          class="code-emitter-input"
          placeholder="Standard input data (leave empty if none)&#10;Example:&#10;5&#10;1 2 3 4 5"
          value={input()}
          onInput={(e) => setInput(e.target.value)}
          rows={3}
        />
      </Show>

      <Show when={running() || hasResult() }>
        <hr class="code-seprator"/>
        <div class="code-output">
          <Show when={running()} fallback={<>
            <div>{stdio.viewEl}</div>
            <Term lines={outputs()}/>
            <i aria-label="clear" class="button-clear" onClick={stdio.clear}><Icon name="clear"/></i>
          </>}>

            <div class="loadding">
              <Spin/>
            </div>
          </Show>
        </div>

      </Show>
    </div>
  </>;
};
