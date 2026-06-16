import { describe, it, expect } from 'vitest';
import { concat, type Hex } from 'viem';
import {
    DVT_TIER_T2,
    DVT_TIER_T3,
    encodeDVTAccountSignature,
    encodeDVTVerifierProof,
    encodeG2Point,
} from '../../src/crypto/dvtWire';

/**
 * DVT combined-signature wire encoders — airaccount-contract #110 authoritative format.
 *
 * GOLDEN-VECTOR SOURCE: **LIVE Sepolia transactions** (byte-for-byte). The two account-level
 * vectors below are the EXACT `PackedUserOperation.signature` fields decoded from the deployed
 * `AAStarBLSAlgorithm` beta.2 tiered E2E run (airaccount-contract `docs/e2e/E2E_RESULTS_v0.18.0-beta.2.md`):
 *
 *   - C4 Tier-2 (0x04): tx 0xa73f0d5fead697226bbd6cdfdd64b20c195b6a45d6afcf0b130c5354081eb243
 *   - C5 Tier-3 (0x05): tx 0x1a7e351291f1f10ad1638da77ae1a63ff7a84e6d76834b848d524a148879141b
 *
 * Both were fetched via viem `getTransaction` + `decodeFunctionData(handleOps)` and decomposed
 * per the #110 spec. The encoder reproduces each full wire from its decoded components → this is
 * a LIVE byte-for-byte cross-check, not a structural placeholder.
 */

// ─── LIVE decoded components — C4 Tier-2 (tx 0xa73f0d5f…) ──────────────────────
const C4_TIER = DVT_TIER_T2;
const C4_P256_R = '0xe51a00b99de722c0c23343eb3cd22532846efa258453249b80c8ed55b3130a0e' as Hex;
const C4_P256_S = '0x7d438d660b15e01c184c76d954577eab74fe06ec3265e8c3d87cc2b96c1aef66' as Hex;
const C4_NODE_IDS: Hex[] = [
    '0xb548c8e23d2df1158ebb19fe07eb1ac4d9c47f13b3c9d3aed83b206930506a6d',
    '0x7f7e6290d0588435c6d12093b420fafc5b4c7ab23c73645ca7186189dca9537c',
];
const C4_BLS_SIG =
    ('0x000000000000000000000000000000001457dabe3743d48f8fdda64437366f3b042330a8651e8e10495041460a1752b34700d2458975efa4e2d434954706a8cd' +
        '0000000000000000000000000000000015f111105fe2ce1a28a529c466a97ff43fb371557e45e040eb04e73d6efe0dcf76b7f0aed4236980026259e88495ce93' +
        '00000000000000000000000000000000128f9b96feec49bdb87fd67e9aaaaaf783a03227caaefa6d1fc472881a460c0c240897d67d6a3f9c5d1113a31bec5efe' +
        '000000000000000000000000000000000619a9f51688a34d085e4e4fcf3438eb16264b5cbaef4ea753d794e37a06beced2b7ec9c3c49767140489776d95a32bb') as Hex;
// Full live PackedUserOperation.signature (417 bytes) for tier 2.
const C4_LIVE_WIRE =
    ('0x04e51a00b99de722c0c23343eb3cd22532846efa258453249b80c8ed55b3130a0e7d438d660b15e01c184c76d954577eab74fe06ec3265e8c3d87cc2b96c1aef66' +
        '0000000000000000000000000000000000000000000000000000000000000002' +
        'b548c8e23d2df1158ebb19fe07eb1ac4d9c47f13b3c9d3aed83b206930506a6d7f7e6290d0588435c6d12093b420fafc5b4c7ab23c73645ca7186189dca9537c' +
        '000000000000000000000000000000001457dabe3743d48f8fdda64437366f3b042330a8651e8e10495041460a1752b34700d2458975efa4e2d434954706a8cd' +
        '0000000000000000000000000000000015f111105fe2ce1a28a529c466a97ff43fb371557e45e040eb04e73d6efe0dcf76b7f0aed4236980026259e88495ce93' +
        '00000000000000000000000000000000128f9b96feec49bdb87fd67e9aaaaaf783a03227caaefa6d1fc472881a460c0c240897d67d6a3f9c5d1113a31bec5efe' +
        '000000000000000000000000000000000619a9f51688a34d085e4e4fcf3438eb16264b5cbaef4ea753d794e37a06beced2b7ec9c3c49767140489776d95a32bb') as Hex;

