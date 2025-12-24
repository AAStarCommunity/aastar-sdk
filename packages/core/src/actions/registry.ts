import { type Address, type PublicClient, type WalletClient, type Hex, type Hash } from 'viem';
import { RegistryABI } from '../abis/index.js';

export type RegistryActions = {
    registerRole: (args: { roleId: Hex, user: Address, roleData: Hex, account?: Address }) => Promise<Hash>;
    registerRoleSelf: (args: { roleId: Hex, roleData: Hex, account?: Address }) => Promise<Hash>;
    hasRole: (args: { roleId: Hex, user: Address }) => Promise<boolean>;
    getCreditLimit: (args: { user: Address }) => Promise<bigint>;
    getGlobalReputation: (args: { user: Address }) => Promise<bigint>;
    getRoleConfig: (args: { roleId: Hex }) => Promise<any>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
    async registerRole({ roleId, user, roleData, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [roleId, user, roleData],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registerRoleSelf({ roleId, roleData, account }) {
        return (client as any).writeContract({
            address,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [roleId, roleData],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async hasRole({ roleId, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: RegistryABI,
            functionName: 'hasRole',
            args: [roleId, user]
        }) as Promise<boolean>;
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
    }
});
