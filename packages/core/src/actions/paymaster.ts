import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';

export type PaymasterActions = {
    depositAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdrawAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    requestSponsorship: (args: { userOp: any, operator: Address, account?: Account | Address }) => Promise<Hash>;
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

    async requestSponsorship({ userOp, operator, account }) {
        // This is likely off-chain or a signature request, but if it's on-chain (e.g. self-sponsorship or something):
        // Actually requestSponsorship usually involves signing.
        // For regression script, if we need it, we implement it.
        // Assuming it's a write for now or just a placeholder if not used in regression.
        // But to satisfy types:
        throw new Error("requestSponsorship Not Implemented fully for regression");
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
