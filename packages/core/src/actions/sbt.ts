import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI } from '../abis/index.js';

export type SBTActions = {
    getUserSBTId: (args: { user: Address }) => Promise<bigint>;
    getSBTData: (args: { tokenId: bigint }) => Promise<any>;
    getCommunityMembership: (args: { tokenId: bigint, community: Address }) => Promise<any>;
    mintForRole: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    airdropMint: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
};

export const sbtActions = (address: Address) => (client: PublicClient | WalletClient): SBTActions => ({
    async getUserSBTId({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getUserSBT',
            args: [user]
        }) as Promise<bigint>;
    },

    async getSBTData({ tokenId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getSBTData',
            args: [tokenId]
        });
    },

    async getCommunityMembership({ tokenId, community }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getCommunityMembership',
            args: [tokenId, community]
        });
    },

    async mintForRole({ user, roleId, roleData, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'mintForRole',
            args: [user, roleId, roleData],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async airdropMint({ user, roleId, roleData, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'airdropMint',
            args: [user, roleId, roleData],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
