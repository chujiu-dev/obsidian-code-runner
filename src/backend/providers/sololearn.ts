import { ClientAgent } from '../../version';
import { requestWithTimeout } from '../net';
import { t } from '../../i18n';
import { escapeHtml } from '../util';

const url = 'https://api2.sololearn.com/v2/codeplayground/v2/compile';

/**
 * The service's own sentence for "the program printed nothing".
 *
 * It is not the program's text: all seven languages of this service answer with
 * this exact literal when there is neither output nor a diagnostic, and it
 * arrives in English whatever `Accept-Language` says (measured against the
 * live API). Left alone it was the one English sentence a Chinese reader would
 * see from a perfectly correct run — `int x = 41 + 1;` printed `No output.`
 * under a Chinese completion notice. A program that literally prints this text
 * and nothing else is indistinguishable from the placeholder, which is
 * harmless: the replacement says the same thing.
 *
 * The replacement is a *note* rather than program output — it opens with the
 * ⚠️ that `isPluginNote` reads — so `Play.tsx` does not take it for "the
 * program printed something" and swap ▶ for ✕.
 */
const NO_OUTPUT = 'No output.';

/** A bare placeholder becomes a translated note; anything else is left as is. */
function withoutPlaceholder(output: string): string {
  return output.trim() === NO_OUTPUT ? t('sololearn.noOutput') : output;
}

/**
 * Split SoloLearn output into clean program output and compiler diagnostics.
 * SoloLearn mixes gcc/clang warnings directly into data.output (errors[] is
 * empty when success=true), so we detect the first diagnostic line and split.
 */
export function splitDiagnostics(raw: string): { output: string; diagnostics: string } {
  const diagStart = raw.search(/^\.\/Playground\/file\d+\.\w+:/m);
  if (diagStart === -1) return { output: withoutPlaceholder(raw), diagnostics: '' };
  return {
    output: withoutPlaceholder(raw.substring(0, diagStart).trimEnd()),
    diagnostics: raw.substring(diagStart).trim(),
  };
}

/** Format compiler diagnostics as a single-line collapsed grey &lt;details&gt; block. */
export function formatWarnings(text: string): string {
  const lines = text.split('\n');
  const warnCount = lines.filter(l => /:\d+:\d+:\s+warning:/.test(l)).length;
  const errCount = lines.filter(l => /:\d+:\d+:\s+error:/.test(l)).length;
  const parts: string[] = [];
  if (errCount) parts.push(t('diag.errorCount', { n: errCount, s: errCount > 1 ? 's' : '' }));
  if (warnCount) parts.push(t('diag.warningCount', { n: warnCount, s: warnCount > 1 ? 's' : '' }));
  const label = parts.join(t('diag.separator')) || t('diag.defaultLabel');
  // Escaped (and newlines encoded) because Term renders this line with innerHTML.
  const body = escapeHtml(text).replace(/\n/g, '&#10;');
  return `<details class="code-runner-warnings"><summary>⚠ ${label}</summary><pre>${body}</pre></details>`;
}

export const run = async (code: string, lang: 'cpp' | 'go' | 'c' | 'java' | 'cs' | 'swift' | 'r', input?: string) => {
  const header = {
    'User-Agent': ClientAgent,
    'Client-Agent': ClientAgent,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
    'Content-Type': 'application/json',
  };

  const res = await requestWithTimeout({
    url,
    headers: header,
    body: JSON.stringify({
      'code': code,
      'codeId': null,
      'input': input || '',
      'language': lang
    }),
    method: 'POST',
  });
  return res.json as {
    success: boolean,
    errors: string[],
    data: {
      sourceCode: number,
      status: number,
      errorCode: number,
      output: string,
      date: string,
      language: string,
      input: string,
    }
  };
};