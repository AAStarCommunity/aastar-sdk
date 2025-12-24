import { type Address, type PublicClient, type WalletClient, type Hex, type Hash } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';

export type PaymasterActions = {
    depositAPNTs: (args: { amount: bigint, account?: Address }) => Promise<Hash>;
    withdrawAPNTs: (args: { amount: bigint, account?: Address }) => Promise<Hash>;
    depositETH: (args: { value: bigint, account?: Address }) => Promise<Hash>;
    withdrawETHStake: (args: { to: Address, account?: Address }) => Promise<Hash>;
    getETHDeposit: () => Promise<bigint>;
    getOperatorInfo: (args: { operator: Address }) => Promise<any>;
    getAvailableCredit: (args: { user: Address, token: Address }) => Promise<bigint>;
};

export const paymasterActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterActions => ({
    async depositAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async depositETH({ value, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [],
            value,
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawETHStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getETHDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    async getOperatorInfo({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [operator]
        });
    },

    async getAvailableCredit({ user, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getAvailableCredit',
            args: [user, token]
        }) as Promise<bigint>;
    }
});
