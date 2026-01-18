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
        try {
            const dvt = dvtActions(this.dvtValidatorAddress)(this.client);
            
            // Mapping general "createProposal" to "createSlashProposal" for now
            // Assuming Governance uses Validator logic or this Client is for Slash.
            // Using createSlashProposal as the available action.
            return await dvt.createSlashProposal({
                operator: target,
                level: 1, // Default level
                reason: description,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Sign (Vote) on a proposal - NOT IMPLEMENTED
     * Note: signSlashProposal does not exist in DVTActions
     */
    async signProposal(proposalId: bigint, signature: Hex = '0x', options?: TransactionOptions): Promise<Hash> {
        throw new Error('signProposal not implemented - signSlashProposal does not exist in DVTActions');
    }

    /**
     * Execute a proposal with collected signatures
     */
    async executeWithProof(proposalId: bigint, signatures: Hex[], options?: TransactionOptions): Promise<Hash> {
        try {
            // Mock proof generation logic or placeholder
            const proof = '0x' as Hex; 
            const dvt = dvtActions(this.dvtValidatorAddress)(this.client);
            
            return await dvt.executeSlashWithProof({
                proposalId,
                repUsers: [], // Needs real data in production
                newScores: [],
                epoch: 0n,
                proof,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 2. 验证器管理 / BLS
    // ========================================

    async registerBLSKey(publicKey: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.blsAggregatorAddress) {
                throw new Error('BLS Aggregator address required for this client');
            }
            // Aggregator actions now handle the type internally or via mapping
            const agg = aggregatorActions(this.blsAggregatorAddress)(this.client);
            
            return await agg.registerBLSPublicKey({
                validator: this.getAddress(),
                publicKey,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 3. 全局参数管理 (Admin)
    // ========================================

    async setProtocolFee(recipient: Address, bps: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.superPaymasterAddress) {
                throw new Error('SuperPaymaster address required for this client');
            }
            const sp = superPaymasterActions(this.superPaymasterAddress);
            
            return await sp(this.client).setProtocolFee({
                newFeeBPS: bps,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async setTreasury(treasury: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.superPaymasterAddress) {
                 throw new Error('SuperPaymaster address required for this client');
            }
            const sp = superPaymasterActions(this.superPaymasterAddress);
            
            return await sp(this.client).setTreasury({
                treasury,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }
}
