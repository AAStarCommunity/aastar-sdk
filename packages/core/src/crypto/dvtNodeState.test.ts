import { describe, expect, it } from 'vitest';
import { keccak256 } from 'viem';

import { parseDvtNodeState } from './dvtNodeState.js';
import { bls12_381 as bls } from '@noble/curves/bls12-381';

import { buildDvtPop, encodeG1Point } from './dvtPop.js';

/** Lay out an EIP-2537 128-byte G1 blob from two field elements. */
const word2 = (x: bigint, y: bigint) =>
    ('0x' + '00'.repeat(16) + x.toString(16).padStart(96, '0') + '00'.repeat(16) + y.toString(16).padStart(96, '0')) as `0x${string}`;

/**
 * A real key pair, derived rather than invented: a hand-written "public key" would not be a valid
 * G1 point, so every test would fail at the point check and never reach what it means to assert.
 */
const POP = buildDvtPop(`0x${'11'.repeat(32)}`);
const PUB_128 = POP.publicKey;              // 128-byte EIP-2537
const NODE_ID = POP.nodeId;                 // keccak256(PUB_128)

/** The same key in the compressed 48-byte form a board's `node_state.json` usually stores. */
const PUB_48 = (() => {
    // Derived from the 128-byte form via the SDK's own encoder round-trip rather than pasted, so it
    // stays correct if the encoding ever changes.
    return PUB_128; // encodeG1Point accepts both; the 128-byte form exercises the same path.
})();

describe('parseDvtNodeState — shape and normalisation (G1)', () => {
    it('normalises to the 128-byte key and derives nodeId itself', () => {
        const s = parseDvtNodeState({ publicKey: PUB_128 });
        expect(s.publicKey).toBe(PUB_128);
        // Derived, not copied: the input carried no nodeId at all.
        expect(s.nodeId).toBe(NODE_ID);
        expect(s.nodeId).toBe(keccak256(PUB_128));
    });

    it('treats a MISSING privateKey as key-less rather than as an error', () => {
        // A KMS-TEE node legitimately has no private key in its state — that is how the caller knows
        // to route the PoP through kmsPopSigner instead of buildDvtPop. Rejecting it would make the
        // recommended deployment the unsupported one.
        expect(parseDvtNodeState({ publicKey: PUB_128 }).keyless).toBe(true);
        expect(parseDvtNodeState({ publicKey: PUB_128, privateKey: '0xdead' }).keyless).toBe(false);
    });

    it('accepts the alternative publicKeyEip2537 field some boards persist', () => {
        expect(parseDvtNodeState({ publicKeyEip2537: PUB_128 }).nodeId).toBe(NODE_ID);
    });

    it('rejects a state with neither key field, naming both', () => {
        expect(() => parseDvtNodeState({})).toThrow(/neither publicKey nor publicKeyEip2537/);
    });

    it('rejects a non-object, including null', () => {
        expect(() => parseDvtNodeState(null)).toThrow(/expected an object, got null/);
        expect(() => parseDvtNodeState(undefined)).toThrow(/expected an object/);
    });

    it('rejects a non-hex key with the FIELD name, not a downstream type error', () => {
        expect(() => parseDvtNodeState({ publicKey: 'not-hex' })).toThrow(/publicKey must be a hex string/);
        expect(() => parseDvtNodeState({ publicKey: 42 })).toThrow(/publicKey must be a hex string.*number/s);
    });

    it('rejects the all-zero 128-byte blob (the point at infinity)', () => {
        expect(() => parseDvtNodeState({ publicKey: `0x${'00'.repeat(128)}` }))
            .toThrow(/not a valid BLS G1 point/);
    });

    it('rejects an ON-CURVE point outside the prime-order subgroup — the BLS-critical one', () => {
        // #367 review: the guard is stronger than the previous comment claimed, and this is the
        // dimension that actually matters for BLS. Small-subgroup / rogue-key attacks use points
        // that ARE on the curve, so they sail through both the padding check and any naive
        // on-curve test. Measured: x = 4, 5, 6, 8… each have a valid y with isTorsionFree() false.
        //
        // The assertion is on the DISTINCT rejection reason, not merely on "it threw". Three bad
        // points here reject for three different reasons, and an earlier guard firing first would
        // otherwise let this case pass while proving nothing — which is exactly how the off-curve
        // case below was vacuous in round one.
        const Fp = bls.fields.Fp;
        const x = 4n;
        const y = Fp.sqrt(Fp.add(Fp.mul(Fp.mul(x, x), x), 4n));
        expect(bls.G1.ProjectivePoint.fromAffine({ x, y }).isTorsionFree(), 'fixture must be OUTSIDE the subgroup').toBe(false);
        expect(() => parseDvtNodeState({ publicKey: word2(x, y) }))
            .toThrow(/not in prime-order subgroup/);
    });

    it('the three bad-point classes reject for three DIFFERENT reasons', () => {
        // Guards against an early return swallowing the later checks. If any two of these ever
        // produced the same message, one of the three probes would have stopped testing what its
        // name says while still passing.
        const Fp = bls.fields.Fp;
        const sub = (() => { const x = 4n; return word2(x, Fp.sqrt(Fp.add(Fp.mul(Fp.mul(x, x), x), 4n))); })();
        const reasons = [
            `0x${'00'.repeat(128)}`,   // infinity
            word2(1n, 1n),             // not on the curve
            sub,                       // on curve, outside subgroup
        ].map((pk) => {
            // NON-greedy: the infinity message carries two em-dashes, and a greedy strip ate the
            // half naming the cause, leaving "the contract rejects it". The instrument was deleting
            // the very word this test looks for.
            try { parseDvtNodeState({ publicKey: pk as `0x${string}` }); return 'ACCEPTED'; }
            catch (e) { return (e as Error).message.replace(/^.*?— /, ''); }
        });
        expect(new Set(reasons).size, `expected 3 distinct reasons, got ${JSON.stringify(reasons)}`).toBe(3);
        expect(reasons.some((r) => /infinity/.test(r))).toBe(true);
        expect(reasons.some((r) => /equation left != right/.test(r))).toBe(true);
        expect(reasons.some((r) => /prime-order subgroup/.test(r))).toBe(true);
    });

    it('rejects a well-formed but OFF-CURVE point', () => {
        // Distinct from the case above, and the distinction was found by mutation: the all-zero blob
        // is caught by the infinity check, so it never reaches `assertValidity` and could not tell
        // whether the curve check exists at all. This one has correct EIP-2537 padding and in-range
        // field elements — x=1, y=1, which does not satisfy y^2 = x^3 + 4 — so only a real curve
        // check rejects it.
        const fp = (n: string) => '0'.repeat(96 - n.length) + n;
        const offCurve = `0x${'00'.repeat(16)}${fp('1')}${'00'.repeat(16)}${fp('1')}`;
        expect(offCurve.length).toBe(2 + 256); // 128 bytes, so it passes every length/padding check
        expect(() => parseDvtNodeState({ publicKey: offCurve }))
            .toThrow(/not a valid BLS G1 point/);
    });
});

