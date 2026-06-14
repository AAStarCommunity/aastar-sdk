import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MySBTABI } from '../abis/index.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type SBTMembership = {
    community: Address;
    joinedAt: bigint;
    lastActiveTime: bigint;
    isActive: boolean;
    metadata: string;
};

export type SBTData = {
    holder: Address;
    firstCommunity: Address;
    mintedAt: bigint;
    totalCommunities: bigint;
};

/** Per-item outcome of a sequential batch mint. */
export type BatchMintResult = {
    user: Address;
    ok: boolean;
    txHash?: Hash;
    error?: string;
};

// MySBT (Soul Bound Token + Membership Management)
export type SBTActions = {
    // SBT specific
    airdropMint: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    mintForRole: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    batchAirdropMint: (args: {
        items: { user: Address, roleId: Hex, roleData: Hex }[],
        account?: Account | Address,
        onProgress?: (done: number, total: number, lastResult: BatchMintResult) => void,
        continueOnError?: boolean
    }) => Promise<BatchMintResult[]>;
    mintOrAddMembership: (args: { user: Address, roleId: Hex, roleData: Hex, account?: Account | Address }) => Promise<Hash>;
    getUserSBT: (args: { user: Address }) => Promise<bigint>;
    getSBTData: (args: { tokenId: bigint }) => Promise<SBTData>;
    getCommunityMembership: (args: { tokenId: bigint, community: Address }) => Promise<SBTMembership>;
    getMemberships: (args: { tokenId: bigint }) => Promise<SBTMembership[]>;
    getActiveMemberships: (args: { tokenId: bigint }) => Promise<Address[]>;
    verifyCommunityMembership: (args: { user: Address, community: Address }) => Promise<boolean>;
    userToSBT: (args: { user: Address }) => Promise<bigint>;
    sbtData: (args: { tokenId: bigint }) => Promise<SBTData>;
    membershipIndex: (args: { tokenId: bigint, community: Address }) => Promise<bigint>;
    
    // ERC721 Standard
    balanceOf: (args: { owner: Address }) => Promise<bigint>;
    ownerOf: (args: { tokenId: bigint }) => Promise<Address>;
    safeTransferFrom: (args: { from: Address, to: Address, tokenId: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    transferFrom: (args: { from: Address, to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    approve: (args: { to: Address, tokenId: bigint, account?: Account | Address }) => Promise<Hash>;
    setApprovalForAll: (args: { operator: Address, approved: boolean, account?: Account | Address }) => Promise<Hash>;
    getApproved: (args: { tokenId: bigint }) => Promise<Address>;
    isApprovedForAll: (args: { owner: Address, operator: Address }) => Promise<boolean>;
    
    // ERC721 Metadata
    name: () => Promise<string>;
    symbol: () => Promise<string>;
    tokenURI: (args: { tokenId: bigint }) => Promise<string>;
    
    // View Functions
    nextTokenId: () => Promise<bigint>;
    supportsInterface: (args: { interfaceId: Hex }) => Promise<boolean>;
    
    // Admin/Minting
    burnSBT: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    setBaseURI: (args: { baseURI: string, account?: Account | Address }) => Promise<Hash>;
    
    // Membership Management
    leaveCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;
    deactivateMembership: (args: { user: Address, community: Address, account?: Account | Address }) => Promise<Hash>;
    deactivateAllMemberships: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Activity & Reputation
    recordActivity: (args: { user: Address, account?: Account | Address }) => Promise<Hash>;
    lastActivityTime: (args: { tokenId: bigint, community: Address }) => Promise<bigint>;
    weeklyActivity: (args: { tokenId: bigint, community: Address, week: bigint }) => Promise<boolean>;
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
    
    // Version
    version: () => Promise<string>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    GTOKEN_STAKING: () => Promise<Address>;
    GTOKEN: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
};

export const sbtActions = (address: Address) => (client: PublicClient | WalletClient): SBTActions => ({
    // SBT specific
    async airdropMint({ user, roleId, roleData, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            validateRequired(roleData, 'roleData');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'airdropMint',
                args: [user, roleId, roleData],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'airdropMint');
        }
    },

    async mintForRole({ user, roleId, roleData, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            validateRequired(roleData, 'roleData');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'mintForRole',
                args: [user, roleId, roleData],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mintForRole');
        }
    },

    /**
     * Airdrop-mint an SBT to many users in one helper call.
     *
     * IMPORTANT: this is NOT atomic. MySBT exposes no on-chain batch entrypoint,
     * so this helper sends N SEPARATE `airdropMint` transactions — one signature
     * and one gas payment per item — awaited sequentially so account nonces stay
     * ordered. A failure on item K does not roll back items 0..K-1 that already
     * landed on-chain. For an all-or-nothing path, a future Multicall3 batch is
     * planned (deferred).
     *
     * @param items          List of { user, roleId, roleData } to mint, in order.
     * @param account        Sender account / address used for every transaction.
     * @param onProgress     Invoked after each item with (done, total, lastResult).
     * @param continueOnError When true, a failing item is recorded as { ok:false, error }
     *                        and the loop continues; when false (default), the error is
     *                        recorded then rethrown, aborting the remaining items.
     * @returns Per-item results in the same order as `items`.
     */
    async batchAirdropMint({ items, account, onProgress, continueOnError }) {
        validateRequired(items, 'items');
        const results: BatchMintResult[] = [];
        const total = items.length;
        for (let i = 0; i < items.length; i++) {
            const { user, roleId, roleData } = items[i];
            let result: BatchMintResult;
            try {
                validateAddress(user, 'user');
                validateRequired(roleId, 'roleId');
                validateRequired(roleData, 'roleData');
                // Sequential await keeps nonces ordered across the N transactions.
                const txHash = await (client as any).writeContract({
                    address,
                    abi: MySBTABI,
                    functionName: 'airdropMint',
                    args: [user, roleId, roleData],
                    account: account as any,
                    chain: (client as any).chain
                });
                result = { user, ok: true, txHash };
            } catch (error) {
                const wrapped = AAStarError.fromViemError(error as Error, 'batchAirdropMint');
                result = { user, ok: false, error: wrapped.message };
                results.push(result);
                onProgress?.(i + 1, total, result);
                if (!continueOnError) throw wrapped;
                continue;
            }
            results.push(result);
            onProgress?.(i + 1, total, result);
        }
        return results;
    },

    /**
     * Ensure `user` holds an SBT and is a member of the community encoded in
     * `roleData`, minting if necessary.
     *
     * On-chain reality: MySBT has NO separate add-membership function. Its
     * `airdropMint` IS the dual-purpose mint-or-add primitive — for a first-time
     * user (tokenId == 0) it mints a fresh SBT, and for an existing holder it adds
     * the new community membership (or reactivates a deactivated one). It is
     * idempotent: if the user is already an ACTIVE member of that community it is a
     * no-op on-chain (returns without reverting), so calling this when already a
     * member is safe and simply emits/returns the transaction.
     *
     * We read `getUserSBT` first only to surface mint-vs-add intent; the issued
     * call is `airdropMint` in both branches because it is the correct (and only)
     * membership-add path the contract provides.
     */
    async mintOrAddMembership({ user, roleId, roleData, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            validateRequired(roleData, 'roleData');
            // 0n => first-time mint; >0n => existing holder, airdropMint adds/reactivates membership.
            await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getUserSBT',
                args: [user]
            });
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'airdropMint',
                args: [user, roleId, roleData],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mintOrAddMembership');
        }
    },

    async getUserSBT({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getUserSBT',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserSBT');
        }
    },

    async getSBTData({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            const res = await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getSBTData',
                args: [tokenId]
            }) as any;
            
            if (Array.isArray(res)) {
                return {
                    holder: res[0],
                    firstCommunity: res[1],
                    mintedAt: res[2],
                    totalCommunities: res[3]
                };
            }
            return res as { holder: Address, firstCommunity: Address, mintedAt: bigint, totalCommunities: bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSBTData');
        }
    },

    async getCommunityMembership({ tokenId, community }) {
        try {
            validateRequired(tokenId, 'tokenId');
            validateAddress(community, 'community');
            const res = await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getCommunityMembership',
                args: [tokenId, community]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    community: res[0],
                    joinedAt: res[1],
                    lastActiveTime: res[2],
                    isActive: res[3],
                    metadata: res[4]
                };
            }
            return res as { community: Address, joinedAt: bigint, lastActiveTime: bigint, isActive: boolean, metadata: Hex };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityMembership');
        }
    },

    async getMemberships({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            const res = await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getMemberships',
                args: [tokenId]
            }) as any[];
            
            return res.map(m => {
                if (Array.isArray(m)) {
                    return {
                        community: m[0],
                        joinedAt: m[1],
                        lastActiveTime: m[2],
                        isActive: m[3],
                        metadata: m[4]
                    };
                }
                return m;
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getMemberships');
        }
    },

    async getActiveMemberships({ tokenId }) {
        try {
            validateRequired(tokenId, 'tokenId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'getActiveMemberships',
                args: [tokenId]
            }) as Promise<Address[]>;
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
            const res = await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'sbtData',
                args: [tokenId]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    holder: res[0],
                    firstCommunity: res[1],
                    mintedAt: res[2],
                    totalCommunities: res[3]
                };
            }
            return res as { holder: Address, firstCommunity: Address, mintedAt: bigint, totalCommunities: bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'sbtData');
        }
    },

    async membershipIndex({ tokenId, community }) {
        try {
            validateRequired(tokenId, 'tokenId');
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'membershipIndex',
                args: [tokenId, community]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'membershipIndex');
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

    async safeTransferFrom({ from, to, tokenId, data, account }) {
        try {
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateRequired(tokenId, 'tokenId');
            const args = data ? [from, to, tokenId, data] : [from, to, tokenId];
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'safeTransferFrom',
                args,
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

    // View Functions
    async nextTokenId() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'nextTokenId',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'nextTokenId');
        }
    },

    async supportsInterface({ interfaceId }) {
        try {
            validateRequired(interfaceId, 'interfaceId');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'supportsInterface',
                args: [interfaceId]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'supportsInterface');
        }
    },

    // Admin/Minting
    async burnSBT({ user, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'burnSBT',
                args: [user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burnSBT');
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

    // Membership Management
    async leaveCommunity({ community, account }) {
        try {
            validateAddress(community, 'community');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'leaveCommunity',
                args: [community],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'leaveCommunity');
        }
    },

    async deactivateMembership({ user, community, account }) {
        try {
            validateAddress(user, 'user');
            validateAddress(community, 'community');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'deactivateMembership',
                args: [user, community],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deactivateMembership');
        }
    },

    async deactivateAllMemberships({ user, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'deactivateAllMemberships',
                args: [user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deactivateAllMemberships');
        }
    },

    // Activity & Reputation
    async recordActivity({ user, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'recordActivity',
                args: [user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'recordActivity');
        }
    },

    async lastActivityTime({ tokenId, community }) {
        try {
            validateRequired(tokenId, 'tokenId');
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'lastActivityTime',
                args: [tokenId, community]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'lastActivityTime');
        }
    },

    async weeklyActivity({ tokenId, community, week }) {
        try {
            validateRequired(tokenId, 'tokenId');
            validateAddress(community, 'community');
            validateRequired(week, 'week');
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'weeklyActivity',
                args: [tokenId, community, week]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'weeklyActivity');
        }
    },

    async reputationCalculator() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'reputationCalculator',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'reputationCalculator');
        }
    },

    async setReputationCalculator({ calculator, account }) {
        try {
            validateAddress(calculator, 'calculator');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setReputationCalculator',
                args: [calculator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setReputationCalculator');
        }
    },

    // Mint Fee & Lock
    async mintFee() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'mintFee',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mintFee');
        }
    },

    async setMintFee({ fee, account }) {
        try {
            validateAmount(fee, 'fee');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setMintFee',
                args: [fee],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMintFee');
        }
    },

    async minLockAmount() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'minLockAmount',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'minLockAmount');
        }
    },

    async setMinLockAmount({ amount, account }) {
        try {
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setMinLockAmount',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMinLockAmount');
        }
    },

    // Pause
    async pause({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'pause',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pause');
        }
    },

    async unpause({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'unpause',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unpause');
        }
    },

    async paused() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'paused',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'paused');
        }
    },

    // DAO & Config
    async daoMultisig() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'daoMultisig',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'daoMultisig');
        }
    },

    async setDAOMultisig({ multisig, account }) {
        try {
            validateAddress(multisig, 'multisig');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setDAOMultisig',
                args: [multisig],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setDAOMultisig');
        }
    },

    async setRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address,
                abi: MySBTABI,
                functionName: 'setRegistry',
                args: [registry],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRegistry');
        }
    },

    // Version
    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: MySBTABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
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
    }
});
