import { requestUrl } from 'obsidian';
import type { CodeOutput as StdIO } from '..';

const url = 'https://play.vosca.dev/run';

export default async function (code: string, output: StdIO): Promise<void> {
  const res = await requestUrl({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `code=${encodeURIComponent(code)}`
  });

  const json = res.json as {
    output: string,
    buildOutput: string,
    error: string
  };

  if (json.error?.length > 0) {
    output.stderr(json.error);
  } else {
    output.stdout(json.output);
  }
}