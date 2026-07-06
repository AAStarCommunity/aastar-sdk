import { describe, it, expect } from 'vitest';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { keccak256, size, toBytes, toHex } from 'viem';
import { buildDvtPop, encodeG1Point } from './dvtPop.js';

// A fixed, in-range BLS12-381 secret scalar for deterministic vectors.
const SK = '0x0000000000000000000000000000000000000000000000000000000000abcdef' as const;

describe('buildDvtPop', () => {
    it('produces the exact byte lengths registerWithProof expects', () => {
        const pop = buildDvtPop(SK);
        expect(size(pop.publicKey)).toBe(128); // G1 EIP-2537
        expect(size(pop.popPoint)).toBe(256);  // G2 EIP-2537
        expect(size(pop.popSig)).toBe(256);    // G2 EIP-2537
        expect(size(pop.nodeId)).toBe(32);
    });

    it('derives nodeId = keccak256(publicKey) — matching the on-chain derivation (no caller-chosen id)', () => {
        const pop = buildDvtPop(SK);
        expect(pop.nodeId).toBe(keccak256(pop.publicKey));
    });

    it('satisfies the on-chain PoP pairing e(pk, popPoint) == e(G1, popSig)', () => {
        // This is exactly what AAStarValidator._verifyPoP checks:
        //   e(-pk, popPoint) · e(G1_generator, popSig) == 1  ⇔  e(pk, popPoint) == e(G1, popSig).
        // Proving it here offline means a registerWithProof built from this tuple is accepted on-chain
        // (modulo the stake/role gates, which are not cryptographic).
        const pop = buildDvtPop(SK);

        const pk = bls.G1.ProjectivePoint.fromHex(eip2537G1ToUncompressed(pop.publicKey));
        const popPoint = eip2537G2ToPoint(pop.popPoint);
        const popSig = eip2537G2ToPoint(pop.popSig);

        const lhs = bls.pairing(pk, popPoint);
        const rhs = bls.pairing(bls.G1.ProjectivePoint.BASE, popSig);
        expect(bls.fields.Fp12.eql(lhs, rhs)).toBe(true);
    });

    it('is deterministic for a given secret key', () => {
        expect(buildDvtPop(SK)).toEqual(buildDvtPop(SK));
    });

    it('rejects out-of-range secret keys (0 and >= curve order)', () => {
        expect(() => buildDvtPop('0x00')).toThrow(/scalar in \[1, r-1\]/);
        const rHex = toHex(bls.params.r, { size: 32 });
        expect(() => buildDvtPop(rHex)).toThrow(/scalar in \[1, r-1\]/);
    });
});

describe('encodeG1Point', () => {
    it('re-packs a compressed G1 pubkey into 128-byte EIP-2537 and round-trips through noble', () => {
        const point = bls.G1.ProjectivePoint.BASE.multiply(0xabcdefn);
        const encoded = encodeG1Point(point.toRawBytes(true)); // 48-byte compressed input
        expect(size(encoded)).toBe(128);
        // Slot heads are 16 zero bytes each (EIP-2537 left-pad).
        const b = toBytes(encoded);
        for (const off of [0, 64]) {
            for (let i = 0; i < 16; i++) expect(b[off + i]).toBe(0);
        }
        // Decoding the EIP-2537 coordinates back yields the same affine point.
        const decoded = bls.G1.ProjectivePoint.fromHex(eip2537G1ToUncompressed(encoded));
        expect(decoded.equals(point)).toBe(true);
    });

    it('rejects a 128-byte blob with non-zero EIP-2537 padding', () => {
        const bad = new Uint8Array(128);
        bad[0] = 1; // corrupt the leading zero pad
        expect(() => encodeG1Point(bad)).toThrow(/not valid EIP-2537/);
    });
});

/** Convert a 128-byte EIP-2537 G1 point to the 96-byte uncompressed (x‖y) form noble parses. */
function eip2537G1ToUncompressed(hex: `0x${string}`): Uint8Array {
    const b = toBytes(hex);
    const out = new Uint8Array(96);
    out.set(b.slice(16, 64), 0);   // x: 48 bytes
    out.set(b.slice(80, 128), 48); // y: 48 bytes
    return out;
}

/** Convert a 256-byte EIP-2537 G2 point to a noble G2 point via its 192-byte uncompressed form. */
function eip2537G2ToPoint(hex: `0x${string}`) {
    const b = toBytes(hex);
    const out = new Uint8Array(192);
    // EIP-2537 order is (x.c0, x.c1, y.c0, y.c1); noble uncompressed wants (x.c1, x.c0, y.c1, y.c0).
    const xc0 = b.slice(16, 64), xc1 = b.slice(80, 128), yc0 = b.slice(144, 192), yc1 = b.slice(208, 256);
    out.set(xc1, 0); out.set(xc0, 48); out.set(yc1, 96); out.set(yc0, 144);
    return bls.G2.ProjectivePoint.fromHex(out);
}
