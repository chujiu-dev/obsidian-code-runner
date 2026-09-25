/**
 * aliases.ts — fence tags that point at another registered language.
 *
 * Both spellings work in a code fence (`js` and `javascript`), but only the
 * canonical one is advertised, and lookups canonicalize first. That matters
 * beyond tidiness: the stdin pattern table and the stdin-capable set are keyed
 * by canonical tags, so a block fenced as `R` used to get no input form at all
 * because the tables only knew `r`.
 *
 * Being listed here is *also* what makes a tag renderable at all: main.tsx
 * registers a code-block processor for every key of the registry, and these are
 * registry keys. A tag that is in neither place (the commonest one being `py`)
 * is not recognised by the plugin, so the block is left as a plain code block —
 * which reads to the user as "the plugin doesn't recognise this code".
 *
 * **Every tag here must be a valid CSS identifier** — letters, digits, `_`, `-`,
 * not starting with a digit. Obsidian turns the registered tag into a selector
 * (`findAll("code.language-" + tag)`), so a tag like `c++` or `c#` produces an
 * invalid selector, and the thrown SyntaxError takes down the rendering of every
 * note in the vault, not just that block. That is why `c++` and `c#` are
 * deliberately absent: those fences stay plain code blocks.
 *
 * Kept free of imports so the pattern tables can use it without a cycle.
 */
export const LANGUAGE_ALIASES: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  haskell: 'hs',
  vlang: 'v',
  wenyan: 'wy',
  cr: 'crystal',
  R: 'r',
  py: 'python',
  golang: 'go',
};

/** Tags fit to be handed to `registerMarkdownCodeBlockProcessor`. */
export function isRegisterableTag(tag: string): boolean {
  return /^[A-Za-z_][\w-]*$/.test(tag);
}

/** The language a fence tag really means. */
export function canonicalLang(lang: string): string {
  return LANGUAGE_ALIASES[lang] ?? lang;
}
