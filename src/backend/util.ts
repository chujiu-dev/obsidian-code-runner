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

  const el = activeDocument.createElement(tag);
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
