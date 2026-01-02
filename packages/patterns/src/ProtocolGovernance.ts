import { type Address, type Hash, type Hex } from 'viem';
import { ProtocolClient, type ProtocolClientConfig } from '@aastar/operator';
import { type TransactionOptions } from '@aastar/core';

export interface ProposalParams {
    target: Address;
    calldata: Hex;
    description: string;
}

/**
 * 🏛️ ProtocolGovernance Pattern
 * 
 * Protocol-level governance and administration.
 * Uses ONLY verified methods from ProtocolClient.
 */
export class ProtocolGovernance {
    private client: ProtocolClient;

    constructor(config: ProtocolClientConfig) {
        this.client = new ProtocolClient(config);
    }

    // ========================================
    // Proposal Management (提案治理)
    // ========================================

    /**
     * Create a governance proposal (currently maps to slash proposal)
     */
    async createProposal(params: ProposalParams, options?: TransactionOptions): Promise<Hash> {
        console.log(`📝 Creating proposal: ${params.description}`);
        return this.client.createProposal(
            params.target,
            params.calldata,
            params.description,
            options
        );
    }

    /**
     * Sign/Vote on a proposal
     */
    async voteOnProposal(proposalId: bigint, signature: Hex, options?: TransactionOptions): Promise<Hash> {
        console.log(`🗳️ Voting on proposal ${proposalId}...`);
        return this.client.signProposal(proposalId, signature, options);
    }

    /**
     * Execute proposal with collected signatures
     */
    async executeProposal(proposalId: bigint, signatures: Hex[], options?: TransactionOptions): Promise<Hash> {
        console.log(`⚡ Executing proposal ${proposalId}...`);
        return this.client.executeWithProof(proposalId, signatures, options);
    }

    // ========================================
    // Validator Management (验证器管理)
    // ========================================

    /**
     * Register BLS public key for validator
     */
    async registerValidator(publicKey: Hex, options?: TransactionOptions): Promise<Hash> {
        console.log(`🔑 Registering BLS validator key...`);
        return this.client.registerBLSKey(publicKey, options);
    }

    // ========================================
    // Global Parameters (全局参数管理)
    // ========================================

    /**
     * Set protocol fee for SuperPaymaster
     */
    async setProtocolFee(recipient: Address, bps: bigint, options?: TransactionOptions): Promise<Hash> {
        console.log(`💰 Setting protocol fee: ${bps} bps to ${recipient}`);
        return this.client.setProtocolFee(recipient, bps, options);
    }

    /**
     * Update protocol treasury address
     */
    async setTreasury(treasury: Address, options?: TransactionOptions): Promise<Hash> {
        console.log(`🏛️ Setting treasury to ${treasury}`);
        return this.client.setTreasury(treasury, options);
    }
}
