import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { AAStarAirAccountFactoryV7ABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';
import type { InitConfig } from './airAccount.js';

export type AirAccountFactoryActions = {
    // CREATE2 address prediction with full InitConfig + chain-qualified id (v0.22.0: 5-arg — the salt
    // binds ownerP256X/Y, so pass the SAME passkey coords as createAccount; omit for no-passkey accounts).
    getAddressWithChainId: (args: { owner: Address, salt: bigint, config: InitConfig, ownerP256X?: Hex, ownerP256Y?: Hex }) => Promise<{ account: Address, chainQualified: Hex }>;
    // CREATE2 address prediction using factory defaults (guard, validator, dailyLimit).
    getAddressWithDefaults: (args: { owner: Address, salt: bigint, guard: Address, validator: Address, dailyLimit: bigint }) => Promise<Address>;
    // getAddress(owner, salt, config, ownerP256X, ownerP256Y) -> CREATE2 prediction (v0.22.0).
    // The clone salt now includes keccak256(configHash, ownerP256X, ownerP256Y), so the SAME passkey
    // coords passed to createAccount MUST be passed here. Omit them (default 0) for no-passkey accounts.
    getAddress: (args: { owner: Address, salt: bigint, config: InitConfig, ownerP256X?: Hex, ownerP256Y?: Hex }) => Promise<Address>;
    // createAccount (v0.22.0, 8 args) -> deploys an AirAccount, optionally injecting the owner WebAuthn
    // passkey (ownerP256X/Y) at birth (no post-deploy setP256Key) and wiring the validator router at birth.
    //  - Direct mode (default): ownerSig "0x", msg.sender must be the owner; nonce/deadline ignored.
    //  - KMS relay mode: pass nonce (from createNonces(owner)), deadline, and the EIP-191 ownerSig over
    //    keccak256("CREATE_ACCOUNT", chainId, factory, owner, salt, ownerP256X, ownerP256Y, configHash, nonce, deadline).
    createAccount: (args: {
        owner: Address, salt: bigint, config: InitConfig,
        ownerP256X?: Hex, ownerP256Y?: Hex, nonce?: bigint, deadline?: bigint, ownerSig?: Hex,
        account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint,
    }) => Promise<Hash>;
    // createNonces(owner) -> the factory's anti-replay nonce for KMS-relay createAccount.
    createNonces: (args: { owner: Address }) => Promise<bigint>;
    // createAccountWithDefaults(owner, salt, guardian1, guardian1Sig, guardian2, guardian2Sig, dailyLimit)
    // -> deploys an AirAccount using the factory's default guard/validator with up to two ECDSA
    // guardians (each authorizing via signature). Args forwarded in exact ABI order.
    createAccountWithDefaults: (args: {
        owner: Address,
        salt: bigint,
        guardian1: Address,
        guardian1Sig: Hex,
        guardian2: Address,
        guardian2Sig: Hex,
        dailyLimit: bigint,
        account?: Account | Address,
        maxFeePerGas?: bigint,
        maxPriorityFeePerGas?: bigint,
    }) => Promise<Hash>;
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
        maxFeePerGas?: bigint,
        maxPriorityFeePerGas?: bigint,
    }) => Promise<Hash>;
    // setAgentRegistry(address _agentRegistry): factory-admin-only setter for the bound AgentRegistry.
    setAgentRegistry: (args: { agentRegistry: Address, account?: Account | Address }) => Promise<Hash>;
};

const ABI = AAStarAirAccountFactoryV7ABI;
/** bytes32(0) — "no passkey" / direct-mode default for the v0.22.0 createAccount/getAddress args. */
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

export const airAccountFactoryActions = (address: Address) => (client: PublicClient | WalletClient): AirAccountFactoryActions => ({
    async getAddress({ owner, salt, config, ownerP256X, ownerP256Y }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(config, 'config');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAddress',
                args: [owner, salt, config, ownerP256X ?? ZERO_BYTES32, ownerP256Y ?? ZERO_BYTES32]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAddress');
        }
    },
    async createAccount({ owner, salt, config, ownerP256X, ownerP256Y, nonce, deadline, ownerSig, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(config, 'config');
            return await (client as WalletClient).writeContract({
                address, abi: ABI, functionName: 'createAccount',
                args: [owner, salt, config, ownerP256X ?? ZERO_BYTES32, ownerP256Y ?? ZERO_BYTES32, nonce ?? 0n, deadline ?? 0n, ownerSig ?? '0x'],
                account: account as any, chain: (client as any).chain,
                ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
                ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createAccount');
        }
    },
    async createNonces({ owner }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'createNonces', args: [owner]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createNonces');
        }
    },
    async createAccountWithDefaults({ owner, salt, guardian1, guardian1Sig, guardian2, guardian2Sig, dailyLimit, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateAddress(owner, 'owner');
            validateAddress(guardian1, 'guardian1');
            validateRequired(guardian1Sig, 'guardian1Sig');
            validateAddress(guardian2, 'guardian2');
            validateRequired(guardian2Sig, 'guardian2Sig');
            // Args forwarded in exact ABI order:
            // (owner, salt, guardian1, guardian1Sig, guardian2, guardian2Sig, dailyLimit)
            return await (client as WalletClient).writeContract({
                address, abi: ABI, functionName: 'createAccountWithDefaults',
                args: [owner, salt, guardian1, guardian1Sig, guardian2, guardian2Sig, dailyLimit],
                account: account as any, chain: (client as any).chain,
                ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
                ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createAccountWithDefaults');
        }
    },
    async getAddressWithChainId({ owner, salt, config, ownerP256X, ownerP256Y }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(config, 'config');
            const r = await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAddressWithChainId',
                args: [owner, salt, config, ownerP256X ?? ZERO_BYTES32, ownerP256Y ?? ZERO_BYTES32]
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

    async createAgentAccount({ agentKey, agentId, guardian2, guardian2Sig, agentKeySig, deadline, dailyLimit, account, maxFeePerGas, maxPriorityFeePerGas }) {
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
                account: account as any, chain: (client as any).chain,
                ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
                ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
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
