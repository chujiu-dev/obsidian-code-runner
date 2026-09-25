import languages from './languages';
import type { Stdio } from './store';

export { createStdio } from './store';
export type { Stdio } from './store';

export type Backend = {
    loading?: boolean;
    /**
     * Stop a running execution (if supported) and resolve its run promise.
     *
     * `output` identifies which run to stop: several code blocks share one
     * runtime, so a run may still be queued behind another block's execution.
     */
    terminate?: (output?: Stdio) => void;
    (code: string, output: Stdio): Promise<void>
}


export default {
  ...languages,
};