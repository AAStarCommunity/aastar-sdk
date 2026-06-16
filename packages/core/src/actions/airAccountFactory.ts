import { type Address, type PublicClient, type WalletClient, type Hex } from 'viem';
import { AAStarAirAccountFactoryV7ABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';
import type { InitConfig } from './airAccount.js';

export type AirAccountFactoryActions = {
    // CREATE2 address prediction with full InitConfig + chain-qualified id.
    getAddressWithChainId: (args: { owner: Address, salt: bigint, config: InitConfig }) => Promise<{ account: Address, chainQualified: Hex }>;
    // CREATE2 address prediction using factory defaults (guard, validator, dailyLimit).
    getAddressWithDefaults: (args: { owner: Address, salt: bigint, guard: Address, validator: Address, dailyLimit: bigint }) => Promise<Address>;
    // Chain-qualified id for an already-known account address.
    getChainQualifiedAddress: (args: { account: Address }) => Promise<Hex>;
    // Account implementation behind the factory's CREATE2 proxies.
    implementation: () => Promise<Address>;
    // Factory admin (owns default config + implementation pointer).
    factoryAdmin: () => Promise<Address>;
    // Guardian injected into accounts that opt into the community default.
    defaultCommunityGuardian: () => Promise<Address>;
};

const ABI = AAStarAirAccountFactoryV7ABI;

export const airAccountFactoryActions = (address: Address) => (client: PublicClient | WalletClient): AirAccountFactoryActions => ({
    async getAddressWithChainId({ owner, salt, config }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(config, 'config');
            const r = await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAddressWithChainId', args: [owner, salt, config]
            }) as readonly [Address, Hex];
            return { account: r[0], chainQualified: r[1] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAddressWithChainId');
        }
    },

    async getAddressWithDefaults({ owner, salt, guard, validator, dailyLimit }) {
        try {
            validateAddress(owner, 'owner');
            validateAddress(guard, 'guard');
            validateAddress(validator, 'validator');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAddressWithDefaults', args: [owner, salt, guard, validator, dailyLimit]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAddressWithDefaults');
        }
    },

    async getChainQualifiedAddress({ account }) {
        try {
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getChainQualifiedAddress', args: [account]
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getChainQualifiedAddress');
        }
    },

    async implementation() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'implementation', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'implementation');
        }
    },

    async factoryAdmin() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'factoryAdmin', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'factoryAdmin');
        }
    },

    async defaultCommunityGuardian() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'defaultCommunityGuardian', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'defaultCommunityGuardian');
        }
    },
});
