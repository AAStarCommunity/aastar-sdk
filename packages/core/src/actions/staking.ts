import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenStakingABI } from '../abis/index.js';

export type StakingActions = {
    // Staking Operations
    lockStake: (args: { user: Address, roleId: Hex, stakeAmount: bigint, entryBurn: bigint, payer: Address, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    unlockAndTransfer: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Slashing
    slash: (args: { user: Address, roleId: Hex, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    slashByDVT: (args: { user: Address, roleId: Hex, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    setAuthorizedSlasher: (args: { slasher: Address, authorized: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Query Functions
    getStakeInfo: (args: { operator: Address, roleId: Hex }) => Promise<any>;
    getStakingBalance: (args: { user: Address }) => Promise<bigint>;
    getLockedStake: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    getUserRoleLocks: (args: { user: Address }) => Promise<any[]>;
    hasRoleLock: (args: { user: Address, roleId: Hex }) => Promise<boolean>;
    availableBalance: (args: { user: Address }) => Promise<bigint>;
    previewExitFee: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    
    // Admin Functions
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setRoleExitFee: (args: { roleId: Hex, feePercent: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    
    // View Functions
    stakes: (args: { user: Address }) => Promise<any>;
    roleLocks: (args: { user: Address, roleId: Hex }) => Promise<any>;
    roleExitConfigs: (args: { roleId: Hex }) => Promise<any>;
    userActiveRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    authorizedSlashers: (args: { slasher: Address }) => Promise<boolean>;
    totalStaked: () => Promise<bigint>;
    getTotalStaked: () => Promise<bigint>; // Alias for totalStaked
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
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'lockStake',
            args: [user, roleId, stakeAmount, entryBurn, payer],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async topUpStake({ user, roleId, stakeAmount, payer, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'topUpStake',
            args: [user, roleId, stakeAmount, payer],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockStake({ user, roleId, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'unlockAndTransfer',
            args: [user, roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockAndTransfer({ user, roleId, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'unlockAndTransfer',
            args: [user, roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Slashing
    async slash({ user, roleId, amount, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'slash',
            args: [user, roleId, amount, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async slashByDVT({ user, roleId, amount, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'slashByDVT',
            args: [user, roleId, amount, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setAuthorizedSlasher({ slasher, authorized, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'setAuthorizedSlasher',
            args: [slasher, authorized],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Query Functions
    async getStakeInfo({ operator, roleId }) {
        return (client as any).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'getStakeInfo',
            args: [operator, roleId]
        });
    },

    async getStakingBalance({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'balanceOf',
            args: [user]
        }) as Promise<bigint>;
    },

    async getLockedStake({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'getLockedStake',
            args: [user, roleId]
        }) as Promise<bigint>;
    },

    async getUserRoleLocks({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'getUserRoleLocks',
            args: [user]
        }) as Promise<any[]>;
    },

    async hasRoleLock({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'hasRoleLock',
            args: [user, roleId]
        }) as Promise<boolean>;
    },

    async availableBalance({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'availableBalance',
            args: [user]
        }) as Promise<bigint>;
    },

    async previewExitFee({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'previewExitFee',
            args: [user, roleId]
        }) as Promise<bigint>;
    },

    // Admin Functions
    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setRoleExitFee({ roleId, feePercent, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'setRoleExitFee',
            args: [roleId, feePercent],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setTreasury({ treasury, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'setTreasury',
            args: [treasury],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // View Functions
    async stakes({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'stakes',
            args: [user]
        });
    },

    async roleLocks({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'roleLocks',
            args: [user, roleId]
        });
    },

    async roleExitConfigs({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'roleExitConfigs',
            args: [roleId]
        });
    },

    async userActiveRoles({ user, index }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'userActiveRoles',
            args: [user, index]
        }) as Promise<Hex>;
    },

    async authorizedSlashers({ slasher }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'authorizedSlashers',
            args: [slasher]
        }) as Promise<boolean>;
    },

    async totalStaked() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'totalStaked',
            args: []
        }) as Promise<bigint>;
    },

    async getTotalStaked() {
        return this.totalStaked();
    },

    async treasury() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'treasury',
            args: []
        }) as Promise<Address>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Version
    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    },

    // Constants
    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async GTOKEN() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'GTOKEN',
            args: []
        }) as Promise<Address>;
    }
});
