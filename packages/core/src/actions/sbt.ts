import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI, RegistryABI } from '../abis/index.js';

export type SBTActions = {
    getUserSBTId: (args: { user: Address }) => Promise<bigint>;
    getSBTData: (args: { tokenId: bigint }) => Promise<any>;
    getCommunityMembership: (args: { tokenId: bigint, community: Address }) => Promise<any>;
    mintForRole: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    airdropMint: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    mintSBT: (args: { user: Address, community: Address, account?: Account | Address }) => Promise<Hash>;
    setBaseURI: (args: { uri: string, account?: Account | Address }) => Promise<Hash>;
    getSBTURI: (args: { tokenId: bigint }) => Promise<string>;
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
    },

    async mintSBT({ user, community, account }: { user: Address, community: Address, account?: Account | Address }) {
        const ROLE_ENDUSER = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const roleData = `0x000000000000000000000000${community.slice(2)}` as Hex;
        return (client as any).writeContract({
            address: (client as any).registryAddress || address, // Fallback logic
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [ROLE_ENDUSER as Hex, user, roleData],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBaseURI({ uri, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setBaseURI',
            args: [uri],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSBTURI({ tokenId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenURI',
            args: [tokenId]
        }) as Promise<string>;
    }
});
