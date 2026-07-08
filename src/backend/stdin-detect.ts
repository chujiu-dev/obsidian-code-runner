/**
 * stdin-detect.ts — Auto-detection of stdin requirements in source code.
 *
 * ## Future Feature: Auto-detect input need
 *
 * When enabled, this module analyzes code to determine whether the program
 * requires stdin input. If detected, the keyboard (input) button will
 * automatically appear without the user having to click it manually.
 *
 * ## How to integrate (future versions):
 *
 * 1. Call `needsStdin(lang, code)` before rendering the Play component.
 * 2. If it returns true, set `showInput` to true by default.
 * 3. Optionally highlight the line(s) where input is read.
 *
 * ## Adding new language patterns:
 *
 * Add a regex entry in `STDIN_PATTERNS` for the target language.
 * Patterns are matched case-insensitively.
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
