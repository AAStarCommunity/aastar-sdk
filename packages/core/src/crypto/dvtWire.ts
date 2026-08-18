import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { type Hex, concat, isHex, numberToHex, size, toBytes, toHex } from 'viem';

/**
 * DVT combined-signature wire encoders — airaccount-contract #110 authoritative,
 * LIVE-verified format (deployed `AAStarBLSAlgorithm` beta.2 `0xA9EE4f8A…` on Sepolia).
 *
 * ## Why this supersedes the `signerMask` design
 *
 * An earlier SDK design (D1, {@link import('./blsSigner').BLSHelpers.encodeDVTProof})
 * encoded the contributing nodes as a `uint256 signerMask` bitmask. The DEPLOYED
 * verifier does NOT use a bitmask: it takes an EXPLICIT list of `bytes32` `nodeId`s
 * and rebuilds the aggregate public key by walking them in order. This module
 * implements the explicit-`nodeIds` wire that the live contract actually decodes;
 * the `signerMask` helpers are retained only for backward compatibility and are
 * marked `@deprecated`.
 *
 * ## Wire layouts (byte-for-byte, confirmed against live Sepolia txs)
 *
 * Account-level (goes into `PackedUserOperation.signature`):
 * ```
 * T2 (0x04): [0x04][P256 r(32)][P256 s(32)][nodeIdsLength(32)][nodeId_1(32)…nodeId_N(32)][blsSig(256)]
 * T3 (0x05): [0x05][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][guardianECDSA(65)]
 * ```
 * Verifier-level (the account strips `tier + P256 + nodeIdsLength`, then calls
 * `AAStarBLSAlgorithm.validate(userOpHash, …)`):
 * ```
 * validate(userOpHash, [nodeId_1(32)…nodeId_N(32)][blsSig(256)])   // NO nodeIdsLength prefix
 * ```
 *
 * Key invariants (all confirmed live):
 * - `nodeIds` are explicit `bytes32` IDs (NOT a `signerMask`). The encoders emit them STRICTLY
 *   ASCENDING (#274): the v0.27.0 DVT validator requires ordered, distinct ids. Callers may pass any
 *   order — BLS aggregation is commutative, so the (order-independent) aggregate `blsSig` still matches
 *   the sorted ids. Duplicate ids throw (a valid M-of-N aggregate has distinct signers).
 * - `blsSig` is a 256-byte uncompressed G2 point in EIP-2537 layout (see {@link encodeG2Point}).
 * - `messagePoint` is NOT attached (issue #45): the verifier recomputes
 *   `hashToG2(userOpHash)` on-chain. Do NOT pass `messagePoint`/`mpSig`.
 *
 * @module
 */

/** DVT account-signature tier byte: P256 primary + ≥threshold BLS aggregate (DVT co-sign). */
export const DVT_TIER_T2 = 0x04 as const;
/** DVT account-signature tier byte: T2 + a trailing 65-byte guardian ECDSA signature. */
export const DVT_TIER_T3 = 0x05 as const;
/** A DVT account-signature tier byte. */
export type DVTTier = typeof DVT_TIER_T2 | typeof DVT_TIER_T3;

/**
 * Account-signature algId byte for the `ALG_BLS` "legacy triple": a DVT BLS aggregate co-sign
 * PLUS a trailing owner-ECDSA factor (airaccount-contract `_validateTripleSignature`). Note this
 * is NOT a BLS-only path — the contract requires the owner signature too.
 */
export const ALG_BLS = 0x01 as const;

