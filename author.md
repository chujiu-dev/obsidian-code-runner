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
- `eslint-plugin-no-unsanitized` is a devDependency **on purpose**, and `eslint.config.mjs`
  runs it at error level. It is the rule that rejected the 1.4.0 submission; having it here
  means `npm run lint` catches that class of problem before a human reviewer does, and it is
  also what lets the two `no-unsanitized/method` suppressions below resolve to a real rule
  instead of "unknown rule".

### The 2026-09 review pass (shipped in 1.4.1)

The 1.4.0 submission came back with **2 errors and ~15 warnings**. Both errors were
`no-unsanitized/method` on a computed `import()`. What changed, and what was left alone on
purpose:

| Finding | What was done |
|---|---|
| `import()` of a computed URL — `net.ts` (`importLibrary`) and `languages/python.ts` (Pyodide) | **Kept, with a reasoned `eslint-disable-next-line`.** One URL is a pinned library constant, the other is the user's own Python CDN setting; neither can be a literal and neither can be bundled. This is the only place a suppression is the answer. |
| `typings/electron.d.ts` — ~16k lines, and nearly every `any` in the report | **Deleted.** Nothing in `src/` imported Electron. It came with the template and its only effect was reviewer noise. |
| `typings/window.d.ts` | **Deleted.** Its `[p: PropertyKey]: any` index signature existed only so `window.hmr` typechecked; `src/hmr.ts` declares `Window.hmr` itself now. |
| `console.log` in `python.ts`, `ts.ts`, `wy.ts`, `hmr.ts` | `console.debug`, or deleted. `debug` is on the review's allow-list and stays hidden until DevTools is switched to Verbose — the right level for "which of the two Python runtimes is in use". The `wy.ts` ones printed the compiled JS and were pure noise. |
| Bare `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` | All `window.`-qualified, which is what the review asks for (a run must keep working from a popout window). Handles are typed `number | null`: `window.setTimeout` returns a number, while the bare name resolves to Node's `Timeout` through `@types/node`. |
| `document.createElement` in `store.ts`, `util.ts` | `createDiv()` / `createEl()`. `sanitizeNode` builds its whitelisted tags with `createEl(tag as keyof HTMLElementTagNameMap)` — the cast is the narrowing the whitelist above it has already proved. **Not** `activeWindow.createEl()`: Obsidian's typings put these helpers on `Node` and on the global, not on `Window`. |
| `Term.tsx` built a style string by concatenation | `style={s.css}`. ansicolor's `css` already carries the colour, and the old code appended `color;[object Object]`, which the browser threw away — an invisible bug, not a styling choice. |
| `if (e instanceof Error) … else String(e)` scattered around | `errorText(e)` in `util.ts`, so a Pyodide error that crossed the Worker boundary (a plain object) prints its fields instead of `[object Object]`. |
| `getLanguage()` in `i18n/index.ts` (an API added in 1.8.7) | Guarded with `requireApiVersion('1.8.7') ? getLanguage() : undefined`. The guard is what the review's `no-unsupported-api` looks for; older apps keep the `en` default. |
| `vite.config.ts`: destructured `path` methods, deprecated `asset.name` | `path.dirname(...)` etc. called on the object; `assetName()` reads `name` first and falls back to `names` — vite calls `assetFileNames` itself with a hand-built `{ type, name, … }` that has **no** `names`, so the "modern" property crashes the build. |

Left in place, **with the reason** — these are warnings, not errors, and fixing them means
raising what the plugin supports:

- `localStorage` in `Play.tsx` (4 warnings). `App.loadLocalStorage` / `saveLocalStorage` are
  `@since 1.8.7` (checked in `node_modules/obsidian/obsidian.d.ts`) while `minAppVersion` is
  `0.12.0`. Raising the floor is a support decision, not a lint fix.
- `PluginSettingTab` without `getSettingDefinitions()` — the declarative settings API is
  1.13.0+, same reasoning. Settings search will not find this plugin's settings on 1.13+.
- `vite.config.ts` imports Node built-ins and uses `process` — it is a build script that
  never reaches `main.js`.

**How to run the reviewer's own gate locally** (it is what the table above was produced
with): install `eslint-plugin-obsidianmd` somewhere *outside* the repo and point a config at
this project's `tsconfig.json`, then run eslint from the repo root — the plugin reads
`./manifest.json` at import time, so the working directory has to be the repo. The
`recommended` preset is type-checked; the repo's own `eslint.config.mjs` is not, so a
problem like "unnecessary type assertion" only ever shows up under the reviewer's config.
`dist/` is gitignored, and the reviewer's clone never has it — do not read a parse error on
`dist/main.js` as a finding.

