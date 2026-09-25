/**
 * net.ts — Failure reporting for the languages that need the network.
 *
 * Twelve languages post to a public playground API and two more pull their
 * library off a CDN. Every one of them used to fail silently: `requestUrl`
 * rejects, nothing catches it, and the user watches a spinner stop with an
 * empty output area — indistinguishable from a program that printed nothing.
 *
 * This module turns those rejections into sentences. It also gives the requests
 * a deadline: `RequestUrlParam` has no `signal`, so a request that neither
 * succeeds nor fails (a captive portal, a firewall dropping packets) has
 * nothing else to end it.
 */

import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { t } from '../i18n';
import type { Backend } from './index';
import type { Stdio } from './store';

/**
 * Generous enough for a cold playground compile, short enough that the user is
 * not left guessing. The request itself keeps running — there is no way to
 * abort it — but nothing waits on it any more.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/** Giving up on a library that has not arrived yet. */
export const LOAD_TIMEOUT_MS = 30_000;

/** A failure worth explaining. `host` is the service it was talking to. */
export abstract class NetError extends Error {
  constructor(message: string, readonly host: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request never answered. */
export class TimeoutError extends NetError {
  constructor(readonly ms: number, host = '') {
    super(`Timed out after ${ms} ms`, host);
  }
}

/** The service answered, but not with success. */
export class HttpError extends NetError {
  constructor(readonly status: number, host = '') {
    super(`Request failed with status ${status}`, host);
  }
}

/** No point sending the request at all. */
export class OfflineError extends NetError {
  constructor(host = '') {
    super('No network connection', host);
  }
}

/**
 * The library arrived, but it is not the library: the module loaded and does
 * not carry the one function the backend needs.
 *
 * This is the failure that used to be invisible. `import()` of a UMD bundle
 * resolves perfectly well and hands back an *empty* namespace — the code then
 * read a global that was never created and died on `undefined.transpile`, which
 * the user sees as `Cannot read properties of undefined (reading 'transpile')`:
 * a stack-trace sentence that names nothing they can act on. Saying which
 * library and which entry point is missing points at the real cause (a CDN
 * serving a build whose shape changed) instead of at our code.
 */
export class LibraryError extends NetError {
  constructor(readonly library: string, readonly entry: string, host = '') {
    super(`The ${library} module has no ${entry}`, host);
  }
}

/**
 * Whether the OS reports no connectivity.
 *
 * Deliberately only believed when it says *no*: `navigator.onLine` is a weak
 * signal that can be wrong in both directions, but a positive "offline" is
 * worth telling the user about instead of letting them wait.
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** `https://api2.sololearn.com/x` → `api2.sololearn.com`. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * Reject if `promise` has not settled within `ms`.
 *
 * `AbortSignal` would be the right tool, but Obsidian's `RequestUrlParam` does
 * not accept one, so the only thing that can be bounded is how long we wait.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = REQUEST_TIMEOUT_MS, host = ''): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms, host)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
    );
  });
}

/**
 * `requestUrl` with a deadline and a status check.
 *
 * `throw: false` because the default turns any 4xx/5xx into a bare rejection,
 * which is exactly the case the user most needs explained — a playground API
 * returning 502 is not a network problem and should not be reported as one.
 */
export async function requestWithTimeout(
  param: RequestUrlParam,
  ms: number = REQUEST_TIMEOUT_MS,
): Promise<RequestUrlResponse> {
  const host = hostOf(param.url);
  if (isOffline()) throw new OfflineError(host);

  const res = await withTimeout(requestUrl({ ...param, throw: false }), ms, host);
  if (res.status >= 400) throw new HttpError(res.status, host);
  return res;
}

/**
 * Pull a library off a CDN and hand back its default export, checked.
 *
 * `ms` defaults to `LOAD_TIMEOUT_MS` because a blocked CDN can leave an
 * `import()` pending forever — neither resolving nor rejecting — which is how a
 * run used to hang with its spinner turning and no way out.
 *
 * The URL must be an **ES module** (jsDelivr's `+esm` builds are). These two
 * libraries were originally imported as their raw UMD files, and that cannot
 * work: `import()` runs a file as a module, so the UMD branch that assigns
 * itself to the global object does not run the way the backends assumed.
 * TypeScript's bundle exports nothing at all in that mode — its
 * `module.exports = ts` sits inside a `typeof module` guard — so the import
 * resolved to an empty namespace and the code then read a `window.ts` that was
 * never created, dying on `undefined.transpile`.
 *
 * `pick` is the guard against that class of bug coming back: whatever the CDN
 * serves has to have the entry point, or the run ends in a sentence naming the
 * library that failed rather than in a bare property access on `undefined`.
 */
export async function importLibrary<T>(
  url: string,
  library: string,
  entry: string,
  pick: (module: unknown) => T | null,
  ms: number = LOAD_TIMEOUT_MS,
): Promise<T> {
  const host = hostOf(url);
  if (isOffline()) throw new OfflineError(host);

  // Computed specifier: the URL has to stay a real `import()` in the CJS build
  // (same reason as `python.ts`'s Pyodide specifier), not a `require`.
  const module = await withTimeout(import(/* @vite-ignore */ url), ms, host) as Record<string, unknown>;
  // The `default` export is where an ES-module build puts the whole namespace
  // object (TypeScript's `+esm` is `export{k7 as default}`); the fallback covers
  // a genuine named-export build that has no default at all.
  const api = pick(module.default ?? module);
  if (!api) throw new LibraryError(library, entry, host);
  return api;
}

/**
 * What Electron says when a request never reached the server. Obsidian's
 * `requestUrl` goes through the main process, so this half of the list is what
 * actually shows up — "Failed to fetch" is the browser `fetch` wording.
 */
const LOOKS_NETWORK = /net::ERR_|ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|CONNECTION_REFUSED|CONNECTION_TIMED_OUT|CONNECTION_RESET|CONNECTION_CLOSED|PROXY_CONNECTION_FAILED|CERT|NETWORK_CHANGED|ADDRESS_UNREACHABLE)|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Failed to fetch|NetworkError|ERR_SOCKET/i;

/**
 * Explain a rejected run in the user's language.
 *
 * @returns the message to show, or `null` when the error is not one we
 *   recognise — the caller then prints the raw message, which is what happened
 *   before this module existed, so nothing gets worse.
 */
export function failureMessage(error: unknown, ctx?: { url?: string }): string | null {
  const known = error instanceof NetError ? error.host : '';
  const host = known || hostOf(ctx?.url ?? '') || t('net.unknownHost');

  if (error instanceof OfflineError) return t('net.offline', { host });
  if (error instanceof TimeoutError) return t('net.timeout', { host, n: Math.round(error.ms / 1000) });
  if (error instanceof HttpError) return t('net.http', { host, status: error.status });
  if (error instanceof LibraryError) return t('net.badLibrary', { host, lib: error.library });

  const message = error instanceof Error ? error.message : String(error);
  if (LOOKS_NETWORK.test(message)) return t('net.failed', { host });
  return null;
}

/**
 * Wrap a network-dependent backend so a rejection becomes a line in the output
 * instead of an unhandled promise rejection.
 *
 * `terminate` and `loading` are copied across: `Play.tsx` decides whether to
 * offer a stop button by asking the registry for `terminate`, and a wrapper
 * that dropped it would silently take the button away.
 */
export function withFailureReport(backend: Backend): Backend {
  const guarded = (async (code: string, output: Stdio) => {
    try {
      await backend(code, output);
    } catch (error) {
      output.stderr(failureMessage(error) ?? (error instanceof Error ? error.message : String(error)));
    }
  }) as Backend;

  if (backend.terminate) guarded.terminate = backend.terminate;
  // Read through, not copied: TypeScript's backends flip `loading` later, and a
  // snapshot taken here would go stale.
  if (backend.loading !== undefined) {
    Object.defineProperty(guarded, 'loading', { get: () => backend.loading, enumerable: true });
  }
  return guarded;
}
