/**
 * Pending Telegram sends must be drained, and critical alerts retried, before exit.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { drainAlerts, exitAfterDrain, isCriticalAlert, retryCritical, trackAlert } from './exitAlerts.js';

let releaseHang: (() => void) | null = null;

afterEach(() => {
    releaseHang?.();
    releaseHang = null;
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

    it('treats stall and signer-identity alerts as critical and rejects an oversized message', () => {
        expect(isCriticalAlert('in-flight nonce 7 not included after 600s; ALL sends closed until a human acts')).toBe(true);
        expect(isCriticalAlert('signer identity refused')).toBe(true);
        expect(isCriticalAlert('sender: above gas ceiling')).toBe(false);
        expect(isCriticalAlert('x'.repeat(8_193))).toBe(false);
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
