import { ethers } from "ethers";
import { AIRACCOUNT_FACTORY_ABI } from "../constants/entrypoint";

// Minimal ABI covering the AAStar AgentRegistry contract (SuperPaymaster-facing).
// Mirrors packages/core/src/abis/AgentRegistry.json. The registry maps agent wallets
// to their human owner and exposes paginated enumeration of an owner's agents.
const AGENT_REGISTRY_ABI = [
  // ── Writes ──
  "function registerAgent(address agentWallet, bytes agentWalletSig) external",
  "function revokeAgent(address agentWallet) external",
  "function deregisterAgent(address agentWallet) external",
  // ── Reads ──
  "function isRegisteredAgent(address agentWallet) external view returns (bool)",
  "function isValidAccount(address account) external view returns (bool)",
  "function getHumanOwner(address agentWallet) external view returns (address)",
  "function getAgentCount(address owner) external view returns (uint256)",
  "function getAgentByIndex(address owner, uint256 index) external view returns (address)",
  "function getAgents(address humanOwner) external view returns (address[])",
  "function getAgentsPage(address owner, uint256 start, uint256 count) external view returns (address[] page)",
  "function agentWalletOwner(address agentWallet) external view returns (address)",
  "function ownerAgents(address owner, uint256 index) external view returns (address)",
  "function balanceOf(address humanOwner) external view returns (uint256)",
  // ── Errors (for decoding reverts) ──
  "error AgentAlreadyRegistered()",
  "error CallerNotAirAccount()",
  "error InvalidAddress()",
  "error InvalidAgentSignature()",
  "error NotAgentOwner()",
  "error SelfRegistrationForbidden()",
];

// ─── Parameter / result types ───────────────────────────────────────────────

export interface CreateAgentAccountParams {
  /** The agent's own signing key (EOA controlled by the agent runtime / KMS). */
  agentKey: string;
  /** ERC-8004-style agent identifier (bytes32) binding this account to an off-chain identity. */
  agentId: string;
  /** The human guardian (guardian2) co-owning the agent account for recovery. */
  guardian2: string;
  /** Guardian2's acceptance signature over the creation hash (EIP-191). */
  guardian2Sig: string;
  /** The agent key's acceptance signature over the creation hash (EIP-191). */
  agentKeySig: string;
  /** Unix timestamp (uint48) after which the signatures are rejected. */
  deadline: bigint | number;
  /** Daily transfer limit in wei (on-chain guard enforcement; V7 requires > 0). */
  dailyLimit: bigint;
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * AgentRegistryService — typed wrappers for the AAStar AgentRegistry contract plus the
 * AAStarAirAccountFactoryV7 agent-account creation helpers.
 *
 * **Two contracts, two responsibilities:**
 *
 * 1. AgentRegistry (constructor `registryAddress`) — the canonical map of agent wallet →
 *    human owner used by SuperPaymaster to authorise gasless sponsorship. The factory calls
 *    `markValid`/registers the agent at deployment; humans manage the binding afterwards via
 *    `registerAgent` / `revokeAgent` / `deregisterAgent`.
 *
 * 2. AAStarAirAccountFactoryV7 — deploys an agent-owned AirAccount. `encodeCreateAgentAccount`
 *    targets the factory (NOT the registry); `getAgentAccountAddress` predicts the CREATE2
 *    address before deployment.
 *
 * All `encode*` methods return ABI-encoded calldata ready for a UserOp (gasless) or a direct
 * owner transaction. Read methods require a provider (or a signer with an attached provider).
 */
export class AgentRegistryService {
  private readonly contract: ethers.Contract;
  private readonly iface: ethers.Interface;
  private readonly factoryIface: ethers.Interface;
  private readonly providerOrSigner: ethers.Provider | ethers.Signer;

  /**
   * @param providerOrSigner ethers Provider (reads only) or Signer (reads + sends).
   * @param registryAddress  deployed AgentRegistry contract address.
   */
  constructor(
    providerOrSigner: ethers.Provider | ethers.Signer,
    private readonly registryAddress: string
  ) {
    this.providerOrSigner = providerOrSigner;
    this.contract = new ethers.Contract(registryAddress, AGENT_REGISTRY_ABI, providerOrSigner);
    this.iface = new ethers.Interface(AGENT_REGISTRY_ABI);
    this.factoryIface = new ethers.Interface(AIRACCOUNT_FACTORY_ABI);
  }

  // ── AgentRegistry calldata encoders ─────────────────────────────────────────

  /**
   * Encode calldata for `registerAgent(agentWallet, agentWalletSig)`.
   *
   * Binds `agentWallet` to the caller (the human owner). `agentWalletSig` must be the agent
   * wallet's EIP-191 signature proving control of the key. Reverts with
   * `SelfRegistrationForbidden` if the caller registers itself, or `AgentAlreadyRegistered`
   * if the wallet is already bound.
   */
  encodeRegisterAgent(agentWallet: string, agentWalletSig: string): string {
    return this.iface.encodeFunctionData("registerAgent", [agentWallet, agentWalletSig]);
  }

