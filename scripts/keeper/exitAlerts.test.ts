/**
 * Pending Telegram sends must be drained, and critical alerts retried, before exit.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { criticalEventForGate, deliverCritical, drainAlerts, exitAfterDrain, isCriticalEvent, pendingCriticalEvents, resetCriticalForTests, retryCritical, trackAlert } from './exitAlerts.js';

let releaseHang: (() => void) | null = null;

afterEach(() => {
    releaseHang?.();
    releaseHang = null;
    resetCriticalForTests();
});

describe('exit alerts', () => {
    it('drain waits for a pending send and then returns', async () => {
        let release!: () => void;
        const hung = new Promise<void>((resolve) => { release = resolve; });
        trackAlert(hung);
        let settled = false;
        const pending = drainAlerts(2_000).then(() => { settled = true; });
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(settled).toBe(false);
        release();
        await pending;
        expect(settled).toBe(true);
    });

    it('a hanging send returns when the deadline elapses', async () => {
        const hung = new Promise<void>((resolve) => { releaseHang = resolve; });
        trackAlert(hung);
        const start = Date.now();
        await drainAlerts(80);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(70);
        expect(elapsed).toBeLessThan(1_000);
    });

    it('retries a critical alert until it succeeds inside the deadline', async () => {
        let attempts = 0;
        const ok = await retryCritical(async () => {
            attempts += 1;
            return attempts >= 3;
        }, true, 2_000);
        expect(ok).toBe(true);
        expect(attempts).toBe(3);
    });

    it('stops a critical alert at the deadline and does not retry a non-critical failure', async () => {
        const start = Date.now();
        const critical = await retryCritical(async () => false, true, 350);
        expect(critical).toBe(false);
        expect(Date.now() - start).toBeGreaterThanOrEqual(300);
        let attempts = 0;
        const ordinary = await retryCritical(async () => {
            attempts += 1;
            return false;
        }, false, 2_000);
        expect(ordinary).toBe(false);
        expect(attempts).toBe(1);
    });

    it('classifies stall, send-ceiling, signer-refused, and identity-expiry by event type', () => {
        expect(isCriticalEvent('stall')).toBe(true);
        expect(isCriticalEvent('send-ceiling')).toBe(true);
        expect(isCriticalEvent('signer-refused')).toBe(true);
        expect(isCriticalEvent('identity-expiry')).toBe(true);
        expect(isCriticalEvent('sender: above gas ceiling')).toBe(false);
        expect(isCriticalEvent('ALL sends closed')).toBe(false);
        expect(criticalEventForGate('all-closed:read-expired')).toBe('identity-expiry');
        expect(criticalEventForGate('all-closed:privileged')).toBe('signer-refused');
        expect(criticalEventForGate('pause-only:read')).toBeNull();
        expect(criticalEventForGate('open')).toBeNull();
    });

    it('keeps an undelivered critical alert and delivers it once the sender recovers', async () => {
        let up = false;
        const sends: string[] = [];
        const send = async (message: string) => {
            sends.push(message);
            return up;
        };
        expect(await deliverCritical({ event: 'stall', message: 'stall closed', now: 1_000, send })).toBe(false);
        expect(sends).toEqual(['stall closed']);
        expect(await deliverCritical({ event: 'stall', message: 'stall closed', now: 1_000 + 299_000, send })).toBe(false);
        expect(sends).toHaveLength(1);
        up = true;
        expect(await deliverCritical({ event: 'stall', message: 'stall closed', now: 1_000 + 300_000, send })).toBe(true);
        expect(sends).toHaveLength(2);
        expect(pendingCriticalEvents()).toEqual([]);
        expect(await deliverCritical({ event: 'identity-expiry', message: 'x'.repeat(8_193), now: 1, send })).toBe(false);
        expect(sends).toHaveLength(2);
    });

    it('does not send a second attempt while the first critical delivery is in flight', async () => {
        let release!: (ok: boolean) => void;
        const gate = new Promise<boolean>((resolve) => { release = resolve; });
        let calls = 0;
        const first = deliverCritical({
            event: 'send-ceiling',
            message: 'send ceiling exceeded — all sends closed',
            now: 5_000,
            send: async () => {
                calls += 1;
                return gate;
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const second = await deliverCritical({
            event: 'send-ceiling',
            message: 'send ceiling exceeded — all sends closed',
            now: 5_000 + 300_000,
            send: async () => {
                calls += 1;
                return true;
            },
        });
        expect(second).toBe(false);
        expect(calls).toBe(1);
        release(false);
        expect(await first).toBe(false);
        expect(calls).toBe(1);
    });

    it('exit waits for a hanging alert and then calls the exit callback', async () => {
        let release!: () => void;
        const hung = new Promise<void>((resolve) => { release = resolve; });
        trackAlert(hung);
        let exited: number | null = null;
        const pending = exitAfterDrain((code) => { exited = code; }, 7, 2_000);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(exited).toBeNull();
        release();
        await pending;
        expect(exited).toBe(7);
    });
});
