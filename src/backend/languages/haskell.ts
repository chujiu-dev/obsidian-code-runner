import { requestUrl } from 'obsidian';

import type { Stdio } from '..';
import { ClientAgent } from '../../version';

const headers = {
  'User-Agent': ClientAgent,
  'Client-Agent': ClientAgent,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

let ghcVersion: string | undefined;

const getGhcVersion = async (): Promise<string> => {
  const res = await requestUrl({
    url: 'https://play.haskell.org/versions',
    headers,
  });
  const versions = res.json as string[];
  ghcVersion = versions[versions.length - 1] ?? '';

  return ghcVersion;
};

const run = async (code: string) => {
  const res = await requestUrl({
    url: 'https://play.haskell.org/submit',
    headers,
    body: JSON.stringify({
      code,
      opt: 'O1',
      output: 'run',
      version: ghcVersion ?? await getGhcVersion(),
    }),
    method: 'POST',
  });

  return res.json as {
    ec: number;
    ghcout: string;
    sout: string;
    serr: string;
    timesec: number;
  };
};

export default async function (code: string, stdio: Stdio): Promise<void> {
  const res = await run(code);

  if (res.ec == 0) {
    stdio.stdout(res.sout);
    stdio.stdout(res.serr);
  } else {
    stdio.stderr(res.ghcout);
  }
}