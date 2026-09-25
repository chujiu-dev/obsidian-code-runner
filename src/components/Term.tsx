
import { For, Show } from 'solid-js';
import { parse } from 'ansicolor';
import { sanitizeHtml } from '../backend/util';

const htmlRegex = /^\s*<([a-zA-Z_][a-zA-Z0-9-_]*)(\s+[^>]+)*>.*<\/\1>\s*$/
export default (props: { lines: string[] }) => {
  return <>
    <ul>
      <For each={props.lines}>
        {/* Markup lines are built from a whitelist rather than pasted in as
            innerHTML: the same stream carries output from remote compilers. */}
        {(line) => <Show when={!htmlRegex.test(line)} fallback={
          <li ref={(el) => { el.replaceChildren(...sanitizeHtml(line)); }}></li>
        }>
          {/* The plugin's own notes to the reader (truncated output, truncated
              stdin) open with ⚠️; set them apart from the program's output. */}
          <li class={line?.startsWith('⚠️') ? 'code-output-notice' : undefined}>
            <For each={parse(line ?? '').spans}>
              {/* `span.css` is ansicolor's own declaration list and already
                  carries the foreground colour (see its `css` builder), so
                  appending `color:${span.color}` — an object — only ever added
                  `color;[object Object]` to the style, which the browser threw
                  away. */}
              {(s) => <span style={s.css}>{s.text}</span>}
            </For>
          </li>
        </Show>}
      </For>
    </ul>
  </>
}