// ─── LIVE decoded components — C5 Tier-3 (tx 0x1a7e3512…) ──────────────────────
const C5_TIER = DVT_TIER_T3;
const C5_P256_R = '0x1b39dd7a8d7acf1f1110bca40700f37e1168e62e6b54fcad574ac4505a6689b3' as Hex;
const C5_P256_S = '0x59f0ead0706dfd8bf2ccb6b4182e29152b7e1202ada6ecb010cc66dfbdc229e9' as Hex;
const C5_NODE_IDS: Hex[] = [
    '0xb548c8e23d2df1158ebb19fe07eb1ac4d9c47f13b3c9d3aed83b206930506a6d',
    '0x7f7e6290d0588435c6d12093b420fafc5b4c7ab23c73645ca7186189dca9537c',
];
const C5_BLS_SIG =
    ('0x000000000000000000000000000000001048672f7dd9e37b4e7c6a1e1e9ef46be38958375d5054c5acdcfc7ebf37180bd0446ec98a854938e139833e84e7222b' +
        '0000000000000000000000000000000002c121df62808f31a929208a9f7d310e69fd2be9b218f8bb453b6a5533fd5ef936b5a1ebdbf5deb238a03dd51cee5d6f' +
        '00000000000000000000000000000000155effce6cd24ccda71a426ba416156bd7f265c3c432322723e90d3ff0a542bf122c74f36532d4932e5b3d03fcc37c3b' +
        '000000000000000000000000000000000fe951eb865c9a3b7ef9bbd391262c36517bc245225107ebe0c3ecaaab68c05f04c9ffa353e44962afd9cbb5e439a674') as Hex;
const C5_GUARDIAN_SIG =
    ('0x49a90382e61b606e0616d82c4acc26d53ce6efba9c4baa811375539b7f538e0e0665f92726788bb94ef1217efb4a71483110fca445196404c8fdfc118f2c1d1d1b') as Hex;
// Full live PackedUserOperation.signature (482 bytes) for tier 3.
const C5_LIVE_WIRE =
    ('0x051b39dd7a8d7acf1f1110bca40700f37e1168e62e6b54fcad574ac4505a6689b359f0ead0706dfd8bf2ccb6b4182e29152b7e1202ada6ecb010cc66dfbdc229e9' +
        '0000000000000000000000000000000000000000000000000000000000000002' +
        'b548c8e23d2df1158ebb19fe07eb1ac4d9c47f13b3c9d3aed83b206930506a6d7f7e6290d0588435c6d12093b420fafc5b4c7ab23c73645ca7186189dca9537c' +
        '000000000000000000000000000000001048672f7dd9e37b4e7c6a1e1e9ef46be38958375d5054c5acdcfc7ebf37180bd0446ec98a854938e139833e84e7222b' +
        '0000000000000000000000000000000002c121df62808f31a929208a9f7d310e69fd2be9b218f8bb453b6a5533fd5ef936b5a1ebdbf5deb238a03dd51cee5d6f' +
        '00000000000000000000000000000000155effce6cd24ccda71a426ba416156bd7f265c3c432322723e90d3ff0a542bf122c74f36532d4932e5b3d03fcc37c3b' +
        '000000000000000000000000000000000fe951eb865c9a3b7ef9bbd391262c36517bc245225107ebe0c3ecaaab68c05f04c9ffa353e44962afd9cbb5e439a674' +
        '49a90382e61b606e0616d82c4acc26d53ce6efba9c4baa811375539b7f538e0e0665f92726788bb94ef1217efb4a71483110fca445196404c8fdfc118f2c1d1d1b') as Hex;

const hexLen = (h: Hex) => (h.length - 2) / 2;

