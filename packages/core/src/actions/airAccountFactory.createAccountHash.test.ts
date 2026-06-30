import { describe, it, expect } from 'vitest';
import { buildCreateAccountHash, configHashFromInitConfig } from './airAccountFactory.js';
import { buildInitConfig } from './initConfig.js';
import type { Hex, Address } from 'viem';

// Golden vectors for the v0.22.0 CREATE_ACCOUNT relay-mode digest (#249). The bytes are CROSS-CHECKED
// on-chain by tests/regression/onchain-evidence/createaccount-relay-passkey-e2e.ts — a successful relay
// deploy proves the replica matches the factory's internal _getConfigHash + preimage (a wrong byte =>
// ecrecover != owner => InvalidOwnerSignature revert). These constants pin the encoding so a future
// drift in field order/types is caught WITHOUT needing the chain.
describe('buildCreateAccountHash / configHashFromInitConfig (v0.22.0 #249)', () => {
    const config = buildInitConfig({
        guardians: [{ ecdsa: '0x4444444444444444444444444444444444444444' as Address }],
        dailyLimit: 10n ** 18n,
        minDailyLimit: 10n ** 17n,
        approvedAlgIds: [0x0a],
    });
    const args = {
        chainId: 11155111,
        factory: '0x0eb0E7a61d5D9e03bc3578f8C1b0d9f40cc0a5B9' as Address,
        owner: '0x1111111111111111111111111111111111111111' as Address,
        salt: 42n,
        ownerP256X: `0x${'22'.repeat(32)}` as Hex,
        ownerP256Y: `0x${'33'.repeat(32)}` as Hex,
        config,
        nonce: 0n,
        deadline: 9999999999n,
    };

    it('configHashFromInitConfig is deterministic + 32 bytes', () => {
        const h = configHashFromInitConfig(config);
        expect(h).toMatch(/^0x[0-9a-f]{64}$/);
        expect(configHashFromInitConfig(config)).toBe(h); // pure
    });

    it('buildCreateAccountHash pins the golden digest (on-chain cross-checked)', () => {
        const h = buildCreateAccountHash(args);
        expect(h).toMatch(/^0x[0-9a-f]{64}$/);
        expect(h).toBe('0x5644f6551bc008a23a4275bd24e916820cba99e5d6c1dee6f62ad15b0ea80cd4');
    });

    it('digest changes if ANY consensus field changes (salt / passkey / nonce / deadline / config)', () => {
        const base = buildCreateAccountHash(args);
        expect(buildCreateAccountHash({ ...args, salt: 43n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, nonce: 1n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, deadline: 1n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, ownerP256X: `0x${'24'.repeat(32)}` as Hex })).not.toBe(base);
        const otherConfig = buildInitConfig({ guardians: [{ ecdsa: '0x5555555555555555555555555555555555555555' as Address }], dailyLimit: 10n ** 18n, minDailyLimit: 10n ** 17n, approvedAlgIds: [0x0a] });
        expect(buildCreateAccountHash({ ...args, config: otherConfig })).not.toBe(base);
    });
});
