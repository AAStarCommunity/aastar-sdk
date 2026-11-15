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

    async signProposal(proposalId: bigint, signature: Hex = '0x', options?: TransactionOptions): Promise<Hash> {
        try {
            const dvt = dvtActions(this.dvtValidatorAddress)(this.client);
            return await dvt.signSlashProposal({
                proposalId,
                signature,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute a proposal with collected signatures
     */
    async executeWithProof(_proposalId: bigint, _signatures: Hex[], _options?: TransactionOptions): Promise<Hash> {
        // #169 lesson: never silently submit fake values. This previously sent proof='0x', repUsers=[],
        // newScores=[], epoch=0n to a slashing call — garbage that ignored `signatures`. The real
        // BLS-proof aggregation (signatures -> proof + repUsers/newScores/epoch) is not wired, so throw
        // instead of submitting a broken slash.
        throw new Error(
            'ProtocolClient.executeWithProof is not implemented: BLS proof aggregation from signatures ' +
            'is missing. Build the real proof + repUsers/newScores/epoch and call ' +
            'dvtActions().executeSlashWithProof directly.',
        );
    }

    // ========================================
    // 2. 验证器管理 / BLS
    // ========================================

    /**
     * @deprecated Unusable; throws without sending. A single hex key never matched the aggregator's
     * `registerBLSPublicKey(address, BLS.G1Point, uint8, BLS.G2Point)`, and from BLSAggregator-4.14.0 (SP rc.8)
     * the aggregator accepts that call only from its current DVTValidator.
     * Use `dvtActions(dvtValidator).registerBLSPublicKey({ validator, key, slot, pop })` from `@aastar/core`.
     */
    async registerBLSKey(_publicKey: Hex, _options?: TransactionOptions): Promise<Hash> {
        throw new Error(
            'registerBLSKey cannot work: register through DVTValidator with ' +
            'dvtActions(dvtValidator).registerBLSPublicKey({ validator, key, slot, pop }) from @aastar/core'
        );
    }

    // ========================================
    // 3. 全局参数管理 (Admin)
    // ========================================

    async setProtocolFee(bps: bigint, options?: TransactionOptions): Promise<Hash> {
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
