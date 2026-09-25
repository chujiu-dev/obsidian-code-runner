import kotlin from './kotlin';
import rust from './rust';
import cpp from './cpp';
import c from './c';
import go from './go';
import hs from './haskell';
import js from './js';
import ts from './ts';
import java from './java';
import python from './python';
import csharp from './csharp';
import swift from './swift';
import v from './v';
import wy from './wy';
import crystal from './crystal';
import r from './r';
import html from './html';
import { LANGUAGE_ALIASES } from './aliases';
import { withFailureReport } from '../net';
import type { Backend } from '..';

// Every entry is a ready-to-call Backend (python's is produced by its own
// factory, the rest are plain async functions).
const canonical: Record<string, Backend> = {
  kotlin,
  rust,
  java,
  c,
  cpp,
  csharp,
  js,
  html,
  hs,
  ts,
  python,
  go,
  swift,
  v,
  wy,
  crystal,
  r,
};

/**
 * Languages whose run needs the network: the twelve playground APIs, plus the
 * two (TypeScript, Wenyan) that pull their library off a CDN.
 *
 * Only these get `net.ts`'s failure reporting — Python, JavaScript and HTML run
 * entirely locally, where a network failure is not a thing that can happen.
 * A rejection used to reach the user as *nothing at all*: no message, just a
 * spinner that stopped.
 */
const NETWORK_LANGS = new Set([
  'kotlin', 'rust', 'java', 'c', 'cpp', 'csharp', 'hs', 'go', 'swift', 'v',
  'wy', 'crystal', 'r', 'ts',
]);

const languageRegistry: Record<string, Backend> = {};
for (const [name, engine] of Object.entries(canonical)) {
  languageRegistry[name] = NETWORK_LANGS.has(name) ? withFailureReport(engine) : engine;
}

// Aliases are derived rather than hand-written, and point at the *wrapped*
// entry, so `R` and `r` cannot drift apart.
for (const [alias, target] of Object.entries(LANGUAGE_ALIASES)) {
  languageRegistry[alias] = languageRegistry[target] as Backend;
}

export default languageRegistry;
