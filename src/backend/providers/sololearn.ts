import { requestUrl } from 'obsidian';
import { ClientAgent } from '../../version';
import { t } from '../../i18n';

const url = 'https://api2.sololearn.com/v2/codeplayground/v2/compile';

/**
 * Split SoloLearn output into clean program output and compiler diagnostics.
 * SoloLearn mixes gcc/clang warnings directly into data.output (errors[] is
 * empty when success=true), so we detect the first diagnostic line and split.
 */
export function splitDiagnostics(raw: string): { output: string; diagnostics: string } {
  const diagStart = raw.search(/^\.\/Playground\/file\d+\.\w+:/m);
  if (diagStart === -1) return { output: raw, diagnostics: '' };
  return {
    output: raw.substring(0, diagStart).trimEnd(),
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
  const label = parts.join(', ') || t('diag.defaultLabel');
  const body = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
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

  const res = await requestUrl({
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