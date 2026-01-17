import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type AggregatorActions = {
    // BLS Public Key Management
    registerBLSPublicKey: (args: { user: Address, publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    blsPublicKeys: (args: { validator: Address }) => Promise<{ publicKey: Hex, registered: boolean }>;
    
    // Threshold Management
    setBLSThreshold: (args: { threshold: number, account?: Account | Address }) => Promise<Hash>;
    getBLSThreshold: () => Promise<bigint>;
    setDefaultThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setMinThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    defaultThreshold: () => Promise<bigint>;
    minThreshold: () => Promise<bigint>;
    
    // Proposal & Execution
    executeProposal: (args: { proposalId: bigint, target: Address, callData: Hex, requiredThreshold: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    verifyAndExecute: (args: { proposalId: bigint, operator: Address, slashLevel: number, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    executedProposals: (args: { proposalId: bigint }) => Promise<boolean>;
    proposalNonces: (args: { proposalId: bigint }) => Promise<bigint>;
    
    // Aggregated Signatures
    aggregatedSignatures: (args: { index: bigint }) => Promise<{ signature: Hex, messageHash: Hex, timestamp: bigint, verified: boolean }>;
    
    // Registry & SuperPaymaster
    setDVTValidator: (args: { dv: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    DVT_VALIDATOR: () => Promise<Address>;
    SUPERPAYMASTER: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    
    // Constants
    MAX_VALIDATORS: () => Promise<bigint>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const aggregatorActions = (address: Address) => (client: PublicClient | WalletClient): AggregatorActions => ({
    // BLS Public Key Management
    async registerBLSPublicKey({ user, publicKey, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(publicKey, 'publicKey');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'registerBLSPublicKey',
                args: [publicKey],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerBLSPublicKey');
        }
    },

    async blsPublicKeys({ validator }) {
        try {
            validateAddress(validator, 'validator');
            const result = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'blsPublicKeys',
                args: [validator]
            }) as any;
            return { publicKey: result[0], registered: result[1] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blsPublicKeys');
        }
    },

    // Threshold Management
    async setBLSThreshold({ threshold, account }) {
        try {
            validateRequired(threshold, 'threshold');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setThreshold',
                args: [BigInt(threshold)],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSThreshold');
        }
    },

    async getBLSThreshold() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'threshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getBLSThreshold');
        }
    },

    async setDefaultThreshold({ newThreshold, account }) {
        try {
            validateRequired(newThreshold, 'newThreshold');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setDefaultThreshold',
                args: [newThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setDefaultThreshold');
        }
    },

    async setMinThreshold({ newThreshold, account }) {
        try {
            validateRequired(newThreshold, 'newThreshold');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setMinThreshold',
                args: [newThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMinThreshold');
        }
    },

    async defaultThreshold( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'defaultThreshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'defaultThreshold');
        }
    },

    async minThreshold( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'minThreshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'minThreshold');
        }
    },

    // Proposal & Execution
    async executeProposal({  proposalId, target, callData, requiredThreshold, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateAddress(target, 'target');
            validateRequired(callData, 'callData');
            validateRequired(requiredThreshold, 'requiredThreshold');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'executeProposal',
                args: [proposalId, target, callData, requiredThreshold, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeProposal');
        }
    },

    async verifyAndExecute({  proposalId, operator, slashLevel, repUsers, newScores, epoch, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateAddress(operator, 'operator');
            validateRequired(slashLevel, 'slashLevel');
            validateRequired(repUsers, 'repUsers');
            validateRequired(newScores, 'newScores');
            validateRequired(epoch, 'epoch');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'verifyAndExecute',
                args: [proposalId, operator, slashLevel, repUsers, newScores, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'verifyAndExecute');
        }
    },

    async executedProposals({  proposalId }) {
        try {
            validateRequired(proposalId, 'proposalId');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'executedProposals',
                args: [proposalId]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executedProposals');
        }
    },

    async proposalNonces({  proposalId }) {
        try {
            validateRequired(proposalId, 'proposalId');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'proposalNonces',
                args: [proposalId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposalNonces');
        }
    },

    // Aggregated Signatures
    async aggregatedSignatures({  index }) {
        try {
            validateRequired(index, 'index');
            const result = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'aggregatedSignatures',
                args: [index]
            }) as any;
            return {
                signature: result[0],
                messageHash: result[1],
                timestamp: result[2],
                verified: result[3]
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'aggregatedSignatures');
        }
    },

    // Registry & SuperPaymaster
    async setDVTValidator({  dv, account }) {
        try {
            validateAddress(dv, 'dv');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setDVTValidator',
                args: [dv],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setDVTValidator');
        }
    },

    async setSuperPaymaster({  paymaster, account }) {
        try {
            validateAddress(paymaster, 'paymaster');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setSuperPaymaster',
                args: [paymaster],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymaster');
        }
    },

    async DVT_VALIDATOR( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'DVT_VALIDATOR',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'DVT_VALIDATOR');
        }
    },

    async SUPERPAYMASTER( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'SUPERPAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPERPAYMASTER');
        }
    },

    async REGISTRY( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    // Constants
    async MAX_VALIDATORS( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'MAX_VALIDATORS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_VALIDATORS');
        }
    },

    // Ownership
    async owner( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({  newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({  account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // Version
    async version( ) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
