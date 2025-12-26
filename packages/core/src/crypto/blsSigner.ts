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
