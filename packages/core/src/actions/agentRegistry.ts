import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { AgentRegistryABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type AgentRegistryActions = {
    // ── Reads ───────────────────────────────────────────────────────────────
    deployer: () => Promise<Address>;
    factory: () => Promise<Address>;
    // isRegisteredAgent(address agentWallet) -> bool: true once the agent wallet is bound to a human owner.
    isRegisteredAgent: (args: { agentWallet: Address }) => Promise<boolean>;
    // isValidAccount(address account) -> bool: true for factory-deployed accounts flagged via markValid.
    isValidAccount: (args: { account: Address }) => Promise<boolean>;
    // getHumanOwner(address agentWallet) -> address: the human owner that registered the agent wallet.
    getHumanOwner: (args: { agentWallet: Address }) => Promise<Address>;
    // agentWalletOwner(address agentWallet) -> address: raw mapping getter (agent wallet -> human owner).
    agentWalletOwner: (args: { agentWallet: Address }) => Promise<Address>;
    // getAgentCount(address owner) -> uint256: number of agent wallets registered under a human owner.
    getAgentCount: (args: { owner: Address }) => Promise<bigint>;
    // getAgents(address humanOwner) -> address[]: all agent wallets registered under a human owner.
    getAgents: (args: { humanOwner: Address }) => Promise<Address[]>;
    // getAgentsPage(address owner, uint256 start, uint256 count) -> address[]: paginated agent wallet list.
    getAgentsPage: (args: { owner: Address, start: bigint, count: bigint }) => Promise<Address[]>;
    // getAgentByIndex(address owner, uint256 index) -> address: agent wallet at a position in the owner's list.
    getAgentByIndex: (args: { owner: Address, index: bigint }) => Promise<Address>;
    // ownerAgents(address owner, uint256 index) -> address: raw array getter (owner -> agent wallet at index).
    ownerAgents: (args: { owner: Address, index: bigint }) => Promise<Address>;

    // ── Writes ──────────────────────────────────────────────────────────────
    bindFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    markValid: (args: { account: Address, signer?: Account | Address }) => Promise<Hash>;
    // ⚠️ registerAgent / revokeAgent / deregisterAgent require `msg.sender` to be a
    // factory-created VALID AirAccount (the contract checks `isValidAccount[msg.sender]`,
    // else reverts `CallerNotAirAccount`). They CANNOT be called from a bare EOA. These
    // wrappers encode the correct call, but the on-chain caller must be an agent AirAccount
    // — route them through `airAccountActions(agentAccount).executeFromExecutor` /
    // the account's `execute(registry, 0, calldata)` (owner-signed). The registry's
    // "humanOwner" recorded is that AirAccount address, not the owner EOA. Verified on
    // Sepolia (Beta4 Phase 2 E2E): register tx 0x0ee94102…, revoke tx 0x68d0c3e7…
    //
    // registerAgent(address agentWallet, bytes agentWalletSig): binds an agent wallet,
    // proving control via the agent wallet's EIP-191 sig over the REGISTER_AGENT payload.
    registerAgent: (args: { agentWallet: Address, agentWalletSig: Hex, account?: Account | Address }) => Promise<Hash>;
    // revokeAgent(address agentWallet): owner-initiated revocation (see caller caveat above).
    revokeAgent: (args: { agentWallet: Address, account?: Account | Address }) => Promise<Hash>;
    // deregisterAgent(address agentWallet): remove an agent wallet binding (see caller caveat above).
    deregisterAgent: (args: { agentWallet: Address, account?: Account | Address }) => Promise<Hash>;
};

const ABI = AgentRegistryABI;

export const agentRegistryActions = (address: Address) => (client: PublicClient | WalletClient): AgentRegistryActions => ({
    async deployer() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'deployer', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deployer');
        }
    },

    async factory() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'factory', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'factory');
        }
    },

    async isRegisteredAgent({ agentWallet }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'isRegisteredAgent', args: [agentWallet]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isRegisteredAgent');
        }
    },

    async isValidAccount({ account }) {
        try {
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'isValidAccount', args: [account]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isValidAccount');
        }
    },

    async getHumanOwner({ agentWallet }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getHumanOwner', args: [agentWallet]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getHumanOwner');
        }
    },

    async agentWalletOwner({ agentWallet }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'agentWalletOwner', args: [agentWallet]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'agentWalletOwner');
        }
    },

    async getAgentCount({ owner }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAgentCount', args: [owner]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgentCount');
        }
    },

    async getAgents({ humanOwner }) {
        try {
            validateAddress(humanOwner, 'humanOwner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAgents', args: [humanOwner]
            }) as Address[];
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgents');
        }
    },

    async getAgentsPage({ owner, start, count }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAgentsPage', args: [owner, start, count]
            }) as Address[];
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgentsPage');
        }
    },

    async getAgentByIndex({ owner, index }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'getAgentByIndex', args: [owner, index]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgentByIndex');
        }
    },

    async ownerAgents({ owner, index }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'ownerAgents', args: [owner, index]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ownerAgents');
        }
    },

    async bindFactory({ factory, account }) {
        try {
            validateAddress(factory, 'factory');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'bindFactory', args: [factory],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'bindFactory');
        }
    },

    // markValid(address account): flags an account as a factory-deployed valid agent.
    async markValid({ account: target, signer }) {
        try {
            validateAddress(target, 'account');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'markValid', args: [target],
                account: signer as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'markValid');
        }
    },

    async registerAgent({ agentWallet, agentWalletSig, account }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            validateRequired(agentWalletSig, 'agentWalletSig');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'registerAgent', args: [agentWallet, agentWalletSig],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerAgent');
        }
    },

    async revokeAgent({ agentWallet, account }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'revokeAgent', args: [agentWallet],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'revokeAgent');
        }
    },

    async deregisterAgent({ agentWallet, account }) {
        try {
            validateAddress(agentWallet, 'agentWallet');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'deregisterAgent', args: [agentWallet],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deregisterAgent');
        }
    },
});
