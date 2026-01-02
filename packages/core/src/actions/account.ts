import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { EntryPointABI, SimpleAccountABI, SimpleAccountFactoryABI } from '../abis/index.js';

// EntryPoint Actions (core ERC-4337)
export type EntryPointActions = {
    handleOps: (args: { ops: any[], beneficiary: Address, account?: Account | Address }) => Promise<Hash>;
    handleAggregatedOps: (args: { opsPerAggregator: any[], beneficiary: Address, account?: Account | Address }) => Promise<Hash>;
    getNonce: (args: { sender: Address, key: bigint }) => Promise<bigint>;
    getUserOpHash: (args: { userOp: any }) => Promise<Hex>;
    getDepositInfo: (args: { account: Address }) => Promise<any>;
};

// SimpleAccount Actions (v0.7)
export type AccountActions = {
    execute: (args: { dest: Address, value: bigint, func: Hex, account?: Account | Address }) => Promise<Hash>;
    executeBatch: (args: { dest: Address[], value: bigint[], func: Hex[], account?: Account | Address }) => Promise<Hash>;
    getNonce: () => Promise<bigint>;
    entryPoint: () => Promise<Address>;
    addDeposit: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawDepositTo: (args: { withdrawAddress: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    owner: () => Promise<Address>;
};

// SimpleAccountFactory Actions
export type AccountFactoryActions = {
    createAccount: (args: { owner: Address, salt: bigint, account?: Account | Address }) => Promise<Hash>;
    getAddress: (args: { owner: Address, salt: bigint }) => Promise<Address>;
};

export const entryPointActions = (address: Address) => (client: PublicClient | WalletClient): EntryPointActions => ({
    async handleOps({ ops, beneficiary, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'handleOps',
            args: [ops, beneficiary],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async handleAggregatedOps({ opsPerAggregator, beneficiary, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'handleAggregatedOps',
            args: [opsPerAggregator, beneficiary],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getNonce({ sender, key }) {
        return (client as PublicClient).readContract({
            address,
            abi: EntryPointABI,
            functionName: 'getNonce',
            args: [sender, key]
        }) as Promise<bigint>;
    },

    async getUserOpHash({ userOp }) {
        return (client as PublicClient).readContract({
            address,
            abi: EntryPointABI,
            functionName: 'getUserOpHash',
            args: [userOp]
        }) as Promise<Hex>;
    },

    async getDepositInfo({ account }) {
        return (client as PublicClient).readContract({
            address,
            abi: EntryPointABI,
            functionName: 'getDepositInfo',
            args: [account]
        });
    }
});

export const accountActions = (address: Address) => (client: PublicClient | WalletClient): AccountActions => ({
    async execute({ dest, value, func, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'execute',
            args: [dest, value, func],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeBatch({ dest, value, func, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'executeBatch',
            args: [dest, value, func],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getNonce() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'getNonce',
            args: []
        }) as Promise<bigint>;
    },

    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    async addDeposit({ account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'addDeposit',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawDepositTo({ withdrawAddress, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'withdrawDepositTo',
            args: [withdrawAddress, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    }
});

export const accountFactoryActions = (address: Address) => (client: PublicClient | WalletClient): AccountFactoryActions => ({
    async createAccount({ owner, salt, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountFactoryABI,
            functionName: 'createAccount',
            args: [owner, salt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getAddress({ owner, salt }) {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountFactoryABI,
            functionName: 'getAddress',
            args: [owner, salt]
        }) as Promise<Address>;
    }
});
