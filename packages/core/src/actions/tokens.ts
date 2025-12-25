import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { xPNTsTokenABI } from '../abis/index.js';

export type TokenActions = {
    repayDebt: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    getDebt: (args: { token: Address, user: Address }) => Promise<bigint>;
    mintXPNTs: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferAndCall: (args: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    updateExchangeRate: (args: { token: Address, newRate: bigint, account?: Account | Address }) => Promise<Hash>;
};

export const tokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    async repayDebt({ token, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'repayDebt',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDebt({ token, user }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'getDebt',
            args: [user]
        }) as Promise<bigint>;
    },

    async mintXPNTs({ token, to, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'mint',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferAndCall({ token, to, amount, data = '0x', account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'transferAndCall',
            args: [to, amount, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async updateExchangeRate({ token, newRate, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'updateExchangeRate',
            args: [newRate],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
