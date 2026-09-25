/**
 * util.ts — helpers shared by language backends.
 */

/**
 * Escape text for safe interpolation into an HTML string.
 *
 * `Term` renders any output line that looks like a complete HTML element as
 * markup (that is how the console panel and the collapsible compiler
 * diagnostics are drawn). Backends therefore build HTML, and any text that
 * comes from the user's code or from a remote compiler must pass through here
 * first — otherwise pasted-in source can turn into live markup.
 *
 * `sanitizeHtml` below is the second half of that defence: escaping protects
 * the lines we build, sanitizing protects the lines we only pass through.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * One line describing a thrown value, for a message the user will read.
 *
 * `String(error)` is the obvious call and the wrong one: what a rejected
 * `runPythonAsync` hands back is not always an `Error` — a Pyodide error that
 * crossed the Worker boundary arrives as a plain object — and stringifying one
 * of those prints `[object Object]` in place of the only part worth reading.
 * JSON is the fallback that keeps the fields; the value's own `toString` is
 * left for the ones JSON cannot represent (a function, a symbol).
 */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error === null) return 'null';
  if (error === undefined) return 'undefined';
  if (typeof error === 'object') {
    try {
      const json: unknown = JSON.stringify(error);
      if (typeof json === 'string' && json !== '{}') return json;
    } catch {
      // Circular reference, or a proxy that throws on read.
    }
    // A Map, a Set, or a class whose fields are all private: JSON had nothing
    // to hand over, so name the class — otherwise every one of them prints the
    // same `[object Object]` the doc comment complains about. `call` is typed
    // loosely enough to come back as `any`, hence the cast, not a call to
    // `String` on the object itself, which is the call that started this.
    return String(Object.prototype.toString.call(error) as string);
  }
  // A number, boolean, bigint, symbol or function: the only values left, and
  // the ones JSON cannot represent. Their own `toString` says the most.
  //
  // Each `typeof` is spelled out rather than left to the tail of the chain:
  // what falls through the checks above is still typed `unknown`, and a
  // `toString` on `unknown` is what the lint reads as "would print
  // `[object Object]`" — the very thing this function exists to avoid.
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint'
    || typeof error === 'symbol' || typeof error === 'function') {
    return error.toString();
  }
  return 'unknown value';
}

// ── HTML whitelist for rendered output ──

/** Tags the output panel is allowed to draw. */
const ALLOWED_TAGS = new Set([
  'div', 'span', 'details', 'summary', 'pre', 'code',
  'ul', 'ol', 'li', 'p', 'br', 'b', 'i', 'em', 'strong',
]);

/** Attributes kept on those tags. `class` is all the panel's own markup needs. */
const ALLOWED_ATTRS = new Set(['class']);

/**
 * Turn one output line into DOM nodes, keeping only whitelisted markup.
 *
 * Most of the output stream is program output, and for the remote languages it
 * is data that came back from a compile service — so it must not be able to
 * reach the real DOM as markup. A line as innocent as
 * `<div><img src=x onerror="…"></div>` would otherwise run script with the
 * plugin's privileges.
 *
 * A tag outside the whitelist is dropped together with its contents: an
 * unexpected `<script>` or `<iframe>` has nothing in it worth keeping.
 */
export function sanitizeHtml(html: string): Node[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const nodes: Node[] = [];
  for (const node of Array.from(parsed.body.childNodes)) {
    const safe = sanitizeNode(node);
    if (safe) nodes.push(safe);
  }
  return nodes;
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return activeDocument.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    // Comments and processing instructions carry nothing to display.
    return null;
  }

  const source = node as Element;
  const tag = source.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return null;

  // Obsidian's `createEl` is used rather than `createElement` because the
  // community review asks for its DOM helpers (they work in popout windows).
  // The cast is the narrowing the whitelist above just proved: every name it
  // accepts is a tag TypeScript knows.
  const el = createEl(tag as keyof HTMLElementTagNameMap);
  for (const attr of Array.from(source.attributes)) {
    if (ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
      el.setAttribute(attr.name, attr.value);
    }
  }
  for (const child of Array.from(source.childNodes)) {
    const safe = sanitizeNode(child);
    if (safe) el.appendChild(safe);
  }
  return el;
}