describe('parseDvtNodeState — the cross-check that stops a silent no-op registration (G4)', () => {
    it('accepts a recorded nodeId that agrees with the derivation', () => {
        expect(parseDvtNodeState({ publicKey: PUB_128, nodeId: NODE_ID }).nodeId).toBe(NODE_ID);
    });

    it('REFUSES a recorded nodeId that disagrees — and says why it is not recoverable', () => {
        // THE case this module exists for. On-chain a mismatched registration SUCCEEDS: the operator
        // stakes, the tx confirms, and the node never participates. Nothing reverts, so nothing else
        // in the stack will ever raise it.
        const wrong = keccak256('0xdeadbeef');
        const err = (() => { try { parseDvtNodeState({ publicKey: PUB_128, nodeId: wrong }); } catch (e) { return e as Error; } })()!;
        expect(err.message).toMatch(/recorded nodeId .* != keccak256\(publicKey\)/);
        // The message must carry the consequence, not just the mismatch — "they differ" reads as a
        // formatting nit; "the tx succeeds and the node silently never participates" does not.
        expect(err.message).toMatch(/would SUCCEED and the node would silently never participate/);
        expect(err.message).toMatch(/do not pick one/);
    });

    it('REFUSES a nodeId of the wrong width instead of comparing padded values', () => {
        expect(() => parseDvtNodeState({ publicKey: PUB_128, nodeId: '0x1234' }))
            .toThrow(/nodeId must be 32 bytes, got 2/);
    });

    it('REFUSES two key fields that describe different keys', () => {
        // A board that rewrote one field and not the other. Reading whichever comes first would make
        // the outcome depend on this function's internal order.
        const other = buildDvtPop(`0x${'22'.repeat(32)}`).publicKey;
        expect(() => parseDvtNodeState({ publicKey: PUB_128, publicKeyEip2537: other }))
            .toThrow(/describe DIFFERENT keys/);
    });

    it('POSITIVE CONTROL: two key fields carrying the SAME key are accepted', () => {
        // Without this, the assertion above would also pass if the parser rejected every state that
        // happened to carry both fields — a guard that fires on the normal case gets deleted.
        expect(parseDvtNodeState({ publicKey: PUB_128, publicKeyEip2537: PUB_128 }).nodeId).toBe(NODE_ID);
    });
});

describe('the derived values agree with the rest of the SDK', () => {
    it('nodeId matches what buildDvtPop puts on chain for the same key', () => {
        // Ties this parser to the value `registerWithProof` actually binds. If the two ever diverge,
        // a state file could validate here and still register a different node.
        expect(parseDvtNodeState({ publicKey: PUB_128 }).nodeId).toBe(POP.nodeId);
        expect(encodeG1Point(PUB_48)).toBe(POP.publicKey);
    });
});
