import { encodeFunctionData, getContract, type Abi, type PublicClient } from "viem";
// parseAbi is required: the ERC-8004 ABI is a local human-readable string[] of function
// signatures (not available in @aastar/core), and viem needs a parsed Abi to encode/read.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";

// Minimal ABI covering only the ERC-8004 agent functions on AAStarAirAccountV7.
// These are routed via fallback→delegatecall to AirAccountExtension on the deployed account.
const ERC8004_ABI = [
  "function setAgentWallet(uint256 agentId, address agentWallet, address agentRegistry, bytes agentWalletSig) external",
  "function mintAgentIdentity(address identityRegistry, string agentURI) external returns (uint256 agentId)",
  "function bindERC8004AgentWallet(address identityRegistry, uint256 agentId, address agentWallet, uint256 deadline, bytes signature) external",
  "function submitAgentReputation(address reputationRegistry, uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external",
  "function queryAgentReputation(address reputationRegistry, uint256 agentId, address[] clientAddresses, string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryDecimals)",
  "function agentExtension() external view returns (address)",
];

// ─── Official ERC-8004 "Trustless Agents" registry addresses ─────────────────
// Deployed at deterministic CREATE2 addresses (SAFE Singleton Factory).
// Source: ../airaccount-contract/src/config/ERC8004Addresses.sol

