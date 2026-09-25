import type { Stdio } from '..';
import { requestWithTimeout } from '../net';

const url = 'https://play.rust-lang.org/execute';

export default async function(code: string, stdio: Stdio): Promise<void> {
  const data = {
    'channel': 'stable',
    'mode': 'debug',
    'edition': '2021',
    'crateType': 'bin',
    'tests': false,
    'code': code,
    'backtrace': false
  };

  const res = await requestWithTimeout({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  const out = res.json as { success: boolean; stdout: string; stderr: string };
  if (out.success) {
    stdio.stdout(out.stdout)
  } else {
    stdio.stderr(out.stderr);
  }
}