/**
 * Pending Telegram sends. `--once` and every async exit drain them before the process ends.
 * Critical alerts are classified by event type and retried on a bounded cadence until delivered
 * or resolved. The drain does not print provider text.
 */

const pending = new Set<Promise<void>>();
export const CRITICAL_RETRY_MS = 300_000;
const MESSAGE_CAP = 8_192;

export const CRITICAL_EVENTS = ['stall', 'send-ceiling', 'signer-refused', 'identity-expiry'] as const;
export type CriticalEvent = (typeof CRITICAL_EVENTS)[number];

const held = new Map<CriticalEvent, { message: string; last: number; inflight: boolean }>();

export function isCriticalEvent(event: string): event is CriticalEvent {
    if (typeof event !== 'string' || event.length > 64) return false;
    for (const item of CRITICAL_EVENTS) {
        if (item === event) return true;
    }
    return false;
}

/** Identity-gate key to a critical event. Other keys are not critical. */
export function criticalEventForGate(key: string): CriticalEvent | null {
    if (key === 'all-closed:read-expired') return 'identity-expiry';
    if (key === 'all-closed:privileged') return 'signer-refused';
    return null;
}

export function resetCriticalForTests(): void {
    held.clear();
}

/**
 * Attempt delivery when the cadence allows it. `now` and `intervalMs` are checked before `send`.
 * Success drops the event. Failure keeps it until the next cadence or `resolveCritical`.
 * A second call that overlaps the in-flight attempt does not send again.
 */
export async function deliverCritical(input: {
    event: string;
    message: string;
    now: number;
    send: (message: string) => Promise<boolean>;
    intervalMs?: number;
}): Promise<boolean> {
    const intervalMs = input.intervalMs ?? CRITICAL_RETRY_MS;
    if (!isCriticalEvent(input.event)) return false;
    if (typeof input.message !== 'string' || input.message.length === 0 || input.message.length > MESSAGE_CAP) return false;
    if (!Number.isSafeInteger(input.now) || input.now < 0) return false;
    if (!Number.isInteger(intervalMs) || intervalMs <= 0 || intervalMs > 86_400_000) return false;
    if (typeof input.send !== 'function') return false;
    const event = input.event;
    const row = held.get(event);
    if (row && (row.inflight || input.now - row.last < intervalMs)) return false;
    held.set(event, { message: input.message, last: input.now, inflight: true });
    let ok = false;
    try {
        ok = await input.send(input.message);
    } catch {
        ok = false;
    } finally {
        const current = held.get(event);
        if (current) current.inflight = false;
    }
    if (ok === true) held.delete(event);
    return ok === true;
}

/** Retry events still held. The caller supplies the clock. No event means no send. */
export async function retryHeldCritical(now: number, send: (message: string) => Promise<boolean>): Promise<void> {
    if (!Number.isSafeInteger(now) || now < 0 || typeof send !== 'function') return;
    const events = pendingCriticalEvents();
    for (const event of events) {
        const row = held.get(event);
        if (!row) continue;
        await deliverCritical({ event, message: row.message, now, send });
    }
}

/** Stop retrying. Used when the condition is resolved, whether or not a send landed. */
export function resolveCritical(event: string): void {
    if (!isCriticalEvent(event)) return;
    held.delete(event);
}

export function pendingCriticalEvents(): CriticalEvent[] {
    return [...held.keys()];
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
