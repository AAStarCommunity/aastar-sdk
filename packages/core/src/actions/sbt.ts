import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI } from '../abis/index.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// MySBT (ERC721 + custom SBT functions) - 50 functions
export type SBTActions = {
    // SBT specific
    safeMintForRole: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    airdropMint: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    mintForRole: (args: { roleId: Hex, to: Address, account?: Account | Address }) => Promise<Hash>;
    getUserSBT: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    getSBTData: (args: { tokenId: bigint }) => Promise<any>;
    getCommunityMembership: (args: { user: Address, community: Address }) => Promise<bigint>;
    getMemberships: (args: { user: Address }) => Promise<any[]>;
    getActiveMemberships: (args: { user: Address }) => Promise<any[]>;
    verifyCommunityMembership: (args: { user: Address, community: Address }) => Promise<boolean>;
    userToSBT: (args: { user: Address }) => Promise<bigint>;
    sbtData: (args: { tokenId: bigint }) => Promise<any>;
    membershipIndex: (args: { user: Address, index: bigint }) => Promise<any>;
    
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
    supportsInterface: (args: { interfaceId: Hex }) => Promise<boolean>;
    nextTokenId: () => Promise<bigint>;
    
    // Admin/Minting
    mint: (args: { to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    burnSBT: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    setBaseURI: (args: { baseURI: string, account?: Account | Address }) => Promise<Hash>;
    
    // Membership Management
    leaveCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;
    deactivateMembership: (args: { tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Activity & Reputation
    recordActivity: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    lastActivityTime: (args: { user: Address }) => Promise<bigint>;
    weeklyActivity: (args: { user: Address }) => Promise<bigint>;
    reputationCalculator: () => Promise<Address>;
    setReputationCalculator: (args: { calculator: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Mint Fee & Lock
    mintFee: () => Promise<bigint>;
    setMintFee: (args: { fee: bigint, account?: Account | Address }) => Promise<Hash>;
    minLockAmount: () => Promise<bigint>;
    setMinLockAmount: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Pause
    pause: (args: { account?: Account | Address }) => Promise<Hash>;
    unpause: (args: { account?: Account | Address }) => Promise<Hash>;
    paused: () => Promise<boolean>;
    
    // DAO & Config
    daoMultisig: () => Promise<Address>;
    setDAOMultisig: (args: { multisig: Address, account?: Account | Address }) => Promise<Hash>;
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
    
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
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'safeMintForRole',
                args: [roleId, to, tokenURI],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'safeMintForRole');
        }
    },

    async airdropMint({ roleId, to, tokenURI, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'airdropMint',
                args: [roleId, to, tokenURI],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'airdropMint');
        }
    },

    async getUserSBT({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getUserSBT',
                args: [user, roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserSBT');
        }
    },

    async getSBTData({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getSBTData',
                args: [tokenId]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSBTData');
        }
    },

    async getCommunityMembership({ user, community }) {
        try {
            validateAddress(user, 'user');
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getCommunityMembership',
                args: [user, community]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityMembership');
        }
    },

    // ERC721 Standard
    async balanceOf({ owner }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'balanceOf',
                args: [owner]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'balanceOf');
        }
    },

    async ownerOf({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'ownerOf',
                args: [tokenId]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ownerOf');
        }
    },

    async safeTransferFrom({ from, to, tokenId, account }) {
        try {
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateRequired(tokenId, 'tokenId');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'safeTransferFrom',
                args: [from, to, tokenId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'safeTransferFrom');
        }
    },

    async transferFrom({ from, to, tokenId, account }) {
        try {
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateRequired(tokenId, 'tokenId');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'transferFrom',
                args: [from, to, tokenId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferFrom');
        }
    },

    async approve({ to, tokenId, account }) {
        try {
            validateAddress(to, 'to');
            validateRequired(tokenId, 'tokenId');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'approve',
                args: [to, tokenId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'approve');
        }
    },

    async setApprovalForAll({ operator, approved, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setApprovalForAll',
                args: [operator, approved],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setApprovalForAll');
        }
    },

    async getApproved({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getApproved',
                args: [tokenId]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getApproved');
        }
    },

    async isApprovedForAll({ owner, operator }) {
        try {
            validateAddress(owner, 'owner');
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'isApprovedForAll',
                args: [owner, operator]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isApprovedForAll');
        }
    },

    // ERC721 Metadata
    async name() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'name',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'name');
        }
    },

    async symbol() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'symbol',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'symbol');
        }
    },

    async tokenURI({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'tokenURI',
                args: [tokenId]
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenURI');
        }
    },

    // ERC721 Enumerable
    async totalSupply() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'totalSupply',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'totalSupply');
        }
    },

    async tokenByIndex({ index }) {
        try {
            validateRequired(index, 'index');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'tokenByIndex',
                args: [index]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenByIndex');
        }
    },

    async tokenOfOwnerByIndex({ owner, index }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(index, 'index');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'tokenOfOwnerByIndex',
                args: [owner, index]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenOfOwnerByIndex');
        }
    },

    // Admin/Minting
    async mint({ to, tokenURI, account }) {
        try {
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'mint',
                args: [to, tokenURI],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mint');
        }
    },

    async burn({ tokenId, account }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'burn',
                args: [tokenId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burn');
        }
    },

    async setBaseURI({ baseURI, account }) {
        try {
            validateRequired(baseURI, 'baseURI');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setBaseURI',
                args: [baseURI],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBaseURI');
        }
    },

    // Constants
    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async GTOKEN_STAKING() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'GTOKEN_STAKING',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'GTOKEN_STAKING');
        }
    },

    async GTOKEN() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'GTOKEN',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'GTOKEN');
        }
    },

    async SUPER_PAYMASTER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'SUPER_PAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPER_PAYMASTER');
        }
    },

    // Ownership
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // Additional SBT-specific functions
    async mintForRole({ roleId, to, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'mintForRole',
                args: [roleId, to],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mintForRole');
        }
    },

    async getMemberships({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getMemberships',
                args: [user]
            }) as Promise<any[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getMemberships');
        }
    },

    async getActiveMemberships({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getActiveMemberships',
                args: [user]
            }) as Promise<any[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getActiveMemberships');
        }
    },

    async verifyCommunityMembership({ user, community }) {
        try {
            validateAddress(user, 'user');
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'verifyCommunityMembership',
                args: [user, community]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'verifyCommunityMembership');
        }
    },

    async userToSBT({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'userToSBT',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userToSBT');
        }
    },

    async sbtData({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'sbtData',
                args: [tokenId]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'sbtData');
        }
    },

    async membershipIndex({ user, index }) {
        try {
            validateAddress(user, 'user');
            validateRequired(index, 'index');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'membershipIndex',
                args: [user, index]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'membershipIndex');
        }
    },

    async supportsInterface({ interfaceId }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'supportsInterface',
            args: [interfaceId]
        }) as Promise<boolean>;
    },

    async nextTokenId() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'nextTokenId',
            args: []
        }) as Promise<bigint>;
    },

    async burnSBT({ tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'burnSBT',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async leaveCommunity({ community, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'leaveCommunity',
            args: [community],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async deactivateMembership({ tokenId, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'deactivateMembership',
            args: [tokenId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async recordActivity({ user, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'recordActivity',
            args: [user],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async lastActivityTime({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'lastActivityTime',
            args: [user]
        }) as Promise<bigint>;
    },

    async weeklyActivity({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'weeklyActivity',
            args: [user]
        }) as Promise<bigint>;
    },

    async reputationCalculator() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'reputationCalculator',
            args: []
        }) as Promise<Address>;
    },

    async setReputationCalculator({ calculator, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setReputationCalculator',
            args: [calculator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async mintFee() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'mintFee',
            args: []
        }) as Promise<bigint>;
    },

    async setMintFee({ fee, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setMintFee',
            args: [fee],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async minLockAmount() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'minLockAmount',
            args: []
        }) as Promise<bigint>;
    },

    async setMinLockAmount({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setMinLockAmount',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async pause({ account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'pause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unpause({ account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'unpause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paused() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'paused',
            args: []
        }) as Promise<boolean>;
    },

    async daoMultisig() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'daoMultisig',
            args: []
        }) as Promise<Address>;
    },

    async setDAOMultisig({ multisig, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setDAOMultisig',
            args: [multisig],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setSuperPaymaster({ paymaster, account }) {
        return (client as any).writeContract({
            address,
            abi: MySBTABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: MySBTABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
