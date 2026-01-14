import {
    type Address,
    type PublicClient,
    type WalletClient,
    type Hex,
    type Hash,
    type Account,
    keccak256,
    toHex
} from 'viem';
import { RegistryABI } from '../abis/index.js';
import type { RoleConfig } from '../roles.js';

export type RegistryActions = {
    // Role Management
    registryConfigureRole: (args: { roleId: Hex, config: RoleConfig, account?: Account | Address }) => Promise<Hash>;
    registryRegisterRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    registryRegisterRoleSelf: (args: { roleId: Hex, data: Hex, account?: Account | Address }) => Promise<Hash>;
    registryHasRole: (args: { user: Address, roleId: Hex }) => Promise<boolean>;
    registryUnRegisterRole: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    registryGetRoleConfig: (args: { roleId: Hex }) => Promise<any>;
    registrySetRoleLockDuration: (args: { roleId: Hex, duration: bigint, account?: Account | Address }) => Promise<Hash>;
    registrySetRoleOwner: (args: { roleId: Hex, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    registryIsCommunityMember: (args: { community: Address, user: Address }) => Promise<boolean>;
    registryCommunityByName: (args: { name: string }) => Promise<Address>;
    registryCommunityByENS: (args: { ensName: string }) => Promise<Address>;
    registryCommunityByNameV3: (args: { name: string }) => Promise<Address>; // Alias for V3 compatibility
    registryCommunityByENSV3: (args: { ensName: string }) => Promise<Address>; // Alias for V3 compatibility
    registryProposedRoleNames: (args: { roleId: Hex }) => Promise<string>;
    registryExecutedProposals: (args: { proposalId: bigint }) => Promise<boolean>;
    
    // Registry Storage Getters
    registryGetAccountCommunity: (args: { account: Address }) => Promise<Address>;
    registryLastReputationEpoch: () => Promise<bigint>;
    registryIsReputationSource: (args: { source: Address }) => Promise<boolean>;
    registryRoleCounts: (args: { roleId: Hex }) => Promise<bigint>;
    registryRoleMembers: (args: { roleId: Hex, index: bigint }) => Promise<Address>;
    registryRoleMemberIndex: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    registryRoleMetadata: (args: { roleId: Hex, user?: Address }) => Promise<Hex>;
    registryRoleStakes: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    registryRoleSBTTokenIds: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    registryUserRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    registryUserRoleCount: (args: { user: Address }) => Promise<bigint>;
    
    // Reputation
    registryGlobalReputation: (args: { user: Address }) => Promise<bigint>;
    registryBatchUpdateGlobalReputation: (args: { users: Address[], scores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Blacklist Management
    registryUpdateOperatorBlacklist: (args: { operator: Address, users: Address[], statuses: boolean[], proof: Hex, account?: Account | Address }) => Promise<Hash>;
    registryIsOperatorBlacklisted: (args: { operator: Address }) => Promise<boolean>;
    
    // Contract References
    registrySetBLSValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    registrySetBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    registrySetMySBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    registrySetSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    registrySetStaking: (args: { staking: Address, account?: Account | Address }) => Promise<Hash>;
    registrySetReputationSource: (args: { source: Address, account?: Account | Address }) => Promise<Hash>;
    registryBlsValidator: () => Promise<Address>;
    registryBlsAggregator: () => Promise<Address>;
    registryMySBT: () => Promise<Address>;
    registrySuperPaymaster: () => Promise<Address>;
    registryStaking: () => Promise<Address>;
    registryReputationSource: () => Promise<Address>;
    
    // Admin
    registryTransferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    registryOwner: () => Promise<Address>;
    registryRenounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // View Functions
    registryRoleConfigs: (args: { roleId: Hex }) => Promise<any>;
    registryGetRoleMemberCount: (args: { roleId: Hex }) => Promise<bigint>; // Alias for getRoleUserCount
    registryLevelThresholds: (args: { level: bigint }) => Promise<bigint>;
    
    // Role Metadata & Members
    registryRoleLockDurations: (args: { roleId: Hex }) => Promise<bigint>;
    registryRoleOwners: (args: { roleId: Hex }) => Promise<Address>;
    registryGetRoleMembers: (args: { roleId: Hex }) => Promise<Address[]>;
    registryGetRoleUserCount: (args: { roleId: Hex }) => Promise<bigint>;
    registryGetUserRoles: (args: { user: Address }) => Promise<Hex[]>;
    
    registryExitRole: (args: { roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    registryCalculateExitFee: (args: { roleId: Hex, amount: bigint }) => Promise<bigint>;
    registryAddLevelThreshold: (args: { threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    registrySetLevelThreshold: (args: { index: bigint, threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    registryAccountToUser: (args: { account: Address }) => Promise<Address>;
    
    // Credit & Tiers
    registryGetCreditLimit: (args: { user: Address }) => Promise<bigint>;
    registrySetCreditTier: (args: { level: bigint, limit: bigint, account?: Account | Address }) => Promise<Hash>;
    registryCreditTierConfig: (args: { level: bigint }) => Promise<bigint>;
 
    // Role Admin (Restored)
    registryAdminConfigureRole: (args: { roleId: Hex, minStake: bigint, entryBurn: bigint, exitFeePercent: number, minExitFee: bigint, account?: Account | Address }) => Promise<Hash>;
    registryCreateNewRole: (args: { roleId: Hex, config: RoleConfig, roleOwner: Address, account?: Account | Address }) => Promise<Hash>;
    registrySafeMintForRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Constants (Role IDs)
    registryROLE_COMMUNITY: () => Promise<Hex>;
    registryROLE_ENDUSER: () => Promise<Hex>;
    registryROLE_PAYMASTER_SUPER: () => Promise<Hex>;
    registryROLE_PAYMASTER_AOA: () => Promise<Hex>;
    registryROLE_DVT: () => Promise<Hex>;
    registryROLE_KMS: () => Promise<Hex>;
    registryROLE_ANODE: () => Promise<Hex>;
    registryGTOKEN_STAKING: () => Promise<Address>;
    registryMYSBT: () => Promise<Address>;
    registrySUPER_PAYMASTER: () => Promise<Address>;
    
    // Version
    registryVersion: () => Promise<string>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
    // Role Management
    async registryConfigureRole({ roleId, config, account }: { roleId: Hex, config: RoleConfig, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'configureRole',
            args: [roleId, config],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryRegisterRole({ roleId, user, data, account }: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [roleId, user, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryRegisterRoleSelf({ roleId, data, account }: { roleId: Hex, data: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [roleId, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryHasRole({ user, roleId }: { user: Address, roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'hasRole',
            args: [roleId, user]
        }) as Promise<boolean>;
    },

    async registryUnRegisterRole({ user, roleId, account }: { user: Address, roleId: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'unregisterRole',
            args: [user, roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryGetRoleConfig({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleConfig',
            args: [roleId]
        });
    },

    async registrySetRoleLockDuration({ roleId, duration, account }: { roleId: Hex, duration: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setRoleLockDuration',
            args: [roleId, duration],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetRoleOwner({ roleId, newOwner, account }: { roleId: Hex, newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setRoleOwner',
            args: [roleId, newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryIsCommunityMember({ community, user }: { community: Address, user: Address }) {
        const ROLE_ENDUSER = await (this as any).registryROLE_ENDUSER();
        return (this as any).registryHasRole({ user, roleId: ROLE_ENDUSER });
    },

    // Credit & Reputation
    async registryGlobalReputation({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'globalReputation',
            args: [user]
        }) as Promise<bigint>;
    },

    async registryBatchUpdateGlobalReputation({ users, scores, epoch, proof, account }: { users: Address[], scores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) {
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
    async registryUpdateOperatorBlacklist({ operator, users, statuses, proof, account }: { operator: Address, users: Address[], statuses: boolean[], proof: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'updateOperatorBlacklist',
            args: [operator, users, statuses, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryIsOperatorBlacklisted({ operator }: { operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'isOperatorBlacklisted',
            args: [operator]
        }) as Promise<boolean>;
    },

    // Contract References
    async registrySetBLSValidator({ validator, account }: { validator: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setBLSValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetBLSAggregator({ aggregator, account }: { aggregator: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setBLSAggregator',
            args: [aggregator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetMySBT({ sbt, account }: { sbt: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setMySBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetSuperPaymaster({ paymaster, account }: { paymaster: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetStaking({ staking, account }: { staking: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setStaking',
            args: [staking],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetReputationSource({ source, account }: { source: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setReputationSource',
            args: [source],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryBlsValidator() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'blsValidator',
            args: []
        }) as Promise<Address>;
    },

    async registryBlsAggregator() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'blsAggregator',
            args: []
        }) as Promise<Address>;
    },

    async registryMySBT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'MYSBT',
            args: []
        }) as Promise<Address>;
    },

    async registrySuperPaymaster() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async registryStaking() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async registryReputationSource() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'reputationSource',
            args: []
        }) as Promise<Address>;
    },

    // Admin
    async registryTransferOwnership({ newOwner, account }: { newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryOwner() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async registryRenounceOwnership({ account }: { account?: Account | Address }) {
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
    async registryRoleConfigs({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleConfigs',
            args: [roleId]
        });
    },

    async registryRoleCounts({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleCounts',
            args: [roleId]
        }) as Promise<bigint>;
    },

    // Alias: getRoleMemberCount maps to contract's getRoleUserCount
    async registryGetRoleMemberCount({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleUserCount',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async registryRoleMembers({ roleId, index }: { roleId: Hex, index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMembers',
            args: [roleId, index]
        }) as Promise<Address>;
    },

    async registryUserRoles({ user, index }: { user: Address, index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'userRoles',
            args: [user, index]
        }) as Promise<Hex>;
    },

    async registryUserRoleCount({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'userRoleCount',
            args: [user]
        }) as Promise<bigint>;
    },

    async registryLevelThresholds({ level }: { level: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'levelThresholds',
            args: [level]
        }) as Promise<bigint>;
    },

    async registryExecutedProposals({ proposalId }: { proposalId: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'executedProposals',
            args: [proposalId]
        }) as Promise<boolean>;
    },

    // Community lookup functions
    async registryCommunityByName({ name }: { name: string }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'communityByName',
            args: [name]
        }) as Promise<Address>;
    },

    async registryCommunityByENS({ ensName }: { ensName: string }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'communityByENS',
            args: [ensName]
        }) as Promise<Address>;
    },

    async registryCommunityByNameV3({ name }: { name: string }) {
        return (this as any).registryCommunityByName({ name });
    },

    async registryCommunityByENSV3({ ensName }: { ensName: string }) {
        return (this as any).registryCommunityByENS({ ensName });
    },

    async registryProposedRoleNames({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'proposedRoleNames',
            args: [roleId]
        }) as Promise<string>;
    },

    // Role Metadata & Members
    async registryRoleLockDurations({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleLockDurations',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async registryRoleMetadata({ roleId, user }: { roleId: Hex, user?: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMetadata',
            args: user ? [roleId, user] : [roleId]
        }) as Promise<Hex>;
    },

    async registryRoleStakes({ roleId, user }: { roleId: Hex, user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleStakes',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async registryRoleSBTTokenIds({ roleId, user }: { roleId: Hex, user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleSBTTokenIds',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async registryRoleOwners({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleOwners',
            args: [roleId]
        }) as Promise<Address>;
    },

    async registryRoleMemberIndex({ roleId, user }: { roleId: Hex, user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'roleMemberIndex',
            args: [roleId, user]
        }) as Promise<bigint>;
    },

    async registryGetRoleMembers({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleMembers',
            args: [roleId]
        }) as Promise<Address[]>;
    },

    async registryGetRoleUserCount({ roleId }: { roleId: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleUserCount',
            args: [roleId]
        }) as Promise<bigint>;
    },

    async registryGetUserRoles({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getUserRoles',
            args: [user]
        }) as Promise<Hex[]>;
    },

    async registryExitRole({ roleId, account }: { roleId: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'exitRole',
            args: [roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryCalculateExitFee({ roleId, amount }: { roleId: Hex, amount: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'calculateExitFee',
            args: [roleId, amount]
        }) as Promise<bigint>;
    },

    async registryAddLevelThreshold({ threshold, account }: { threshold: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'addLevelThreshold',
            args: [threshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySetLevelThreshold({ index, threshold, account }: { index: bigint, threshold: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setLevelThreshold',
            args: [index, threshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryAccountToUser({ account: userAccount }: { account: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'accountToUser',
            args: [userAccount]
        }) as Promise<Address>;
    },

    // Credit & Tiers
    async registryGetCreditLimit({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getCreditLimit',
            args: [user]
        }) as Promise<bigint>;
    },

    async registrySetCreditTier({ level, limit, account }: { level: bigint, limit: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'setCreditTier',
            args: [level, limit],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryCreditTierConfig({ level }: { level: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'creditTierConfig',
            args: [level]
        }) as Promise<bigint>;
    },

    // Role Admin
    async registryAdminConfigureRole({ roleId, minStake, entryBurn, exitFeePercent, minExitFee, account }: { roleId: Hex, minStake: bigint, entryBurn: bigint, exitFeePercent: number, minExitFee: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'adminConfigureRole',
            args: [roleId, minStake, entryBurn, exitFeePercent, minExitFee],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryCreateNewRole({ roleId, config, roleOwner, account }: { roleId: Hex, config: RoleConfig, roleOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'createNewRole',
            args: [roleId, config, roleOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registrySafeMintForRole({ roleId, user, data, account }: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'safeMintForRole',
            args: [roleId, user, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registryGetAccountCommunity({ account: userAccount }: { account: Address }) {
        // Check if user has COMMUNITY role
        const COMMUNITY_ROLE_ID = '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex;
        const hasRole = await (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'hasRole',
            args: [userAccount, COMMUNITY_ROLE_ID]
        }) as boolean;

        if (!hasRole) {
            return '0x0000000000000000000000000000000000000000' as Address;
        }

        // Get role data which contains the community token address
        const roleData = await (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleData',
            args: [userAccount, COMMUNITY_ROLE_ID]
        }) as Hex;

        // Parse community token from role data (first 20 bytes after removing 0x)
        if (!roleData || roleData === '0x') {
            return '0x0000000000000000000000000000000000000000' as Address;
        }
        
        // Community token is at bytes 0-19 of roleData
        const tokenAddress = ('0x' + roleData.slice(2, 42)) as Address;
        return tokenAddress;
    },

    // Constants (Role IDs)
    async registryROLE_COMMUNITY() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_COMMUNITY',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_ENDUSER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_ENDUSER',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_PAYMASTER_SUPER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_PAYMASTER_SUPER',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_PAYMASTER_AOA() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_PAYMASTER_AOA',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_DVT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_DVT',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_KMS() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_KMS',
            args: []
        }) as Promise<Hex>;
    },

    async registryROLE_ANODE() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'ROLE_ANODE',
            args: []
        }) as Promise<Hex>;
    },

    async registryGTOKEN_STAKING() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'GTOKEN_STAKING',
            args: []
        }) as Promise<Address>;
    },

    async registryMYSBT() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'MYSBT',
            args: []
        }) as Promise<Address>;
    },

    async registrySUPER_PAYMASTER() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async registryIsReputationSource({ source }: { source: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'isReputationSource',
            args: [source]
        }) as Promise<boolean>;
    },

    async registryLastReputationEpoch() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'lastReputationEpoch',
            args: []
        }) as Promise<bigint>;
    },

    // Version
    async registryVersion() {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
