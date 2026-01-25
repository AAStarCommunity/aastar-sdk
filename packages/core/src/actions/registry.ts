import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { RegistryABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type RoleConfigDetailed = {
    minStake: bigint;
    entryBurn: bigint;
    slashThreshold: number;
    slashBase: number;
    slashInc: number;
    slashMax: number;
    exitFeePercent: number;
    isActive: boolean;
    minExitFee: bigint;
    description: string;
    owner: Address;
    roleLockDuration: bigint;
};

export type RegistryActions = {
    // Role Management
    configureRole: (args: { roleId: Hex, config: RoleConfigDetailed, account?: Account | Address }) => Promise<Hash>;
    adminConfigureRole: (args: { roleId: Hex, minStake: bigint, entryBurn: bigint, exitFeePercent: bigint, minExitFee: bigint, account?: Account | Address }) => Promise<Hash>;
    createNewRole: (args: { roleId: Hex, config: RoleConfigDetailed, roleOwner: Address, account?: Account | Address }) => Promise<Hash>;
    registerRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    registerRoleSelf: (args: { roleId: Hex, data: Hex, account?: Account | Address }) => Promise<Hash>;
    safeMintForRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    hasRole: (args: { roleId: Hex, user: Address }) => Promise<boolean>;
    getRoleConfig: (args: { roleId: Hex }) => Promise<RoleConfigDetailed>;
    setRoleLockDuration: (args: { roleId: Hex, duration: bigint, account?: Account | Address }) => Promise<Hash>;
    setRoleOwner: (args: { roleId: Hex, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    exitRole: (args: { roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    roleMetadata: (args: { roleId: Hex, user: Address }) => Promise<Hex>;
    
    // Community Management
    communityByName: (args: { name: string }) => Promise<Address>;
    communityByENS: (args: { ensName: string }) => Promise<Address>;
    
    // Credit & Reputation
    getCreditLimit: (args: { user: Address }) => Promise<bigint>;
    globalReputation: (args: { user: Address }) => Promise<bigint>;
    addLevelThreshold: (args: { threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    batchUpdateGlobalReputation: (args: { proposalId: bigint, users: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Contract References
    setBLSValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    setMySBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setStaking: (args: { staking: Address, account?: Account | Address }) => Promise<Hash>;
    setReputationSource: (args: { source: Address, account?: Account | Address }) => Promise<Hash>;
    
    blsValidator: () => Promise<Address>;
    blsAggregator: () => Promise<Address>;
    MYSBT: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    GTOKEN_STAKING: () => Promise<Address>;
    reputationSource: () => Promise<Address>;
    isReputationSource: (args: { source: Address }) => Promise<boolean>;
    lastReputationEpoch: (args: { user: Address }) => Promise<bigint>;
    
    // View Functions
    roleConfigs: (args: { roleId: Hex }) => Promise<RoleConfigDetailed>;
    getRoleUserCount: (args: { roleId: Hex }) => Promise<bigint>;
    getRoleMembers: (args: { roleId: Hex }) => Promise<Address[]>;
    getUserRoles: (args: { user: Address }) => Promise<Hex[]>;
    roleMembers: (args: { roleId: Hex, index: bigint }) => Promise<Address>;
    userRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    userRoleCount: (args: { user: Address }) => Promise<bigint>;
    creditTierConfig: (args: { tierIndex: bigint }) => Promise<bigint>;
    levelThresholds: (args: { levelIndex: bigint }) => Promise<bigint>;
    calculateExitFee: (args: { roleId: Hex, amount: bigint }) => Promise<bigint>;
    accountToUser: (args: { account: Address }) => Promise<Address>;
    roleOwners: (args: { roleId: Hex }) => Promise<Address>;
    roleStakes: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    roleLockDurations: (args: { roleId: Hex }) => Promise<bigint>;
    
    // Constants (Role IDs)
    ROLE_COMMUNITY: () => Promise<Hex>;
    ROLE_ENDUSER: () => Promise<Hex>;
    ROLE_PAYMASTER_SUPER: () => Promise<Hex>;
    ROLE_PAYMASTER_AOA: () => Promise<Hex>;
    ROLE_DVT: () => Promise<Hex>;
    ROLE_KMS: () => Promise<Hex>;
    ROLE_ANODE: () => Promise<Hex>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // AccessControl
    grantRole: (args: { roleId: Hex, user: Address, account?: Account | Address }) => Promise<Hash>;
    revokeRole: (args: { roleId: Hex, user: Address, account?: Account | Address }) => Promise<Hash>;
    
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

    async adminConfigureRole({ roleId, minStake, entryBurn, exitFeePercent, minExitFee, account }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'adminConfigureRole',
                args: [roleId, minStake, entryBurn, exitFeePercent, minExitFee],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'adminConfigureRole');
        }
    },

    async createNewRole({ roleId, config, roleOwner, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(config, 'config');
            validateAddress(roleOwner, 'roleOwner');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'createNewRole',
                args: [roleId, config, roleOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createNewRole');
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

    async safeMintForRole({ roleId, user, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'safeMintForRole',
                args: [roleId, user, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'safeMintForRole');
        }
    },

    async hasRole({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
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

    async getRoleConfig({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleConfig',
                args: [roleId]
            }) as any;
            
            if (Array.isArray(result)) {
                return {
                    minStake: result[0],
                    entryBurn: result[1],
                    slashThreshold: result[2],
                    slashBase: result[3],
                    slashInc: result[4],
                    slashMax: result[5],
                    exitFeePercent: result[6],
                    isActive: result[7],
                    minExitFee: result[8],
                    description: result[9],
                    owner: result[10],
                    roleLockDuration: result[11]
                };
            }
            return result as RoleConfigDetailed;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleConfig');
        }
    },

    async setRoleLockDuration({ roleId, duration, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(duration, 'duration');
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

    async roleMetadata({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleMetadata',
                args: [roleId, user]
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleMetadata');
        }
    },

    // Community Management
    async communityByName({ name }) {
        try {
            validateRequired(name, 'name');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'communityByName',
                args: [name]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByName');
        }
    },

    async communityByENS({ ensName }) {
        try {
            validateRequired(ensName, 'ensName');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'communityByENS',
                args: [ensName]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByENS');
        }
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

    async addLevelThreshold({ threshold, account }) {
        try {
            validateAmount(threshold, 'threshold');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'addLevelThreshold',
                args: [threshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addLevelThreshold');
        }
    },

    async batchUpdateGlobalReputation({ proposalId, users, newScores, epoch, proof, account }) {
        try {
            validateAmount(proposalId, 'proposalId');
            validateRequired(users, 'users');
            validateRequired(newScores, 'newScores');
            validateAmount(epoch, 'epoch');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'batchUpdateGlobalReputation',
                args: [proposalId, users, newScores, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'batchUpdateGlobalReputation');
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

    async lastReputationEpoch({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'lastReputationEpoch',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'lastReputationEpoch');
        }
    },

    // View Functions
    async roleConfigs({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'roleConfigs',
                args: [roleId]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    minStake: result[0],
                    entryBurn: result[1],
                    slashThreshold: result[2],
                    slashBase: result[3],
                    slashInc: result[4],
                    slashMax: result[5],
                    exitFeePercent: result[6],
                    isActive: result[7],
                    minExitFee: result[8],
                    description: result[9],
                    owner: result[10],
                    roleLockDuration: result[11]
                };
            }
            return result as RoleConfigDetailed;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleConfigs');
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

    async roleMembers({ roleId, index }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(index, 'index');
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
            validateRequired(index, 'index');
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

    async creditTierConfig({ tierIndex }) {
        try {
            validateAmount(tierIndex, 'tierIndex');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'creditTierConfig',
                args: [tierIndex]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'creditTierConfig');
        }
    },

    async levelThresholds({ levelIndex }) {
        try {
            validateAmount(levelIndex, 'levelIndex');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'levelThresholds',
                args: [levelIndex]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'levelThresholds');
        }
    },

    async calculateExitFee({ roleId, amount }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAmount(amount, 'amount');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'calculateExitFee',
                args: [roleId, amount]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'calculateExitFee');
        }
    },

    async accountToUser({ account }) {
        try {
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'accountToUser',
                args: [account]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'accountToUser');
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

    // Ownership
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
    
    // AccessControl
    async grantRole({ roleId, user, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'grantRole',
                args: [roleId, user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'grantRole');
        }
    },

    async revokeRole({ roleId, user, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'revokeRole',
                args: [roleId, user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'revokeRole');
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
