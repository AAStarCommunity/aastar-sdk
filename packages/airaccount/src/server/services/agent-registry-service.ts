import { encodeFunctionData, type Abi, type Address, type Hex, type PublicClient } from "viem";
// The AgentRegistry / EntryPoint / AirAccount ABIs are local human-readable `string[]`
// signatures (not available in @aastar/core), so parseAbi is required to feed them to
// viem's encodeFunctionData / readContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { AIRACCOUNT_FACTORY_ABI, AIRACCOUNT_ABI } from "../constants/entrypoint";

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

// Parsed viem ABIs (loosely typed as `Abi`) used for both calldata encoding and reads.
// Widening to `Abi` mirrors the hub's ViemContract approach: function names are indexed
// dynamically and read return values are cast at the call site.
const REGISTRY_ABI: Abi = parseAbi(AGENT_REGISTRY_ABI as readonly string[]);
const FACTORY_ABI: Abi = parseAbi(AIRACCOUNT_FACTORY_ABI as readonly string[]);
const ACCOUNT_ABI: Abi = parseAbi(AIRACCOUNT_ABI as readonly string[]);

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
 * owner transaction. Read methods require a viem `PublicClient`.
 */
export class AgentRegistryService {
  private readonly client: PublicClient;

  /**
   * @param client          viem PublicClient for on-chain reads (e.g. `ethereum.getProvider()`).
   * @param registryAddress deployed AgentRegistry contract address.
   */
  constructor(
    client: PublicClient,
    private readonly registryAddress: string
  ) {
    this.client = client;
  }

  // ── Composed register/revoke-via-account scenario encoders ──────────────────
  // registerAgent/revokeAgent require msg.sender == the agent account, so they are delivered
  // through the account's execute(registry, 0, calldata). These return the FULL execute
  // calldata to submit TO the agent account (owner-signed) — the scenario-level entry point.

  /** Encode `account.execute(registry, 0, registerAgent(agentWallet, agentWalletSig))`. */
  encodeRegisterAgentViaAccount(agentWallet: string, agentWalletSig: string): string {
    return encodeFunctionData({
      abi: ACCOUNT_ABI,
      functionName: "execute",
      args: [
        this.registryAddress as Address,
        0n,
        this.encodeRegisterAgent(agentWallet, agentWalletSig) as Hex,
      ],
    });
  }

  /** Encode `account.execute(registry, 0, revokeAgent(agentWallet))`. */
  encodeRevokeAgentViaAccount(agentWallet: string): string {
    return encodeFunctionData({
      abi: ACCOUNT_ABI,
      functionName: "execute",
      args: [this.registryAddress as Address, 0n, this.encodeRevokeAgent(agentWallet) as Hex],
    });
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
    return encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "registerAgent",
      args: [agentWallet as Address, agentWalletSig as Hex],
    });
  }

  /**
   * Encode calldata for `revokeAgent(agentWallet)`.
   *
   * Owner-initiated revocation of a previously registered agent wallet. Caller must be the
   * agent's human owner (else `NotAgentOwner`).
   */
  encodeRevokeAgent(agentWallet: string): string {
    return encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "revokeAgent",
      args: [agentWallet as Address],
    });
  }

  /**
   * Encode calldata for `deregisterAgent(agentWallet)`.
   *
   * Removes the agent wallet from the registry (full deregistration, distinct from the
   * lighter-weight `revokeAgent`). Caller must be the agent's human owner.
   */
  encodeDeregisterAgent(agentWallet: string): string {
    return encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "deregisterAgent",
      args: [agentWallet as Address],
    });
  }

  // ── AgentRegistry on-chain reads ────────────────────────────────────────────

  /** Whether `agentWallet` is currently registered in the registry. */
  async isRegisteredAgent(agentWallet: string): Promise<boolean> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "isRegisteredAgent",
      args: [agentWallet as Address],
    })) as boolean;
  }

  /** Whether `account` has been marked valid (e.g. an AirAccount minted by the bound factory). */
  async isValidAccount(account: string): Promise<boolean> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "isValidAccount",
      args: [account as Address],
    })) as boolean;
  }

  /** The human owner bound to `agentWallet` (ZeroAddress if unregistered). */
  async getHumanOwner(agentWallet: string): Promise<string> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "getHumanOwner",
      args: [agentWallet as Address],
    })) as string;
  }

  /** Number of agents registered under `owner`. */
  async getAgentCount(owner: string): Promise<bigint> {
    return BigInt(
      (await this.client.readContract({
        address: this.registryAddress as Address,
        abi: REGISTRY_ABI,
        functionName: "getAgentCount",
        args: [owner as Address],
      })) as bigint
    );
  }

  /** The agent wallet at `index` in `owner`'s agent list. */
  async getAgentByIndex(owner: string, index: bigint | number): Promise<string> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "getAgentByIndex",
      args: [owner as Address, BigInt(index)],
    })) as string;
  }

  /** Full list of agent wallets registered under `humanOwner`. */
  async getAgents(humanOwner: string): Promise<string[]> {
    const result = (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "getAgents",
      args: [humanOwner as Address],
    })) as readonly string[];
    // Normalise the (readonly) viem result into a plain mutable array.
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
    const result = (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "getAgentsPage",
      args: [owner as Address, BigInt(start), BigInt(count)],
    })) as readonly string[];
    return Array.from(result);
  }

  /** Raw `agentWalletOwner` mapping read (agentWallet → owner). */
  async agentWalletOwner(agentWallet: string): Promise<string> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "agentWalletOwner",
      args: [agentWallet as Address],
    })) as string;
  }

  /** Raw `ownerAgents` array read (owner, index → agentWallet). */
  async ownerAgents(owner: string, index: bigint | number): Promise<string> {
    return (await this.client.readContract({
      address: this.registryAddress as Address,
      abi: REGISTRY_ABI,
      functionName: "ownerAgents",
      args: [owner as Address, BigInt(index)],
    })) as string;
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
    return encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "createAgentAccount",
      args: [
        params.agentKey as Address,
        params.agentId as Hex,
        params.guardian2 as Address,
        params.guardian2Sig as Hex,
        params.agentKeySig as Hex,
        BigInt(params.deadline),
        params.dailyLimit,
      ],
    });
  }

  /**
   * Encode calldata for the factory's `setAgentRegistry(_agentRegistry)` (factory-admin only).
   */
  encodeSetAgentRegistry(agentRegistry: string): string {
    return encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "setAgentRegistry",
      args: [agentRegistry as Address],
    });
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
    return (await this.client.readContract({
      address: factoryAddress as Address,
      abi: FACTORY_ABI,
      functionName: "getAgentAddress",
      args: [humanOwner as Address, agentKey as Address, agentId as Hex],
    })) as string;
  }

  /** Read the AgentRegistry address currently bound to the factory. */
  async getFactoryAgentRegistry(factoryAddress: string): Promise<string> {
    return (await this.client.readContract({
      address: factoryAddress as Address,
      abi: FACTORY_ABI,
      functionName: "agentRegistry",
      args: [],
    })) as string;
  }
}
