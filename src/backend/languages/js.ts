import type { Stdio } from '..';
import { escapeHtml } from '../util';

interface WrappedConsole {
  log: (...data: string[]) => void;
  info: (...data: string[]) => void;
  debug: (...data: string[]) => void;
  warn: (...data: string[]) => void;
  error: (...data: unknown[]) => void;
}

const wrapConsole = ({ stdout }: Stdio): WrappedConsole => {
  const prettyWrite = (name: string, data: string[]): void => {
    // Text is escaped because Term renders these lines with innerHTML.
    const outputStr = `<div class="log-${name}">${escapeHtml(data.join(','))}</div>`;
    // Through `stdout`, not `update`: the latter hands subscribers a fresh array
    // per call, which costs O(lines so far) — and this backend runs on the UI
    // thread, so `while (true) console.log(i)` froze Obsidian outright. `stdout`
    // is batched and capped like every other backend's output.
    stdout(outputStr);
  };

  const log = (...data: string[]) => prettyWrite('info', data);
  const info = (...data: string[]) => prettyWrite('info', data);
  const debug = (...data: string[]) => prettyWrite('debug', data);
  const warn = (...data: string[]) => prettyWrite('warn', data);
  const error = (...data: unknown[]) => prettyWrite('error', data.map(String));

  return { log, info, debug, warn, error };
};

export default async function (code: string, output: Stdio): Promise<void> {
  return new Promise((resolve) => {
    const wrapped = wrapConsole(output);

    try {
      // AsyncFunction constructor runs user code with access to the real global scope.
      // 'console' is passed as a parameter so user code's console.* calls are captured.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Object.getPrototypeOf returns object; .constructor is not recognized by strict linting
      const AsyncFunction = Object.getPrototypeOf(async function () { /* noop */ }).constructor as
        new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
      const fn = new AsyncFunction('console', code);
      fn(wrapped).then(() => resolve()).catch((e: unknown) => {
        wrapped.error(e);
        resolve();
      });
    } catch (e: unknown) {
      wrapped.error(e);
      resolve();
    }
  });
}
