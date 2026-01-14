import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI } from '../abis/index.js';

// MySBT (ERC721 + custom SBT functions) - 50 functions
export type SBTActions = {
    // SBT specific
    sbtSafeMintForRole: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    sbtAirdropMint: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    sbtMintForRole: (args: { roleId: Hex, to: Address, account?: Account | Address }) => Promise<Hash>;
    sbtGetUserSBT: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    sbtGetSBTData: (args: { tokenId: bigint }) => Promise<any>;
    sbtGetCommunityMembership: (args: { user: Address, community: Address }) => Promise<bigint>;
    sbtGetMemberships: (args: { user: Address }) => Promise<any[]>;
    sbtGetActiveMemberships: (args: { user: Address }) => Promise<any[]>;
    sbtVerifyCommunityMembership: (args: { user: Address, community: Address }) => Promise<boolean>;
    sbtUserToSBT: (args: { user: Address }) => Promise<bigint>;
    sbtSbtData: (args: { tokenId: bigint }) => Promise<any>;
    sbtMembershipIndex: (args: { user: Address, index: bigint }) => Promise<any>;
    
    // ERC721 Standard
    sbtBalanceOf: (args: { owner: Address }) => Promise<bigint>;
    sbtOwnerOf: (args: { tokenId: bigint }) => Promise<Address>;
    sbtSafeTransferFrom: (args: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtTransferFrom: (args: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtApprove: (args: { to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtSetApprovalForAll: (args: { operator: Address, approved: boolean, account?: Account | Address }) => Promise<Hash>;
    sbtGetApproved: (args: { tokenId: bigint }) => Promise<Address>;
    sbtIsApprovedForAll: (args: { owner: Address, operator: Address }) => Promise<boolean>;
    
    // ERC721 Metadata
    sbtName: () => Promise<string>;
    sbtSymbol: () => Promise<string>;
    sbtTokenURI: (args: { tokenId: bigint }) => Promise<string>;
    
    // ERC721 Enumerable
    sbtTotalSupply: () => Promise<bigint>;
    sbtTokenByIndex: (args: { index: bigint }) => Promise<bigint>;
    sbtTokenOfOwnerByIndex: (args: { owner: Address, index: bigint }) => Promise<bigint>;
    sbtSupportsInterface: (args: { interfaceId: Hex }) => Promise<boolean>;
    sbtNextTokenId: () => Promise<bigint>;
    
    // Admin/Minting
    sbtMint: (args: { to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    sbtBurn: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtBurnSBT: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtDeactivateAllMemberships: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    sbtSetBaseURI: (args: { baseURI: string, account?: Account | Address }) => Promise<Hash>;
    
    // Membership Management
    sbtLeaveCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;
    sbtDeactivateMembership: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Activity & Reputation
    sbtRecordActivity: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    sbtLastActivityTime: (args: { user: Address }) => Promise<bigint>;
    sbtWeeklyActivity: (args: { user: Address }) => Promise<bigint>;
    sbtReputationCalculator: () => Promise<Address>;
    sbtSetReputationCalculator: (args: { calculator: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Mint Fee & Lock
    sbtMintFee: () => Promise<bigint>;
    sbtSetMintFee: (args: { fee: bigint, account?: Account | Address }) => Promise<Hash>;
    sbtMinLockAmount: () => Promise<bigint>;
    sbtSetMinLockAmount: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Pause
    sbtPause: (args: { account?: Account | Address }) => Promise<Hash>;
    sbtUnpause: (args: { account?: Account | Address }) => Promise<Hash>;
    sbtPaused: () => Promise<boolean>;
    
    // DAO & Config
    sbtDaoMultisig: () => Promise<Address>;
    sbtSetDAOMultisig: (args: { multisig: Address, account?: Account | Address }) => Promise<Hash>;
    sbtSetRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    sbtSetSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    sbtVersion: () => Promise<string>;
    
    // Constants
    sbtREGISTRY: () => Promise<Address>;
    sbtGTOKEN_STAKING: () => Promise<Address>;
    sbtGTOKEN: () => Promise<Address>;
    sbtSUPER_PAYMASTER: () => Promise<Address>;
    
    // Ownership
    sbtOwner: () => Promise<Address>;
    sbtTransferSBTOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    sbtRenounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
};

export const sbtActions = (address: Address) => (client: PublicClient | WalletClient): SBTActions => ({
    // SBT specific
    async sbtSafeMintForRole({ roleId, to, tokenURI, account }: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'safeMintForRole',
            args: [roleId, to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtAirdropMint({ roleId, to, tokenURI, account }: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'airdropMint',
            args: [roleId, to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtGetUserSBT({ user, roleId }: { user: Address, roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getUserSBT',
            args: [user]
        }) as Promise<bigint>;
    },

    async sbtGetSBTData({ tokenId }: { tokenId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getSBTData',
            args: [tokenId]
        });
    },

    async sbtGetCommunityMembership({ user, community }: { user: Address, community: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getCommunityMembership',
            args: [user, community]
        }) as Promise<bigint>;
    },

    // ERC721 Standard
    async sbtBalanceOf({ owner }: { owner: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'balanceOf',
            args: [owner]
        }) as Promise<bigint>;
    },

    async sbtOwnerOf({ tokenId }: { tokenId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'ownerOf',
            args: [tokenId]
        }) as Promise<Address>;
    },

    async sbtSafeTransferFrom({ from, to, tokenId, account }: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'safeTransferFrom',
            args: [from, to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtTransferFrom({ from, to, tokenId, account }: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'transferFrom',
            args: [from, to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtApprove({ to, tokenId, account }: { to: Address, tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'approve',
            args: [to, tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtSetApprovalForAll({ operator, approved, account }: { operator: Address, approved: boolean, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setApprovalForAll',
            args: [operator, approved],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtGetApproved({ tokenId }: { tokenId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getApproved',
            args: [tokenId]
        }) as Promise<Address>;
    },

    async sbtIsApprovedForAll({ owner, operator }: { owner: Address, operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'isApprovedForAll',
            args: [owner, operator]
        }) as Promise<boolean>;
    },

    // ERC721 Metadata
    async sbtName() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'name',
            args: []
        }) as Promise<string>;
    },

    async sbtSymbol() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'symbol',
            args: []
        }) as Promise<string>;
    },

    async sbtTokenURI({ tokenId }: { tokenId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenURI',
            args: [tokenId]
        }) as Promise<string>;
    },

    // ERC721 Enumerable
    async sbtTotalSupply() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'totalSupply',
            args: []
        }) as Promise<bigint>;
    },

    async sbtTokenByIndex({ index }: { index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenByIndex',
            args: [index]
        }) as Promise<bigint>;
    },

    async sbtTokenOfOwnerByIndex({ owner, index }: { owner: Address, index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [owner, index]
        }) as Promise<bigint>;
    },

    // Admin/Minting
    async sbtMint({ to, tokenURI, account }: { to: Address, tokenURI: string, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'mint',
            args: [to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtBurn({ tokenId, account }: { tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'burn',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtDeactivateAllMemberships({ user, account }: { user: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'deactivateAllMemberships',
            args: [user],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtSetBaseURI({ baseURI, account }: { baseURI: string, account?: Account | Address }) {
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
    async sbtREGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async sbtGTOKEN_STAKING() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async sbtGTOKEN() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'GTOKEN',
            args: []
        }) as Promise<Address>;
    },

    async sbtSUPER_PAYMASTER() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async sbtOwner() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async sbtTransferSBTOwnership({ newOwner, account }: { newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtRenounceOwnership({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Additional SBT-specific functions
    async sbtMintForRole({ roleId, to, account }: { roleId: Hex, to: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'mintForRole',
            args: [roleId, to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtGetMemberships({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getMemberships',
            args: [user]
        }) as Promise<any[]>;
    },

    async sbtGetActiveMemberships({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'getActiveMemberships',
            args: [user]
        }) as Promise<any[]>;
    },

    async sbtVerifyCommunityMembership({ user, community }: { user: Address, community: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'verifyCommunityMembership',
            args: [user, community]
        }) as Promise<boolean>;
    },

    async sbtUserToSBT({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'userToSBT',
            args: [user]
        }) as Promise<bigint>;
    },

    async sbtSbtData({ tokenId }: { tokenId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'sbtData',
            args: [tokenId]
        });
    },

    async sbtMembershipIndex({ user, index }: { user: Address, index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'membershipIndex',
            args: [user, index]
        });
    },

    async sbtSupportsInterface({ interfaceId }: { interfaceId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'supportsInterface',
            args: [interfaceId]
        }) as Promise<boolean>;
    },

    async sbtNextTokenId() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'nextTokenId',
            args: []
        }) as Promise<bigint>;
    },

    async sbtBurnSBT({ tokenId, account }: { tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'burnSBT',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtLeaveCommunity({ community, account }: { community: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'leaveCommunity',
            args: [community],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtDeactivateMembership({ tokenId, account }: { tokenId: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'deactivateMembership',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtRecordActivity({ user, account }: { user: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'recordActivity',
            args: [user],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtLastActivityTime({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'lastActivityTime',
            args: [user]
        }) as Promise<bigint>;
    },

    async sbtWeeklyActivity({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'weeklyActivity',
            args: [user]
        }) as Promise<bigint>;
    },

    async sbtReputationCalculator() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'reputationCalculator',
            args: []
        }) as Promise<Address>;
    },

    async sbtSetReputationCalculator({ calculator, account }: { calculator: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setReputationCalculator',
            args: [calculator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtMintFee() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'mintFee',
            args: []
        }) as Promise<bigint>;
    },

    async sbtSetMintFee({ fee, account }: { fee: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setMintFee',
            args: [fee],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtMinLockAmount() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'minLockAmount',
            args: []
        }) as Promise<bigint>;
    },

    async sbtSetMinLockAmount({ amount, account }: { amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setMinLockAmount',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtPause({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'pause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtUnpause({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'unpause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtPaused() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'paused',
            args: []
        }) as Promise<boolean>;
    },

    async sbtDaoMultisig() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'daoMultisig',
            args: []
        }) as Promise<Address>;
    },

    async sbtSetDAOMultisig({ multisig, account }: { multisig: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setDAOMultisig',
            args: [multisig],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtSetRegistry({ registry, account }: { registry: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtSetSuperPaymaster({ paymaster, account }: { paymaster: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async sbtVersion() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
