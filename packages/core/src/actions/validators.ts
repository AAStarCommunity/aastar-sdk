import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { DVTValidatorABI, BLSAggregatorABI } from '../abis/index.js';

// DVT Validator Actions
export type DVTActions = {
    createProposal: (args: { target: Address, calldata: Hex, description: string, account?: Account | Address }) => Promise<Hash>;
    signProposal: (args: { proposalId: bigint, account?: Account | Address }) => Promise<Hash>;
    executeWithProof: (args: { proposalId: bigint, signatures: Hex[], account?: Account | Address }) => Promise<Hash>;
    isValidator: (args: { validator: Address }) => Promise<boolean>;
    addValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    removeValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    getProposal: (args: { proposalId: bigint }) => Promise<any>;
    threshold: () => Promise<bigint>;
    setThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
};

// BLS Aggregator Actions
export type BLSAggregatorActions = {
    registerBLSPublicKey: (args: { publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    aggregateSignatures: (args: { signatures: Hex[] }) => Promise<Hex>;
    verifyAggregatedSignature: (args: { message: Hex, aggregatedSignature: Hex, publicKeys: Hex[] }) => Promise<boolean>;
    threshold: () => Promise<bigint>;
    setThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
};

export const dvtActions = (address: Address) => (client: PublicClient | WalletClient): DVTActions => ({
    async createProposal({ target, calldata, description, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'createProposal',
            args: [target, calldata, description],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async signProposal({ proposalId, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'signProposal',
            args: [proposalId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeWithProof({ proposalId, signatures, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'executeWithProof',
            args: [proposalId, signatures],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isValidator({ validator }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'isValidator',
            args: [validator]
        }) as Promise<boolean>;
    },

    async addValidator({ validator, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'addValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeValidator({ validator, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'removeValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getProposal({ proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getProposal',
            args: [proposalId]
        });
    },

    async threshold() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    },

    async setThreshold({ newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'setThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    }
});

export const blsActions = (address: Address) => (client: PublicClient | WalletClient): BLSAggregatorActions => ({
    async registerBLSPublicKey({ publicKey, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'registerBLSPublicKey',
            args: [publicKey],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async aggregateSignatures({ signatures }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'aggregateSignatures',
            args: [signatures]
        }) as Promise<Hex>;
    },

    async verifyAggregatedSignature({ message, aggregatedSignature, publicKeys }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'verifyAggregatedSignature',
            args: [message, aggregatedSignature, publicKeys]
        }) as Promise<boolean>;
    },

    async threshold() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    },

    async setThreshold({ newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
