/**
 * Pending Telegram sends. `--once` and every async exit drain them before the process ends.
 * Critical alerts are retried inside the same deadline. The drain does not print provider text.
 */

const pending = new Set<Promise<void>>();

export function isCriticalAlert(message: string): boolean {
    if (typeof message !== 'string' || message.length > 8_192) return false;
    if (message.includes('ALL sends closed')) return true;
    return message.includes('signer identity refused');
}

/** Register a send that has already been started. The promise is removed when it settles. */
export function trackAlert(work: Promise<unknown>): void {
    const done = Promise.resolve(work).then(() => undefined, () => undefined);
    pending.add(done);
    void done.finally(() => {
        pending.delete(done);
    });
}

/**
 * Await the drain, then call `exit`. A hanging critical send blocks `exit` until the drain returns.
 */
export async function exitAfterDrain(exit: (code: number) => void, code: number, timeoutMs = 10_000): Promise<void> {
    await drainAlerts(timeoutMs);
    exit(code);
}

/** Wait until every tracked send settles, or until `timeoutMs` elapses. */
export async function drainAlerts(timeoutMs = 10_000): Promise<void> {
    const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000 ? timeoutMs : 10_000;
    const deadline = Date.now() + budget;
    while (pending.size > 0) {
        const left = deadline - Date.now();
        if (left <= 0) return;
        const current = [...pending];
        await Promise.race([
            Promise.all(current),
            new Promise<void>((resolve) => setTimeout(resolve, left)),
        ]);
    }
}

/**
 * Retry `send` while it returns false and the alert is critical, until `deadlineMs`.
 * `send` must not throw provider text; a throw is a failed attempt.
 */
export async function retryCritical(send: () => Promise<boolean>, critical: boolean, deadlineMs = 10_000): Promise<boolean> {
    const budget = Number.isFinite(deadlineMs) && deadlineMs > 0 && deadlineMs <= 60_000 ? deadlineMs : 10_000;
    const deadline = Date.now() + budget;
    for (;;) {
        let ok = false;
        try {
            ok = await send();
        } catch {
            ok = false;
        }
        if (ok) return true;
        if (!critical) return false;
        const left = deadline - Date.now();
        if (left <= 0) return false;
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(200, left)));
    }
}
