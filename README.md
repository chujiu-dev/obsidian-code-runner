# Code Runner — Obsidian Plugin

Run code blocks interactively in Obsidian with full **stdin input** support. 17 language tags are supported: Python runs locally via Pyodide (WebAssembly), four more run in the browser (JavaScript, TypeScript, HTML, Wenyan), and the remaining twelve go through public playground APIs.

## Features

### Hybrid Interactive Input (Python)

Code Runner provides the most complete Python input experience of any Obsidian plugin:

| Platform | Mode | Behavior |
|---|---|---|
| Desktop (SAB available) | **Interactive** | Pre-fill the first `input()` prompt, then each subsequent `input()` triggers an inline popup in real time — type and press Enter as the program runs |
| Tablet / Mobile (no SAB) | **Pre-fill** | All `input()` prompts are parsed and shown as labeled fields. Loop-based programs get a raw textarea for unlimited lines |

- **Input history**: Every prompt→response pair is displayed above the output, visible during and after execution
- **Stop button**: Interrupt a running Python program at any time — including a `while True:` loop that never asks for input
- **Auto-detection**: `input()` inside `while`/`for` loops is detected automatically; tablet mode switches to a multi-line textarea

### One-shot Input (other languages)

`stdin`-capable remote languages (C, C++, Java, Go, C#, Swift, R) get a plain stdin textarea. The text is handed to the compiler service **with the compile request**, so these languages cannot prompt you mid-run the way Python can — fill in everything the program will read before starting it.

### Multi-Language Support

| Language | Backend | stdin |
|---|---|---|
| Python | Pyodide v0.26.x (local WASM) | ✅ interactive |
| C | SoloLearn API (remote) | ✅ one-shot |
| C++ | SoloLearn API (remote) | ✅ one-shot |
| Java | SoloLearn API (remote) | ✅ one-shot |
| Go | SoloLearn API (remote) | ✅ one-shot |
| C# | SoloLearn API (remote) | ✅ one-shot |
| Swift | SoloLearn API (remote) | ✅ one-shot |
| R | SoloLearn API (remote) | ✅ one-shot |
| JavaScript | `AsyncFunction` on the main thread (local) | — |
| TypeScript | Transpiled → JavaScript (local) | — |
| Rust | Rust Playground API (remote) | — |
| Kotlin | Kotlin Playground API (remote) | — |
| Haskell | Haskell Playground API (remote) | — |
| Crystal | Crystal Playground API (remote) | — |
| V (Vlang) | V Playground API (remote) | — |
| Wenyan | wenyan-lang from CDN (local) | — |
| HTML | Rendered into a shadow root (local) | — |

Fence tags accepted: the names above, plus these aliases — `py` (Python), `javascript`, `typescript`,
`haskell`, `vlang`, `wenyan`, `cr`, `R`, `golang`. A fence tag outside that list is not recognised at
all: the block stays a plain code block with no run button. `py` was the usual casualty of that
(`python` and `py` are the same backend).

`c++` and `c#` are deliberately **not** aliases: write `cpp` and `csharp`. Obsidian turns a
registered tag into a CSS selector, and those two are not valid selectors, so registering them
breaks the rendering of every note in the vault.

### Quality of Life

- **Output cache**: Results persist across note switches via localStorage; entries untouched for 30 days are pruned
- **ANSI color support**: Terminal color codes are rendered in output
- **Plugin API**: Other plugins can programmatically execute code via `app.plugins.plugins['code-runner'].api`

### Runtime Limits

Worth knowing before you write a long loop:

- **JavaScript runs on the UI thread.** A `while (true) {}` in a JS block freezes Obsidian, and JS blocks have no stop button.
- **Only the desktop Python runtime can be stopped.** On a tablet/phone (no `SharedArrayBuffer`) Python also occupies the UI thread, so no stop button is offered there — the button only appears when it can actually work.
- **Matplotlib figures** are wired up on the main-thread Python runtime only. On desktop Python runs in a Worker, where figures are not rendered into the note.
- **Remote languages depend on their playground APIs** being reachable. Requests time out after 20 s instead of hanging, 4xx/5xx responses are reported with their status code, and a run started while offline says so immediately rather than sending a request that cannot succeed.
- **A run that looks stuck says so.** After 10 s with no output a block adds a one-line hint that it is still running and offers the stop button; if the code also looks loop-shaped (`while True:` with no `break`/`return`/`exit`), the hint says it may be an infinite loop instead — a program that keeps printing is left alone unless its shape is loop-like. Languages that cannot be stopped mid-run wait 30 s and are told to check the network rather than to press a button that does not exist.
- **Output is capped at 5000 lines.** A program that prints without end keeps only its most recent 5000 lines, with the first line of the output replaced by a notice saying how many were dropped. This is what keeps such a program from freezing the editor: output used to cost time proportional to the square of the line count (80 000 lines blocked the interface for 20 seconds, hiding the very hint that tells you how to stop the loop).
- **A queued block that waits too long says so.** Blocks run one at a time; after two minutes of waiting the queue notice adds a hint that the block ahead may be stuck, and that it can be stopped from its own block.
- **Loading the Python runtime is visible.** The first run (and the first run after a stop that had to restart it) shows a "loading" notice while ~10 MB of Pyodide is fetched, and reports an error after 60 s instead of spinning forever. A cold load with no network connection fails immediately with that explanation; a run on an already-loaded runtime works offline, since it is local WebAssembly.

## Installation

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/chujiu-dev/obsidian-code-runner/releases)
2. Create `<vault>/.obsidian/plugins/code-runner/` and copy the 3 files in
3. Settings → Community Plugins → Enable "Code Runner"

