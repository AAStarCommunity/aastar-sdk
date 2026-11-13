/**
 * Unconfigured PaymasterV4 is off and does not suppress a healthy heartbeat.
 */
import { describe, expect, it } from 'vitest';
import { rollupHealth } from './healthRollup.js';

describe('health rollup', () => {
    it('reports an unconfigured paymaster as off and still heartbeats', () => {
        const rolled = rollupHealth({
            superDisabled: false,
            superCacheOk: true,
            paymasterDisabled: false,
            paymasterConfigured: false,
            paymasterCacheOk: null,
        });
        expect(rolled.paymaster).toBe('off');
        expect(rolled.heartbeat).toBe(true);
        expect(rolled.paymasterOk).toBe(true);
    });

    it('keeps a configured not-ok paymaster out of the heartbeat', () => {
        const rolled = rollupHealth({
            superDisabled: false,
            superCacheOk: true,
            paymasterDisabled: false,
            paymasterConfigured: true,
            paymasterCacheOk: false,
        });
        expect(rolled.paymaster).toBe('not-ok');
        expect(rolled.heartbeat).toBe(false);
    });
});
