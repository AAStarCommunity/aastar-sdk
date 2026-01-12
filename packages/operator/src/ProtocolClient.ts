import { type Address, type Hash, type Hex } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { dvtActions, aggregatorActions, superPaymasterActions } from '@aastar/core';

export interface ProtocolClientConfig extends ClientConfig {
    dvtValidatorAddress: Address; // The DVT Validator contract (Governance)
    blsAggregatorAddress?: Address; // Optional BLS Aggregator
    superPaymasterAddress?: Address; // For Global Params
}

export enum ProposalState {
    Pending = 0,
    Active = 1,
    Canceled = 2,
    Defeated = 3,
    Succeeded = 4,
    Queued = 5,
    Expired = 6,
    Executed = 7
}

/**
 * Client for Protocol Governors and Validators (Infrastructure)
 */
export class ProtocolClient extends BaseClient {
    public dvtValidatorAddress: Address;
    public blsAggregatorAddress?: Address;
    public superPaymasterAddress?: Address;

    constructor(config: ProtocolClientConfig) {
        super(config);
        this.dvtValidatorAddress = config.dvtValidatorAddress;
        this.blsAggregatorAddress = config.blsAggregatorAddress;
        this.superPaymasterAddress = config.superPaymasterAddress;
    }

    // ========================================
    // 1. 提案管理 (DVT)
    // ========================================

    /**
     * Create a new proposal
     */
    async createProposal(target: Address, calldata: Hex, description: string, options?: TransactionOptions): Promise<Hash> {
        const dvt = dvtActions()(this.client);
        
        // Mapping general "createProposal" to "createSlashProposal" for now
        // Assuming Governance uses Validator logic or this Client is for Slash.
        // If it's general governance, we might need a different Action.
        // Using createSlashProposal as the available action.
        return dvt.createSlashProposal({
            address: this.dvtValidatorAddress,
            operator: target,
            level: 1, // Default level
            reason: description,
            account: options?.account
        });
    }

    /**
     * Sign (Vote) on a proposal
     */
    async signProposal(proposalId: bigint, signature: Hex = '0x', options?: TransactionOptions): Promise<Hash> {
        const dvt = dvtActions()(this.client);
        
        return dvt.signSlashProposal({
            address: this.dvtValidatorAddress,
            proposalId,
            signature, 
            account: options?.account
        });
    }

    /**
     * Execute a proposal with collected signatures
     */
    async executeWithProof(proposalId: bigint, signatures: Hex[], options?: TransactionOptions): Promise<Hash> {
        // Mock proof generation
        const proof = '0x'; 
        const dvt = dvtActions()(this.client);
        
        return dvt.executeSlashWithProof({
            address: this.dvtValidatorAddress,
            proposalId,
            repUsers: [], // Needs real data
            newScores: [],
            epoch: 0n,
            proof,
            account: options?.account
        });
    }

    // ========================================
    // 2. 验证器管理 / BLS
    // ========================================

    async registerBLSKey(publicKey: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.blsAggregatorAddress) throw new Error('BLS Aggregator address required');
        const agg = aggregatorActions()(this.client);
        
        return agg.registerBLSPublicKey({
            address: this.blsAggregatorAddress,
            publicKey,
            account: options?.account
        });
    }

    // ========================================
    // 3. 全局参数管理 (Admin)
    // ========================================

    async setProtocolFee(recipient: Address, bps: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.superPaymasterAddress) throw new Error('SuperPaymaster address required');
        const sp = superPaymasterActions(this.superPaymasterAddress);
        
        return sp(this.client).setProtocolFee({
            feeRecipient: recipient,
            feeBps: bps,
            account: options?.account
        });
    }

    async setTreasury(treasury: Address, options?: TransactionOptions): Promise<Hash> {
        if (!this.superPaymasterAddress) throw new Error('SuperPaymaster address required');
        const sp = superPaymasterActions(this.superPaymasterAddress);
        
        return sp(this.client).setTreasury({
            treasury,
            account: options?.account
        });
    }
}
