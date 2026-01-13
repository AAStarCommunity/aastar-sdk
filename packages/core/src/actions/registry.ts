import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { RegistryABI } from '../abis/index.js';
import type { RoleConfig } from '../roles.js';

export type RegistryActions = {
    // Role Management
    configureRole: (args: { roleId: Hex, config: RoleConfig, account?: Account | Address }) => Promise<Hash>;
    registerRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    registerRoleSelf: (args: { roleId: Hex, data: Hex, account?: Account | Address }) => Promise<Hash>;
    hasRole: (args: { user: Address, roleId: Hex }) => Promise<boolean>;
    unRegisterRole: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    getRoleConfig: (args: { roleId: Hex }) => Promise<any>;
    setRoleLockDuration: (args: { roleId: Hex, duration: bigint, account?: Account | Address }) => Promise<Hash>;
    setRoleOwner: (args: { roleId: Hex, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Community Management
    communityToToken: (args: { community: Address }) => Promise<Address>;
    getCommunityRoleData: (args: { community: Address }) => Promise<any>;
    isCommunityMember: (args: { community: Address, user: Address }) => Promise<boolean>;
    communityByNameV3: (args: { name: string }) => Promise<Address>;
    communityByENSV3: (args: { ensName: string }) => Promise<Address>;
    proposedRoleNames: (args: { roleId: Hex }) => Promise<string>;
    
    // Credit & Reputation
    getCreditLimit: (args: { user: Address }) => Promise<bigint>;
    getGlobalReputation: (args: { user: Address }) => Promise<bigint>;
    setCreditTier: (args: { tier: bigint, params: any, account?: Account | Address }) => Promise<Hash>;
    setLevelThreshold: (args: { level: bigint, threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    batchUpdateGlobalReputation: (args: { users: Address[], scores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Blacklist Management
    updateOperatorBlacklist: (args: { operator: Address, isBlacklisted: boolean, account?: Account | Address }) => Promise<Hash>;
    isOperatorBlacklisted: (args: { operator: Address }) => Promise<boolean>;
    
    // Contract References
    setBLSValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    setMySBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setStaking: (args: { staking: Address, account?: Account | Address }) => Promise<Hash>;
    setReputationSource: (args: { source: Address, account?: Account | Address }) => Promise<Hash>;
    blsValidator: () => Promise<Address>;
    blsAggregator: () => Promise<Address>;
    mySBT: () => Promise<Address>;
    superPaymaster: () => Promise<Address>;
    staking: () => Promise<Address>;
    reputationSource: () => Promise<Address>;
    
    // Admin
    transferRegistryOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    owner: () => Promise<Address>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // View Functions
    roleConfigs: (args: { roleId: Hex }) => Promise<any>;
    roleCounts: (args: { roleId: Hex }) => Promise<bigint>;
    getRoleMemberCount: (args: { roleId: Hex }) => Promise<bigint>; // Alias for getRoleUserCount
    roleMembers: (args: { roleId: Hex, index: bigint }) => Promise<Address>;
    userRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    userRoleCount: (args: { user: Address }) => Promise<bigint>;
    globalReputation: (args: { user: Address }) => Promise<bigint>;
    creditTiers: (args: { tier: bigint }) => Promise<any>;
    levelThresholds: (args: { level: bigint }) => Promise<bigint>;
    
    // Role Metadata & Members
    roleLockDurations: (args: { roleId: Hex }) => Promise<bigint>;
    roleMetadata: (args: { roleId: Hex }) => Promise<any>;
    roleStakes: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    roleSBTTokenIds: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    roleOwners: (args: { roleId: Hex }) => Promise<Address>;
    roleMemberIndex: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    getRoleMembers: (args: { roleId: Hex }) => Promise<Address[]>;
    getRoleUserCount: (args: { roleId: Hex }) => Promise<bigint>;
    getUserRoles: (args: { user: Address }) => Promise<Hex[]>;
    
    // Admin Operations
    adminConfigureRole: (args: { roleId: Hex, config: RoleConfig, account?: Account | Address }) => Promise<Hash>;
    createNewRole: (args: { name: string, config: RoleConfig, account?: Account | Address }) => Promise<Hash>;
    safeMintForRole: (args: { roleId: Hex, to: Address, tokenURI: string, account?: Account | Address }) => Promise<Hash>;
    exitRole: (args: { roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    calculateExitFee: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    addLevelThreshold: (args: { level: bigint, threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    creditTierConfig: (args: { tier: bigint }) => Promise<any>;
    accountToUser: (args: { account: Address }) => Promise<Address>;
    
    // Constants (Role IDs)
    ROLE_COMMUNITY: () => Promise<Hex>;
    ROLE_ENDUSER: () => Promise<Hex>;
    ROLE_PAYMASTER_SUPER: () => Promise<Hex>;
    ROLE_PAYMASTER_AOA: () => Promise<Hex>;
    ROLE_DVT: () => Promise<Hex>;
    ROLE_KMS: () => Promise<Hex>;
    ROLE_ANODE: () => Promise<Hex>;
    GTOKEN_STAKING: () => Promise<Address>;
    MYSBT: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    isReputationSource: (args: { source: Address }) => Promise<boolean>;
    lastReputationEpoch: () => Promise<bigint>;
    
    // Community lookup functions
    getAccountCommunity: (args: { account: Address }) => Promise<Address>;
    
    // Version
    version: () => Promise<string>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
    // Role Management
    async configureRole({ roleId, config, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'configureRole',
            args: [roleId, config],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registerRole({ roleId, user, data, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [roleId, user, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registerRoleSelf({ roleId, data, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [roleId, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async hasRole({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'hasRole',
            args: [roleId, user]
        }) as Promise<boolean>;
    },

    async unRegisterRole({ user, roleId, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'unregisterRole',
            args: [user, roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getRoleConfig({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleConfig',
            args: [roleId]
        });
    },

    async setRoleLockDuration({ roleId, duration, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setRoleLockDuration',
            args: [roleId, duration],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setRoleOwner({ roleId, newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setRoleOwner',
            args: [roleId, newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Community Management
    async communityToToken({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'communityToToken',
            args: [community]
        }) as Promise<Address>;
    },

    async getCommunityRoleData({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getCommunityRoleData',
            args: [community]
        });
    },

    async isCommunityMember({ community, user }) {
        // Implementation: Check if user has the community role
        // In the AAStar system, a community member is identified by having a specific role
        // We need to check if the user has a role associated with this community
        // For now, we check if user has ROLE_ENDUSER which indicates general membership
        const ROLE_ENDUSER = await this.ROLE_ENDUSER();
        return this.hasRole({ user, roleId: ROLE_ENDUSER });
    },

    // Credit & Reputation
    async getCreditLimit({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getCreditLimit',
            args: [user]
        }) as Promise<bigint>;
    },

    async getGlobalReputation({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'globalReputation',
            args: [user]
        }) as Promise<bigint>;
    },

    async setCreditTier({ tier, params, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setCreditTier',
            args: [tier, params],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setLevelThreshold({ level, threshold, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setLevelThreshold',
            args: [level, threshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async batchUpdateGlobalReputation({ users, scores, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'batchUpdateGlobalReputation',
            args: [users, scores, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Blacklist Management
    async updateOperatorBlacklist({ operator, isBlacklisted, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'updateOperatorBlacklist',
            args: [operator, isBlacklisted],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isOperatorBlacklisted({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'isOperatorBlacklisted',
            args: [operator]
        }) as Promise<boolean>;
    },

    // Contract References
    async setBLSValidator({ validator, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setBLSValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBLSAggregator({ aggregator, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setBLSAggregator',
            args: [aggregator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setMySBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setMySBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setSuperPaymaster({ paymaster, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setStaking({ staking, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setStaking',
            args: [staking],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setReputationSource({ source, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setReputationSource',
            args: [source],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async blsValidator() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'blsValidator',
            args: []
        }) as Promise<Address>;
    },

    async blsAggregator() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'blsAggregator',
            args: []
        }) as Promise<Address>;
    },

    async mySBT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'MYSBT',
            args: []
        }) as Promise<Address>;
    },

    async superPaymaster() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async staking() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async reputationSource() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'reputationSource',
            args: []
        }) as Promise<Address>;
    },

    // Admin
    async transferRegistryOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // View Functions
    async roleConfigs({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleConfigs',
            args: [roleId]
        });
    },

    async roleCounts({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleCounts',
            args: [roleId]
        }) as Promise<bigint>;
    },

    // Alias: getRoleMemberCount maps to contract's getRoleUserCount
    async getRoleMemberCount({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleUserCount',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async roleMembers({ roleId, index }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMembers',
            args: [roleId, index]
        }) as Promise<Address>;
    },

    async userRoles({ user, index }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'userRoles',
            args: [user, index]
        }) as Promise<Hex>;
    },

    async userRoleCount({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'userRoleCount',
            args: [user]
        }) as Promise<bigint>;
    },

    async globalReputation({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'globalReputation',
            args: [user]
        }) as Promise<bigint>;
    },

    async creditTiers({ tier }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'creditTiers',
            args: [tier]
        });
    },

    async levelThresholds({ level }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'levelThresholds',
            args: [level]
        }) as Promise<bigint>;
    },

    // Community lookup functions
    async communityByNameV3({ name }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'communityByNameV3',
            args: [name]
        }) as Promise<Address>;
    },

    async communityByENSV3({ ensName }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'communityByENSV3',
            args: [ensName]
        }) as Promise<Address>;
    },

    async proposedRoleNames({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'proposedRoleNames',
            args: [roleId]
        }) as Promise<string>;
    },

    // Role Metadata & Members
    async roleLockDurations({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleLockDurations',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async roleMetadata({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMetadata',
            args: [roleId]
        });
    },

    async roleStakes({ roleId, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleStakes',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async roleSBTTokenIds({ roleId, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleSBTTokenIds',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async roleOwners({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleOwners',
            args: [roleId]
        }) as Promise<Address>;
    },

    async roleMemberIndex({ roleId, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMemberIndex',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async getRoleMembers({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleMembers',
            args: [roleId]
        }) as Promise<Address[]>;
    },

    async getRoleUserCount({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleUserCount',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async getUserRoles({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getUserRoles',
            args: [user]
        }) as Promise<Hex[]>;
    },

    // Admin Operations
    async adminConfigureRole({ roleId, config, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'adminConfigureRole',
            args: [roleId, config],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async createNewRole({ name, config, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'createNewRole',
            args: [name, config],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async safeMintForRole({ roleId, to, tokenURI, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'safeMintForRole',
            args: [roleId, to, tokenURI],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async exitRole({ roleId, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'exitRole',
            args: [roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async calculateExitFee({ user, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'calculateExitFee',
            args: [user, roleId]
        }) as Promise<bigint>;
    },

    async addLevelThreshold({ level, threshold, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'addLevelThreshold',
            args: [level, threshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async creditTierConfig({ tier }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'creditTierConfig',
            args: [tier]
        });
    },

    async accountToUser({ account: userAccount }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'accountToUser',
            args: [userAccount]
        }) as Promise<Address>;
    },

    async getAccountCommunity({ account: userAccount }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'accountToCommunity', // Correcting to likely name or will confirm via grep
            args: [userAccount]
        }) as Promise<Address>;
    },

    // Constants (Role IDs)
    async ROLE_COMMUNITY() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_COMMUNITY',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_ENDUSER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_ENDUSER',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_PAYMASTER_SUPER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_PAYMASTER_SUPER',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_PAYMASTER_AOA() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_PAYMASTER_AOA',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_DVT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_DVT',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_KMS() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_KMS',
            args: []
        }) as Promise<Hex>;
    },

    async ROLE_ANODE() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_ANODE',
            args: []
        }) as Promise<Hex>;
    },

    async GTOKEN_STAKING() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async MYSBT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'MYSBT',
            args: []
        }) as Promise<Address>;
    },

    async SUPER_PAYMASTER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async isReputationSource({ source }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'isReputationSource',
            args: [source]
        }) as Promise<boolean>;
    },

    async lastReputationEpoch() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'lastReputationEpoch',
            args: []
        }) as Promise<bigint>;
    },

    // Version
    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