### Community Plugin (pending approval)

Once approved, install directly via Settings → Community Plugins → Browse → "Code Runner".

## Usage

Create a fenced code block with a language tag:

````markdown
```python
name = input("Enter your name: ")
age  = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```
````

- Click the **⌨ keyboard icon** (bottom-right of the code block) to open the input form
- Fill in your input values and click **▶** to run
- Output appears below the code block

### Input Format

- **Python**: Each line feeds one `input()` call, consumed in order. Anything the program still asks for after your lines run out is prompted interactively (desktop).
- **C / C++ / Java / Go / C# / Swift / R**: The textarea is passed to the program's stdin verbatim. Write it the way your code reads it — `3 4` on one line for two `scanf`/`Scanner` calls, `Alice` then `25` on separate lines for `readLine`-style readers.

## Architecture

```
Code Block → needsStdin() → input form (only for languages that can be fed)
                │
        which language?
   ┌────────────┴─────────────┐
Python                  C/C++/Java/Go/C#/Swift/R
   │                              │
SAB available?              SoloLearn compile API
 ┌─┴──┐                      (stdin travels with
Yes   No                      the request)
 │     │
Worker  Main-thread
+ SAB   Pyodide
(inter- (pre-fill
active) only)
   └────────────┬─────────────┘
              Output
```

- **Worker + SharedArrayBuffer**: Desktop Python. `Atomics.wait/notify` blocks the Worker for interactive input without freezing the UI; a SIGINT cell handed to `pyodide.setInterruptBuffer` plus an abort sentinel in the same buffer is what the stop button uses
- **Main-thread Pyodide**: Tablet/mobile fallback, and the runtime that wires up matplotlib. All input must be provided before execution
- **Remote APIs**: the twelve playground-backed languages, one request per run

## Building From Source

```bash
git clone https://github.com/chujiu-dev/obsidian-code-runner.git
cd obsidian-code-runner
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # typecheck + vite build → dist/main.js, dist/styles.css, dist/manifest.json
```

To copy the build into a vault you test against, create a `.env` file (gitignored):

```ini
VAULT_PLUGIN_DIR=E:/path/to/vault/.obsidian/plugins/code-runner
```

and run `npm run deploy`.

## Credits

Forked from **[Code Emitter](https://github.com/mokeyish/obsidian-code-emitter)** by YISH (MIT). Key additions:

- Hybrid stdin system: pre-fill + Worker/SAB interactive input
- Full Python `input()` support via `builtins.input` replacement (Pyodide v0.26.x / Python 3.12)
- Tablet/mobile fallback with auto-detection of loop-based interactive programs
- One-shot stdin for the seven remote languages, sent with the compile request
- Interruptible runs (SIGINT plus an abort sentinel in the shared buffer) and a per-runtime run queue, so two blocks cannot interleave their output
- Configurable Pyodide CDN, input history, stop button, output caching, ANSI color rendering

## License

MIT — see [LICENSE](LICENSE).
