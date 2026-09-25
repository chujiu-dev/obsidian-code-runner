/**
 * skeleton-rules.ts — Complete an incomplete snippet so that it can run.
 *
 * A block holding `int n = 5; printf("%d", n);` is a fragment of a program,
 * not a program: it has no entry point and no `#include`. That is the shape
 * lecture notes and textbooks are made of, and the reader's intent — "run
 * these lines" — is not ambiguous. So the fragment is completed here, before
 * anything is sent to a backend, and the caller tells the user what was added.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It never completes something without strong evidence, because a wrong guess
 * is worse than no guess:
 *
 *   - a snippet that already declares an entry point is left alone (`hasEntry`);
 *   - a snippet that is *defining* a function or a type is left alone
 *     (`guard`). `int add(int a, int b) { … }` inside `main` is not C — gcc
 *     answers "a function-definition is not allowed here" — so wrapping would
 *     turn a link error into a syntax error, i.e. make it worse;
 *   - so is an empty snippet, or one that is nothing but comments.
 *
 * Every decision is made on `stripLiterals(code)` — the same text with comments
 * and string/char literals blanked — so that a `// TODO: add main` comment
 * cannot convince this module the program is complete, and a `printf` inside a
 * string does not drag in `<stdio.h>`. The one question about output rather than
 * behaviour (C#'s `prelude`) is asked of `withoutComments(code)` instead, which
 * keeps the literals: a non-ASCII character in a comment is no reason to touch
 * the program, the same character in a string is.
 *
 * WHY THE SNIPPET'S OWN PREFIX IS HOISTED
 *
 * A snippet's leading `#include`/`import` lines are moved above the generated
 * entry point rather than left where they are. That is not cosmetic:
 * `#include <iostream>` inside a function is an error, because every libstdc++
 * header defines names in `namespace std` and gcc reports "'namespace'
 * definition is not allowed here" (checked against the real service, not
 * assumed). Java, Kotlin and V `import` and Go `import` may also only appear
 * before the first declaration. Go's parenthesised `import ( … )` is hoisted as
 * a whole — hoisting just its first line would leave a bare `( "fmt" )` behind.
 *
 * Only the *leading* run is hoisted. An `#include` that appears after the first
 * statement stays where the author put it, which keeps the body readable and
 * avoids reordering code on a guess.
 *
 * WHY THERE IS NO `#line` DIRECTIVE
 *
 * Renumbering the body so compiler diagnostics match the snippet's own line
 * numbers was tried and rejected on evidence. `#line 1` does fix the number in
 * the message, but gcc then prints its source excerpt from the *physical* line
 * that logical number names, so a warning on snippet line 3 is shown as
 * `    3 | #line 1` with the caret under the directive. The excerpt is the part
 * a reader actually uses, so the offset is accepted instead: numbers are
 * shifted by the length of the prefix, and the notice's expanded view shows the
 * code that really ran, which is what makes the shift recoverable.
 *
 * WHAT EACH LANGUAGE GETS
 *
 * `entry` is the entry point the snippet is missing. C# has none on purpose:
 * the service accepts top-level statements, so a C# snippet needs its `using`
 * lines and nothing else, and wrapping it would only break top-level `await`.
 * Rust needs no headers either (the std prelude covers `println!`).
 *
 * `prelude` is the one line that has to run before the snippet prints anything.
 * Only C# has one, and it is there to undo a defect of the service rather than
 * of the snippet; see the comment on the rule itself.
 *
 * Kept free of `../i18n` (which imports `obsidian` at module scope) so this file
 * can be exercised in plain Node, like `run-watch.ts` and `loop-detect.ts`.
 */

import { canonicalLang } from './languages/aliases';

export interface SkeletonResult {
  /** The program as it will actually be sent to the backend. */
  code: string;
  /** What was added, for the user-facing notice — e.g. `['#include <stdio.h>', 'int main()']`. */
  added: string[];
}

interface Need {
  /** Matched against the stripped source. */
  use: RegExp;
  /**
   * `headers` are skipped when the snippet's own prefix already carries this
   * string, so `#include <stdio.h>` is never added twice.
   */
  key: string;
  /** Include/import lines for this need. */
  headers: string[];
  /**
   * Lines that must be emitted whenever `use` matches, even if `headers` was
   * skipped. `using std::cout;` has to follow whichever `<iostream>` include
   * won, including one the snippet brought itself.
   *
   * One name per entry rather than a list per header, so that the notice never
   * claims to have declared something the snippet does not use — and so that a
   * snippet reading only `cerr` is not told to look for `cout`.
   */
  usings?: string[];
}

