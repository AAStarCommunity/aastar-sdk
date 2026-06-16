import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
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

    // ── Agent-account lifecycle ───────────────────────────────────────────────
    // agentRegistry() -> address: AgentRegistry bound to this factory (the createAgentAccount target registry).
    agentRegistry: () => Promise<Address>;
    // getAgentAddress(address humanOwner, address agentKey, bytes32 agentId) -> address:
    // CREATE2 prediction of the agent AirAccount before deployment.
    getAgentAddress: (args: { humanOwner: Address, agentKey: Address, agentId: Hex }) => Promise<Address>;
    // createAgentAccount(address agentKey, bytes32 agentId, address guardian2, bytes guardian2Sig,
    //   bytes agentKeySig, uint48 deadline, uint256 dailyLimit) -> address account:
    // Deploys the agent AirAccount (co-owned by the human guardian2) and registers it in the bound
    // AgentRegistry in one transaction. Args forwarded in exact ABI order.
    createAgentAccount: (args: {
        agentKey: Address,
        agentId: Hex,
        guardian2: Address,
        guardian2Sig: Hex,
        agentKeySig: Hex,
        deadline: bigint | number,
        dailyLimit: bigint,
        account?: Account | Address,
    }) => Promise<Hash>;
    // setAgentRegistry(address _agentRegistry): factory-admin-only setter for the bound AgentRegistry.
    setAgentRegistry: (args: { agentRegistry: Address, account?: Account | Address }) => Promise<Hash>;
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

    async agentRegistry() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'agentRegistry', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'agentRegistry');
        }
    },

    async getAgentAddress({ humanOwner, agentKey, agentId }) {
        try {
            validateAddress(humanOwner, 'humanOwner');
            validateAddress(agentKey, 'agentKey');
            validateRequired(agentId, 'agentId');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAgentAddress', args: [humanOwner, agentKey, agentId]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgentAddress');
        }
    },

    async createAgentAccount({ agentKey, agentId, guardian2, guardian2Sig, agentKeySig, deadline, dailyLimit, account }) {
        try {
            validateAddress(agentKey, 'agentKey');
            validateRequired(agentId, 'agentId');
            validateAddress(guardian2, 'guardian2');
            validateRequired(guardian2Sig, 'guardian2Sig');
            validateRequired(agentKeySig, 'agentKeySig');
            // Args forwarded in exact ABI order:
            // (agentKey, agentId, guardian2, guardian2Sig, agentKeySig, deadline, dailyLimit)
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'createAgentAccount',
                args: [agentKey, agentId, guardian2, guardian2Sig, agentKeySig, deadline, dailyLimit],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createAgentAccount');
        }
    },

    async setAgentRegistry({ agentRegistry, account }) {
        try {
            validateAddress(agentRegistry, 'agentRegistry');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setAgentRegistry', args: [agentRegistry],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAgentRegistry');
        }
    },
});
