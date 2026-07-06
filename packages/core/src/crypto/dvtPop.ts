import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { type Hex, isHex, keccak256, size, toBytes, toHex } from 'viem';
import { BLS_POP_DST } from './hashToField.js';
import { encodeG2Point } from './dvtWire.js';

/**
 * DVT node registration Proof-of-Possession (PoP) builder.
 *
 * A prospective DVT operator proves knowledge of the BLS secret key behind its G1 public
 * key before {@link https://github.com/AAStarCommunity/YetAnotherAA-Validator | AAStarBLSAlgorithm}
 * (source `AAStarValidator.sol`, the DVT validator, Sepolia `0x539B9681…`) will bind
 * `nodeId = keccak256(publicKey)` to `msg.sender` via `registerWithProof(publicKey, popPoint, popSig)`
 * (YetAnotherAA-Validator #165, staked-registration path — caller must hold `ROLE_DVT` + stake).
 *
 * ## What the contract checks
 *
 * `_verifyPoP` runs a single pairing product on the EIP-2537 precompile:
 *
 * ```
 *   e(-publicKey, popPoint) · e(G1_generator, popSig) == 1
 *   ⇔ e(G1_generator, popSig) == e(publicKey, popPoint)
 * ```
 *
 * With `publicKey = sk · G1_generator` this holds **iff** `popSig = sk · popPoint` — i.e. the
 * registrant knows `sk`. NOTE: the check is a *proof of knowledge of `sk`*, NOT a signature over a
 * fixed message — it passes for ANY `popPoint` as long as `popSig = sk · popPoint`. The contract does
 * NOT recompute `popPoint` from the pubkey, so the message hashed into `popPoint` is a convention, not
 * a consensus constant. We follow the RFC PoP convention (`popPoint = hashToCurve(publicKey, POP_DST)`)
 * for determinism and cross-tool legibility; interop does not depend on it.
 *
 * Rogue-key defences that DO matter (enforced on-chain): `nodeId = keccak256(publicKey)` (no
 * caller-chosen id → no squatting), and point-at-infinity rejection on all three operands (an
 * infinity operand makes `e(_, ∞)=1`, passing the pairing with no secret known).
 *
 * @module
 */

/** Byte length of a BLS12-381 G1 point in EIP-2537 layout (2 × 64-byte slots). */
const G1_EIP2537_LENGTH = 128;
/** Fp coordinate width: 48-byte big-endian, right-aligned in a 64-byte slot (16-byte zero pad). */
const FP_BYTES = 48;
/** EIP-2537 byte offsets for the two G1 Fp coordinates (x @ slot 0, y @ slot 1). */
const G1_FP_OFFSETS = [16, 80] as const;
/** BLS12-381 scalar field order r — valid secret keys are in [1, r-1]. */
const BLS_CURVE_ORDER = bls.params.r;