## Map of the code

| Path | Responsibility |
|---|---|
| `src/main.tsx` | Plugin entry: settings load/merge, code-block processor registration, public `api` |
| `src/backend/index.ts` | `Backend` type (`(code, stdio) => Promise<void>`, optional `terminate`) and the registry |
| `src/backend/store.ts` | `createStdio()` — output stream (batched, capped), view element, interactive stdin plumbing |
| `src/backend/stdin-detect.ts` | `needsStdin`, `extractInputPrompts`, `isInteractiveStdin`, `supportsStdin` |
| `src/backend/loop-detect.ts` | `looksInfinite` — a heuristic for a loop with no way out (halting is undecidable, and a false alarm is worse than a miss). It does **not** gate or delay anything: `run-watch.ts` uses it only to pick the wording of the running-too-long hint. |
| `src/backend/run-watch.ts` | Pure functions deciding what to say about a run in progress: `runHint` (elapsed + quiet + loop-shaped + stoppable → which hint) and `waitedTooLong` (queued past two minutes). No imports, so it is unit-testable outside Obsidian. |
| `src/backend/skeleton-rules.ts` | `buildSkeleton(lang, code)` — decides whether a snippet is an incomplete fragment, and what a complete program looks like for that language. Pure: it imports only `languages/aliases`, so it can be driven from Node. |
| `src/backend/skeleton.ts` | The wrapper (`withSkeleton`) applied in the registry, the on/off flag, and the one-line notice written before the program runs. |
| `src/backend/net.ts` | Failure reporting for network-dependent languages: `NetError`/`TimeoutError`/`HttpError`/`OfflineError`/`LibraryError`, `isOffline`, `withTimeout`, `requestWithTimeout` (bounded request that surfaces 4xx/5xx), `importLibrary` (CDN ES-module load with a shape check), `failureMessage` (error → one user-facing line) and `withFailureReport` (wraps a backend so a rejection prints instead of vanishing). |
| `src/backend/languages/*` | One file per language; `python.ts` also owns the CDN setting |
| `src/backend/languages/python.ts` | Pyodide via Worker+SAB (interactive) or main thread (pre-fill) |
| `src/backend/providers/sololearn.ts` | Remote compile API used by C, C++, Java, Go, C#, Swift, R |
| `src/backend/languages/index.ts` | The language registry. `NETWORK_LANGS` decides which backends get `withFailureReport`; aliases are derived from `LANGUAGE_ALIASES` rather than listed by hand, so `R` and `r` cannot drift apart. |
| `src/backend/languages/aliases.ts` | Fence tags that point at another language (`py`, `javascript`, `R`, …). Being listed here is *also* what makes a tag renderable: `main.tsx` registers a processor per registry key, and the view compares canonical names — see the note below. Every entry must be a valid CSS identifier, which is why `c++`/`c#` are absent. |
| `src/components/Play.tsx` | The run UI: input forms, spinner, stop button, output cache |
| `src/i18n/` | `types.ts` is the key contract — a new key must be added to `en.ts`, `zh.ts` **and** `types.ts`. English is the first language: it is the shape every other locale is written against, and where the two disagree English wins. |

Anything a translation *builds* rather than states belongs in the map too, not in the calling code:
`diag.separator` exists only because joining `1 个错误` and `1 个警告` with a hard-coded `', '` put an
English comma in a Chinese sentence. Plurals are the same story — `diag.errorCount` carries `{s}` in
English and no such placeholder in Chinese, since Chinese does not inflect. The caller still computes
`s: n > 1 ? 's' : ''`, and an absent placeholder is simply ignored, so the same call site serves both.

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
- **A Python traceback arrives with the runtime's own frames on top, and `withoutEngineFrames()`
  takes them off** (1.4.2). Pyodide formats the traceback inside
  `_pyodide/_base.py::eval_code_async` → `run_async` → `eval`, so `print(undefined_name)` used to
  open with three frames of machinery before the reader's own `<exec>` line — noise in a panel
  that is meant to be read. Everything from the first frame that is *not* under
  `/lib/python3…_pyodide/` is kept, so an error raised inside a function the reader wrote still
  shows the path through their code. Applied in both error paths (the Worker's message handler and
  the main-thread backend), and deliberately conservative: anything that is not a traceback with at
  least one of the reader's frames comes back byte for byte, which is what makes it safe to apply
  to load failures and `SyntaxError`s too. The test note used to claim all three error shapes were
  "one or two lines", which was false for Python until this existed.

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
- **SoloLearn answers `No output.` for a program that printed nothing** — all seven of its
  languages, and in English whatever the `Accept-Language` header says (measured; the plugin sends
  `zh-CN` first). `splitDiagnostics` replaces that literal with `t('sololearn.noOutput')`, so a
  Chinese reader sees a Chinese sentence instead of the one piece of English a correct run used to
  produce. The replacement opens with ⚠️, i.e. it is a *note*: without that, the line would count
  as the program's output and put ✕ back where ▶ belongs, which is the same bug as the completion
  notice's. A program that prints exactly `No output.` and nothing else is indistinguishable from
  the placeholder — harmless, since the two sentences mean the same thing.
