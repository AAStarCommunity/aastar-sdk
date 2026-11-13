/**
 * Online pin decision. SKIP only when gh is not ready before the first blob check.
 * A later gh failure is FAIL.
 */
export type PinOutcome = 'match' | 'mismatch' | 'error';

export function pinCheckDecision(preflight: 'unready' | 'ready', outcomes: readonly PinOutcome[]): { exitCode: number; lines: string[] } {
    if (preflight === 'unready') return { exitCode: 0, lines: ['SKIP'] };
    const lines: string[] = [];
    const failures: string[] = [];
    for (const outcome of outcomes) {
        if (outcome === 'match') lines.push('CHECKED');
        else failures.push(outcome);
    }
    if (outcomes.length === 0 || failures.length > 0) {
        return { exitCode: 1, lines: ['FAIL', ...failures] };
    }
    return { exitCode: 0, lines: [...lines, `CHECKED ${outcomes.length}`] };
}