/** Write a 48-byte big-endian Fp coordinate right-aligned at `offset` in a 64-byte EIP-2537 slot. */
function writeFp(out: Uint8Array, offset: number, value: bigint): void {
    const hex = value.toString(16).padStart(FP_BYTES * 2, '0');
    if (hex.length > FP_BYTES * 2) {
        throw new Error('encodeG1Point: Fp coordinate exceeds 48 bytes (point is not a valid BLS12-381 element)');
    }
    for (let i = 0; i < FP_BYTES; i++) {
        out[offset + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
}

/**
 * Encode a BLS12-381 G1 point into the canonical 128-byte EIP-2537 layout the contract stores as
 * `publicKey` (`x @ 16`, `y @ 80`, each a 48-byte big-endian Fp right-aligned in a 64-byte slot).
 * Accepts a G1 point in EIP-2537 (128-byte, validated pass-through) or zkcrypto compressed (48-byte)
 * / uncompressed (96-byte) form.
 */
export function encodeG1Point(pubkey: Hex | Uint8Array): Hex {
    const bytes = typeof pubkey === 'string' ? toBytes(pubkey) : pubkey;

    if (bytes.length === G1_EIP2537_LENGTH) {
        // Pass-through; validate the 16-byte zero pad heading each 64-byte slot so a mis-shaped
        // 128-byte blob is rejected, not silently registered.
        for (const off of [0, 64]) {
            for (let i = 0; i < 16; i++) {
                if (bytes[off + i] !== 0) {
                    throw new Error(
                        `encodeG1Point: 128-byte input is not valid EIP-2537 (non-zero padding at byte ${off + i}; ` +
                        `each 64-byte slot must start with 16 zero bytes)`
                    );
                }
            }
        }
        return toHex(bytes);
    }

    if (bytes.length === 48 || bytes.length === 96) {
        const affine = bls.G1.ProjectivePoint.fromHex(bytes).toAffine();
        const out = new Uint8Array(G1_EIP2537_LENGTH);
        writeFp(out, G1_FP_OFFSETS[0], affine.x);
        writeFp(out, G1_FP_OFFSETS[1], affine.y);
        return toHex(out);
    }

    throw new Error(
        `encodeG1Point: unexpected G1 length ${bytes.length} bytes (expected 128 EIP-2537, 48 compressed, or 96 uncompressed)`
    );
}

/** The complete tuple `registerWithProof(publicKey, popPoint, popSig)` consumes, plus the derived nodeId. */
export interface DvtPop {
    /** G1 public key in 128-byte EIP-2537 layout — the `publicKey` argument. */
    publicKey: Hex;
    /** `hashToCurve(publicKey, POP_DST)` as a 256-byte EIP-2537 G2 point — the `popPoint` argument. */
    popPoint: Hex;
    /** `sk · popPoint` as a 256-byte EIP-2537 G2 point — the `popSig` argument. */
    popSig: Hex;
    /** `keccak256(publicKey)` — the nodeId the contract will derive and bind (NOT caller-chosen). */
    nodeId: Hex;
}

/**
 * Build the Proof-of-Possession tuple for {@link https://github.com/AAStarCommunity/YetAnotherAA-Validator | AAStarBLSAlgorithm}'s
 * `registerWithProof(publicKey, popPoint, popSig)` from a BLS12-381 secret key.
 *
 * The returned `nodeId` (`keccak256(publicKey)`) is what the contract binds to `msg.sender`; surface it
 * to the operator so the UI can show/track it before the tx lands.
 *
 * @param blsSecretKey 32-byte BLS12-381 secret scalar (hex), in [1, r-1].
 * @throws if the secret key is out of range (0 or ≥ curve order).
 */
export function buildDvtPop(blsSecretKey: Hex): DvtPop {
    // Require a canonical 32-byte hex scalar: the production Rust signer rejects non-32-byte keys
    // (signer/src/bls.rs), so accepting a short hex like `0x1` here would diverge from it.
    if (!isHex(blsSecretKey) || size(blsSecretKey) !== 32) {
        throw new Error('buildDvtPop: BLS secret key must be a 32-byte hex value');
    }
    const sk = BigInt(blsSecretKey);
    if (sk <= 0n || sk >= BLS_CURVE_ORDER) {
        throw new Error('buildDvtPop: BLS secret key must be a scalar in [1, r-1] (r = BLS12-381 curve order)');
    }

    // publicKey = sk · G1_generator, serialized EIP-2537 (128 bytes) — matches on-chain storage.
    const pubPoint = bls.G1.ProjectivePoint.BASE.multiply(sk);
    const publicKey = encodeG1Point(pubPoint.toRawBytes(false));
    const nodeId = keccak256(publicKey);

    // popPoint = hashToCurve(publicKey, POP_DST); popSig = sk · popPoint. See module doc: the on-chain
    // pairing accepts any popPoint with popSig = sk · popPoint, so message choice is a convention only.
    // Serialize via dvtWire.encodeG2Point (the c0-first EIP-2537 layout the pairing precompile expects,
    // golden-vector-verified against the production DVT signer — NOT the c1-first IETF/blst order).
    const popPointG2 = bls.G2.hashToCurve(toBytes(publicKey), { DST: BLS_POP_DST }) as InstanceType<
        typeof bls.G2.ProjectivePoint
    >;
    const popSigG2 = popPointG2.multiply(sk);

    return {
        publicKey,
        popPoint: encodeG2Point(popPointG2.toRawBytes(false)),
        popSig: encodeG2Point(popSigG2.toRawBytes(false)),
        nodeId,
    };
}
