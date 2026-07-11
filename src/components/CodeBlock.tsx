import Play from './Play';
import { loadPrism } from 'obsidian';


export default (props: { lang: string, code: string, sourcePath: string } ) => {
  const highlightElement = async (el: HTMLElement) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Obsidian's loadPrism returns an untyped Prism instance
    const prism = await loadPrism();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Prism.highlightElement is an untyped API from Obsidian
    prism.highlightElement(el);
  };
  const language = () => `language-${props.lang}`;
  return <>
    <pre class={ language() }>
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises -- SolidJS ref callbacks accept async functions; the returned Promise is handled by the framework */}
      <code ref={highlightElement}>{props.code}</code>
      <Play {...props}/>
    </pre>
  </>;
};
