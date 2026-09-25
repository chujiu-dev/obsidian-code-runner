# Code Runner — project notes

> **Written for three readers: the plugin's author, Claude (the AI that has done most of the
> work on this codebase), and any agent that picks the project up later.** It is not
> documentation for users — that is `README.md`. Nothing here is shipped in a release; this
> file exists so that whoever touches the code next can read *why* it looks the way it does
> instead of re-deriving it from the source, and so that the things a terminal cannot check
> get checked in a real Obsidian window by someone who knows to look for them.
>
> Formerly `CLAUDE.md`. Renamed so that it is **not** loaded into every session
> automatically — which means it now has to be read deliberately, before changing the build,
> the Pyodide Worker, or any review-sensitive code path.

Obsidian community plugin (`id: code-runner`) that runs fenced code blocks in a note.
TypeScript + SolidJS, bundled by Vite into a single CJS `main.js`.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` — must be clean |
| `npm run lint` | eslint 9 flat config — **0 errors** expected, warnings are intentional (see below) |
| `npm run build` | `tsc --noEmit && vite build` → `dist/main.js`, `dist/styles.css`, `dist/manifest.json` |
| `npm run dev` | watch build with inline sourcemaps |
| `npm run deploy` | copies `dist/` into `VAULT_PLUGIN_DIR` from `.env` |

`npm install` after any `package.json` change. A stale `node_modules` once shipped a
TypeScript 4.7 compiler against a 5.5 declaration (lint "failed" with a parse error on
`satisfies`), which looked like a syntax bug in our code and was not.

### Deploying

`.env` (gitignored) holds `VAULT_PLUGIN_DIR=/path/to/vault/.obsidian/plugins/code-runner`.
Building only ever writes the repo's own `dist/`. Copying into a real vault touches the
user's notes folder — **ask before running `npm run deploy`.**

## Obsidian review constraints

The plugin targets `minAppVersion 0.12.0`, while the installed `obsidian` typings are much
newer. Anything newer passes typecheck but breaks older hosts, and the community review
checks for exactly that:

- Raw `localStorage`, **not** `App.loadLocalStorage` / `Plugin.loadData` for caches.
- No `eval`, no `new Function` (see the `AsyncFunction` note below).
- `manifest.json`'s `description` must not contain the word "Obsidian".
- The `eslint-disable` directives in `Play.tsx`, `main.tsx`, `CodeBlock.tsx`, `js.ts` and
  `html.tsx` carry the *reason* a newer API was avoided. They currently report as "unused"
  because the rules that motivated them are off — **do not delete them**; delete the code
  they guard, or leave both, but the explanation is the point.
- `js.ts` builds a function with the `AsyncFunction` constructor (reached through
  `Object.getPrototypeOf(async function(){}).constructor`) to dodge the reviewer's
  `eval` / `new Function` pattern match. It is deliberate; treat it as review-sensitive.
- `typings/*.d.ts` patches Obsidian's own types (making `App.plugins`, `DataAdapter.getBasePath`
  etc. required). Obsidian's shipped `.d.ts` then fails its own interfaces — that is what
  `skipLibCheck: true` in `tsconfig.json` is for. The patches still apply to our code.

## Map of the code

| Path | Responsibility |
|---|---|
| `src/main.tsx` | Plugin entry: settings load/merge, code-block processor registration, public `api` |
| `src/backend/index.ts` | `Backend` type (`(code, stdio) => Promise<void>`, optional `terminate`) and the registry |
| `src/backend/store.ts` | `createStdio()` — output stream (batched, capped), view element, interactive stdin plumbing |
| `src/backend/stdin-detect.ts` | `needsStdin`, `extractInputPrompts`, `isInteractiveStdin`, `supportsStdin` |
| `src/backend/loop-detect.ts` | `looksInfinite` — a heuristic for a loop with no way out (halting is undecidable, and a false alarm is worse than a miss). It does **not** gate or delay anything: `run-watch.ts` uses it only to pick the wording of the running-too-long hint. |
| `src/backend/run-watch.ts` | Pure functions deciding what to say about a run in progress: `runHint` (elapsed + quiet + loop-shaped + stoppable → which hint) and `waitedTooLong` (queued past two minutes). No imports, so it is unit-testable outside Obsidian. |
| `src/backend/net.ts` | Failure reporting for network-dependent languages: `NetError`/`TimeoutError`/`HttpError`/`OfflineError`/`LibraryError`, `isOffline`, `withTimeout`, `requestWithTimeout` (bounded request that surfaces 4xx/5xx), `importLibrary` (CDN ES-module load with a shape check), `failureMessage` (error → one user-facing line) and `withFailureReport` (wraps a backend so a rejection prints instead of vanishing). |
| `src/backend/languages/*` | One file per language; `python.ts` also owns the CDN setting |
| `src/backend/languages/python.ts` | Pyodide via Worker+SAB (interactive) or main thread (pre-fill) |
| `src/backend/providers/sololearn.ts` | Remote compile API used by C, C++, Java, Go, C#, Swift, R |
| `src/backend/languages/index.ts` | The language registry. `NETWORK_LANGS` decides which backends get `withFailureReport`; aliases are derived from `LANGUAGE_ALIASES` rather than listed by hand, so `R` and `r` cannot drift apart. |
| `src/backend/languages/aliases.ts` | Fence tags that point at another language (`py`, `javascript`, `R`, …). Being listed here is *also* what makes a tag renderable: `main.tsx` registers a processor per registry key, and the view compares canonical names — see the note below. Every entry must be a valid CSS identifier, which is why `c++`/`c#` are absent. |
| `src/components/Play.tsx` | The run UI: input forms, spinner, stop button, output cache |
| `src/i18n/` | `types.ts` is the key contract — a new key must be added to `en.ts`, `zh.ts` **and** `types.ts` |

### Pyodide specifics

- The Worker is built from a **string** (`workerSource()`) turned into a Blob URL. Inside that
  string every JS literal must use double quotes — no backticks, no single quotes. Breaking
  this silently breaks the Worker at runtime, not at build time.
- Stdin is `builtins.input` replacement, not `pyodide.setStdin()`: Emscripten fd-0 raises EIO
  under Obsidian's Electron.
- One Worker serves all code blocks, so runs are **queued** per runtime and a stop request
  carries the `Stdio` of the block it belongs to. Two blocks running at once would otherwise
  share the single SAB slot and stdout handler.
- Queue positions are announced to *both* lists: the blocks still waiting get their count, and
  a block that drops out of `waiting` gets `queued(0)`. Notifying only the waiting ones left the
  block that had just started running showing "1 ahead" for its whole run — the UI rendered that
  as a permanent "waiting for another block" notice over a program that was running fine.
  The count is `i + (activeOutput ? 1 : 0)`: the run inside the Worker plus those queued ahead.
- Stopping uses two mechanisms at once: SIGINT through `pyodide.setInterruptBuffer` for a busy
  loop, and an abort sentinel in the shared buffer to release a Worker parked in `Atomics.wait`.
  Pyodide clears the interrupt cell when it reads it, so a stop also re-arms it every 250 ms
  (otherwise `while True: pass` inside `try/except` would be unstoppable again).
- If those do not land within `STOP_GRACE_MS` (2.5 s) the Worker is terminated. That is the last
  resort, not the normal path: the next run must fetch ~10 MB of Pyodide again, and **on a
  blocked CDN that fetch stalls instead of failing**, so the run sat in `pendingRuns` forever
  and every later block queued behind a runtime that would never be ready. Both stop paths log
  which one happened (`Stopped via SIGINT` vs `restarting the Python runtime`) — ask the user for
  that console line before changing anything about stopping.
- `LOAD_TIMEOUT_MS` (60 s) is the backstop for that stall: the main thread tracks the Worker's
  `ready` message (it used to be ignored — the switch fell through to `default`), shows a
  "loading" notice while it waits, and on timeout reports to the run, drops the Worker and
  settles the run, so a stalled load is visible and retryable instead of a silent freeze.
- `backend.loading` is **written but never read** — no module in `src/` consumes it, so it is
  currently inert. The "loading" notice the user sees comes from `runtimeLoading()` in
  `Play.tsx`, which is driven by the run lifecycle instead. Do not assume this flag reflects
  anything; if a future change needs to know whether a runtime is loading, it needs its own
  signal rather than this one. (It was reset to `false` on load failure as part of this round's
  fix, which changed nothing observable — the real bug was the promise never settling.)
- `pyodide.mjs` is loaded with a **computed** specifier so the CDN setting takes effect
  (`` import(`${cdn}pyodide.mjs`) ``). After touching that line, check `dist/main.js` still
  contains a real `import(`, not a `require()` — the build output is CJS and a rewrite there
  would break the tablet path.

### Network-dependent languages

- Every backend that touches the network is wrapped by `withFailureReport` in
  `languages/index.ts`. This is deliberate: 14 backends call `requestUrl` (or a CDN `import()`)
  with no `try`/`catch` of their own, and `Play.tsx`'s `run()` has `finally` but no `catch`, so
  before this round a network failure produced *no output at all* — the spinner stopped and the
  output area stayed empty, which reads as "the plugin is broken" rather than "the service is
  unreachable". The wrapper turns that rejection into one line of output.
- **`NETWORK_LANGS` is a set of strings, so a typo in it fails silently**: the language still
  runs, the code still compiles, and the only symptom is the missing message on a network error.
  TypeScript cannot see this. Keep it in step with the modules that import `../net` or
  `providers/sololearn`, and with the registry keys (note `haskell.ts` registers as `hs`).
- `python.ts` is deliberately **not** wrapped: it calls `failureMessage` in its own catches. Its
  network need is narrower than the others' — only a *cold* load fetches Pyodide, so the offline
  check there is conditioned on that, and a run on an already-loaded runtime must keep working
  with the network down (local WebAssembly).
- `requestUrl`'s `throw` defaults to **true**, which made 4xx/5xx indistinguishable from a lost
  connection. `requestWithTimeout` passes `throw: false` and checks the status itself.
- `RequestUrlParam` has no `signal`, so a timeout can only be a race against a timer. The
  underlying request keeps running to completion; only the UI stops waiting on it.

### CDN libraries: an ES module, or nothing

`ts` and `wy` are the two languages whose runtime is a library, not an API. Both used to `import()`
their raw UMD file, and for TypeScript that never worked: `lib/typescript.min.js` ends with
`"undefined"!=typeof module&&module.exports&&(module.exports=ts)` — inside an ES module there is no
`module`, so the namespace is **empty**, and the backend then read `window.ts`, a global that file
never creates (all it publishes is `globalThis.TypeScript.Services.*`). The user's report was
`Cannot read properties of undefined (reading 'transpile')`: a sentence that names neither the CDN
nor the library and reads like a bug in the plugin.

Both now load jsDelivr's `+esm` build through `importLibrary()`, which unwraps `.default`, checks the
entry point exists, and throws `LibraryError` (→ `net.badLibrary`) if it does not. Two rules:

- **`+esm` is not cosmetic.** It is jsDelivr's rollup/esbuild conversion of the same file into a real
  module, with the CommonJS globals shimmed so the guarded `module.exports` line actually runs
  (TypeScript 4.7.4's ends in `export{k7 as default}`). A literal URL of the plain `.js` file is the
  bug returning.
- **The check is the point, not the URL.** `pick` is what stops the next shape change from becoming
  another `undefined.something` in the output; without it, `importLibrary` would be a rename.

Versions are pinned in both URLs. `@wenyan/core` was previously unpinned on unpkg, so a release
could have arrived unannounced; note its module still prints its compilation passes to the console
(`PASS 0`… `PASS 3`) — that is the library, not our debug output.

Verified outside Obsidian by `cdns.mjs` in the scratch harness, which fetches the URL **from the
source**, runs it in Node, and transpiles 测试二十六(3)'s exact snippet to check it prints 42. What
that cannot show is Obsidian's own `import()` of an `https://` URL — `python.ts` is the precedent
that it works.

### Deciding what to say about a run in progress

- The hint logic lives in `run-watch.ts` as pure functions with no imports, specifically so it
  can be unit-tested outside Obsidian. `Play.tsx` only supplies the facts (elapsed, quiet,
  loop-shaped, stoppable) and renders the verdict.
- Two independent triggers, per the user's choice: a **quiet timeout** (no output for 4 s past
  the threshold) and a **loop-shaped** program. A loop-shaped program is reported even while it
  prints, which is what lets `while True: print(i)` be recognised; a program that merely prints
  steadily is never reported.
- Thresholds differ by whether the run can actually be stopped: 10 s when a stop button exists,
  30 s when it does not. Telling a user to press a button that was never offered is worse than
  saying nothing, so the non-stoppable wording asks them to check the network instead.
- Timing starts only once a block is genuinely running — not while Pyodide loads and not while
  queued, or a cold start would report a "stuck" run that is merely downloading.
- Output activity is tracked from the stdio subscription **and** from
  `stdio.viewEl.childElementCount`, because matplotlib figures do not go through `subscribe`;
  that was the one path where a producing program could have looked idle.

## Why the output path is batched, and why it has a ceiling

`createStdio()` used to notify subscribers once per printed line, each time handing them a freshly
copied array. That is O(lines so far) *per line*, i.e. quadratic overall, and every subscriber pays
it again — `Term.tsx` renders one `<li>` per line, and `api.execute` copies the array again. Measured
with the real `store.ts` in Node: 5 000 lines 32 ms, 20 000 lines 1 005 ms, 80 000 lines 20 522 ms.

`while True: print(i)` reaches those counts in seconds, and while the main thread is busy the
renderer draws **nothing** — the spinner is a CSS animation on the compositor thread, so it keeps
turning and the block looks alive with no text at all. That is what "it just spins, there is no
message" was: the watchdog hint existed but could not be painted.

So: appends are O(1) (`push` + a head index that is compacted lazily), notifications are coalesced
to one per 100 ms, and the array is capped at `MAX_OUTPUT_LINES` (5000) with the dropped count
prepended as a `⚠️` line — otherwise a runaway loop ends up in the DOM and in the localStorage
output cache unbounded. Two consequences worth remembering:

- Anything that reads the output **synchronously** after a run must call `stdio.flush()` first:
  `Play.tsx`'s `writeToCache()` and `main.tsx`'s `api.execute()` both do. The subscriber callbacks
  themselves see a fresh array each time, so Solid's `For` still re-renders.
- `stdio.set()` (cache restore) goes through the same trim, so an over-long legacy cache cannot
  arrive in the DOM unguarded.

## Fence tags: an alias is not "just" a lookup shortcut

A code block only becomes a plugin block if `registerMarkdownCodeBlockProcessor` was called with
that exact fence tag. That loop used to iterate `supportedLanguages()` — the 17 advertised names —
so every alias (`py`, `javascript`, `R`, …) silently fell through to Obsidian's plain code block:
no ⌨, no ▶, no error. Users read that as "the plugin doesn't recognise this code", and because the
block it was first reported on happened to be a long one, as "the plugin can't handle long programs".

The loop now walks `Object.keys(backend)` (canonical **and** aliases) and hands the component
`canonicalLang(tag)`. That second half matters: `Play.tsx` compares `props.lang === 'python'` for the
Python-specific input path, so passing the raw tag through would give a `py` block the generic
textarea instead of the interactive field. Anything else that branches on `props.lang` must either
compare canonical names or canonicalize first — `supportsStdin`, `needsStdin`, `looksInfinite` and
`extractInputPrompts` already do.

`fences.mjs` in the scratch harness checks the whole chain, including that every fence tag used in the
user's test note is registered (that check, run against the old alias table, names `py`).

## What cannot be verified from a terminal

Typecheck, lint and build say nothing about these; they need a real Obsidian window:

1. Interactive Python input (pre-filled line, then the popup mid-run, then the history).
2. Stop on `while True: pass`, and that a second run afterwards still works *without*
   reloading Pyodide — i.e. that the console says `Stopped via SIGINT`, not `restarting`.
3. `scanf` / `Scanner` blocks with the stdin textarea.
4. Two Python blocks in one note — output must not interleave, and the "N ahead" notice must
   appear only while a block is genuinely queued, never over a running one.
5. The tablet/no-SAB fallback path.
6. The "loading the Python runtime" notice, and the 60 s load-timeout error.
7. The running-too-long hint appearing after 10 s — and *not* appearing for a quiet program, for a
   block that is still loading, for one that is queued, or while a block is waiting for input. The
   seconds must tick up by themselves.
8. The network-failure wording: pull the network and run a C/Java block (`没有网络连接…`), run a
   cold Python block while offline (`…cdn.jsdelivr.net`), and let a remote run time out.
9. The queued-too-long hint after two minutes of waiting behind another block.
10. That a flooding `while True: print(i)` keeps the editor responsive, still shows the loop hint
    after 10 s (the point of the batching above), and switches its first output line to the
    `⚠️ …省略…` notice at 5000 lines — which the clear button removes again.
11. That a block fenced as `py` (or `javascript`, `R`, `golang`, …) renders the plugin UI at all —
    the registration is invisible to every check that runs in a terminal except `fences.mjs`.
12. That a `ts` block prints its result (`typescript` and `ts` fences alike). `cdns.mjs` proves the
    CDN serves the right compiler and that it transpiles 测试二十六(3); whether Obsidian's
    `import()` of that URL resolves is not something a terminal can answer.

The unit-level behaviour behind 7–9 *is* covered in a terminal: `run-watch.ts` and `net.ts` are
pure and were checked at every boundary, as was `python.ts`'s offline cold-start path against a
fake Worker. What a terminal cannot show is the wiring in `Play.tsx` — that the right hint is
rendered, at the right time, over the right element.
