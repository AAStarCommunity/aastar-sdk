import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { type Hex, toBytes, keccak256, encodePacked } from 'viem';

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
     * @returns Aggregated public key
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
 * Helper functions for creating BLS proofs for Registry operations
 */
export const BLSHelpers = {
    /**
     * Create message hash for slash proposal
     * @param proposalId Slash proposal ID
     * @returns Message hash to sign
     */
    createSlashProposalMessage(proposalId: bigint): Hex {
        return keccak256(encodePacked(['uint256'], [proposalId]));
    },
    
    /**
     * Create message hash for reputation update
     * @param users Array of user addresses
     * @param scores Array of reputation scores
     * @param epoch Epoch number
     * @returns Message hash to sign
     */
    createReputationUpdateMessage(users: Hex[], scores: bigint[], epoch: bigint): Hex {
        return keccak256(encodePacked(
            ['address[]', 'uint256[]', 'uint256'],
            [users, scores, epoch]
        ));
    },
    
    /**
     * Encode BLS proof for Registry.batchUpdateGlobalReputation
     * @param aggregatedSignature Aggregated BLS signature
     * @param aggregatedPublicKey Aggregated BLS public key
     * @param bitmap Validator participation bitmap
     * @returns Encoded proof bytes
     */
    encodeReputationProof(
        aggregatedSignature: Hex,
        aggregatedPublicKey: Hex,
        bitmap: bigint
    ): Hex {
        return encodePacked(
            ['bytes', 'bytes', 'uint256'],
            [aggregatedSignature, aggregatedPublicKey, bitmap]
        ) as Hex;
    }
};
