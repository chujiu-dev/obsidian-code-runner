import { onCleanup, onMount } from 'solid-js';
import type { Stdio } from '..';
import { render } from 'solid-js/web';

export default async function (code: string, stdio: Stdio): Promise<void> {
  render(() => <HtmlViewer code={code}/>, stdio.viewEl);
}


const HtmlViewer = (props: { code: string }) => {
  // Assigned by the ref callbacks below. Written as callbacks rather than as
  // `ref={host}` because the shorthand assigns from the compiled output, which
  // no reader — or linter — can see, and an invisible assignment reads exactly
  // like a variable that should have been `const`.
  let host: HTMLDivElement | undefined = undefined;
  let el: HTMLDivElement | undefined = undefined;

  let shadow: ShadowRoot | undefined = undefined;

  onMount(() => {
    if (!host || !el) return;
    // Closed shadow root: the code under view runs in the viewer's document,
    // and a shadow boundary keeps its styles and ids from reaching the app.
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.appendChild(el);
  });

  onCleanup(() => {
    host?.remove();
  });

  return <>
    <div ref={(node) => { host = node; }} class="html-viewer" >
      <div ref={(node) => { el = node; }} innerHTML={props.code}></div>
    </div>
  </>;
};
