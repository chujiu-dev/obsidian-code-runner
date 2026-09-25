import type { Stdio } from '..';
import { requestWithTimeout } from '../net';

// The playground moved off `play.vosca.dev`, which stopped resolving (NXDOMAIN
// on 2026-09-25) without any announcement. The current host answers on the same
// path with the same form body and the same `{ output, buildOutput, error }`,
// so only the host name changed.
const url = 'https://play.vlang.io/run';

export default async function (code: string, output: Stdio): Promise<void> {
  const res = await requestWithTimeout({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `code=${encodeURIComponent(code)}`
  });

  const json = res.json as {
    output: string;
    buildOutput: string;
    error: string;
  };

  if (json.error?.length > 0) {
    output.stderr(json.error);
  } else {
    output.stdout(json.output);
  }
}