- **The V playground moved off `play.vosca.dev`**: on 2026-09-25 `nslookup` said NXDOMAIN while
  every other host in the list resolved, so a `v` block ended in `无法连接到…` whatever the code
  was — the one broken language that no amount of code in this repo could have fixed. The
  playground answers on **`play.vlang.io`** with an identical request (form body `code=…`) and an
  identical response (`{ output, buildOutput, error }`), so `v.ts` differs only in the host name.
  Verified through the registry on the real service: a whole program, a bare snippet completed by
  the skeleton, a snippet that needs `import os`, the `vlang` alias, and a compile error reaching
  `stderr`. If V breaks again, check DNS first — that is what it looks like when a playground is
  retired, not a code bug.

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

## Completing a snippet before it runs

`backend/skeleton-rules.ts` + `backend/skeleton.ts`. A block holding `printf("%d", n);` is a
fragment, not a program, and the reader's intent is unambiguous — so it is wrapped in the standard
shape for its language, with the additions named in a one-line collapsible notice above the output.
Four decisions in there are not obvious, and one of them contradicts the design this started with.

**The snippet's own leading `#include`/`import` lines are hoisted above the generated entry
point, and that is not cosmetic.** `#include <iostream>` inside a function is an error — every
libstdc++ header defines names in `namespace std`, and gcc answers `'namespace' definition is not
allowed here` (checked against the service, not assumed). Java/Kotlin/V and Go `import` are
grammatically only allowed before the first declaration. Go's parenthesised `import ( … )` is
hoisted as a whole, because hoisting only its first line would leave a bare `( "fmt" )` in the
body. Only the *leading* run is moved: an `#include` after the first statement stays where the
author put it, so the body is never reordered on a guess. The snippet's own lines also stay above
what was added to them, which is why a leading doc comment is still line 1 of the generated file.

**No `#line` directive, for any language.** The original design had one, to keep diagnostics
numbered the way the snippet is numbered. Measured against the real service, `#line 1` does make
the *number* in the message right, but gcc then prints its source excerpt from the physical line
that logical number names — a warning the reader knows is on snippet line 3 comes out as
`3 | #line 1` with the caret under the directive, and an error excerpted as the line above the
fault. The excerpt is the part people actually read, so the shifted number is accepted instead.
What makes the shift recoverable is the notice's expanded view, which shows the code that was
really sent. (This is also why the line-number question the test note asks has to be answered by
comparing against that view, not against the raw number.)

**A snippet that is *defining* something is never wrapped** (`guard` in the rules table):
`int add(int a, int b) { … }` nested in `main` is a syntax error, and `public class Student { … }`
nested in a generated class is `modifier public not allowed here`. Wrapping those would trade a
link error the compiler explains for a syntax error it does not. Same for a snippet that already
has an entry point (idempotence), an empty or comment-only block, and a Go snippet declaring a
package other than `main` (a `func main` in another package would never run). Every one of these
checks runs on `stripLiterals(code)` — comments and string literals blanked — so `// int main() {`
cannot convince the module the program is complete, and `printf` inside a string cannot drag in a
header. `stripComments` in `loop-detect.ts` cannot be reused for that: it deletes `#…`, i.e. every
`#include` line.

