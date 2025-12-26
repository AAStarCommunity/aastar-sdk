import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterABI } from '../abis/index.js';

/**
 * Paymaster V4 Actions
 * 
 * Paymaster V4 uses Token Paymaster model:
 * - Users must hold supported SBT or Gas Tokens
 * - Direct token deduction for gas payment
 * - No signature verification required
 */

export type PaymasterV4Actions = {
    // Admin Configuration Methods
    addGasToken: (args: { address: Address; token: Address; account?: Account | Address }) => Promise<Hash>;
    removeGasToken: (args: { address: Address; token: Address; account?: Account | Address }) => Promise<Hash>;
    addSBT: (args: { address: Address; sbt: Address; account?: Account | Address }) => Promise<Hash>;
    addSBTWithActivity: (args: { address: Address; sbt: Address; account?: Account | Address }) => Promise<Hash>;
    removeSBT: (args: { address: Address; sbt: Address; account?: Account | Address }) => Promise<Hash>;
    addActivitySBT: (args: { address: Address; sbt: Address; account?: Account | Address }) => Promise<Hash>;
    removeActivitySBT: (args: { address: Address; sbt: Address; account?: Account | Address }) => Promise<Hash>;
    withdrawPNT: (args: { address: Address; to: Address; token: Address; amount: bigint; account?: Account | Address }) => Promise<Hash>;
    setMaxGasCostCap: (args: { address: Address; cap: bigint; account?: Account | Address }) => Promise<Hash>;
    setServiceFeeRate: (args: { address: Address; rate: bigint; account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { address: Address; treasury: Address; account?: Account | Address }) => Promise<Hash>;
    pause: (args: { address: Address; account?: Account | Address }) => Promise<Hash>;
    unpause: (args: { address: Address; account?: Account | Address }) => Promise<Hash>;
    
    // Query Methods
    getSupportedGasTokens: (args: { address: Address }) => Promise<Address[]>;
    getSupportedSBTs: (args: { address: Address }) => Promise<Address[]>;
    isGasTokenSupported: (args: { address: Address; token: Address }) => Promise<boolean>;
    isSBTSupported: (args: { address: Address; sbt: Address }) => Promise<boolean>;
    getMaxGasCostCap: (args: { address: Address }) => Promise<bigint>;
    getServiceFeeRate: (args: { address: Address }) => Promise<bigint>;
    getTreasury: (args: { address: Address }) => Promise<Address>;
    isPaused: (args: { address: Address }) => Promise<boolean>;
};

/**
 * Create Paymaster V4 Actions
 * 
 * Note: Unlike SuperPaymaster, V4 does not require a fixed address.
 * Each deployment can have its own address, so we pass it per-call.
 */
export const paymasterV4Actions = () => (client: PublicClient | WalletClient): PaymasterV4Actions => ({
    // Admin Configuration Methods
    async addGasToken({ address, token, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeGasToken({ address, token, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addSBT({ address, sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addSBTWithActivity({ address, sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addSBTWithActivity',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeSBT({ address, sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addActivitySBT({ address, sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addActivitySBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeActivitySBT({ address, sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeActivitySBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawPNT({ address, to, token, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'withdrawPNT',
            args: [to, token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setMaxGasCostCap({ address, cap, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setMaxGasCostCap',
            args: [cap],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setServiceFeeRate({ address, rate, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setServiceFeeRate',
            args: [rate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setTreasury({ address, treasury, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setTreasury',
            args: [treasury],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async pause({ address, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'pause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unpause({ address, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'unpause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Query Methods
    async getSupportedGasTokens({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getSupportedGasTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async getSupportedSBTs({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getSupportedSBTs',
            args: []
        }) as Promise<Address[]>;
    },

    async isGasTokenSupported({ address, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isGasTokenSupported',
            args: [token]
        }) as Promise<boolean>;
    },

    async isSBTSupported({ address, sbt }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isSBTSupported',
            args: [sbt]
        }) as Promise<boolean>;
    },

    async getMaxGasCostCap({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'maxGasCostCap',
            args: []
        }) as Promise<bigint>;
    },

    async getServiceFeeRate({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'serviceFeeRate',
            args: []
        }) as Promise<bigint>;
    },

    async getTreasury({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'treasury',
            args: []
        }) as Promise<Address>;
    },

    async isPaused({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'paused',
            args: []
        }) as Promise<boolean>;
    }
});
