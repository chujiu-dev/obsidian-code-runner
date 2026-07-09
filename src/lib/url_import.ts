/**
 * Dynamically load a remote script via <script> tag injection.
 *
 * This is required specifically for loading the Pyodide WebAssembly runtime
 * (Python backend). Pyodide must initialize as a classic script in the main
 * document context — it cannot be fetched via requestUrl or loaded as a module
 * because it needs to create global objects (loadPyodide) for WASM bootstrapping.
 */

// eslint-disable-next-line no-restricted-syntax -- dynamic script injection is the only way to load Pyodide WASM runtime
export default function <R>(url: string, extract?: ()=>R): Promise<R | undefined> {
  return new Promise((resolve, _reject) => {
    if ((document.head.querySelector(`script[src="${url}"]`))) {
      resolve(extract? extract(): undefined)
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = function () {
      resolve(extract? extract(): undefined)
    }
    document.head.append(script);
  })
}