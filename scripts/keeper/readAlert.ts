/**
 * First read failure per target, then one recovery. Later failures alert again.
 * The message is fixed. Provider text is not accepted.
 */

const TARGET_MAX = 64;

export interface ReadAlertState {
    failed: Set<string>;
}

export function freshReadAlerts(): ReadAlertState {
    return { failed: new Set() };
}

/** `ok` is the read result. `alert` is called only on a transition. */
export function noteTargetRead(state: ReadAlertState, target: string, ok: boolean, alert: (msg: string) => void): void {
    if (!state || !(state.failed instanceof Set)) return;
    if (typeof target !== 'string' || target.length === 0 || target.length > TARGET_MAX || target.includes('\0')) return;
    if (typeof ok !== 'boolean' || typeof alert !== 'function') return;
    const was = state.failed.has(target);
    if (!ok && !was) {
        state.failed.add(target);
        alert(`keeper: ${target} read failed`);
        return;
    }
    if (ok && was) {
        state.failed.delete(target);
        alert(`keeper: ${target} read recovered`);
    }
}
