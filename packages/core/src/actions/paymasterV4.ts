import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterV4ABI } from '../abis/index.js';

// PaymasterV4 Actions (comprehensive stub for 100% coverage)
export type PaymasterV4Actions = {
    // Gas Token Management
    addGasToken: (args: { token: Address, priceFeed: Address, account?: Account | Address }) => Promise<Hash>;
    removeGasToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    getSupportedGasTokens: () => Promise<Address[]>;
    isGasTokenSupported: (args: { token: Address }) => Promise<boolean>;
    
    // SBT Management
    addSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    removeSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    getSupportedSBTs: () => Promise<Address[]>;
    isSBTSupported: (args: { sbt: Address }) => Promise<boolean>;
    
    // Validation (EntryPoint calls)
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<any>;
    postOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) => Promise<void>;
    
    // Deposit & Withdrawal
    deposit: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    addStake: (args: { unstakeDelaySec: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockPaymasterStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    getDeposit: () => Promise<bigint>;
    
    // EntryPoint
    entryPoint: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    version: () => Promise<string>;
};

export const paymasterV4Actions = (address: Address) => (client: PublicClient | WalletClient): PaymasterV4Actions => ({
    // Gas Token Management
    async addGasToken({ token, priceFeed, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addGasToken',
            args: [token, priceFeed],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeGasToken({ token, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedGasTokens() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedGasTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async isGasTokenSupported({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isGasTokenSupported',
            args: [token]
        }) as Promise<boolean>;
    },

    // SBT Management
    async addSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedSBTs() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedSBTs',
            args: []
        }) as Promise<Address[]>;
    },

    async isSBTSupported({ sbt }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isSBTSupported',
            args: [sbt]
        }) as Promise<boolean>;
    },

    // Validation
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'validatePaymasterUserOp',
            args: [userOp, userOpHash, maxCost]
        });
    },

    async postOp({ mode, context, actualGasCost, actualUserOpFeePerGas }) {
        throw new Error('postOp is called by EntryPoint, not directly invoked');
    },

    // Deposit & Withdrawal
    async deposit({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'deposit',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawTo({ to, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addStake({ unstakeDelaySec, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addStake',
            args: [unstakeDelaySec],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockPaymasterStake({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    // EntryPoint
    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
