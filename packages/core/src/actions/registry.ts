import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { RegistryABI } from '../abis/index.js';
import type { RoleConfig } from '../roles.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

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
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
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
    
    // Version
    version: () => Promise<string>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
    // Role Management
    async configureRole({ roleId, config, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'configureRole',
                args: [roleId, config],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'configureRole');
        }
    },

    async registerRole({ roleId, user, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [roleId, user, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerRole');
        }
    },

    async registerRoleSelf({ roleId, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'registerRoleSelf',
                args: [roleId, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerRoleSelf');
        }
    },

    async hasRole({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'hasRole',
                args: [roleId, user]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'hasRole');
        }
    },

    async unRegisterRole({ user, roleId, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'unregisterRole',
                args: [user, roleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unRegisterRole');
        }
    },

    async getRoleConfig({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleConfig',
                args: [roleId]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleConfig');
        }
    },

    async setRoleLockDuration({ roleId, duration, account }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setRoleLockDuration',
                args: [roleId, duration],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRoleLockDuration');
        }
    },

    async setRoleOwner({ roleId, newOwner, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setRoleOwner',
                args: [roleId, newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRoleOwner');
        }
    },

    // Community Management
    async communityToToken({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'communityToToken',
                args: [community]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityToToken');
        }
    },

    async getCommunityRoleData({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCommunityRoleData',
                args: [community]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityRoleData');
        }
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
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCreditLimit',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCreditLimit');
        }
    },

    async getGlobalReputation({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'globalReputation',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'globalReputation');
        }
    },

    async setCreditTier({ tier, params, account }) {
        try {
            validateAmount(tier, 'tier');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setCreditTier',
                args: [tier, params],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setCreditTier');
        }
    },

    async setLevelThreshold({ level, threshold, account }) {
        try {
            validateAmount(level, 'level');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setLevelThreshold',
                args: [level, threshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setLevelThreshold');
        }
    },

    async batchUpdateGlobalReputation({ users, scores, epoch, proof, account }) {
        try {
            validateRequired(users, 'users');
            validateRequired(scores, 'scores');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'batchUpdateGlobalReputation',
                args: [users, scores, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'batchUpdateGlobalReputation');
        }
    },

    // Blacklist Management
    async updateOperatorBlacklist({ operator, isBlacklisted, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'updateOperatorBlacklist',
                args: [operator, isBlacklisted],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateOperatorBlacklist');
        }
    },

    async isOperatorBlacklisted({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'isOperatorBlacklisted',
                args: [operator]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isOperatorBlacklisted');
        }
    },

    // Contract References
    async setBLSValidator({ validator, account }) {
        try {
            validateAddress(validator, 'validator');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setBLSValidator',
                args: [validator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSValidator');
        }
    },

    async setBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSAggregator');
        }
    },

    async setMySBT({ sbt, account }) {
        try {
            validateAddress(sbt, 'sbt');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setMySBT',
                args: [sbt],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMySBT');
        }
    },

    async setSuperPaymaster({ paymaster, account }) {
        try {
            validateAddress(paymaster, 'paymaster');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setSuperPaymaster',
                args: [paymaster],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymaster');
        }
    },

    async setStaking({ staking, account }) {
        try {
            validateAddress(staking, 'staking');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setStaking',
                args: [staking],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setStaking');
        }
    },

    async setReputationSource({ source, account }) {
        try {
            validateAddress(source, 'source');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setReputationSource',
                args: [source],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setReputationSource');
        }
    },

    async blsValidator() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'blsValidator',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blsValidator');
        }
    },

    async blsAggregator() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'blsAggregator',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blsAggregator');
        }
    },

    async mySBT() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'MYSBT',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mySBT');
        }
    },

    async superPaymaster() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'SUPER_PAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'superPaymaster');
        }
    },

    async staking() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'GTOKEN_STAKING',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'staking');
        }
    },

    async reputationSource() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'reputationSource',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'reputationSource');
        }
    },

    // Admin
    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // View Functions
    async roleConfigs({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleConfigs',
                args: [roleId]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleConfigs');
        }
    },

    async roleCounts({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleCounts',
                args: [roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleCounts');
        }
    },

    // Alias: getRoleMemberCount maps to contract's getRoleUserCount
    async getRoleMemberCount({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleUserCount',
                args: [roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleMemberCount');
        }
    },

    async roleMembers({ roleId, index }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleMembers',
                args: [roleId, index]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleMembers');
        }
    },

    async userRoles({ user, index }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'userRoles',
                args: [user, index]
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userRoles');
        }
    },

    async userRoleCount({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'userRoleCount',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userRoleCount');
        }
    },

    async globalReputation({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'globalReputation',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'globalReputation');
        }
    },

    async creditTiers({ tier }) {
        try {
            validateAmount(tier, 'tier');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'creditTiers',
                args: [tier]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'creditTiers');
        }
    },

    async levelThresholds({ level }) {
        try {
            validateAmount(level, 'level');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'levelThresholds',
                args: [level]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'levelThresholds');
        }
    },

    // Community lookup functions
    async communityByNameV3({ name }) {
        try {
            validateRequired(name, 'name');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'communityByNameV3',
                args: [name]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByNameV3');
        }
    },

    async communityByENSV3({ ensName }) {
        try {
            validateRequired(ensName, 'ensName');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'communityByENSV3',
                args: [ensName]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByENSV3');
        }
    },

    async proposedRoleNames({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'proposedRoleNames',
                args: [roleId]
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposedRoleNames');
        }
    },

    // Role Metadata & Members
    async roleLockDurations({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleLockDurations',
                args: [roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleLockDurations');
        }
    },

    async roleMetadata({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleMetadata',
                args: [roleId]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleMetadata');
        }
    },

    async roleStakes({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleStakes',
                args: [roleId, user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleStakes');
        }
    },

    async roleSBTTokenIds({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleSBTTokenIds',
                args: [roleId, user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleSBTTokenIds');
        }
    },

    async roleOwners({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleOwners',
                args: [roleId]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleOwners');
        }
    },

    async roleMemberIndex({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleMemberIndex',
                args: [roleId, user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleMemberIndex');
        }
    },

    async getRoleMembers({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleMembers',
                args: [roleId]
            }) as Promise<Address[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleMembers');
        }
    },

    async getRoleUserCount({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleUserCount',
                args: [roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleUserCount');
        }
    },

    async getUserRoles({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getUserRoles',
                args: [user]
            }) as Promise<Hex[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserRoles');
        }
    },

    // Admin Operations
    async adminConfigureRole({ roleId, config, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'adminConfigureRole',
                args: [roleId, config],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'adminConfigureRole');
        }
    },

    async createNewRole({ name, config, account }) {
        try {
            validateRequired(name, 'name');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'createNewRole',
                args: [name, config],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createNewRole');
        }
    },

    async safeMintForRole({ roleId, to, tokenURI, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'safeMintForRole',
                args: [roleId, to, tokenURI],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'safeMintForRole');
        }
    },

    async exitRole({ roleId, account }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'exitRole',
                args: [roleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'exitRole');
        }
    },

    async calculateExitFee({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'calculateExitFee',
                args: [user, roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'calculateExitFee');
        }
    },

    async addLevelThreshold({ level, threshold, account }) {
        try {
            validateAmount(level, 'level');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'addLevelThreshold',
                args: [level, threshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addLevelThreshold');
        }
    },

    async creditTierConfig({ tier }) {
        try {
            validateAmount(tier, 'tier');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'creditTierConfig',
                args: [tier]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'creditTierConfig');
        }
    },

    async accountToUser({ account: userAccount }) {
        try {
            validateAddress(userAccount, 'account');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'accountToUser',
                args: [userAccount]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'accountToUser');
        }
    },

    // Constants (Role IDs)
    async ROLE_COMMUNITY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_COMMUNITY',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_COMMUNITY');
        }
    },

    async ROLE_ENDUSER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_ENDUSER',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_ENDUSER');
        }
    },

    async ROLE_PAYMASTER_SUPER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_PAYMASTER_SUPER',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_PAYMASTER_SUPER');
        }
    },

    async ROLE_PAYMASTER_AOA() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_PAYMASTER_AOA',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_PAYMASTER_AOA');
        }
    },

    async ROLE_DVT() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_DVT',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_DVT');
        }
    },

    async ROLE_KMS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_KMS',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_KMS');
        }
    },

    async ROLE_ANODE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'ROLE_ANODE',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ROLE_ANODE');
        }
    },

    async GTOKEN_STAKING() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'GTOKEN_STAKING',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'GTOKEN_STAKING');
        }
    },

    async MYSBT() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'MYSBT',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MYSBT');
        }
    },

    async SUPER_PAYMASTER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'SUPER_PAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPER_PAYMASTER');
        }
    },

    async isReputationSource({ source }) {
        try {
            validateAddress(source, 'source');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'isReputationSource',
                args: [source]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isReputationSource');
        }
    },

    async lastReputationEpoch() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'lastReputationEpoch',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'lastReputationEpoch');
        }
    },

    // Version
    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
