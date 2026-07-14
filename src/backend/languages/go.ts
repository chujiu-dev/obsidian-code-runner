import type { Stdio } from '..';
import { run, splitDiagnostics, formatWarnings } from '../providers/sololearn';

export default async function(code: string, stdio: Stdio): Promise<void> {
  const res = await run(code, 'go', stdio.getStdin());
  if (res.success) {
    const { output, diagnostics } = splitDiagnostics(res.data.output);
    if (output) stdio.stdout(output);
    if (diagnostics) stdio.write(formatWarnings(diagnostics));
  } else {
    stdio.stderr((res.errors ?? []).join('\n'))
  }
}