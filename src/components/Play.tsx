import './Play.scss';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import backend, { createStdio } from '../backend';
import Spin from './Spin';
import md5 from 'crypto-js/md5';
import Term from './Term';
import Icon from './Icon';

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
  autoRun?: boolean
}) => {

  const cacheKey = () => `code-emitter-cache-${props.sourcePath}`;
  const codeSum = () => md5(props.code).toString();
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


  const readFromCache = () => {
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
    const a = localStorage.getItem(cacheKey());
    const b: CacheEntry = a ? JSON.parse(a) : {};
    b[codeSum()] = {
      outputs: outputs(),
      lastAccessTime: Date.now()
    };
    localStorage.setItem(cacheKey(), JSON.stringify(b));
  };

  onMount(async () => {
    const r = readFromCache();
    if (r) {
      stdio.set(r);
    } else if (props.autoRun) {
      await run();
    }
  });

  onCleanup(writeToCache);

  return <>
    <div class="code-emitter-block solid">
      <Show when={ !running() && !hasResult()}>
        <div class="code-emitter-actions">
          <i aria-label="play" class="button-play" onClick={run}><Icon name="play"/></i>
          <i aria-label="toggle-input" class="button-input-toggle" onClick={() => setShowInput(v => !v)} title="Toggle input area">
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="0.75em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M256 80c-96 0-176 64-240 176 64 112 144 176 240 176s176-64 240-176C432 144 352 80 256 80zm0 288c-61.9 0-112-50.1-112-112S194.1 144 256 144s112 50.1 112 112-50.1 112-112 112zm0-176c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64z"/></svg>
          </i>
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