export const ERC8004_ADDRESSES = {
  mainnet: {
    identityRegistry:   "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
  },
  testnet: {
    identityRegistry:   "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
} as const;

// Mainnet chain IDs that have official ERC-8004 deployments.
const MAINNET_CHAIN_IDS = new Set([1, 10, 137, 8453, 42161, 43114, 56, 534352, 100, 42220, 59144, 5000, 167000, 360]);
const TESTNET_CHAIN_IDS = new Set([11155111, 11155420, 84532, 421614, 80002]);

export function erc8004AddressesForChain(chainId: number): (typeof ERC8004_ADDRESSES)["mainnet"] | (typeof ERC8004_ADDRESSES)["testnet"] {
  if (MAINNET_CHAIN_IDS.has(chainId)) return ERC8004_ADDRESSES.mainnet;
  if (TESTNET_CHAIN_IDS.has(chainId)) return ERC8004_ADDRESSES.testnet;
  throw new Error(`ERC-8004: unsupported chain ${chainId}`);
}

// ─── Parameter types ──────────────────────────────────────────────────────────

export interface SetAgentWalletParams {
  agentId: bigint;
  agentWallet: string;
  /** AAStar AgentRegistry contract address (SuperPaymaster-facing, NOT the official ERC-8004 registry) */
  agentRegistry: string;
  /** Signature from the agent wallet proving ownership */
  agentWalletSig: string;
}

export interface MintAgentIdentityParams {
  /** Must be the official ERC-8004 identity registry for this chain */
  identityRegistry: string;
  /** Agent metadata URI (ERC-721 tokenURI) */
  agentURI: string;
}

export interface BindERC8004AgentWalletParams {
  /** Must be the official ERC-8004 identity registry for this chain */
  identityRegistry: string;
  agentId: bigint;
  agentWallet: string;
  /** Unix timestamp — signature becomes invalid after this deadline */
  deadline: bigint;
  /** Signature authorising the wallet binding, signed by the identity registry's expected signer */
  signature: string;
}

export interface SubmitAgentReputationParams {
  /** Must be the official ERC-8004 reputation registry for this chain */
  reputationRegistry: string;
  agentId: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: string; // bytes32 hex
}

export interface QueryAgentReputationParams {
  /** Must be the official ERC-8004 reputation registry for this chain */
  reputationRegistry: string;
  agentId: bigint;
  clientAddresses: string[];
  tag1: string;
  tag2: string;
}

export interface AgentReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryDecimals: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ERC8004Service — TypeScript wrappers for AirAccount's ERC-8004 "Trustless Agents" functions.
 *
 * **Two distinct registration paths:**
 *
 * 1. `encodeSetAgentWallet` — AAStar/SuperPaymaster path.
 *    Registers the agent wallet in the AAStar AgentRegistry contract. Use this when you want
 *    SuperPaymaster to recognise the agent for gasless sponsorship. The `agentRegistry` argument
 *    is the deployed AgentRegistry address, NOT the official ERC-8004 IdentityRegistry.
 *
 * 2. `encodeMintAgentIdentity` + `encodeBindERC8004AgentWallet` — official ERC-8004 path.
 *    Mints an ERC-721 identity NFT in the official ERC-8004 IdentityRegistry and binds an
 *    execution wallet to it. The registry address MUST be from `erc8004AddressesForChain()`.
 *    These calls revert on-chain if the wrong registry address is supplied.
 *
 * All `encode*` methods return ABI-encoded calldata ready to be submitted via UserOp (gasless)
 * or a direct owner transaction. The calldata targets the AirAccount address — the account's
 * fallback delegates to AirAccountExtension for these selectors.
 */
export class ERC8004Service {
  private readonly abi: Abi;
  private readonly provider?: PublicClient;

  constructor(provider?: PublicClient) {
    this.abi = parseAbi(ERC8004_ABI);
    this.provider = provider;
  }

  /**
   * Build a read-only viem contract bound to the account address. The ABI is loaded from
   * human-readable signatures via `parseAbi` (loose `Abi`), so `read` methods are indexed by
   * name and return `unknown` — cast at the call site. Mirrors the dynamic surface that
   * `ethers.Contract` previously exposed. Caller must ensure `this.provider` is set.
   */
  private contractAt(accountAddress: string): {
    read: Record<string, (args: readonly unknown[]) => Promise<unknown>>;
  } {
    return getContract({
      address: accountAddress as `0x${string}`,
      abi: this.abi,
      client: this.provider as PublicClient,
    }) as unknown as { read: Record<string, (args: readonly unknown[]) => Promise<unknown>> };
  }

  // ── AAStar AgentRegistry path ─────────────────────────────────────────────

  /**
   * Encode calldata for `setAgentWallet`.
   *
   * Registers `agentWallet` in the AAStar AgentRegistry (SuperPaymaster-facing). This is the
   * correct path when the goal is SuperPaymaster gasless sponsorship for the agent.
   *
   * **Not** a call to the official ERC-8004 IdentityRegistry. Use `encodeMintAgentIdentity`
   * + `encodeBindERC8004AgentWallet` for the ERC-8004 standard path.
   *
   * Callable: owner EOA direct tx OR via UserOp (gasless).
   */
  encodeSetAgentWallet(params: SetAgentWalletParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "setAgentWallet",
      args: [params.agentId, params.agentWallet, params.agentRegistry, params.agentWalletSig],
    });
  }

  // ── Official ERC-8004 identity path ──────────────────────────────────────

  /**
   * Encode calldata for `mintAgentIdentity`.
   *
   * Mints an ERC-721 agent identity NFT in the official ERC-8004 IdentityRegistry and returns
   * the new `agentId` (decoded from the tx receipt). The `identityRegistry` must be
   * `erc8004AddressesForChain(chainId).identityRegistry` — the contract reverts otherwise.
   *
   * Callable: owner EOA direct tx OR via UserOp (gasless).
   */
  encodeMintAgentIdentity(params: MintAgentIdentityParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "mintAgentIdentity",
      args: [params.identityRegistry, params.agentURI],
    });
  }

  /**
   * Encode calldata for `bindERC8004AgentWallet`.
   *
   * Binds an execution wallet to an existing ERC-8004 agent identity NFT. Requires a
   * deadline-bounded signature from the expected signer (see the IdentityRegistry contract).
   * The `identityRegistry` must be the official chain-specific address.
   *
   * Callable: owner EOA direct tx OR via UserOp (gasless).
   */
  encodeBindERC8004AgentWallet(params: BindERC8004AgentWalletParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "bindERC8004AgentWallet",
      args: [
        params.identityRegistry,
        params.agentId,
        params.agentWallet,
        params.deadline,
        params.signature,
      ],
    });
  }

  // ── Reputation ────────────────────────────────────────────────────────────

  /**
   * Encode calldata for `submitAgentReputation`.
   *
   * Submits a reputation feedback entry to the official ERC-8004 ReputationRegistry.
   * `reputationRegistry` must be `erc8004AddressesForChain(chainId).reputationRegistry`.
   *
   * Callable: owner EOA direct tx OR via UserOp (gasless).
   */
  encodeSubmitAgentReputation(params: SubmitAgentReputationParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "submitAgentReputation",
      args: [
        params.reputationRegistry,
        params.agentId,
        params.value,
        params.valueDecimals,
        params.tag1,
        params.tag2,
        params.endpoint,
        params.feedbackURI,
        params.feedbackHash,
      ],
    });
  }

  /**
   * Query aggregated reputation for an agent from the official ERC-8004 ReputationRegistry.
   * Returns `null` when no provider was supplied at construction.
   */
  async queryAgentReputation(
    accountAddress: string,
    params: QueryAgentReputationParams,
  ): Promise<AgentReputationSummary> {
    if (!this.provider) throw new Error("ERC8004Service: provider required for on-chain reads");
    const contract = this.contractAt(accountAddress);
    const [count, summaryValue, summaryDecimals] = (await contract.read.queryAgentReputation([
      params.reputationRegistry,
      params.agentId,
      params.clientAddresses,
      params.tag1,
      params.tag2,
    ])) as readonly [bigint, bigint, number];
    return { count: BigInt(count), summaryValue: BigInt(summaryValue), summaryDecimals: Number(summaryDecimals) };
  }

  /**
   * Encode calldata for `queryAgentReputation` (for static-call or eth_call without a signer).
   */
  encodeQueryAgentReputation(params: QueryAgentReputationParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "queryAgentReputation",
      args: [
        params.reputationRegistry,
        params.agentId,
        params.clientAddresses,
        params.tag1,
        params.tag2,
      ],
    });
  }

  /**
   * Read the agentExtension implementation address from a deployed AirAccount.
   */
  async getAgentExtensionAddress(accountAddress: string): Promise<string> {
    if (!this.provider) throw new Error("ERC8004Service: provider required for on-chain reads");
    const contract = this.contractAt(accountAddress);
    const extension = await contract.read.agentExtension([]);
    return extension as string;
  }
}
