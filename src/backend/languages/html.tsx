import { onCleanup, onMount } from 'solid-js';
import type { Stdio } from '..';
import { render } from 'solid-js/web';

export default async function (code: string, stdio: Stdio): Promise<void> {
   
  render(() => <HtmlViewer code={code}/>, stdio.viewEl);
}


const HtmlViewer = (props: { code: string }) => {
  // eslint-disable-next-line prefer-const -- SolidJS ref callbacks reassign these variables, let is required
  let host: HTMLDivElement | undefined = undefined;
  // eslint-disable-next-line prefer-const -- SolidJS ref callbacks reassign these variables, let is required
  let el: HTMLDivElement | undefined = undefined;

  let shadow: ShadowRoot | undefined = undefined;

  onMount(() => {
    if (!host || !el) return;
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.appendChild(el);
  });

  onCleanup(() => {
    host?.remove();
  });

  return <>
    <div ref={host} class="html-viewer" >
      <div ref={el} innerHTML={props.code}></div>
    </div>
  </>;
};