  /**
   * Encode calldata for `revokeAgent(agentWallet)`.
   *
   * Owner-initiated revocation of a previously registered agent wallet. Caller must be the
   * agent's human owner (else `NotAgentOwner`).
   */
  encodeRevokeAgent(agentWallet: string): string {
    return this.iface.encodeFunctionData("revokeAgent", [agentWallet]);
  }

  /**
   * Encode calldata for `deregisterAgent(agentWallet)`.
   *
   * Removes the agent wallet from the registry (full deregistration, distinct from the
   * lighter-weight `revokeAgent`). Caller must be the agent's human owner.
   */
  encodeDeregisterAgent(agentWallet: string): string {
    return this.iface.encodeFunctionData("deregisterAgent", [agentWallet]);
  }

  // ── AgentRegistry on-chain reads ────────────────────────────────────────────

  /** Whether `agentWallet` is currently registered in the registry. */
  async isRegisteredAgent(agentWallet: string): Promise<boolean> {
    return this.contract.isRegisteredAgent(agentWallet) as Promise<boolean>;
  }

  /** Whether `account` has been marked valid (e.g. an AirAccount minted by the bound factory). */
  async isValidAccount(account: string): Promise<boolean> {
    return this.contract.isValidAccount(account) as Promise<boolean>;
  }

  /** The human owner bound to `agentWallet` (ZeroAddress if unregistered). */
  async getHumanOwner(agentWallet: string): Promise<string> {
    return this.contract.getHumanOwner(agentWallet) as Promise<string>;
  }

  /** Number of agents registered under `owner`. */
  async getAgentCount(owner: string): Promise<bigint> {
    return BigInt(await this.contract.getAgentCount(owner));
  }

  /** The agent wallet at `index` in `owner`'s agent list. */
  async getAgentByIndex(owner: string, index: bigint | number): Promise<string> {
    return this.contract.getAgentByIndex(owner, index) as Promise<string>;
  }

  /** Full list of agent wallets registered under `humanOwner`. */
  async getAgents(humanOwner: string): Promise<string[]> {
    const result = (await this.contract.getAgents(humanOwner)) as string[];
    // Normalise the ethers Result proxy into a plain array.
    return Array.from(result);
  }

  /**
   * Paginated slice of `owner`'s agent wallets: `count` entries starting at `start`.
   * The contract clamps `count` to the remaining length, so the returned array may be shorter.
   */
  async getAgentsPage(
    owner: string,
    start: bigint | number,
    count: bigint | number
  ): Promise<string[]> {
    const result = (await this.contract.getAgentsPage(owner, start, count)) as string[];
    return Array.from(result);
  }

  /** Raw `agentWalletOwner` mapping read (agentWallet → owner). */
  async agentWalletOwner(agentWallet: string): Promise<string> {
    return this.contract.agentWalletOwner(agentWallet) as Promise<string>;
  }

  /** Raw `ownerAgents` array read (owner, index → agentWallet). */
  async ownerAgents(owner: string, index: bigint | number): Promise<string> {
    return this.contract.ownerAgents(owner, index) as Promise<string>;
  }

  // ── Factory agent-account helpers (AAStarAirAccountFactoryV7) ───────────────

  /**
   * Encode calldata for the factory's `createAgentAccount(...)`.
   *
   * Targets the AAStarAirAccountFactoryV7, NOT the AgentRegistry. The factory deploys the agent
   * AirAccount and registers it in the bound AgentRegistry in one transaction. Submit this
   * calldata to the factory address (direct tx or via a relayer).
   */
  encodeCreateAgentAccount(params: CreateAgentAccountParams): string {
    return this.factoryIface.encodeFunctionData("createAgentAccount", [
      params.agentKey,
      params.agentId,
      params.guardian2,
      params.guardian2Sig,
      params.agentKeySig,
      params.deadline,
      params.dailyLimit,
    ]);
  }

  /**
   * Encode calldata for the factory's `setAgentRegistry(_agentRegistry)` (factory-admin only).
   */
  encodeSetAgentRegistry(agentRegistry: string): string {
    return this.factoryIface.encodeFunctionData("setAgentRegistry", [agentRegistry]);
  }

  /**
   * Predict the CREATE2 address of an agent account via the factory's `getAgentAddress(...)`.
   *
   * @param factoryAddress AAStarAirAccountFactoryV7 address.
   * @param humanOwner     the human guardian/owner co-owning the agent account.
   * @param agentKey       the agent's signing key.
   * @param agentId        the bytes32 agent identifier.
   */
  async getAgentAccountAddress(
    factoryAddress: string,
    humanOwner: string,
    agentKey: string,
    agentId: string
  ): Promise<string> {
    const factory = new ethers.Contract(
      factoryAddress,
      AIRACCOUNT_FACTORY_ABI,
      this.providerOrSigner
    );
    return factory.getAgentAddress(humanOwner, agentKey, agentId) as Promise<string>;
  }

  /** Read the AgentRegistry address currently bound to the factory. */
  async getFactoryAgentRegistry(factoryAddress: string): Promise<string> {
    const factory = new ethers.Contract(
      factoryAddress,
      AIRACCOUNT_FACTORY_ABI,
      this.providerOrSigner
    );
    return factory.agentRegistry() as Promise<string>;
  }
}
