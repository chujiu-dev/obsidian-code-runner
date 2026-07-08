# Code Runner — Obsidian Plugin

有没有想过在obsidian上直接运行你的代码？我常常想，obsidian写出来的代码块这么漂亮，不能直接跑就太可惜了。如果这些代码块既能实现输入又能据此输出，这个笔记软件几乎就是一个完美的小终端了。我尝试了一些其他插件，发现它们很少同时提供输入与输出功能，于是我基于 Code Emitter 加入了自己需要的输入功能，并按自己的需求做了一些改动，最终做出了这个小插件。当你点击代码块右下角左侧的小键盘按钮后，就可以进行输入了；点击右侧的运行按钮，就可以看到代码的运行结果了。这不是很有意思吗？

后续还将更新语言切换功能和自动输入识别功能，也许还会和其他插件组合使用，实现更多功能。

---

Have you ever thought about running your code directly in Obsidian? I often think it's such a pity that the code blocks made in Obsidian look so beautiful but can't be run directly. If these code blocks could both take input and produce output, this note-taking app would be almost a perfect little terminal. I tried some other plugins and found that few of them provide both input and output at the same time. So I took Code Emitter, added the input functionality I needed, made a few tweaks of my own, and built this little plugin. Click the keyboard button on the left at the bottom of the code block to enter input; click the run button on the right to see the result. Isn't that interesting?

In the future, language switching and automatic input detection features will be updated. Maybe it will also be used in combination with other plugins to achieve more functions.

---

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
1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/chujiu-dev/obsidian-code-runner/releases)
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

1. Click the **⌨ keyboard icon** (left of the Play button) to show the input textarea
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
git clone https://github.com/chujiu-dev/obsidian-code-runner.git
cd obsidian-code-runner
npm install
npm run build
# Built files: main.js, styles.css
```
