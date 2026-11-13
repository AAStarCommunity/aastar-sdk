/**
 * Identity refresh failures stay inside the step. The price tick still runs.
 */
import { describe, expect, it } from 'vitest';
import { runKeeperStep } from './keeperStep';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('keeper step', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('still ticks when refreshIdentity throws, and alerts that failure once', async () => {
        const ticks: number[] = [];
        const skipped: string[] = [];
        const alerts: string[] = [];
        const alerted = new Set<string>();
        const step = () => runKeeperStep({
            refreshIdentity: async () => {
                throw new Error('identity rpc http://127.0.0.1:9/secret failed');
            },
            tick: async () => {
                ticks.push(1);
            },
            pauseDue: true,
            onPause: async () => {
                throw new Error('pause must be skipped');
            },
            onPauseSkipped: async (reason) => {
                skipped.push(reason);
            },
            alert: (msg) => {
                alerts.push(msg);
            },
            alerted,
        });
        await step();
        await step();
        expect(ticks).toEqual([1, 1]);
        expect(skipped).toEqual(['signer identity refused', 'signer identity refused']);
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).not.toContain('http');
        expect(alerts[0]).toContain('<url>');
    });
});
