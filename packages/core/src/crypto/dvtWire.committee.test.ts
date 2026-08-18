import { describe, expect, it } from 'vitest';
import { concat, keccak256, numberToHex, size, toHex, type Hex } from 'viem';
import {
    ALG_BLS,
    COMMITTEE_QUORUM_UNAVAILABLE,
    COMMITTEE_TREE_DEPTH_DEFAULT,
    DVT_TIER_T2,
    DVT_TIER_T3,
    assertCommitteeQuorum,
    committeePerSignerLength,
    encodeBLSAccountSignature,
    encodeCommitteeBLSBlock,
    encodeDVTAccountSignature,
    type CommitteeSigner,
} from './dvtWire.js';

const DEPTH = COMMITTEE_TREE_DEPTH_DEFAULT;
const id = (n: number): Hex => numberToHex(n, { size: 32 });
const proof = (seed: number): Hex[] => Array.from({ length: DEPTH }, (_, i) => id(1000 + seed * 100 + i));
const BLS_SIG: Hex = toHex(new Uint8Array(256)); // valid EIP-2537 shape (all-zero pads included)
const OWNER_SIG: Hex = `0x${'11'.repeat(65)}`;
const GUARDIAN_SIG: Hex = `0x${'22'.repeat(65)}`;
const P256 = { r: id(7), s: id(8) };

const signer = (n: number): CommitteeSigner => ({ nodeId: id(n), slot: BigInt(n), merkleProof: proof(n) });

describe('committee per-signer wire (CC-98 / CC-103)', () => {
    it('perSigner is 64 + depth*32 = 512 at the deployed TREE_DEPTH of 14', () => {
        expect(committeePerSignerLength()).toBe(512);
        expect(committeePerSignerLength(DEPTH)).toBe(64 + DEPTH * 32);
        expect(committeePerSignerLength(1)).toBe(96);
    });

    it('lays out [k][ (nodeId|slot|proof) x k ][blsSig] with the exact expected byte length', () => {
        const signers = [signer(1), signer(2)];
        const block = encodeCommitteeBLSBlock(signers, BLS_SIG);
        expect(size(block)).toBe(32 + 2 * 512 + 256);

        // nodeIdsLength stays the SIGNER COUNT and stays in the same position as legacy.
        expect(block.slice(0, 66)).toBe(numberToHex(2, { size: 32 }));

        // First signer entry, field by field.
        const entry = `0x${block.slice(66, 66 + 512 * 2)}` as Hex;
        expect(entry.slice(0, 66)).toBe(id(1));
        expect(`0x${entry.slice(66, 130)}`).toBe(numberToHex(1n, { size: 32 }));
        expect(`0x${entry.slice(130)}`).toBe(concat(proof(1)));
    });

    it('never emits accountId — the account injects address(this) (CC-103 命门 B2)', () => {
        // An attacker-chosen accountId in the payload is the documented 2/3 break. The encoder takes
        // no account parameter at all, so the only way to assert this is that a 20-byte account
        // address cannot appear anywhere in the output for arbitrary inputs.
        const account = '0x00000000000000000000000000000000deadbeef';
        const block = encodeCommitteeBLSBlock([signer(1), signer(2)], BLS_SIG);
        expect(block.toLowerCase()).not.toContain(account.slice(2).toLowerCase());
        // And the block starts with the signer count, not a 32-byte account word.
        expect(BigInt(`0x${block.slice(2, 66)}`)).toBe(2n);
    });

    it('sorts signers strictly ascending by nodeId, carrying slot+proof with each', () => {
        const asc = encodeCommitteeBLSBlock([signer(1), signer(2), signer(3)], BLS_SIG);
        const desc = encodeCommitteeBLSBlock([signer(3), signer(1), signer(2)], BLS_SIG);
        expect(desc).toBe(asc);

        // The reordering must move the WHOLE entry, not just the ids: entry i must still pair
        // nodeId(i) with proof(i).
        const first = `0x${desc.slice(66, 66 + 512 * 2)}` as Hex;
        expect(first.slice(0, 66)).toBe(id(1));
        expect(`0x${first.slice(130)}`).toBe(concat(proof(1)));
    });

    it('rejects duplicate signers (a valid M-of-N aggregate has distinct signers)', () => {
        expect(() => encodeCommitteeBLSBlock([signer(1), signer(1)], BLS_SIG)).toThrow(/duplicate nodeId/);
    });

    it('rejects a proof whose length is not TREE_DEPTH — on-chain _verifyMerkle would reject it', () => {
        const short: CommitteeSigner = { nodeId: id(1), slot: 0n, merkleProof: proof(1).slice(0, DEPTH - 1) };
        expect(() => encodeCommitteeBLSBlock([short], BLS_SIG)).toThrow(/TREE_DEPTH is 14/);
    });

    it('rejects a slot that cannot address a leaf of a depth-14 tree', () => {
        const wide: CommitteeSigner = { nodeId: id(1), slot: 1n << 14n, merkleProof: proof(1) };
        expect(() => encodeCommitteeBLSBlock([wide], BLS_SIG)).toThrow(/outside \[0, 2\^14\)/);
        // The largest valid slot is accepted.
        expect(() =>
            encodeCommitteeBLSBlock([{ nodeId: id(1), slot: (1n << 14n) - 1n, merkleProof: proof(1) }], BLS_SIG)
        ).not.toThrow();
    });

    it('honours a non-default treeDepth so an upstream depth change does not need an SDK release', () => {
        const d = 4;
        const s: CommitteeSigner = { nodeId: id(1), slot: 3n, merkleProof: proof(1).slice(0, d) };
        expect(size(encodeCommitteeBLSBlock([s], BLS_SIG, d))).toBe(32 + (64 + d * 32) + 256);
    });
});