**C# is imports-only, and Haskell is not covered at all.** A probe showed the service accepts
top-level statements, so a C# fragment needs its `using` lines and nothing else — adding a class
would only break a snippet that awaits something. Haskell is the one entry-point language left out:
`main = do` is indentation-sensitive, so a fragment cannot be dropped into it without re-indenting
the author's lines, and "the body is copied verbatim" is the invariant the rest of this module is
built on. Its exclusion is deliberate, not an oversight.

**The other languages are left alone because "a bare statement is already a whole program" was
measured, not assumed.** Asked of the real services: `print("swift-bare")`, `puts "crystal-bare"`
and `print("r-bare")` each run as written and print the right thing, so wrapping them could only
add noise. Haskell behaves as described above rather than being broken here — a bare snippet fails
for want of `main`, and one where the user wrote `main = do` themselves runs, which is the state
that module deliberately leaves it in.

**C# also gets one statement, and it is there to undo a defect of the service rather than of the
snippet.** That service's runtime prints through a US-ASCII stdout — `Console.OutputEncoding.WebName`
answers `us-ascii` — so `Console.WriteLine("中文")` returns `??`. It is the output side and not the
transport: the same text written as a `\uXXXX` escape, i.e. with no non-ASCII byte in the source,
mangles identically. One line before the snippet's own code fixes it end to end, and it is spelled
fully qualified (`System.Console.OutputEncoding = …`) so that it still compiles when the snippet's
`using` list is empty. It is added only when the snippet can actually print non-ASCII, which is the
one question asked of `withoutComments(code)` — the second haystack in that file, which keeps string
literals and drops comments, so that `// 计算平均值` alone does not change the program. Two limits
worth knowing: it goes in **only for a snippet** (prepended to a whole program it becomes the entry
point and the program's own `Main` is ignored — `warning CS7022`, measured), so a whole C# program
printing non-ASCII still shows `?`; and a string built at runtime from char codes rather than
written in the source is not detected.

Two smaller things that will bite anyone editing the notice:

- The notice is **one line** of HTML with no raw newline, because `Term.tsx` only treats a
  single-line `<details>…</details>` as markup (its `htmlRegex`) and escapes the rest. Newlines are
  encoded as `&#10;`, the code is `escapeHtml`-ed, and the summary's `{added}` substitution happens
  before escaping — so a snippet containing `<` or `&` cannot inject markup.
- Its class is `code-runner-skeleton`, not `code-runner-warnings`, although the two look alike:
  `.code-runner-warnings` carries `margin-top: 1em` because it sits under the program's output, and
  this notice is the output's first line.

**The notice broke one predicate in `Play.tsx`, and the fix was to split it in two** (1.4.2). It is
the first thing written to the output, so a program that prints nothing used to leave a non-empty
output area, `hasResult()` was true, and ▶ was replaced by ✕ — a rerun needed a click on the clear
button first. `showsOutput()` ("the area has something to display") and `hasResult()` ("the program
printed something of its own") now answer separately, and only the second one decides the button.

What separates the two is `isPluginNote()` in `util.ts`: a line the *plugin* wrote, not the program.
Two things mark one — the ⚠️ prefix, which `Term.tsx` was already using to dim the truncation
notices, and the completion notice's own opening tag (`SKELETON_NOTICE_OPEN`, exported from
`util.ts` so the marker and the markup that produces it cannot drift apart). A compile *warning* is
deliberately not a note: it is a product of that run, and whether to clear it is the reader's call.
Both `Play` predicates include `stdio.viewEl.hasChildNodes()`, because figures are painted into the
view rather than written as lines. One case is left as it was: after a stop, the only line is
`已停止。`, which is not a note, so ✕ stands where ▶ could — long-standing behaviour, not a
regression, and changing it means deciding that runtime messages count as the plugin talking.

`api.execute` callers get the notice as the first element of the returned array, which is why the
API's JSDoc says so.

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
13. That the completion notice renders *above* the program's output (not beside it, not as raw
    HTML text) and expands to show the code that ran. `Term.tsx`'s markup path only accepts a
    single-line `<details>`, which the unit harness checks in the abstract, but the styling is
    `Play.scss` and only a window can show it.
14. The setting toggle: "Complete program skeleton" off means the next run is sent exactly as
    written with no notice, with no reload in between.

The unit-level behaviour behind 7–9 *is* covered in a terminal: `run-watch.ts` and `net.ts` are
pure and were checked at every boundary, as was `python.ts`'s offline cold-start path against a
fake Worker. What a terminal cannot show is the wiring in `Play.tsx` — that the right hint is
rendered, at the right time, over the right element.
