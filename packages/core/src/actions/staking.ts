import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenStakingABI } from '../abis/index.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type StakingActions = {
    // Staking Operations
    lockStake: (args: { user: Address, roleId: Hex, stakeAmount: bigint, entryBurn: bigint, payer: Address, account?: Account | Address }) => Promise<Hash>;
    topUpStake: (args: { user: Address, roleId: Hex, stakeAmount: bigint, payer: Address, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    unlockAndTransfer: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Slashing
    slash: (args: { user: Address, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    slashByDVT: (args: { operator: Address, roleId: Hex, penaltyAmount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    setAuthorizedSlasher: (args: { slasher: Address, authorized: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Query Functions
    getStakeInfo: (args: { operator: Address, roleId: Hex }) => Promise<{
        amount: bigint;
        slashedAmount: bigint;
        stakedAt: bigint;
        unstakeRequestedAt: bigint;
    }>;
    getStakingBalance: (args: { user: Address }) => Promise<bigint>;
    getLockedStake: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    getUserRoleLocks: (args: { user: Address }) => Promise<Array<{
        amount: bigint;
        entryBurn: bigint;
        lockedAt: number;
        roleId: Hex;
        metadata: Hex;
    }>>;
    hasRoleLock: (args: { user: Address, roleId: Hex }) => Promise<boolean>;
    availableBalance: (args: { user: Address }) => Promise<bigint>;
    previewExitFee: (args: { user: Address, roleId: Hex }) => Promise<{ fee: bigint; netAmount: bigint }>;
    
    // Admin Functions
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setRoleExitFee: (args: { roleId: Hex, feePercent: bigint, minFee: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    
    // View Functions
    stakes: (args: { user: Address }) => Promise<{
        amount: bigint;
        slashedAmount: bigint;
        stakedAt: bigint;
        unstakeRequestedAt: bigint;
    }>;
    roleLocks: (args: { user: Address, roleId: Hex }) => Promise<{
        amount: bigint;
        entryBurn: bigint;
        lockedAt: number;
        roleId: Hex;
        metadata: Hex;
    }>;
    roleExitConfigs: (args: { roleId: Hex }) => Promise<{ feePercent: bigint; minFee: bigint }>;
    userActiveRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    authorizedSlashers: (args: { slasher: Address }) => Promise<boolean>;
    totalStaked: () => Promise<bigint>;
    getTotalStaked: () => Promise<bigint>;
    treasury: () => Promise<Address>;
    owner: () => Promise<Address>;
    
    // Ownership
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    GTOKEN: () => Promise<Address>;
};

export const stakingActions = (address: Address) => (client: PublicClient | WalletClient): StakingActions => ({
    // Staking Operations
    /**
     * @internal
     * @warning This is a low-level internal API. Use high-level clients instead.
     */
    async lockStake({ user, roleId, stakeAmount, entryBurn, payer, account }) {
        try {
            validateAddress(user, 'user');
            validateAddress(payer, 'payer');
            validateAmount(stakeAmount, 'stakeAmount');
            validateAmount(entryBurn, 'entryBurn');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'lockStake',
                args: [user, roleId, stakeAmount, entryBurn, payer],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'lockStake');
        }
    },

    async topUpStake({ user, roleId, stakeAmount, payer, account }) {
        try {
            validateAddress(user, 'user');
            validateAddress(payer, 'payer');
            validateAmount(stakeAmount, 'stakeAmount');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'topUpStake',
                args: [user, roleId, stakeAmount, payer],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'topUpStake');
        }
    },

    async unlockStake({ user, roleId, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'unlockAndTransfer',
                args: [user, roleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unlockStake');
        }
    },

    async unlockAndTransfer({ user, roleId, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'unlockAndTransfer',
                args: [user, roleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unlockAndTransfer');
        }
    },

    // Slashing
    async slash({ user, amount, reason, account }) {
        try {
            validateAddress(user, 'user');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'slash',
                args: [user, amount, reason],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slash');
        }
    },

    async slashByDVT({ operator, roleId, penaltyAmount, reason, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(roleId, 'roleId');
            validateAmount(penaltyAmount, 'penaltyAmount');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'slashByDVT',
                args: [operator, roleId, penaltyAmount, reason],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashByDVT');
        }
    },

    async setAuthorizedSlasher({ slasher, authorized, account }) {
        try {
            validateAddress(slasher, 'slasher');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'setAuthorizedSlasher',
                args: [slasher, authorized],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAuthorizedSlasher');
        }
    },

    // Query Functions
    async getStakeInfo({ operator, roleId }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(roleId, 'roleId');
            const res = await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'getStakeInfo',
                args: [operator, roleId]
            }) as any;
            return {
                amount: res.amount,
                slashedAmount: res.slashedAmount,
                stakedAt: res.stakedAt,
                unstakeRequestedAt: res.unstakeRequestedAt
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getStakeInfo');
        }
    },

    async getStakingBalance({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'balanceOf',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getStakingBalance');
        }
    },

    async getLockedStake({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'getLockedStake',
                args: [user, roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getLockedStake');
        }
    },

    async getUserRoleLocks({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'getUserRoleLocks',
                args: [user]
            }) as Promise<any[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserRoleLocks');
        }
    },

    async hasRoleLock({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'hasRoleLock',
                args: [user, roleId]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'hasRoleLock');
        }
    },

    async availableBalance({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'availableBalance',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'availableBalance');
        }
    },

    async previewExitFee({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            const [fee, netAmount] = await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'previewExitFee',
                args: [user, roleId]
            }) as [bigint, bigint];
            return { fee, netAmount };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'previewExitFee');
        }
    },

    // Admin Functions
    async setRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'setRegistry',
                args: [registry],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRegistry');
        }
    },

    async setRoleExitFee({ roleId, feePercent, minFee, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAmount(feePercent, 'feePercent');
            validateAmount(minFee, 'minFee');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'setRoleExitFee',
                args: [roleId, feePercent, minFee],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRoleExitFee');
        }
    },

    async setTreasury({ treasury, account }) {
        try {
            validateAddress(treasury, 'treasury');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'setTreasury',
                args: [treasury],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setTreasury');
        }
    },

    // View Functions
    async stakes({ user }) {
        try {
            validateAddress(user, 'user');
            const res = await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'stakes',
                args: [user]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    amount: res[0],
                    slashedAmount: res[1],
                    stakedAt: res[2],
                    unstakeRequestedAt: res[3]
                };
            }
            return res as { amount: bigint, slashedAmount: bigint, stakedAt: bigint, unstakeRequestedAt: bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'stakes');
        }
    },

    async roleLocks({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            const res = await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'roleLocks',
                args: [user, roleId]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    amount: res[0],
                    entryBurn: res[1],
                    lockedAt: Number(res[2]),
                    roleId: res[3],
                    metadata: res[4]
                };
            }
            return res as { amount: bigint, entryBurn: bigint, lockedAt: number, roleId: Hex, metadata: Hex };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleLocks');
        }
    },

    async roleExitConfigs({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            const [feePercent, minFee] = await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'roleExitConfigs',
                args: [roleId]
            }) as [bigint, bigint];
            return { feePercent, minFee };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleExitConfigs');
        }
    },

    async userActiveRoles({ user, index }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'userActiveRoles',
                args: [user, index]
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userActiveRoles');
        }
    },

    async authorizedSlashers({ slasher }) {
        try {
            validateAddress(slasher, 'slasher');
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'authorizedSlashers',
                args: [slasher]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'authorizedSlashers');
        }
    },

    async totalStaked() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'totalStaked',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'totalStaked');
        }
    },

    async getTotalStaked() {
        return this.totalStaked();
    },

    async treasury() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'treasury',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'treasury');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    // Ownership
    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: GTokenStakingABI,
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
                abi: GTokenStakingABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // Version
    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
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
                abi: GTokenStakingABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async GTOKEN() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: GTokenStakingABI,
                functionName: 'GTOKEN',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'GTOKEN');
        }
    }
});
