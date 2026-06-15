import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { hash_to_field } from '@noble/curves/abstract/hash-to-curve';
import { type Hex, toBytes } from 'viem';

/**
 * Frozen cross-repo DST (Domain Separation Tag) for the BLS-signature
 * Proof-of-Possession (POP) scheme. This MUST be byte-identical across:
 *   - SuperPaymaster        contracts/src/utils/BLS.sol            (dstPrime)
 *   - AAStar SDK            this file
 *   - YetAnotherAA-Validator src/utils/bls.util.ts                (BLS_DST)
 *
 * NOTE: @noble/curves's `bls.G2.defaults.DST` is the `_NUL_` variant
 * ("BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_"); we deliberately override
 * it with the `_POP_` variant to match the on-chain contract.
 */
export const BLS_POP_DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';

/**
 * The two Fp2 field elements (u0, u1) produced by `hash_to_field(msg, DST, 2)`,
 * each serialized in EIP-2537 split form to mirror SuperPaymaster's on-chain
 * `BLS.G2Point` X-coordinate layout.
 *
 * Each Fp2 element has two coordinates (c0, c1). Each Fp (a BLS12-381 base-field
 * element, 48 bytes) is serialized EIP-2537-style as 64 bytes
 * (16 zero bytes + 48-byte big-endian) and split into two bytes32:
 *   - `a` = high 32 bytes (16 zero bytes + top 16 bytes of the field element)
 *   - `b` = low 32 bytes  (bottom 32 bytes of the field element)
 */
export interface HashToFieldU0U1 {
    // u0 = first Fp2 element (c0, c1).
    u0c0a: Hex;
    u0c0b: Hex;
    u0c1a: Hex;
    u0c1b: Hex;
    // u1 = second Fp2 element (c0, c1).
    u1c0a: Hex;
    u1c0b: Hex;
    u1c1a: Hex;
    u1c1b: Hex;
}

/**
 * Serialize a BLS12-381 base-field element (Fp, < 2^381) into the EIP-2537
 * split form used on-chain: a 64-byte big-endian encoding (16 leading zero
 * bytes + 48 field bytes), split into the high 32 bytes (`a`) and low 32 bytes
 * (`b`).
 */
function fpToSplitBytes32(fp: bigint): { a: Hex; b: Hex } {
    // 96 hex chars = 48 bytes big-endian.
    const hex48 = fp.toString(16).padStart(96, '0');
    // EIP-2537 pads to 64 bytes (128 hex) with 16 leading zero bytes.
    const hex64 = hex48.padStart(128, '0');
    return {
        a: `0x${hex64.slice(0, 64)}` as Hex, // high 32 bytes
        b: `0x${hex64.slice(64)}` as Hex, // low 32 bytes
    };
}

/**
 * Compute `hash_to_field(message, DST=BLS_POP_DST, count=2)` for BLS12-381 G2
 * and serialize the resulting two Fp2 elements (u0, u1) into SuperPaymaster's
 * EIP-2537 split-bytes32 layout.
 *
 * This is the authoritative cross-repo golden surface for DVT: the node, the
 * SDK, and the on-chain verifier must all agree byte-for-byte on (u0, u1).
 * Full hash-to-curve (map_to_curve + clear_cofactor) is intentionally NOT
 * computed here because it needs EIP-2537 precompiles absent on cancun; the
 * contract only verifies the `hash_to_field` intermediate.
 *
 * @param message The message to hash (arbitrary-length bytes, as Hex).
 * @returns The 8 bytes32 values (u0/u1 × c0/c1 × a/b).
 */
export function hashToFieldU0U1(message: Hex): HashToFieldU0U1 {
    const msgBytes = toBytes(message);
    const opts = { ...bls.G2.defaults, DST: BLS_POP_DST };
    // hash_to_field with m=2 (Fp2 -> 2 coords) and count=2 yields:
    //   [ [u0.c0, u0.c1], [u1.c0, u1.c1] ]  as bigints.
    const [u0, u1] = hash_to_field(msgBytes, 2, opts);
    const u0c0 = fpToSplitBytes32(u0[0]);
    const u0c1 = fpToSplitBytes32(u0[1]);
    const u1c0 = fpToSplitBytes32(u1[0]);
    const u1c1 = fpToSplitBytes32(u1[1]);
    return {
        u0c0a: u0c0.a,
        u0c0b: u0c0.b,
        u0c1a: u0c1.a,
        u0c1b: u0c1.b,
        u1c0a: u1c0.a,
        u1c0b: u1c0.b,
        u1c1a: u1c1.a,
        u1c1b: u1c1.b,
    };
}
