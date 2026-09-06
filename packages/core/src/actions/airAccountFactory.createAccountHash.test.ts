import { describe, it, expect } from 'vitest';
import { buildCreateAccountHash, configHashFromInitConfig } from './airAccountFactory.js';
import { buildInitConfig } from './initConfig.js';
import type { Hex, Address } from 'viem';

// Golden vectors for the relay-mode CREATE_ACCOUNT digest, MEASURED against the v0.33.0 factory
// `0x2A5cf40c24B8D27B8A039DE2b628fb4C9C66dAb9` on Sepolia at block 11644989.
//
// NOTE ON THE COMMAND BELOW: `RPC_URL` is QUOTED. The previous revision wrote
// `RPC_URL=<sepolia-rpc>` and an unquoted `<` is input redirection, so copy-pasting it produced
// `bash: sepolia-rpc: No such file or directory` and the command never ran. That is the SECOND
// time this exact sentence — "re-run the command, not the memory of it" — failed to hold of the
// command printed directly beneath it; the first was eliding the config arguments. A promise about
// re-runnability is only worth what a paste into a shell proves.
//
// ## Why this file was rewritten
//
// The previous version pinned an 8-field digest, called itself "v0.22.0", and said the bytes were
// "CROSS-CHECKED on-chain by createaccount-relay-passkey-e2e.ts". Every part of that decayed:
// airaccount-contract #161 (v0.29.0) took `InitConfig` from 8 fields to 10 (`+tier1Limit`,
// `+tier2Limit`), `configHashFromInitConfig` kept hashing 8, and the runner that was supposed to
// notice had been red — with `InvalidOwnerSignature()`, which reads like a key problem rather than
// an encoding one. A note claiming a cross-check is not a cross-check.
//
// ## The measurement, in full, re-runnable as written
//
//   RPC_URL='https://sepolia.example/…' pnpm exec tsx -e "
//   import {createPublicClient,http} from 'viem'; import {sepolia} from 'viem/chains';
//   import {CANONICAL_ADDRESSES,buildInitConfig,airAccountFactoryActions} from '@aastar/core';
//   const F=CANONICAL_ADDRESSES[11155111].airAccountFactoryV7;
//   const f=airAccountFactoryActions(F)(createPublicClient({chain:sepolia,transport:http(process.env.RPC_URL)}));
//   const cfg=buildInitConfig({guardians:[{ecdsa:'0x4444444444444444444444444444444444444444'},
//       {p256:{x:'0x'+'a1'.repeat(32),y:'0x'+'b2'.repeat(32)}}],
//     dailyLimit:10n**18n,minDailyLimit:10n**17n,approvedAlgIds:[0x0a],
//     initialTokens:['0x6666666666666666666666666666666666666666'],
//     initialTokenConfigs:[{tier1Limit:11n,tier2Limit:22n,dailyLimit:2n**128n}],
//     tier1Limit:2n**128n,tier2Limit:7n});
//   f.getConfigHash({config:cfg}).then(h=>console.log('getConfigHash',h));
//   f.hashCreateAccount({owner:'0x1111111111111111111111111111111111111111',salt:42n,config:cfg,
//     ownerP256X:'0x'+'22'.repeat(32),ownerP256Y:'0x'+'33'.repeat(32),nonce:0n,deadline:9999999999n})
//     .then(h=>console.log('hashCreateAccount',h));
//   "
//
//   getConfigHash     0x416416526eb52f643fb0c986f510d052ac94d01ab63651ea26da69a8b1af990c
//   hashCreateAccount 0x73144db69c4adcfc6efeb7e4d07fc59ed3da156a1f14685f520ba4d0e1e1dfd8
//
// The command is written out in full, not elided, because the point of recording a frozen
// observation is that the next reader re-runs it rather than trusts it. An abbreviated command with
// `...` in place of the arguments is the same promise the old header made and could not keep.
//
// ## Why EVERY leaf slot carries a distinct value
//
// `InitConfig` has 12 leaf slots. The previous revision measured a vector where five of them were
// zero or empty — `guardianP256X`, `guardianP256Y`, `initialTokens`, `initialTokenConfigs` — and
// review demonstrated the cost with mutations that SURVIVED it:
//
//   D  exchange guardianP256X / guardianP256Y in the encode  ->  5 passed  (survived)
//   E  TokenConfig components -> (uint256,uint128,uint128)   ->  5 passed  (survived)
//   positive control: exchange dailyLimit / minDailyLimit    ->  2 failed  (instrument is live)
//
// The positive control is the load-bearing line: without it, two `5 passed` cannot be told apart
// from "the mutation never landed". This is the SAME defect the rewrite was meant to remove —
// fixed for the two tier fields and left standing in five other slots. Exchanging two zeros is a
// no-op wherever the zeros are.
//
// So the vector below gives every slot a value distinct from every other: a P-256 guardian with
// `x != y`, both non-zero; one `initialTokens` entry with a `TokenConfig` whose three components
// all differ; `dailyLimit != minDailyLimit`.
//
// ## Distinctness kills ORDER mutations. It does not kill WIDTH mutations.
//
// That vector, with `TokenConfig = {11, 22, 33}`, killed D and **E still survived at 5 passed**.
// The reason is not a gap in the vector, it is a property of ABI encoding: a static tuple's
// components are each padded into a 32-byte word, so `(uint128,uint128,uint256)` and
// `(uint256,uint128,uint128)` emit BYTE-IDENTICAL output for any values that fit in `uint128`.
// E was an EQUIVALENT MUTATION — `verification.md` §1's second cause, the one that looks exactly
// like a blind test.
//
// **No vector of small values can pin those widths.** What pins them is magnitude: the component
// declared `uint256` carries `2**128`, which no `uint128` encoding can represent, so the mutation
// throws instead of matching. Same reason `tier1Limit = 2**128` is what pins mutation B.
//
// Stated as a rule, because it generalises past this file: **to pin a field's TYPE you need a
// value the wrong type cannot hold; to pin its POSITION you need a value no other field shares.**
// Those are two different requirements and a vector has to satisfy both, field by field.
//
// With `TokenConfig.dailyLimit = 2**128`, D and E both turn red.
//
// ## Why THESE tier values specifically
//
// `tier1Limit = 2**128` and `tier2Limit = 7` are chosen so the vector is falsifiable in two ways
// the zero-valued config could not be:
//
//   * they DIFFER, so swapping the two fields in the `abi.encode` changes the hash. A vector with
//     `tier1 == tier2 == 0` proves both fields are present and proves NOTHING about their order —
//     swapping two zeros is a no-op.
//   * `2**128` exceeds `uint128`, so encoding the field as `uint128` cannot produce this preimage.
//     For small values `abi.encode` pads both types into the same 32-byte word, and the type would
//     be unpinnable.
//
// Both properties are carried by the MEASURED VECTOR, not by the inequality tests further down —
// see the note above `neither #161 tier field is dead`. Measured mutation kills, all five run:
//
//   A  swap tier1/tier2 in the encode        -> 2 failed  (both measured-vector tests)
//   B  uint256 -> uint128                    -> 5 failed  (encodeAbiParameters throws on 2**128)
//   C  drop both fields (back to 8)          -> 4 failed  (survivor: `is pure`, which is vacuous)
//   D  swap guardianP256X / guardianP256Y    -> 2 failed  (was 5 passed on the zero-valued vector)
//   E  TokenConfig -> (uint256,uint128,uint128) -> 5 failed  (was 5 PASSED — equivalent until
//                                                 the uint256 slot carried 2**128; see above)
describe('buildCreateAccountHash / configHashFromInitConfig — v0.33.0 factory, 10-field InitConfig', () => {
    const FACTORY_V033 = '0x2A5cf40c24B8D27B8A039DE2b628fb4C9C66dAb9' as Address;

    /** The measured vector. Every leaf slot distinct + out-of-uint128-range — see the header. */
    const measured = buildInitConfig({
        guardians: [
            { ecdsa: '0x4444444444444444444444444444444444444444' as Address },
            { p256: { x: `0x${'a1'.repeat(32)}` as Hex, y: `0x${'b2'.repeat(32)}` as Hex } },
        ],
        dailyLimit: 10n ** 18n,
        minDailyLimit: 10n ** 17n,
        approvedAlgIds: [0x0a],
        initialTokens: ['0x6666666666666666666666666666666666666666' as Address],
        initialTokenConfigs: [{ tier1Limit: 11n, tier2Limit: 22n, dailyLimit: 2n ** 128n }],
        tier1Limit: 2n ** 128n,
        tier2Limit: 7n,
    });
    const args = {
        chainId: 11155111,
        factory: FACTORY_V033,
        owner: '0x1111111111111111111111111111111111111111' as Address,
        salt: 42n,
        ownerP256X: `0x${'22'.repeat(32)}` as Hex,
        ownerP256Y: `0x${'33'.repeat(32)}` as Hex,
        config: measured,
        nonce: 0n,
        deadline: 9999999999n,
    };

    it('configHashFromInitConfig == the factory\'s own getConfigHash (measured)', () => {
        expect(configHashFromInitConfig(measured))
            .toBe('0x416416526eb52f643fb0c986f510d052ac94d01ab63651ea26da69a8b1af990c');
    });

    it('buildCreateAccountHash == the factory\'s own hashCreateAccount (measured)', () => {
        expect(buildCreateAccountHash(args))
            .toBe('0x73144db69c4adcfc6efeb7e4d07fc59ed3da156a1f14685f520ba4d0e1e1dfd8');
    });

    // NOTE ON WHAT THIS TEST DOES **NOT** DO, because an over-claiming title is the exact defect
    // this file is being rewritten to remove. These are INEQUALITIES. An inequality can show that
    // two inputs hash differently; it can never show WHICH SLOT each input landed in. Swap the two
    // fields in the implementation's `abi.encode` and every assertion below still passes — measured:
    // 2 failed / 3 passed, and the two that failed are the measured-vector tests above, not these.
    //
    // THE TIER FIELDS' order and width are pinned by the on-chain vector, not by this test — and
    // the same is true of every other slot: the vector is what pins the layout, full stop. What
    // this test adds is the thing the vector cannot express on its own: that neither tier field is
    // DEAD — that a change to either one reaches the digest at all.
    it('neither #161 tier field is dead — a change to either reaches the digest', () => {
        const base = configHashFromInitConfig(measured);
        expect(configHashFromInitConfig({ ...measured, tier1Limit: 5n })).not.toBe(base);
        expect(configHashFromInitConfig({ ...measured, tier2Limit: 5n })).not.toBe(base);
        // The two fields are distinguishable from each other: exchanging the VALUES changes the
        // digest. With a `tier1 == tier2 == 0` vector even this much is unprovable — exchanging two
        // zeros is a no-op — which is why the measured vector is asymmetric.
        expect(configHashFromInitConfig({ ...measured, tier1Limit: measured.tier2Limit, tier2Limit: measured.tier1Limit }))
            .not.toBe(base);
    });

    // The previous version of this test was titled "digest changes if ANY consensus field changes"
    // and varied five of the nine. "ANY" is a claim about a set; a test that samples the set does
    // not make it. Every field in the preimage is now varied, one per line.
    it('digest changes if any of the nine preimage fields changes', () => {
        const base = buildCreateAccountHash(args);
        expect(buildCreateAccountHash({ ...args, chainId: 1 })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, factory: '0x0eb0E7a61d5D9e03bc3578f8C1b0d9f40cc0a5B9' as Address })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, owner: '0x2222222222222222222222222222222222222222' as Address })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, salt: 43n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, ownerP256X: `0x${'24'.repeat(32)}` as Hex })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, ownerP256Y: `0x${'34'.repeat(32)}` as Hex })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, nonce: 1n })).not.toBe(base);
        expect(buildCreateAccountHash({ ...args, deadline: 1n })).not.toBe(base);
        // the ninth is configHash — every InitConfig field must reach it
        for (const variant of [
            { ...measured, guardians: ['0x5555555555555555555555555555555555555555', measured.guardians[1], measured.guardians[2]] as never },
            { ...measured, guardianP256X: [measured.guardianP256X[0], `0x${'11'.repeat(32)}`, measured.guardianP256X[2]] as never },
            { ...measured, guardianP256Y: [measured.guardianP256Y[0], `0x${'12'.repeat(32)}`, measured.guardianP256Y[2]] as never },
            { ...measured, dailyLimit: measured.dailyLimit + 1n },
            { ...measured, approvedAlgIds: [0x05] },
            { ...measured, minDailyLimit: measured.minDailyLimit + 1n },
            { ...measured, initialTokens: ['0x7777777777777777777777777777777777777777' as Address] },
            { ...measured, initialTokenConfigs: [{ tier1Limit: 44n, tier2Limit: 55n, dailyLimit: 66n }] },
            { ...measured, tier1Limit: measured.tier1Limit + 1n },
            { ...measured, tier2Limit: measured.tier2Limit + 1n },
        ]) {
            expect(buildCreateAccountHash({ ...args, config: variant })).not.toBe(base);
        }
    });

    it('configHashFromInitConfig is pure', () => {
        expect(configHashFromInitConfig(measured)).toBe(configHashFromInitConfig(measured));
    });
});