describe('encodeG2Point — EIP-2537 256-byte G2 layout (x.c0@16 / x.c1@80 / y.c0@144 / y.c1@208)', () => {
    it('passes a 256-byte EIP-2537 sig through unchanged (the node already emits this)', () => {
        expect(encodeG2Point(C4_BLS_SIG)).toBe(C4_BLS_SIG);
        expect(hexLen(encodeG2Point(C4_BLS_SIG))).toBe(256);
    });

    it('places each 48-byte Fp coordinate at the EIP-2537 slot offsets (16-byte zero pad per slot)', () => {
        const bytes = Buffer.from(C4_BLS_SIG.slice(2), 'hex');
        for (const off of [0, 64, 128, 192]) {
            // Each 64-byte slot starts with 16 zero bytes, then the 48-byte coordinate.
            expect(bytes.subarray(off, off + 16).every((b) => b === 0)).toBe(true);
        }
    });

    it('rejects a 256-byte blob whose slot padding is non-zero (not valid EIP-2537)', () => {
        const bad = ('0x' + 'ff' + '00'.repeat(255)) as Hex;
        expect(() => encodeG2Point(bad)).toThrow(/EIP-2537/);
    });

    it('rejects an unexpected length (not 256 / 96 / 192)', () => {
        expect(() => encodeG2Point(('0x' + 'ab'.repeat(100)) as Hex)).toThrow(/unexpected BLS signature length/);
    });

    it('re-packs a compressed/uncompressed G2 to the same 256-byte EIP-2537 bytes (round-trip via @noble)', async () => {
        // Derive a real zkcrypto-serialized G2 from the LIVE point, then re-pack it.
        const { bls12_381 } = await import('@noble/curves/bls12-381');
        const G2 = bls12_381.G2.ProjectivePoint;
        const Fp2 = bls12_381.fields.Fp2;
        const raw = C4_BLS_SIG.slice(2);
        const slot = (i: number) => raw.slice(i * 128, i * 128 + 128);
        const coord = (h: string) => BigInt('0x' + h.slice(32)); // drop the 16-byte (32-hex) pad
        const point = G2.fromAffine({
            x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]),
            y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]),
        });
        point.assertValidity();
        // Both zkcrypto serializations must re-pack to the exact LIVE EIP-2537 bytes.
        expect(encodeG2Point(('0x' + point.toHex(true)) as Hex)).toBe(C4_BLS_SIG); // compressed (96 B)
        expect(encodeG2Point(('0x' + point.toHex(false)) as Hex)).toBe(C4_BLS_SIG); // uncompressed (192 B)
    });
});

describe('encodeDVTVerifierProof — [nodeIds…][blsSig(256)] (no nodeIdsLength prefix)', () => {
    it('concatenates nodeIds + blsSig in order, matching the LIVE C4 nodeIds/blsSig', () => {
        const proof = encodeDVTVerifierProof(C4_NODE_IDS, C4_BLS_SIG);
        expect(proof).toBe(concat([...C4_NODE_IDS, C4_BLS_SIG]));
        // Verifier-level length = N*32 + 256, and (len - 256) % 32 === 0 (contract's nodeCount derivation).
        expect(hexLen(proof)).toBe(C4_NODE_IDS.length * 32 + 256);
        expect((hexLen(proof) - 256) % 32).toBe(0);
    });

    it('preserves nodeIds order (verifier aggregates registered keys in this order)', () => {
        const a = encodeDVTVerifierProof([C4_NODE_IDS[0], C4_NODE_IDS[1]], C4_BLS_SIG);
        const b = encodeDVTVerifierProof([C4_NODE_IDS[1], C4_NODE_IDS[0]], C4_BLS_SIG);
        expect(a).not.toBe(b);
    });

    it('rejects an empty nodeIds list', () => {
        expect(() => encodeDVTVerifierProof([], C4_BLS_SIG)).toThrow(/non-empty/);
    });

    it('rejects a nodeId that is not exactly 32 bytes', () => {
        expect(() => encodeDVTVerifierProof(['0x1234' as Hex], C4_BLS_SIG)).toThrow(/32-byte/);
    });
});

