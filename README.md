# Code Runner — Obsidian Plugin

Run code blocks interactively in Obsidian, **with standard input (stdin) support**. Supports 18+ programming languages including Python, C/C++, Java, Go, JavaScript, and more.

> 🎁 **Key Feature**: Unlike the original Code Emitter, Code Runner supports **interactive input** — `input()`, `scanf()`, `cin`, etc. now work via a built-in input textarea.

## Supported Languages

| Language | Backend | Input Support |
|----------|---------|:---:|
| Python | Pyodide (WebAssembly, local) | ✅ |
| C | SoloLearn API (remote) | ✅ |
| C++ | SoloLearn API (remote) | ✅ |
| Java | SoloLearn API (remote) | ✅ |
| Go | SoloLearn API (remote) | ✅ |
| C# | SoloLearn API (remote) | ✅ |
| Swift | SoloLearn API (remote) | ✅ |
| R | SoloLearn API (remote) | ✅ |
| JavaScript | Sandboxed eval (local) | — |
| TypeScript | Sandboxed eval (local) | — |
| Rust | Rust Playground API (remote) | — |
| Kotlin | Kotlin Playground API (remote) | — |
| Haskell | Haskell Playground API (remote) | — |
| Crystal | Crystal Playground API (remote) | — |
| V (Vlang) | V Playground API (remote) | — |
| Wenyan | wenyan-lang CDN (local) | — |
| HTML | Shadow DOM render (local) | — |

## Installation

### Method 1: Community Plugin (Recommended)
1. Open Obsidian → Settings → Community Plugins
2. Disable "Safe Mode"
3. Click "Browse" → Search "Code Runner" → Install → Enable

### Method 2: Manual Installation
1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/xkm/obsidian-code-runner/releases)
2. Create folder: `<vault>/.obsidian/plugins/code-runner/`
3. Copy the 3 files into that folder
4. Restart Obsidian → Settings → Community Plugins → Enable "Code Runner"

## Usage

### Basic Usage

Create a code block with the language name:

````markdown
```python
print("Hello, World!")
```
````

Click the ▶ **Play button** to run. Output appears below the code block.

### Using Standard Input (stdin) — Key Feature!

For programs that need user input:

1. Click the **👁 eye icon** (next to the Play button) to show the input textarea
2. Type your input data in the textarea
3. Click ▶ Run

**Python example:**

````markdown
```python
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```
````

Input in textarea:
```
Alice
25
```

Each line of input corresponds to one `input()` call.

**C example:**

````markdown
```c
#include <stdio.h>
int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("Sum: %d\n", a + b);
    return 0;
}
```
````

Input in textarea:
```
5 10
```

### Single-line vs Multi-line Input

- **C/C++/Java**: Separate values with **spaces** (e.g., `5 10 hello`)
- **Python**: Separate values by **lines** (each `input()` reads one line)

## How It Works

### Python (Local Execution)
Python code runs locally via **Pyodide** — a Python 3.12 runtime compiled to WebAssembly. On first run, Pyodide downloads ~12MB from CDN (cached thereafter). Stdin data from the textarea is fed line-by-line to Python's `sys.stdin`.

### C/C++/Java/Go/C#/Swift/R (Remote Execution)
These languages run via the **SoloLearn API**. Your code + stdin data are sent to SoloLearn's servers, which execute the code and return output.

### JavaScript/TypeScript (Local Execution)
Runs in a sandboxed JavaScript environment with a proxied window object. Console output is captured and displayed.

## Credits

This plugin is a fork of **[Code Emitter](https://github.com/mokeyish/obsidian-code-emitter)** by YISH. Key improvements:

- **Stdin/Input support** for Python, C, C++, Java, Go, C#, Swift, R
- Built-in input textarea UI for entering data before execution
- Cleaned-up, minimal plugin file structure

Original Code Emitter license: MIT

## License

MIT License — see [LICENSE](LICENSE) file.

## Building From Source

```bash
git clone https://github.com/xkm/obsidian-code-runner.git
cd obsidian-code-runner
npm install
npm run build
# Built files: main.js, styles.css
```
