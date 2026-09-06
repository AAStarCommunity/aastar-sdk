import { describe, it, expect } from 'vitest';
import { buildCreateAccountHash, configHashFromInitConfig } from './airAccountFactory.js';
import { buildInitConfig } from './initConfig.js';
import type { Hex, Address } from 'viem';

// Golden vectors for the CREATE_ACCOUNT relay-mode digest (#249).
//
// The previous version of this header said the bytes were "CROSS-CHECKED on-chain by
// createaccount-relay-passkey-e2e.ts". That sentence was true when written and then quietly stopped
// being true: airaccount-contract #161 (v0.29.0) took `InitConfig` from 8 to 10 fields,
// `configHashFromInitConfig` kept hashing 8, and the runner that was supposed to notice had been
// red — with `InvalidOwnerSignature()`, which reads like a key problem rather than an encoding one.
// A note claiming a cross-check is not a cross-check. So the pin below is a MEASUREMENT instead:
//
//   cast call 0x2A5cf40c24B8D27B8A039DE2b628fb4C9C66dAb9 \
//     'getConfigHash((address[3],bytes32[3],bytes32[3],uint256,uint8[],uint256,address[],(uint128,uint128,uint256)[],uint256,uint256))' ...
//   -> 0x05ca2a0caa5c066a9c487b5e4ff62bcfe5ef35fec668304997d1e476097f249a   (Sepolia, factory v0.33.0)
//
// `MEASURED_*` below reproduces that read locally. It is a frozen observation, so the command that
// produced it is written down next to it — re-run the command, not the memory of it. When the
// factory address changes, this vector must be re-measured, not carried over.
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

    // The whole point of this block: it FAILS on the 8-field replica and PASSES on the 10-field one.
    // The old "deterministic + 32 bytes" test above passes on both, which is why it caught nothing —
    // determinism is a property of keccak, not of hashing the right preimage.
    it('configHashFromInitConfig reproduces the factory\'s own getConfigHash (measured on Sepolia)', () => {
        const measured = buildInitConfig({
            guardians: [{ ecdsa: '0x13c1B67594fd9181c81a48DA7C735F6f7BdA9207' as Address }],
            dailyLimit: 10n ** 18n,
            minDailyLimit: 10n ** 17n,
            approvedAlgIds: [0x0a],
        });
        // factory v0.33.0 @ 0x2A5cf40c…dAb9, getConfigHash(config) — see the header for the exact call.
        expect(configHashFromInitConfig(measured))
            .toBe('0x05ca2a0caa5c066a9c487b5e4ff62bcfe5ef35fec668304997d1e476097f249a');
    });

    it('the two #161 native-ETH tier fields are IN the preimage', () => {
        const base = configHashFromInitConfig(config);
        expect(configHashFromInitConfig({ ...config, tier1Limit: 1n })).not.toBe(base);
        expect(configHashFromInitConfig({ ...config, tier2Limit: 1n })).not.toBe(base);
        // …and they are two distinct slots, not one field counted twice.
        expect(configHashFromInitConfig({ ...config, tier1Limit: 1n }))
            .not.toBe(configHashFromInitConfig({ ...config, tier2Limit: 1n }));
    });

    it('buildCreateAccountHash pins the golden digest (on-chain cross-checked)', () => {
        const h = buildCreateAccountHash(args);
        expect(h).toMatch(/^0x[0-9a-f]{64}$/);
        expect(h).toBe('0x6aad2e0681f46a2f48cc02e3c126436dfc49bd89977ab37c54644d4a4f99ba7b');
    });

    it('digest changes if ANY consensus field changes (salt / passkey / nonce / deadline / config)', () => {
        const base = buildCreateAccountHash(args);
        expect(buildCreateAccountHash({ ...args, salt: 43n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, nonce: 1n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, deadline: 1n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, ownerP256X: `0x${'24'.repeat(32)}` as Hex })).not.toBe(base);
        const otherConfig = buildInitConfig({ guardians: [{ ecdsa: '0x5555555555555555555555555555555555555555' as Address }], dailyLimit: 10n ** 18n, minDailyLimit: 10n ** 17n, approvedAlgIds: [0x0a] });
        expect(buildCreateAccountHash({ ...args, config: otherConfig })).not.toBe(base);
        // config variation must reach the #161 fields too — otherwise "ANY consensus field" is a
        // claim the test does not make. This is the assertion the 8-field replica could not pass.
        expect(buildCreateAccountHash({ ...args, config: { ...config, tier1Limit: 1n } })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, config: { ...config, tier2Limit: 1n } })).not.toBe(base);
    });
});
