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
import type { Backend } from '..';


const languageRegistry: Record<string, ((props?: unknown) => Backend) | Backend> = {
  kotlin,
  rust,
  java,
  c,
  cpp,
  csharp,
  js,
  javascript: js,
  html,
  hs,
  haskell: hs,
  ts,
  typescript: ts,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- python IIFE return type (Backend) is compatible but the intermediate function wrapper confuses strict lint
  python,
  go,
  swift,
  v,
  vlang: v,
  wy,
  wenyan: wy,
  crystal,
  cr: crystal,
  r,
  R: r,
};

export default languageRegistry;
