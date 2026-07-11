# Code Runner — Obsidian Plugin

Run code blocks interactively in Obsidian with full **stdin input** support. Python runs locally via Pyodide (WebAssembly); 17+ other languages execute via public playground APIs.

## Features

### Hybrid Interactive Input (Python)

Code Runner provides the most complete Python input experience of any Obsidian plugin:

| Platform | Mode | Behavior |
|---|---|---|
| Desktop (SAB available) | **Interactive** | Pre-fill the first `input()` prompt, then each subsequent `input()` triggers an inline popup in real time — type and press Enter as the program runs |
| Tablet / Mobile (no SAB) | **Pre-fill** | All `input()` prompts are parsed and shown as labeled fields. Loop-based programs get a raw textarea for unlimited lines |

- **Input history**: Every prompt→response pair is displayed above the output, visible during and after execution
- **Stop button**: Terminate runaway programs during interactive execution
- **Auto-detection**: `input()` inside `while`/`for` loops is detected automatically; tablet mode switches to a multi-line textarea

### Multi-Language Support

| Language | Backend | stdin |
|---|---|---|
| Python | Pyodide v0.26.x (local WASM) | ✅ |
| C | SoloLearn API (remote) | ✅ |
| C++ | SoloLearn API (remote) | ✅ |
| Java | SoloLearn API (remote) | ✅ |
| Go | SoloLearn API (remote) | ✅ |
| C# | SoloLearn API (remote) | ✅ |
| Swift | SoloLearn API (remote) | ✅ |
| R | SoloLearn API (remote) | ✅ |
| JavaScript | Proxy-sandboxed eval (local) | — |
| TypeScript | Compiled → JS (local) | — |
| Rust | Rust Playground API (remote) | — |
| Kotlin | Kotlin Playground API (remote) | — |
| Haskell | Haskell Playground API (remote) | — |
| Crystal | Crystal Playground API (remote) | — |
| V (Vlang) | V Playground API (remote) | — |
| Wenyan | wenyan-lang CDN (local) | — |
| HTML | Shadow DOM render (local) | — |

### Quality of Life

- **Output cache**: Results persist across note switches via localStorage
- **ANSI color support**: Terminal color codes are rendered in output
- **Matplotlib**: Python matplotlib figures render inline (desktop)
- **Plugin API**: Other plugins can programmatically execute code via `app.plugins.plugins['code-runner'].api`

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

- **Python**: Each line feeds one `input()` call
- **C / C++ / Java / Go / C# / Swift / R**: Separate values with spaces (fed to the program's stdin stream)

## Architecture

```
Code Block → needsStdin() → Show pre-fill form (optional)
                │
          ┌─────┴─────┐
     SAB available?    │
     ┌───┴───┐         │
    Yes     No         │
     │       │         │
  Worker   Main-thread │
  + SAB    Pyodide     │
  (inter-  (pre-fill   │
  active)  only)       │
                       │
          Output ←─────┘
```

- **Worker + SharedArrayBuffer**: Desktop mode. `Atomics.wait/notify` synchronously blocks the Worker for interactive input without freezing the UI
- **Main-thread Pyodide**: Tablet/mobile fallback. All input must be provided before execution

## Building From Source

```bash
git clone https://github.com/chujiu-dev/obsidian-code-runner.git
cd obsidian-code-runner
npm install
npm run build
# Output: dist/main.js, dist/styles.css, dist/manifest.json
```

## Credits

Forked from **[Code Emitter](https://github.com/mokeyish/obsidian-code-emitter)** by YISH (MIT). Key additions:

- Hybrid stdin system: pre-fill + Worker/SAB interactive input
- Full Python `input()` support via `builtins.input` replacement (Pyodide v0.26.x / Python 3.12)
- Tablet/mobile fallback with auto-detection of loop-based interactive programs
- Input history, stop button, output caching, ANSI color rendering

## License

MIT — see [LICENSE](LICENSE).