interface Rules {
  /** The snippet declares its own entry point. */
  hasEntry: RegExp;
  /** The snippet is declaring a function or a type — never wrap one of those. */
  guard?: RegExp[];
  /** A leading line that belongs above the entry point. */
  hoist?: RegExp;
  /** The snippet's own prefix rules the whole idea out (Go: `package foo`). */
  refuse?: RegExp;
  /** A line that must be first in the file, if the prefix does not supply it. */
  first?: string;
  /**
   * A statement that has to run before the snippet's own output, and therefore
   * goes inside the entry point — or above the body, for a language that runs
   * top-level statements and has no entry point to go in (C#).
   *
   * `when` is tested against the code with comments removed and `unless` against
   * the code with literals removed as well: the first asks what the program
   * prints, the second what it already does.
   */
  prelude?: { when: RegExp; unless: RegExp; line: string };
  needs?: Need[];
  entry?: {
    open: string[];
    close: string[];
    /** Shown in the notice; kept short. */
    label: string;
  };
}

// ── C ────────────────────────────────────────────────────────────────────────
// `<math.h>` is safe to add even though `sqrt` needs -lm on a plain gcc: the
// playground links it, confirmed by running `sqrt(2.0)` against the service.
const C_NEEDS: Need[] = [
  {
    use: /\b(?:printf|fprintf|sprintf|snprintf|vprintf|scanf|fscanf|sscanf|puts|fputs|putchar|getchar|fopen|fclose|fgets|fread|fwrite|fflush|perror|getline|FILE|stdin|stdout|stderr|EOF)\b/,
    key: 'stdio.h', headers: ['#include <stdio.h>'],
  },
  {
    use: /\b(?:malloc|calloc|realloc|free|exit|atoi|atof|atol|strtol|strtod|qsort|rand|srand|abs|EXIT_SUCCESS|EXIT_FAILURE)\b/,
    key: 'stdlib.h', headers: ['#include <stdlib.h>'],
  },
  {
    use: /\b(?:strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strstr|strchr|strrchr|strtok|memcpy|memmove|memset|memcmp)\b/,
    key: 'string.h', headers: ['#include <string.h>'],
  },
  {
    use: /\b(?:sqrt|pow|sin|cos|tan|asin|acos|atan|atan2|exp|log|log10|fabs|floor|ceil|round|fmod|M_PI|INFINITY|NAN)\b/,
    key: 'math.h', headers: ['#include <math.h>'],
  },
  {
    use: /\b(?:int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|intptr_t|uintptr_t)\b/,
    key: 'stdint.h', headers: ['#include <stdint.h>'],
  },
  {
    use: /\b(?:bool|true|false)\b/,
    key: 'stdbool.h', headers: ['#include <stdbool.h>'],
  },
  {
    use: /\b(?:assert)\s*\(/,
    key: 'assert.h', headers: ['#include <assert.h>'],
  },
  {
    use: /\b(?:isalpha|isdigit|isalnum|isspace|isupper|islower|toupper|tolower)\s*\(/,
    key: 'ctype.h', headers: ['#include <ctype.h>'],
  },
  {
    use: /\b(?:time|clock|localtime|strftime|time_t)\b/,
    key: 'time.h', headers: ['#include <time.h>'],
  },
];

/**
 * A function definition or a type declaration. The keyword block rules out
 * `if (…) {` / `for (…) {`, which are statements and are exactly what a
 * fragment is made of.
 */
const C_GUARD: RegExp[] = [
  /^\s*(?:struct|union|enum|typedef)\b/m,
  /^(?!\s*(?:if|for|while|switch|do|else|return)\b)[^\s#/][^;{}]*\b[A-Za-z_]\w*\s*\([^;{}]*\)\s*\{/m,
];

const RULES: Record<string, Rules> = {
  c: {
    hasEntry: /\b(?:int|void)\s+main\s*\(/,
    guard: C_GUARD,
    hoist: /^#\s*include\b/,
    needs: C_NEEDS,
    entry: { open: ['int main() {'], close: ['return 0;', '}'], label: 'int main()' },
  },

  cpp: {
    hasEntry: /\b(?:int|void)\s+main\s*\(/,
    guard: [...C_GUARD, /^\s*(?:class|template)\b/m, /^\s*namespace\b/m],
    hoist: /^#\s*include\b/,
    // A `using` per name rather than `using namespace std;`: the latter drags
    // `std::max`/`std::min` into scope, so a snippet that defines its own `max`
    // and calls it would not compile. (The guard above would stop such a
    // snippet from being wrapped at all, but the narrow form is still right.)
    needs: [
      // One entry per iostream name. They share a `key`, so the include is
      // emitted once however many of them match, while each `using` appears
      // only if the snippet actually writes that name.
      { use: /\bcout\b/, key: 'iostream', headers: ['#include <iostream>'], usings: ['using std::cout;'] },
      { use: /\bcin\b/, key: 'iostream', headers: ['#include <iostream>'], usings: ['using std::cin;'] },
      { use: /\bcerr\b/, key: 'iostream', headers: ['#include <iostream>'], usings: ['using std::cerr;'] },
      { use: /\bclog\b/, key: 'iostream', headers: ['#include <iostream>'], usings: ['using std::clog;'] },
      { use: /\bendl\b/, key: 'iostream', headers: ['#include <iostream>'], usings: ['using std::endl;'] },
      { use: /\bvector\b/, key: 'vector', headers: ['#include <vector>'], usings: ['using std::vector;'] },
      { use: /\bstring\b/, key: 'string', headers: ['#include <string>'], usings: ['using std::string;'] },
      { use: /\bmap\b/, key: 'map', headers: ['#include <map>'], usings: ['using std::map;'] },
      { use: /\bset\b/, key: 'set', headers: ['#include <set>'], usings: ['using std::set;'] },
      { use: /\bqueue\b/, key: 'queue', headers: ['#include <queue>'], usings: ['using std::queue;'] },
      { use: /\bstack\b/, key: 'stack', headers: ['#include <stack>'], usings: ['using std::stack;'] },
      { use: /\bpair\b/, key: 'utility', headers: ['#include <utility>'], usings: ['using std::pair;'] },
      { use: /\bsort\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::sort;'] },
      { use: /\bmax\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::max;'] },
      { use: /\bmin\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::min;'] },
      { use: /\bfind\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::find;'] },
      { use: /\breverse\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::reverse;'] },
      { use: /\bswap\s*\(/, key: 'algorithm', headers: ['#include <algorithm>'], usings: ['using std::swap;'] },
      ...C_NEEDS.filter(need => need.key !== 'stdbool.h').map((need): Need => ({
        ...need,
        // The C++ form of each C header, which also gets `using`-free access to
        // the same names under `std::`. Verified against the service: a bare
        // `printf`/`sqrt`/`strlen`/`malloc` compiles through them.
        headers: need.headers.map(header => header.replace(/<(stdio|stdlib|string|math|stdint|assert|ctype|time)\.h>/,
          (_, name: string) => `<c${name}>`)),
      })),
      // `bool` is deliberately absent above: it is a keyword in C++, and
      // `<cstdbool>` was deprecated in C++17 and removed in C++20 — harmless in
      // the C table, a compile error here the day the service moves on.
    ],
    entry: { open: ['int main() {'], close: ['return 0;', '}'], label: 'int main()' },
  },

  java: {
    hasEntry: /\bstatic\s+(?:void|int|String)\s+main\s*\(/,
    guard: [
      // A type of the snippet's own. A local class may not carry `public`, so
      // wrapping `public class Student { … }` is not a repair.
      /^\s*(?:public|private|protected)?\s*(?:abstract|final|static)?\s*(?:class|interface|enum|record)\s+\w/m,
      // A method of the snippet's own: Java has no nested method declarations.
      /^\s*(?:public|private|protected|static|final|abstract)\b[^;{}]*\([^;{}]*\)\s*\{/m,
    ],
    hoist: /^import\s+(?:static\s+)?[\w.*]+/,
    needs: [
      {
        use: /\b(?:Scanner|Arrays|List|ArrayList|LinkedList|Map|HashMap|TreeMap|Set|HashSet|TreeSet|Collections|Queue|Deque|ArrayDeque|PriorityQueue|Random|Optional|StringJoiner)\b/,
        key: 'java.util.', headers: ['import java.util.*;'],
      },
      { use: /\b(?:BigInteger|BigDecimal)\b/, key: 'java.math.', headers: ['import java.math.*;'] },
      {
        use: /\b(?:LocalDate|LocalTime|LocalDateTime|Duration|Period|DateTimeFormatter)\b/,
        key: 'java.time.', headers: ['import java.time.*;'],
      },
      {
        use: /\b(?:File|FileReader|FileWriter|BufferedReader|InputStreamReader|PrintWriter|Files|IOException|Path|Paths)\b/,
        key: 'java.io.', headers: ['import java.io.*;'],
      },
    ],
    // `Program` rather than `Main`: the plugin's own Java test has been passing
    // with that name. A probe showed the service accepts any class name that
    // has a `main`, so this is a convention, not a requirement.
    entry: {
      open: ['public class Program {', 'public static void main(String[] args) {'],
      close: ['}', '}'],
      label: 'public class Program',
    },
  },

  go: {
    hasEntry: /\bfunc\s+main\s*\(\s*\)/,
    guard: [/^\s*(?:func|type)\s/m],
    hoist: /^(?:package\s+\w+|import\b)/,
    // A snippet that names another package cannot be given a `func main` that
    // the runner would reach.
    refuse: /^package\s+(?!main\b)\w+/m,
    first: 'package main',
    needs: [
      { use: /\bfmt\./, key: '"fmt"', headers: ['import "fmt"'] },
      { use: /\bos\./, key: '"os"', headers: ['import "os"'] },
      { use: /\bstrings\./, key: '"strings"', headers: ['import "strings"'] },
      { use: /\bstrconv\./, key: '"strconv"', headers: ['import "strconv"'] },
      { use: /\bmath\./, key: '"math"', headers: ['import "math"'] },
      { use: /\bbufio\./, key: '"bufio"', headers: ['import "bufio"'] },
      { use: /\bsort\./, key: '"sort"', headers: ['import "sort"'] },
      { use: /\btime\./, key: '"time"', headers: ['import "time"'] },
      { use: /\bio\./, key: '"io"', headers: ['import "io"'] },
      { use: /\berrors\./, key: '"errors"', headers: ['import "errors"'] },
    ],
    // An unused import is an error in Go, not a warning, so the `use` match
    // above has to be exact — this table is the reason `missingHeaders` is
    // allowed to add nothing at all.
    entry: { open: ['func main() {'], close: ['}'], label: 'func main()' },
  },

  csharp: {
    hasEntry: /\bstatic\b[^;{}()]*\bMain\s*\(/,
    guard: [
      /^\s*(?:public|private|protected|internal|static|abstract|sealed|partial|readonly)?\s*(?:class|struct|interface|enum|record)\s+\w/m,
      /^\s*(?:public|private|protected|internal|static|abstract|partial)\b[^;{}]*\b\w+\s*\([^;{}]*\)\s*\{/m,
    ],
    hoist: /^using\s+[\w.]+\s*;/,
    needs: [
      { use: /\b(?:Console|Math|Convert|Environment|DateTime)\./, key: 'using System', headers: ['using System;'] },
      {
        use: /\b(?:List|Dictionary|Queue|Stack|HashSet|IEnumerable)\s*</,
        key: 'System.Collections.Generic', headers: ['using System.Collections.Generic;'],
      },
      { use: /\.(?:Select|Where|OrderBy|ToList|ToArray|Any|All)\s*\(/, key: 'System.Linq', headers: ['using System.Linq;'] },
      { use: /\b(?:File|Directory|Path|StreamReader|StreamWriter)\./, key: 'System.IO', headers: ['using System.IO;'] },
      { use: /\bRegex\b/, key: 'RegularExpressions', headers: ['using System.Text.RegularExpressions;'] },
    ],
    // The runtime prints through a US-ASCII stdout — it reports `us-ascii` for
    // `Console.OutputEncoding.WebName` — so every character outside ASCII comes
    // out as `?`. Measured, not guessed: printing the same text through
    // `\uXXXX` escapes mangles identically, which rules out the encoding of the
    // source and puts the loss on the output side. The line below is the fix,
    // fully qualified so that it compiles even with no `using` at all.
    //
    // Only ever for a snippet this module is already completing. Prepending it to
    // a whole program makes *it* the entry point and the program's own `Main` is
    // then ignored ("warning CS7022: The entry point of the program is global
    // code") — so a complete C# program with non-ASCII output still shows `?`.
    prelude: {
      // Anything above ASCII, or written as a `\uXXXX` escape — which is the
      // same non-ASCII text after the compiler has read it, and mangles the
      // same way. (`no-control-regex` forbids spelling this `[^\x00-\x7F]`.)
      when: /[\u0080-\uFFFF]|\\[uU][0-9a-fA-F]{4}/,
      unless: /OutputEncoding/,
      line: 'System.Console.OutputEncoding = System.Text.Encoding.UTF8;',
    },
    // No `entry`: the service runs top-level statements, verified by posting
    // `Console.WriteLine("hi");` and getting `hi` back. A class wrapper would
    // only break a snippet that awaits something.
  },

  rust: {
    hasEntry: /\bfn\s+main\s*\(/,
    hoist: /^(?:use|extern\s+crate)\s/,
    // No needs: `println!`, `vec!` and the rest are in the std prelude.
    entry: { open: ['fn main() {'], close: ['}'], label: 'fn main()' },
  },

  kotlin: {
    hasEntry: /\bfun\s+main\s*\(/,
    // `fun`/`class` on its own is fine locally, so the guard keys on a modifier.
    guard: [/^\s*(?:public|private|internal|protected|open|abstract|sealed|data|enum|annotation|value|inline|operator)\s+(?:class|object|interface|fun)\b/m],
    hoist: /^import\s+/,
    needs: [
      { use: /\bScanner\b/, key: 'java.util.Scanner', headers: ['import java.util.Scanner'] },
      {
        use: /\b(?:LocalDate|LocalTime|LocalDateTime|Duration)\b/,
        key: 'java.time', headers: ['import java.time.LocalDate', 'import java.time.LocalDateTime'],
      },
      { use: /\bRandom\b/, key: 'kotlin.random', headers: ['import kotlin.random.Random'] },
    ],
    entry: { open: ['fun main() {'], close: ['}'], label: 'fun main()' },
  },

  v: {
    hasEntry: /\bfn\s+main\s*\(/,
    guard: [/^\s*(?:struct|enum|interface|type|fn)\s/m],
    hoist: /^import\s+/,
    needs: [
      { use: /\bos\./, key: 'import os', headers: ['import os'] },
      { use: /\bmath\./, key: 'import math', headers: ['import math'] },
      { use: /\bstrings\./, key: 'import strings', headers: ['import strings'] },
      { use: /\bstrconv\./, key: 'import strconv', headers: ['import strconv'] },
      { use: /\btime\./, key: 'import time', headers: ['import time'] },
      { use: /\brand\./, key: 'import rand', headers: ['import rand'] },
      { use: /\barrays\./, key: 'import arrays', headers: ['import arrays'] },
    ],
    entry: { open: ['fn main() {'], close: ['}'], label: 'fn main()' },
  },
};

/** Languages this module knows how to complete. */
export const SKELETON_LANGS: Set<string> = new Set(Object.keys(RULES));

/**
 * Blank out comments and string/char literals, preserving everything else.
 *
 * Single pass so that a `"` inside a comment and a `//` inside a string both
 * come out right; `loop-detect.ts`'s `stripComments` cannot be reused because it
 * deletes `#…`, which would remove every `#include` line before it was read.
 *
 * Kotlin's `"""…"""` and Rust's `r"…"` are handled only approximately: the run
 * is blanked, but a keyword inside one may survive. That is acceptable here —
 * the result is a haystack for "did the author write `printf`", never output.
 */
export function stripLiterals(code: string): string {
  return scan(code, true);
}

/**
 * The same scan with string and char literals left as written.
 *
 * Needed because `stripLiterals` answers "what does this code do" and this one
 * has to answer "what does it print": a non-ASCII character in a comment is no
 * reason to touch the program, the same character inside a literal is.
 */
function withoutComments(code: string): string {
  return scan(code, false);
}

function scan(code: string, blankLiterals: boolean): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    const next = code[i + 1];

    if (char === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }
    if (char === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) { out += ' '; i += 1; }
      out += '  ';
      i += 2;
      continue;
    }
    if (char === '"' || char === '\'') {
      const quote = char;
      out += blankLiterals ? ' ' : char;
      i += 1;
      while (i < code.length && code[i] !== quote) {
        // An escaped quote does not end the literal.
        if (code[i] === '\\') {
          out += blankLiterals ? '  ' : code.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += blankLiterals ? ' ' : code[i];
        i += 1;
      }
      out += blankLiterals ? ' ' : (code[i] ?? '');
      i += 1;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

/**
 * Split off the leading run of lines that belongs above the entry point: blank
 * lines, comments, and the language's own include/import/package lines —
 * including a Go `import ( … )` block, which continues until its closing paren.
 */
function splitPrefix(code: string, hoist?: RegExp): { prefix: string[]; body: string[] } {
  const lines = code.split(/\r?\n/);
  const prefix: string[] = [];
  let inBlockComment = false;
  let blockDepth = 0;
  let index = 0;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (inBlockComment) {
      prefix.push(line);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (blockDepth > 0) {
      prefix.push(line);
      if (trimmed.includes(')')) blockDepth = 0;
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('//')) {
      prefix.push(line);
      continue;
    }
    if (trimmed.startsWith('/*')) {
      prefix.push(line);
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
    if (hoist?.test(trimmed)) {
      prefix.push(line);
      if (trimmed.endsWith('(')) blockDepth = 1;
      continue;
    }
    break;
  }

  return { prefix, body: lines.slice(index) };
}

/** Whether anything is left to run once comments and the prefix are removed. */
function hasStatements(body: string): boolean {
  return /\S/.test(stripLiterals(body));
}

/**
 * Complete `code` if it is an incomplete snippet, or return `null` to leave it
 * exactly as the author wrote it.
 *
 * @example
 * ```ts
 * buildSkeleton('c', 'printf("hi");')?.added   // => ['#include <stdio.h>', 'int main()']
 * buildSkeleton('c', 'int main() { return 0; }')  // => null (already whole)
 * buildSkeleton('c', 'int add(int a, int b) { return a + b; }')  // => null (it is a definition)
 * ```
 */
export function buildSkeleton(lang: string, code: string): SkeletonResult | null {
  const rules = RULES[canonicalLang(lang)];
  if (!rules) return null;

  const stripped = stripLiterals(code);
  // The second haystack keeps literals, for the one question about output
  // rather than about behaviour.
  const printable = withoutComments(code);
  if (rules.hasEntry.test(stripped)) return null;
  if (rules.guard?.some(pattern => pattern.test(stripped))) return null;

  const { prefix, body } = splitPrefix(code, rules.hoist);
  if (!hasStatements(body.join('\n'))) return null;

  const prefixText = prefix.join('\n');
  if (rules.refuse?.test(prefixText)) return null;

  // "缺什么补什么": only what the snippet uses and does not already carry.
  const claimed = (rules.needs ?? []).filter(
    need => need.use.test(stripped) && !prefixText.includes(need.key),
  );
  // Deduplicated across needs as well as against the prefix: the C++ table has
  // one entry per `std` name, several of which share `<iostream>`.
  const headers = [...new Set(claimed.flatMap(need => need.headers))];
  // Emitted for every matching need, including one whose headers were skipped
  // because the snippet brought its own copy of that header.
  const usings = (rules.needs ?? []).filter(need => need.use.test(stripped)).flatMap(need => need.usings ?? []);
  const prelude = rules.prelude && rules.prelude.when.test(printable) && !rules.prelude.unless.test(stripped)
    ? [rules.prelude.line]
    : [];

  // Nothing to add: no entry point for this language (C#) and none of the names
  // it uses needs a header. Returning the same text with an empty notice would
  // tell the user something happened when nothing did.
  if (!rules.entry && headers.length === 0 && usings.length === 0 && prelude.length === 0) return null;

  const lines: string[] = [];
  if (rules.first && !prefix.some(line => /^package\b/.test(line.trim()))) lines.push(rules.first);
  // Anything the snippet brought goes above what is added to it: a `using
  // std::cout;` of ours may depend on an `<iostream>` of theirs.
  lines.push(...prefix, ...headers, ...usings);
  if (rules.entry) lines.push(...rules.entry.open);
  lines.push(...prelude);
  lines.push(...body);
  if (rules.entry) lines.push(...rules.entry.close);

  const added = [...headers, ...usings, ...prelude];
  if (rules.entry) added.push(rules.entry.label);

  return { code: lines.join('\n'), added };
}