describe('committee framing inside the account-level signatures', () => {
    it('T2/T3 committee payloads differ from legacy only in the BLS block', () => {
        const legacy = encodeDVTAccountSignature({ tier: DVT_TIER_T2, p256: P256, nodeIds: [id(1)], blsSig: BLS_SIG });
        const cmt = encodeDVTAccountSignature({ tier: DVT_TIER_T2, p256: P256, committeeSigners: [signer(1)], blsSig: BLS_SIG });
        // tier byte + P256(64) prefix identical …
        expect(cmt.slice(0, 2 + 2 + 128)).toBe(legacy.slice(0, 2 + 2 + 128));
        // … and the committee block is exactly (perSigner - 32) bytes longer for one signer.
        expect(size(cmt) - size(legacy)).toBe(512 - 32);
    });

    it('T3 keeps the trailing guardian signature after the committee block', () => {
        const sig = encodeDVTAccountSignature({
            tier: DVT_TIER_T3,
            p256: P256,
            committeeSigners: [signer(1), signer(2)],
            blsSig: BLS_SIG,
            guardianSig: GUARDIAN_SIG,
        });
        expect(size(sig)).toBe(1 + 64 + (32 + 2 * 512 + 256) + 65);
        expect(`0x${sig.slice(sig.length - 130)}`).toBe(GUARDIAN_SIG);
    });

    it('ALG_BLS (0x01) triple carries the committee block and keeps the owner ECDSA last', () => {
        const sig = encodeBLSAccountSignature({ committeeSigners: [signer(1)], blsSig: BLS_SIG, ownerSig: OWNER_SIG });
        expect(sig.slice(0, 4)).toBe(numberToHex(ALG_BLS, { size: 1 }));
        expect(size(sig)).toBe(1 + (32 + 512 + 256) + 65);
        expect(`0x${sig.slice(sig.length - 130)}`).toBe(OWNER_SIG);
    });

    it('refuses an ambiguous call that supplies both framings', () => {
        expect(() =>
            encodeDVTAccountSignature({
                tier: DVT_TIER_T2,
                p256: P256,
                nodeIds: [id(1)],
                committeeSigners: [signer(1)],
                blsSig: BLS_SIG,
            })
        ).toThrow(/not both/);
    });

    it('refuses a call that supplies neither framing', () => {
        expect(() => encodeDVTAccountSignature({ tier: DVT_TIER_T2, p256: P256, blsSig: BLS_SIG })).toThrow(
            /must pass nodeIds .* or committeeSigners/
        );
    });

    it('LEGACY output is byte-identical to before the committee change (back-compat)', () => {
        // committeeActive()==false must stay byte-for-byte unchanged for old accounts/validators.
        const sig = encodeDVTAccountSignature({
            tier: DVT_TIER_T2,
            p256: P256,
            nodeIds: [id(2), id(1)],
            blsSig: BLS_SIG,
        });
        const expected = concat([
            numberToHex(DVT_TIER_T2, { size: 1 }),
            P256.r,
            P256.s,
            numberToHex(2, { size: 32 }),
            id(1),
            id(2),
            BLS_SIG,
        ]);
        expect(sig).toBe(expected);
    });
});

describe('requiredQuorum sentinel handling', () => {
    it('names the real cause instead of reporting an impossible quorum', () => {
        expect(() => assertCommitteeQuorum(3, COMMITTEE_QUORUM_UNAVAILABLE)).toThrow(/fail-closed sentinel/);
        expect(() => assertCommitteeQuorum(3, COMMITTEE_QUORUM_UNAVAILABLE)).toThrow(/snapshotEpoch/);
    });

    it('rejects an under-quorum aggregate before it reaches the chain', () => {
        expect(() => assertCommitteeQuorum(1, 2n)).toThrow(/only 1 committee signer/);
        expect(() => assertCommitteeQuorum(2, 2n)).not.toThrow();
        expect(() => assertCommitteeQuorum(3, 2n)).not.toThrow();
    });

    it('rejects a zero quorum', () => {
        expect(() => assertCommitteeQuorum(0, 0n)).toThrow(/returned 0/);
    });
});

describe('Merkle proof folding matches the on-chain _verifyMerkle', () => {
    // Mirror of AAStarCommitteeValidator._verifyMerkle: fold leaf at `slot` through `proof`,
    // bit i of slot selecting left/right. Used to check that the proofs we encode actually
    // reconstruct a root — the encoder is only useful if the bytes it carries verify.
    const fold = (slot: bigint, leaf: Hex, siblings: readonly Hex[]): Hex => {
        let cur = leaf;
        let idx = slot;
        for (const sib of siblings) {
            cur = (idx & 1n) === 0n ? keccak256(concat([cur, sib])) : keccak256(concat([sib, cur]));
            idx >>= 1n;
        }
        return cur;
    };

    it('a 2-leaf tree folds to the same root from either leaf', () => {
        const a = id(0xaa);
        const b = id(0xbb);
        const zeros: Hex[] = [];
        let z: Hex = id(0);
        for (let i = 0; i < DEPTH; i++) {
            zeros.push(z);
            z = keccak256(concat([z, z]));
        }
        const rootFromA = fold(0n, a, [b, ...zeros.slice(1)]);
        const rootFromB = fold(1n, b, [a, ...zeros.slice(1)]);
        expect(rootFromA).toBe(rootFromB);
    });

    it('flipping a slot bit changes the folded root (proof is position-bound)', () => {
        const leaf = id(0xaa);
        const sibs = proof(1);
        expect(fold(0n, leaf, sibs)).not.toBe(fold(1n, leaf, sibs));
    });
});
