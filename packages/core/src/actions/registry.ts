import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { RegistryABI } from '../abis/index.js';
import type { RoleConfig } from '../roles.js';

export type RegistryActions = {
    configureRole: (args: { roleId: Hex, config: RoleConfig, account?: Account | Address }) => Promise<Hash>;
    registerRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    registerRoleSelf: (args: { roleId: Hex, data: Hex, account?: Account | Address }) => Promise<Hash>;
    hasRole: (args: { user: Address, roleId: Hex }) => Promise<boolean>;
    unRegisterRole: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    getCreditLimit: (args: { user: Address }) => Promise<bigint>;
    getGlobalReputation: (args: { user: Address }) => Promise<bigint>;
    getRoleConfig: (args: { roleId: Hex }) => Promise<any>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    batchUpdateGlobalReputation: (args: { users: Address[], scores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
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

    async getRoleConfig({ roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'getRoleConfig',
            args: [roleId]
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

    async batchUpdateGlobalReputation({ users, scores, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'batchUpdateGlobalReputation',
            args: [users, scores, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