/** Byte length of a BLS12-381 G2 point in EIP-2537 layout (4 × 64-byte slots). */
const G2_EIP2537_LENGTH = 256;
/** Byte length of a compressed (zkcrypto) BLS12-381 G2 point. */
const G2_COMPRESSED_LENGTH = 96;
/** Byte length of an uncompressed (zkcrypto) BLS12-381 G2 point. */
const G2_UNCOMPRESSED_LENGTH = 192;
/** Byte length of each `bytes32` nodeId. */
const NODE_ID_LENGTH = 32;
/** Byte length of an Fp coordinate within an EIP-2537 64-byte slot (48-byte big-endian, 16-byte left pad). */
const FP_BYTES = 48;
/** EIP-2537 byte offsets for the four G2 Fp coordinates (x.c0, x.c1, y.c0, y.c1). */
const G2_FP_OFFSETS = [16, 80, 144, 208] as const;
/** Length of a guardian ECDSA signature (r(32) + s(32) + v(1)). */
const GUARDIAN_SIG_LENGTH = 65;

/**
 * Write a BLS12-381 Fp coordinate as a 48-byte big-endian value, right-aligned at
 * `offset` within a 64-byte EIP-2537 slot (the leading 16 bytes stay zero).
 */
function writeFp(out: Uint8Array, offset: number, value: bigint): void {
    const hex = value.toString(16).padStart(FP_BYTES * 2, '0');
    if (hex.length > FP_BYTES * 2) {
        throw new Error('encodeG2Point: Fp coordinate exceeds 48 bytes (point is not a valid BLS12-381 element)');
    }
    for (let i = 0; i < FP_BYTES; i++) {
        out[offset + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
}

/**
 * Produce the canonical 256-byte EIP-2537 G2 layout for a BLS aggregate signature,
 * byte-identical to the DVT node's `encodeG2Point` (YetAnotherAA-Validator
 * `src/utils/bls.util.ts`) and to what the contract pairs over.
 *
 * Layout: `x.c0 @ 16 / x.c1 @ 80 / y.c0 @ 144 / y.c1 @ 208`, each Fp a 48-byte
 * big-endian value right-aligned in its 64-byte slot (16 leading zero bytes).
 *
 * Accepts the signature in three forms:
 * - **256-byte EIP-2537** (what the node already emits): validated and passed through.
 * - **96-byte compressed** / **192-byte uncompressed** zkcrypto G2: re-packed via
 *   `@noble/curves` (parse → affine → EIP-2537 slots).
 *
 * @param blsSig The aggregate BLS G2 signature (hex or bytes).
 * @returns The 256-byte EIP-2537 G2 point as hex.
 */
export function encodeG2Point(blsSig: Hex | Uint8Array): Hex {
    const bytes = typeof blsSig === 'string' ? toBytes(blsSig) : blsSig;

    if (bytes.length === G2_EIP2537_LENGTH) {
        // Pass-through: the node already emits this layout. Validate the 16-byte zero
        // pad at the head of each 64-byte slot so a mis-shaped 256-byte blob (e.g. a
        // non-EIP-2537 encoding of the same total length) is rejected, not silently sent.
        for (const off of [0, 64, 128, 192]) {
            for (let i = 0; i < 16; i++) {
                if (bytes[off + i] !== 0) {
                    throw new Error(
                        `encodeG2Point: 256-byte input is not valid EIP-2537 (non-zero padding at byte ${off + i}; ` +
                        `each 64-byte slot must start with 16 zero bytes)`
                    );
                }
            }
        }
        return toHex(bytes);
    }

    if (bytes.length === G2_COMPRESSED_LENGTH || bytes.length === G2_UNCOMPRESSED_LENGTH) {
        // Re-pack a zkcrypto-serialized G2 point into the EIP-2537 slot layout.
        const point = bls.G2.ProjectivePoint.fromHex(bytes);
        const affine = point.toAffine();
        const out = new Uint8Array(G2_EIP2537_LENGTH);
        writeFp(out, G2_FP_OFFSETS[0], affine.x.c0);
        writeFp(out, G2_FP_OFFSETS[1], affine.x.c1);
        writeFp(out, G2_FP_OFFSETS[2], affine.y.c0);
        writeFp(out, G2_FP_OFFSETS[3], affine.y.c1);
        return toHex(out);
    }

    throw new Error(
        `encodeG2Point: unexpected BLS signature length ${bytes.length} bytes ` +
        `(expected 256 EIP-2537, 96 compressed, or 192 uncompressed G2)`
    );
}

/**
 * Sort nodeIds STRICTLY ASCENDING (by 32-byte big-endian value) for the BLS aggregation wire (#274).
 *
 * The DVT-unification validator (algId 0x01, airaccount-contract v0.27.0 / YetAnotherAA-Validator #170)
 * rejects unordered or duplicate nodeIds: a single node could otherwise submit `[nid, nid, …]` + k·sig to
 * fake an M-of-N quorum. Strictly-increasing ⇒ dedup, matching SP BLSAggregator's ordered signerMask.
 *
 * BLS aggregation is commutative (Σ sig / Σ pubkey are order-independent), so reordering the ids does NOT
 * change the aggregate signature — this only fixes the WIRE order. A duplicate nodeId is a malformed
 * aggregate → throw (rather than silently dropping an id whose signature is already summed in).
 */
export function sortNodeIdsAscending(nodeIds: readonly Hex[]): Hex[] {
    const sorted = [...nodeIds].sort((a, b) => {
        const av = BigInt(a);
        const bv = BigInt(b);
        return av < bv ? -1 : av > bv ? 1 : 0;
    });
    for (let i = 1; i < sorted.length; i++) {
        if (BigInt(sorted[i]) === BigInt(sorted[i - 1])) {
            throw new Error(
                `sortNodeIdsAscending: duplicate nodeId ${sorted[i]} — a valid M-of-N BLS aggregate has strictly-ascending, distinct nodeIds (#274)`
            );
        }
    }
    return sorted;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CC-98 / CC-103 — per-proposal COMMITTEE framing of the BLS block
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One committee signer's membership proof, accompanying its share of the aggregate BLS signature.
 *
 * `slot` and `merkleProof` authenticate `nodeId` against the FROZEN committee set root
 * `setRoot[e-1]` held by `AAStarCommitteeValidator`. They are NOT signed over — the BLS message is
 * still `bytes(userOpHash)` exactly as in legacy (authoritative: CC-103, dvt from
 * `AAStarValidator.sol` + `bls.util.ts`; DST `BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_`).
 */
export interface CommitteeSigner {
    /** `bytes32` node id (`keccak256(EIP-2537 G1 pubkey)`). */
    nodeId: Hex;
    /** Leaf index of `nodeId` in the frozen committee set. */
    slot: bigint | number;
    /** `TREE_DEPTH` sibling hashes, leaf→root order. Length must equal the validator's TREE_DEPTH. */
    merkleProof: readonly Hex[];
}

/**
 * The validator's Merkle tree depth. `AAStarCommitteeValidator.TREE_DEPTH` is a `public constant`
 * = 14, giving `perSigner = 64 + 14*32 = 512`. Exported only as the DEFAULT for offline/test use:
 * production callers should read `TREE_DEPTH()` from the mounted validator and pass it through, so
 * a depth change upstream does not silently produce mis-shaped payloads here (CC-103 Q4 — raised by
 * KMS, endorsed by airaccount-contract, accepted by dvt).
 */
export const COMMITTEE_TREE_DEPTH_DEFAULT = 14 as const;

/** Byte length of one committee signer entry: `nodeId(32) ‖ slot(32) ‖ proof(depth×32)`. */
export function committeePerSignerLength(treeDepth: number = COMMITTEE_TREE_DEPTH_DEFAULT): number {
    if (!Number.isInteger(treeDepth) || treeDepth <= 0) {
        throw new Error(`committeePerSignerLength: treeDepth must be a positive integer, got ${treeDepth}`);
    }
    return 2 * NODE_ID_LENGTH + treeDepth * NODE_ID_LENGTH;
}

/**
 * Sentinel returned by `AAStarCommitteeValidator.requiredQuorum()` when committee validation cannot
 * be satisfied at all — `epochLength == 0` (committee off) or the `e-1` snapshot is missing/stale.
 *
 * NOT documented in the CC-103 wire spec, which describes `requiredQuorum()` only as `⌈2·m_e/3⌉`;
 * found by reading it back on-chain (it returned `type(uint256).max` on the live validator) and
 * confirmed in `AAStarCommitteeValidator.sol:385`. A caller that compares `k >= requiredQuorum()`
 * without special-casing this can never pass, so {@link assertCommitteeQuorum} rejects it with a
 * message naming the real cause instead of an impossible-quorum error.
 */
export const COMMITTEE_QUORUM_UNAVAILABLE = (1n << 256n) - 1n;

/**
 * Guard the collected signer count against the validator's live quorum.
 *
 * @param signerCount Number of committee signers whose partials are in the aggregate.
 * @param requiredQuorum Value read from `AAStarCommitteeValidator.requiredQuorum()`.
 */
export function assertCommitteeQuorum(signerCount: number, requiredQuorum: bigint): void {
    if (requiredQuorum === COMMITTEE_QUORUM_UNAVAILABLE) {
        throw new Error(
            'assertCommitteeQuorum: validator returned the fail-closed sentinel type(uint256).max — committee ' +
            'validation cannot succeed right now. Either committee mode is off (epochLength == 0) or the ' +
            'previous epoch has no usable pinned snapshot (needs snapshotEpoch()). Do not submit a committee ' +
            'payload until requiredQuorum() returns a real value.'
        );
    }
    if (requiredQuorum === 0n) {
        throw new Error('assertCommitteeQuorum: requiredQuorum() returned 0, which is never a valid quorum');
    }
    if (BigInt(signerCount) < requiredQuorum) {
        throw new Error(
            `assertCommitteeQuorum: only ${signerCount} committee signer(s) collected, validator requires ` +
            `${requiredQuorum} — aggregate would be rejected on-chain`
        );
    }
}

/**
 * Encode the committee-framed BLS block:
 * ```
 * [nodeIdsLength(32)][ (nodeId(32) ‖ slot(32) ‖ merkleProof(depth×32)) × k ][ blsSig(256) ]
 * ```
 * versus the legacy block `[nodeIdsLength(32)][ nodeId(32) × k ][ blsSig(256) ]`.
 *
 * `nodeIdsLength` stays the SIGNER COUNT `k` (not a byte length) and stays in the same position, so
 * the two framings differ only in the per-signer stride — which is why the account must decide
 * legacy-vs-committee from `committeeValidator.committeeActive()` rather than from the payload
 * shape (the shape-collision that CC-103 calls out as the flip-order attack root).
 *
 * **`accountId` is never included.** The account prepends `address(this)` itself before calling
 * `validate()`; a submitter-supplied `accountId` would let an attacker shop for an account whose
 * committee draw favours their own nodes, breaking the 2/3 assumption outright (CC-103 §二, "命门 B2").
 *
 * Signers are emitted in STRICTLY ASCENDING `nodeId` order, carrying each signer's `slot`/`proof`
 * with it, for the same reason legacy sorts ids (#274).
 */
export function encodeCommitteeBLSBlock(
    signers: readonly CommitteeSigner[],
    blsSig: Hex | Uint8Array,
    treeDepth: number = COMMITTEE_TREE_DEPTH_DEFAULT
): Hex {
    if (signers.length === 0) {
        throw new Error('encodeCommitteeBLSBlock: signers must be a non-empty list');
    }
    signers.forEach((s, i) => {
        if (!isHex(s.nodeId) || size(s.nodeId) !== NODE_ID_LENGTH) {
            throw new Error(`encodeCommitteeBLSBlock: signers[${i}].nodeId must be a 32-byte hex value, got ${s.nodeId}`);
        }
        if (s.merkleProof.length !== treeDepth) {
            throw new Error(
                `encodeCommitteeBLSBlock: signers[${i}].merkleProof has ${s.merkleProof.length} element(s), ` +
                `validator TREE_DEPTH is ${treeDepth} — the on-chain _verifyMerkle rejects any other length`
            );
        }
        s.merkleProof.forEach((p, j) => {
            if (!isHex(p) || size(p) !== NODE_ID_LENGTH) {
                throw new Error(`encodeCommitteeBLSBlock: signers[${i}].merkleProof[${j}] must be a 32-byte hex value`);
            }
        });
        const slot = BigInt(s.slot);
        if (slot < 0n || slot >= 1n << BigInt(treeDepth)) {
            throw new Error(
                `encodeCommitteeBLSBlock: signers[${i}].slot ${slot} is outside [0, 2^${treeDepth}) — ` +
                `a slot that wide cannot address a leaf of a depth-${treeDepth} tree`
            );
        }
    });

    // Same ordering rule as legacy (#274): strictly ascending, distinct. sortNodeIdsAscending throws
    // on duplicates, so run the ids through it and then reorder the full entries to match.
    const order = sortNodeIdsAscending(signers.map((s) => s.nodeId));
    const byId = new Map(signers.map((s) => [BigInt(s.nodeId), s]));
    const sorted = order.map((id) => byId.get(BigInt(id))!);

    const parts: Hex[] = [numberToHex(sorted.length, { size: 32 })];
    for (const s of sorted) {
        parts.push(s.nodeId, numberToHex(BigInt(s.slot), { size: 32 }), ...s.merkleProof);
    }
    parts.push(encodeG2Point(blsSig));
    return concat(parts);
}

/** Validate that every nodeId is a 32-byte hex value, then return them STRICTLY ASCENDING (#274). */
function validateNodeIds(nodeIds: Hex[], fn: string): Hex[] {
    if (nodeIds.length === 0) {
        throw new Error(`${fn}: nodeIds must be a non-empty list of bytes32 IDs`);
    }
    nodeIds.forEach((id, i) => {
        if (!isHex(id) || size(id) !== NODE_ID_LENGTH) {
            throw new Error(`${fn}: nodeId[${i}] must be a 32-byte (bytes32) hex value, got ${id}`);
        }
    });
    // #274: the v0.27.0 validator requires strictly-ascending nodeIds on the wire. BLS aggregation is
    // commutative, so sorting here does not change the aggregate signature the ids accompany.
    return sortNodeIdsAscending(nodeIds);
}

/**
 * Encode the VERIFIER-LEVEL proof passed to `AAStarBLSAlgorithm.validate`:
 * `[nodeId_1(32)…nodeId_N(32)][blsSig(256)]` — NO `nodeIdsLength` prefix (the contract
 * derives `nodeCount = (sig.length - 256) / 32`).
 *
 * `nodeIds` order MUST equal the nodes' signing/aggregation order.
 *
 * @param nodeIds Explicit `bytes32` node IDs of the contributing signers, in order.
 * @param blsSig The aggregate BLS G2 signature (256-byte EIP-2537, or 96/192-byte zkcrypto).
 */
export function encodeDVTVerifierProof(nodeIds: Hex[], blsSig: Hex | Uint8Array): Hex {
    const ids = validateNodeIds(nodeIds, 'encodeDVTVerifierProof');
    const sig = encodeG2Point(blsSig);
    return concat([...ids, sig]);
}

/** Normalize a P256 primary signature to a 64-byte `r‖s` hex value. */
function normalizeP256(p256: { r: Hex; s: Hex } | Hex): Hex {
    if (typeof p256 === 'string') {
        if (!isHex(p256) || size(p256) !== 64) {
            throw new Error('encodeDVTAccountSignature: p256 bytes form must be a 64-byte (r‖s) hex value');
        }
        return p256;
    }
    if (!isHex(p256.r) || size(p256.r) !== 32) {
        throw new Error('encodeDVTAccountSignature: p256.r must be a 32-byte hex value');
    }
    if (!isHex(p256.s) || size(p256.s) !== 32) {
        throw new Error('encodeDVTAccountSignature: p256.s must be a 32-byte hex value');
    }
    return concat([p256.r, p256.s]);
}

/** Parameters for {@link encodeDVTAccountSignature}. */
export interface DVTAccountSignatureParams {
    /** Tier byte: {@link DVT_TIER_T2} (0x04) or {@link DVT_TIER_T3} (0x05). */
    tier: DVTTier;
    /** P256 primary signature, as `{ r, s }` (each 32 bytes) or a 64-byte `r‖s` hex value. */
    p256: { r: Hex; s: Hex } | Hex;
    /**
     * Explicit `bytes32` node IDs of the contributing signers. LEGACY framing
     * (`committeeActive() == false`). Mutually exclusive with {@link committeeSigners}.
     */
    nodeIds?: Hex[];
    /**
     * COMMITTEE framing (`committeeActive() == true`, CC-98/CC-103): each signer carries its `slot`
     * and Merkle proof against the frozen set root. Mutually exclusive with {@link nodeIds}.
     */
    committeeSigners?: readonly CommitteeSigner[];
    /** Validator `TREE_DEPTH()`. Read it on-chain; defaults to {@link COMMITTEE_TREE_DEPTH_DEFAULT}. */
    treeDepth?: number;
    /** Aggregate BLS G2 signature (256-byte EIP-2537, or 96/192-byte zkcrypto). */
    blsSig: Hex | Uint8Array;
    /** REQUIRED for T3 (0x05): the trailing 65-byte guardian ECDSA signature. Forbidden for T2. */
    guardianSig?: Hex;
}

/**
 * Build the BLS block for whichever framing the caller supplied, enforcing that exactly one is.
 *
 * Legacy   : `[nodeIdsLength(32)][ nodeId(32) × k ][ blsSig(256) ]`
 * Committee: `[nodeIdsLength(32)][ (nodeId ‖ slot ‖ proof)(perSigner) × k ][ blsSig(256) ]`
 */
function buildBLSBlock(
    fn: string,
    nodeIds: Hex[] | undefined,
    committeeSigners: readonly CommitteeSigner[] | undefined,
    blsSig: Hex | Uint8Array,
    treeDepth?: number
): Hex {
    if (nodeIds !== undefined && committeeSigners !== undefined) {
        throw new Error(
            `${fn}: pass either nodeIds (legacy) or committeeSigners (committee), not both — the account picks ` +
            `its framing from committeeActive(), so an ambiguous call would encode for the wrong mode`
        );
    }
    if (committeeSigners !== undefined) {
        return encodeCommitteeBLSBlock(committeeSigners, blsSig, treeDepth ?? COMMITTEE_TREE_DEPTH_DEFAULT);
    }
    if (nodeIds === undefined) {
        throw new Error(`${fn}: must pass nodeIds (legacy framing) or committeeSigners (committee framing)`);
    }
    const ids = validateNodeIds(nodeIds, fn);
    return concat([numberToHex(ids.length, { size: 32 }), ...ids, encodeG2Point(blsSig)]);
}

/**
 * Encode the ACCOUNT-LEVEL combined signature that goes into
 * `PackedUserOperation.signature`, per airaccount-contract #110:
 * ```
 * T2: [0x04][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)]
 * T3: [0x05][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][guardianECDSA(65)]
 * ```
 * `nodeIdsLength` is a 32-byte big-endian `uint256` count of `nodeIds`.
 */
export function encodeDVTAccountSignature(params: DVTAccountSignatureParams): Hex {
    const { tier, p256, nodeIds, committeeSigners, treeDepth, blsSig, guardianSig } = params;

    if (tier !== DVT_TIER_T2 && tier !== DVT_TIER_T3) {
        throw new Error(`encodeDVTAccountSignature: tier must be 0x04 (T2) or 0x05 (T3), got ${tier}`);
    }

    const tierByte = numberToHex(tier, { size: 1 });
    const p256Bytes = normalizeP256(p256);
    const blsBlock = buildBLSBlock('encodeDVTAccountSignature', nodeIds, committeeSigners, blsSig, treeDepth);

    if (tier === DVT_TIER_T3) {
        if (guardianSig === undefined || !isHex(guardianSig) || size(guardianSig) !== GUARDIAN_SIG_LENGTH) {
            throw new Error('encodeDVTAccountSignature: T3 (0x05) requires a 65-byte guardian ECDSA signature');
        }
        return concat([tierByte, p256Bytes, blsBlock, guardianSig]);
    }

    // T2 (0x04): no guardian segment.
    if (guardianSig !== undefined) {
        throw new Error('encodeDVTAccountSignature: T2 (0x04) must not carry a guardian signature — use tier 0x05 for T3');
    }
    return concat([tierByte, p256Bytes, blsBlock]);
}

/** Parameters for {@link encodeBLSAccountSignature}. */
export interface BLSAccountSignatureParams {
    /** Explicit `bytes32` node IDs — LEGACY framing. Mutually exclusive with {@link committeeSigners}. */
    nodeIds?: Hex[];
    /** COMMITTEE framing (CC-98/CC-103). Mutually exclusive with {@link nodeIds}. */
    committeeSigners?: readonly CommitteeSigner[];
    /** Validator `TREE_DEPTH()`. Read it on-chain; defaults to {@link COMMITTEE_TREE_DEPTH_DEFAULT}. */
    treeDepth?: number;
    /** Aggregate BLS G2 signature (256-byte EIP-2537, or 96/192-byte zkcrypto). */
    blsSig: Hex | Uint8Array;
    /**
     * The trailing 65-byte OWNER ECDSA signature over `toEthSignedMessageHash(userOpHash)`
     * (EIP-191). The contract recovers it and requires `recovered == owner`.
     */
    ownerSig: Hex;
}

/**
 * Encode the ACCOUNT-LEVEL `ALG_BLS` (0x01) signature that goes into
 * `PackedUserOperation.signature` for an `EntryPoint.handleOps` BLS UserOp, per
 * airaccount-contract `AAStarAirAccountBase._validateTripleSignature`:
 * ```
 * [0x01][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][ownerECDSA(65)]
 * ```
 * `nodeIdsLength` is a 32-byte big-endian `uint256` count. The BLS payload `[nodeIds][blsSig]`
 * (no length prefix) is the same blob {@link encodeDVTVerifierProof} hands to the verifier's
 * `validate(userOpHash, …)`; the account additionally binds the owner ECDSA over the
 * eth-signed `userOpHash`. (So `ALG_BLS` is a 2-factor BLS+owner path, not BLS-only —
 * it is distinct from the verifier-level `validate` which checks the aggregate alone.)
 */
export function encodeBLSAccountSignature(params: BLSAccountSignatureParams): Hex {
    const { nodeIds, committeeSigners, treeDepth, blsSig, ownerSig } = params;
    if (!isHex(ownerSig) || size(ownerSig) !== GUARDIAN_SIG_LENGTH) {
        throw new Error('encodeBLSAccountSignature: ownerSig must be a 65-byte ECDSA signature (r‖s‖v)');
    }
    const algByte = numberToHex(ALG_BLS, { size: 1 });
    const blsBlock = buildBLSBlock('encodeBLSAccountSignature', nodeIds, committeeSigners, blsSig, treeDepth);
    return concat([algByte, blsBlock, ownerSig]);
}
