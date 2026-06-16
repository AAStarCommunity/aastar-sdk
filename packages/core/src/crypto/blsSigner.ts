import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { type Hex, toBytes, keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';

/**
 * BLS Signer for Registry reputation updates and DVT operations
 * 
 * Uses BLS12-381 curve for signature aggregation
 */
export class BLSSigner {
    private privateKey: Uint8Array;
    
    constructor(privateKeyHex: Hex) {
        this.privateKey = toBytes(privateKeyHex);
    }
    
    /**
     * Sign a message with BLS private key
     * @param message Message hash to sign
     * @returns BLS signature as hex string
     */
    sign(message: Hex): Hex {
        const messageBytes = toBytes(message);
        const signature = bls.sign(messageBytes, this.privateKey);
        return `0x${Buffer.from(signature).toString('hex')}` as Hex;
    }
    
    /**
     * Get BLS public key
     * @returns Public key as hex string
     */
    getPublicKey(): Hex {
        const pubKey = bls.getPublicKey(this.privateKey);
        return `0x${Buffer.from(pubKey).toString('hex')}` as Hex;
    }
    
    /**
     * Aggregate multiple BLS signatures
     * @param signatures Array of BLS signatures
     * @returns Aggregated signature
     */
    static aggregateSignatures(signatures: Hex[]): Hex {
        const sigBytes = signatures.map(sig => toBytes(sig));
        const aggregated = bls.aggregateSignatures(sigBytes);
        return `0x${Buffer.from(aggregated).toString('hex')}` as Hex;
    }
    
    /**
     * Aggregate multiple BLS public keys
     * @param pubKeys Array of BLS public keys
     * @returns Aggregated public key (uncompressed G1 - 96 bytes for EVM)
     */
    static aggregatePublicKeys(pubKeys: Hex[]): Hex {
        const pubKeyBytes = pubKeys.map(pk => toBytes(pk));
        const aggregated = bls.aggregatePublicKeys(pubKeyBytes);
        return `0x${Buffer.from(aggregated).toString('hex')}` as Hex;
    }
    
    /**
     * Verify a BLS signature
     * @param message Message hash
     * @param signature BLS signature
     * @param publicKey BLS public key
     * @returns True if signature is valid
     */
    static verify(message: Hex, signature: Hex, publicKey: Hex): boolean {
        const messageBytes = toBytes(message);
        const sigBytes = toBytes(signature);
        const pubKeyBytes = toBytes(publicKey);
        return bls.verify(sigBytes, messageBytes, pubKeyBytes);
    }
}

/**
 * Helper functions for creating BLS proofs for Registry and BLSAggregator operations
 */
export const BLSHelpers = {
    /**
     * Create message hash for slash proposal
     */
    createSlashProposalMessage(proposalId: bigint): Hex {
        return keccak256(encodePacked(['uint256'], [proposalId]));
    },
    
    /**
     * Create message hash for reputation update
     */
    createReputationUpdateMessage(users: Hex[], scores: bigint[], epoch: bigint): Hex {
        return keccak256(encodePacked(
            ['address[]', 'uint256[]', 'uint256'],
            [users, scores, epoch]
        ));
    },
    
    /**
     * Encode BLS proof for Registry/Aggregator (v3 format)
     * Proof structure: (bytes pkG1, bytes sigG2, bytes msgG2, uint256 signerMask)
     */
    encodeBLSProof(
        aggregatedPublicKey: Hex, // G1 (48 bytes compressed or 96 bytes uncompressed)
        aggregatedSignature: Hex, // G2 (96 bytes compressed or 192 bytes uncompressed)
        messageMappingG2: Hex,    // G2 (Mapping of hash to G2 point)
        signerMask: bigint
    ): Hex {
        return encodeAbiParameters(
            parseAbiParameters('bytes, bytes, bytes, uint256'),
            [aggregatedPublicKey, aggregatedSignature, messageMappingG2, signerMask]
        );
    },

    /**
     * @deprecated SUPERSEDED by the explicit-`nodeIds` DVT wire (airaccount-contract
     * #110, LIVE-verified). The DEPLOYED `AAStarBLSAlgorithm` verifier takes an explicit
     * list of `bytes32` `nodeId`s, NOT a `signerMask` bitmask — `signerMask` was an early
     * design that the landed contract did not adopt. Use
     * {@link import('./dvtWire').encodeDVTAccountSignature} /
     * {@link import('./dvtWire').encodeDVTVerifierProof} instead. Retained for backward
     * compatibility with the legacy aggregator path only.
     *
     * Build a DVT co-sign `signerMask` from registration slots (frozen DVT program
     * spec, hub YetAnotherAA-Validator#42).
     *
     * The on-chain BLSAggregator addresses signers by REGISTRATION SLOT, not by
     * key-array index: bit `i` (LSB = 0) corresponds to slot `i + 1` (1-indexed) →
     * `validatorAtSlot[i + 1]`. So a validator registered at slot `s` sets bit `s - 1`.
     * Using a 0-indexed array position instead makes the contract rebuild the WRONG
     * aggregate public key → verification always fails.
     *
     * @param slots Registration slots (1-indexed, `>= 1`) of the contributing signers.
     * @returns The uint256 signerMask.
     */
    slotsToSignerMask(slots: number[]): bigint {
        let mask = 0n;
        for (const slot of slots) {
            // On-chain slot is a uint8 in [1, 255] (bit 0..254, all within uint256).
            // Rejecting > 255 here surfaces a clear error instead of a plausible-but-
            // impossible mask (slot 256) or an opaque ABI-encode overflow (slot 257).
            if (!Number.isInteger(slot) || slot < 1 || slot > 255) {
                throw new Error(
                    `invalid registration slot ${slot}: slots are 1-indexed uint8 (must be in [1, 255])`
                );
            }
            mask |= 1n << BigInt(slot - 1);
        }
        return mask;
    },

    /**
     * @deprecated SUPERSEDED by the explicit-`nodeIds` DVT wire (airaccount-contract
     * #110, LIVE-verified). The DEPLOYED verifier decodes an explicit `nodeIds` list +
     * 256-byte `blsSig`, NOT this `(signerMask, sigG2)` ABI tuple. Use
     * {@link import('./dvtWire').encodeDVTVerifierProof} (verifier-level) or
     * {@link import('./dvtWire').encodeDVTAccountSignature} (account-level) instead.
     * Retained for backward compatibility only.
     *
     * Encode a DVT co-sign proof (early `signerMask` design, hub #42, decision B).
     *
     * Under decision B the on-chain verifier recomputes `msgG2 = hashToG2(userOpHash)`
     * itself and rebuilds the aggregate public key from `signerMask` → registered
     * keys, so the proof carries ONLY `(signerMask, sigG2)`. pkG1 and msgG2 are NOT
     * included — this is intentionally narrower than the v3 {@link encodeBLSProof}
     * still used by the slash/reputation path.
     *
     * @param signerMask Bitmask of contributing slots (see {@link slotsToSignerMask}).
     * @param aggregatedSignature The BLS12-381 aggregated G2 signature (`sigG2`).
     */
    encodeDVTProof(signerMask: bigint, aggregatedSignature: Hex): Hex {
        return encodeAbiParameters(
            parseAbiParameters('uint256 signerMask, bytes sigG2'),
            [signerMask, aggregatedSignature]
        );
    },

    /**
     * Encode Reputation Proof (for test compatibility)
     * Matches format: (signature, publicKey, signerMask)
     */
    encodeReputationProof(
        signature: Hex,
        publicKey: Hex,
        signerMask: bigint
    ): Hex {
        return encodeAbiParameters(
            parseAbiParameters('bytes signature, bytes publicKey, uint256 signerMask'),
            [signature, publicKey, signerMask]
        );
    }
};
