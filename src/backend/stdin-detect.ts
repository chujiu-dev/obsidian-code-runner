/**
 * stdin-detect.ts — Parse & analyze stdin-reading patterns in source code.
 */

/** Per-language regex patterns that indicate stdin usage. */
const STDIN_PATTERNS: Record<string, RegExp[]> = {
  // Python: input(), sys.stdin.read(), sys.stdin.readline()
  python: [
    /\binput\s*\(/,
    /sys\.stdin\.read/,
    /sys\.stdin\.readline/,
  ],

  // C: scanf, gets, fgets, getchar, getc
  c: [
    /\bscanf\s*\(/,
    /\bgets\s*\(/,
    /\bfgets\s*\(/,
    /\bgetchar\s*\(/,
    /\bgetc\s*\(/,
  ],

  // C++: std::cin, cin >>, getline, scanf
  cpp: [
    /std::cin/,
    /\bcin\s*>>/,
    /\bgetline\s*\(/,
    /\bscanf\s*\(/,
  ],

  // Java: Scanner, BufferedReader.readLine, Console.readLine, DataInputStream
  java: [
    /\bScanner\b/,
    /\bBufferedReader\b/,
    /\breadLine\s*\(/,
    /\bnextInt\s*\(/,
    /\bnextLine\s*\(/,
    /\bnextDouble\s*\(/,
    /\bnext\s*\(/,
    /\bnextFloat\s*\(/,
    /\bnextLong\s*\(/,
    /\bnextShort\s*\(/,
    /\bnextByte\s*\(/,
    /\bnextBoolean\s*\(/,
    /\bDataInputStream\b/,
  ],

  // Go: fmt.Scan, fmt.Scanf, fmt.Scanln, bufio.NewReader, os.Stdin
  go: [
    /fmt\.Scan\b/,
    /fmt\.Scanf\b/,
    /fmt\.Scanln\b/,
    /bufio\.NewReader/,
    /os\.Stdin/,
  ],

  // C#: Console.Read, Console.ReadLine
  csharp: [
    /Console\.Read\b/,
    /Console\.ReadLine\b/,
    /Console\.ReadKey\b/,
  ],

  // Swift: readLine()
  swift: [
    /\breadLine\s*\(/,
    /\bread\s*\(/,
  ],

  // R: readline(), scan(), scan()
  r: [
    /\breadline\s*\(/,
    /\bscan\s*\(/,
    /\breadLines\s*\(/,
  ],
};

/**
 * Check whether the given source code likely requires stdin input.
 *
 * @param lang  - Language identifier (e.g. 'python', 'cpp').
 * @param code  - Source code string to analyze.
 * @returns true if the code contains stdin-reading patterns.
 *
 * @example
 * ```ts
 * needsStdin('python', 'name = input("Enter: ")')  // => true
 * needsStdin('python', 'print("Hello")')           // => false
 * needsStdin('c', 'scanf("%d", &n);')              // => true
 * ```
 */
export function needsStdin(lang: string, code: string): boolean {
  const patterns = STDIN_PATTERNS[lang];
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((re) => re.test(code));
}

/**
 * Languages that support stdin input in Code Runner.
 * Used for UI decisions (e.g. showing the keyboard toggle).
 */
export const STDIN_SUPPORTED_LANGS = new Set([
  'python',
  'c',
  'cpp',
  'java',
  'go',
  'csharp',
  'swift',
  'r',
]);

/**
 * Check whether a language supports stdin at all.
 */
export function supportsStdin(lang: string): boolean {
  return STDIN_SUPPORTED_LANGS.has(lang);
}

// ── Prompt extraction ──

/** One parsed input() call from source code. */
export interface InputPrompt {
  /** Literal prompt text from source, e.g. "请输入姓名：". Empty string if none. */
  prompt: string;
  /** Display label for the UI field. Same as prompt, or "Input #N" / "Input #N (动态)". */
  label: string;
  /** True when the prompt can't be statically determined (f-string, variable, etc.). */
  dynamic: boolean;
}

/**
 * Extract input() prompts from source code for UI visualization.
 *
 * Currently only Python is supported. Returns an empty array for all
 * other languages (they fall back to the raw textarea).
 *
 * @param lang - Language identifier.
 * @param code - Source code to analyze.
 * @returns Array of parsed input prompts in source order.
 */
export function extractInputPrompts(lang: string, code: string): InputPrompt[] {
  if (lang !== 'python') return [];

  const results: InputPrompt[] = [];
  let counter = 0;

  // Strip # comments to reduce false matches inside comments
  const cleanCode = code.replace(/#.*$/gm, '');

  const inputRe = /\binput\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = inputRe.exec(cleanCode)) !== null) {
    counter++;
    const pos = match.index + match[0].length;
    const after = cleanCode.slice(pos);

    // Case 1: input() — no arguments
    const noArgMatch = after.match(/^\s*\)/);
    if (noArgMatch) {
      results.push({ prompt: '', label: `Input #${counter}`, dynamic: false });
      continue;
    }

    // Case 2: input("...") or input('...') — literal string prompt
    const strMatch = after.match(/^\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*\)/);
    if (strMatch) {
      const rawPrompt = strMatch[2].replace(/\\(.)/g, '$1');
      results.push({ prompt: rawPrompt, label: rawPrompt, dynamic: false });
      continue;
    }

    // Case 3: input(f"..."), input(var), etc. — dynamic prompt
    results.push({ prompt: '', label: `Input #${counter} (动态)`, dynamic: true });
  }

  return results;
}

// ── Interactive stdin detection (unbounded input, e.g. while loops) ──

/**
 * Detect whether the program uses input() inside a loop (while/for),
 * meaning the number of stdin lines is unbounded and cannot be
 * statically determined. Used to decide whether the tablet fallback
 * should show a raw multi-line textarea instead of labeled fields.
 *
 * Heuristic (Python only):
 *  - input() appears on a line whose indent is deeper than a preceding
 *    `while` or `for` line, AND no dedent back to that loop's level
 *    before the input() call.
 *
 * @example
 * ```ts
 * isInteractiveStdin('python', `
 * while True:
 *     x = input("> ")  // → true
 * `)  // => true
 *
 * isInteractiveStdin('python', `
 * name = input("Name: ")
 * age  = input("Age: ")  // → false (sequential, bounded)
 * `)  // => false
 * ```
 */
export function isInteractiveStdin(lang: string, code: string): boolean {
  if (lang !== 'python') return false;

  // Strip comments to avoid false positives
  const clean = code.replace(/#.*$/gm, '');

  const lines = clean.split('\n');
  const whileForRe = /\b(while|for)\b.*:/;
  const inputRe = /\binput\s*\(/;

  // Track active loop indentation levels (stack)
  const loopIndents: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    const indent = line.search(/\S/); // first non-whitespace column

    // Pop loops that have been dedented past
    while (loopIndents.length > 0 && indent <= loopIndents[loopIndents.length - 1]) {
      loopIndents.pop();
    }

    // Does this line start a new while/for loop?
    if (whileForRe.test(trimmed)) {
      // Check if input() is on this same line (unlikely but possible)
      // Push AFTER checking so we don't match the loop header itself
      loopIndents.push(indent);
      continue;
    }

    // Is this an input() call inside an active loop?
    if (loopIndents.length > 0 && inputRe.test(trimmed)) {
      return true;
    }
  }

  return false;
}
