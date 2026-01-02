import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI } from '../abis/index.js';

// MySBT (ERC721 + custom SBT functions) - 50 functions
export type SBTActions = {
    // SBT specific
    safeMintForRole: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    airdropMint: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    getUserSBT: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    getSBTData: (args: { tokenId: bigint }) => Promise<any>;
    getCommunityMembership: (args: { user: Address, community: Address }) => Promise<bigint>;
    
    // ERC721 Standard
    balanceOf: (args: { owner: Address }) => Promise<bigint>;
    ownerOf: (args: { tokenId: bigint }) => Promise<Address>;
    safeTransferFrom: (args: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    transferFrom: (args: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    approve: (args: { to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    setApprovalForAll: (args: { operator: Address, approved: boolean, account?: Account | Address }) => Promise<Hash>;
    getApproved: (args: { tokenId: bigint }) => Promise<Address>;
    isApprovedForAll: (args: { owner: Address, operator: Address }) => Promise<boolean>;
    
    // ERC721 Metadata
    name: () => Promise<string>;
    symbol: () => Promise<string>;
    tokenURI: (args: { tokenId: bigint }) => Promise<string>;
    
    // ERC721 Enumerable
    totalSupply: () => Promise<bigint>;
    tokenByIndex: (args: { index: bigint }) => Promise<bigint>;
    tokenOfOwnerByIndex: (args: { owner: Address, index: bigint }) => Promise<bigint>;
    
    // Admin/Minting
    mint: (args: { to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    setBaseURI: (args: { baseURI: string, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    GTOKEN_STAKING: () => Promise<Address>;
    GTOKEN: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
};

export const sbtActions = (address: Address) => (client: PublicClient | WalletClient): SBTActions => ({
    // SBT specific
    async safeMintForRole({ roleId, to, tokenURI, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'safeMintForRole',
            args: [roleId, to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async airdropMint({ roleId, to, tokenURI, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'airdropMint',
            args: [roleId, to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getUserSBT({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getUserSBT',
            args: [user, roleId]
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

    async getCommunityMembership({ user, community }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getCommunityMembership',
            args: [user, community]
        }) as Promise<bigint>;
    },

    // ERC721 Standard
    async balanceOf({ owner }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'balanceOf',
            args: [owner]
        }) as Promise<bigint>;
    },

    async ownerOf({ tokenId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'ownerOf',
            args: [tokenId]
        }) as Promise<Address>;
    },

    async safeTransferFrom({ from, to, tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'safeTransferFrom',
            args: [from, to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferFrom({ from, to, tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'transferFrom',
            args: [from, to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async approve({ to, tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'approve',
            args: [to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setApprovalForAll({ operator, approved, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setApprovalForAll',
            args: [operator, approved],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getApproved({ tokenId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getApproved',
            args: [tokenId]
        }) as Promise<Address>;
    },

    async isApprovedForAll({ owner, operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'isApprovedForAll',
            args: [owner, operator]
        }) as Promise<boolean>;
    },

    // ERC721 Metadata
    async name() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'name',
            args: []
        }) as Promise<string>;
    },

    async symbol() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'symbol',
            args: []
        }) as Promise<string>;
    },

    async tokenURI({ tokenId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenURI',
            args: [tokenId]
        }) as Promise<string>;
    },

    // ERC721 Enumerable
    async totalSupply() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'totalSupply',
            args: []
        }) as Promise<bigint>;
    },

    async tokenByIndex({ index }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenByIndex',
            args: [index]
        }) as Promise<bigint>;
    },

    async tokenOfOwnerByIndex({ owner, index }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [owner, index]
        }) as Promise<bigint>;
    },

    // Admin/Minting
    async mint({ to, tokenURI, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'mint',
            args: [to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async burn({ tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'burn',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBaseURI({ baseURI, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setBaseURI',
            args: [baseURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Constants
    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async GTOKEN_STAKING() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async GTOKEN() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'GTOKEN',
            args: []
        }) as Promise<Address>;
    },

    async SUPER_PAYMASTER() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