describe('encodeDVTAccountSignature — account-level wire (LIVE byte-for-byte)', () => {
    it('T2 (0x04): reproduces the LIVE C4 PackedUserOperation.signature byte-for-byte', () => {
        const wire = encodeDVTAccountSignature({
            tier: C4_TIER,
            p256: { r: C4_P256_R, s: C4_P256_S },
            nodeIds: C4_NODE_IDS,
            blsSig: C4_BLS_SIG,
        });
        expect(wire).toBe(C4_LIVE_WIRE);
        expect(hexLen(wire)).toBe(417); // 1 + 64 + 32 + 2*32 + 256
    });

    it('T3 (0x05): reproduces the LIVE C5 PackedUserOperation.signature byte-for-byte (with guardian)', () => {
        const wire = encodeDVTAccountSignature({
            tier: C5_TIER,
            p256: { r: C5_P256_R, s: C5_P256_S },
            nodeIds: C5_NODE_IDS,
            blsSig: C5_BLS_SIG,
            guardianSig: C5_GUARDIAN_SIG,
        });
        expect(wire).toBe(C5_LIVE_WIRE);
        expect(hexLen(wire)).toBe(482); // T2 (417) + 65-byte guardian
    });

    it('accepts a 64-byte r‖s P256 form equivalently to { r, s }', () => {
        const fromParts = encodeDVTAccountSignature({
            tier: C4_TIER,
            p256: { r: C4_P256_R, s: C4_P256_S },
            nodeIds: C4_NODE_IDS,
            blsSig: C4_BLS_SIG,
        });
        const fromBytes = encodeDVTAccountSignature({
            tier: C4_TIER,
            p256: concat([C4_P256_R, C4_P256_S]),
            nodeIds: C4_NODE_IDS,
            blsSig: C4_BLS_SIG,
        });
        expect(fromBytes).toBe(fromParts);
    });

    it('encodes nodeIdsLength as a 32-byte big-endian uint256 count', () => {
        const wire = encodeDVTAccountSignature({
            tier: C4_TIER,
            p256: { r: C4_P256_R, s: C4_P256_S },
            nodeIds: C4_NODE_IDS,
            blsSig: C4_BLS_SIG,
        });
        // Bytes: [0x04][P256(64)] then the 32-byte length at offset 1+64 = 65.
        const lenWord = wire.slice(2 + 65 * 2, 2 + 65 * 2 + 64);
        expect(BigInt('0x' + lenWord)).toBe(BigInt(C4_NODE_IDS.length));
    });

    it('the account-level wire embeds the verifier-level proof after tier+P256+nodeIdsLength', () => {
        const wire = encodeDVTAccountSignature({
            tier: C4_TIER,
            p256: { r: C4_P256_R, s: C4_P256_S },
            nodeIds: C4_NODE_IDS,
            blsSig: C4_BLS_SIG,
        });
        const verifierProof = encodeDVTVerifierProof(C4_NODE_IDS, C4_BLS_SIG);
        // Strip tier(1) + P256(64) + nodeIdsLength(32) = 97 bytes → the rest IS the verifier proof.
        const stripped = ('0x' + wire.slice(2 + 97 * 2)) as Hex;
        expect(stripped).toBe(verifierProof);
    });

    it('rejects T3 without a guardian signature', () => {
        expect(() =>
            encodeDVTAccountSignature({
                tier: DVT_TIER_T3,
                p256: { r: C5_P256_R, s: C5_P256_S },
                nodeIds: C5_NODE_IDS,
                blsSig: C5_BLS_SIG,
            })
        ).toThrow(/65-byte guardian/);
    });

    it('rejects a guardian signature on T2', () => {
        expect(() =>
            encodeDVTAccountSignature({
                tier: DVT_TIER_T2,
                p256: { r: C4_P256_R, s: C4_P256_S },
                nodeIds: C4_NODE_IDS,
                blsSig: C4_BLS_SIG,
                guardianSig: C5_GUARDIAN_SIG,
            })
        ).toThrow(/must not carry a guardian/);
    });

    it('rejects an invalid tier byte', () => {
        expect(() =>
            // @ts-expect-error — intentionally invalid tier for the runtime guard
            encodeDVTAccountSignature({ tier: 0x02, p256: { r: C4_P256_R, s: C4_P256_S }, nodeIds: C4_NODE_IDS, blsSig: C4_BLS_SIG })
        ).toThrow(/tier must be 0x04/);
    });

    it('rejects a malformed P256 r component', () => {
        expect(() =>
            encodeDVTAccountSignature({
                tier: C4_TIER,
                p256: { r: '0x1234' as Hex, s: C4_P256_S },
                nodeIds: C4_NODE_IDS,
                blsSig: C4_BLS_SIG,
            })
        ).toThrow(/p256\.r must be a 32-byte/);
    });
});
