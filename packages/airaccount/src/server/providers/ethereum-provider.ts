import {
  createPublicClient,
  http,
  getContract,
  formatEther,
  parseUnits,
  type PublicClient,
  type Address,
  type Abi,
} from "viem";
// EntryPoint/AirAccount ABIs are local human-readable signatures (not in @aastar/core);
// parseAbi is required to feed them to viem's getContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { ServerConfig, EntryPointVersionConfig } from "../config";
import {
  EntryPointVersion,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  AIRACCOUNT_FACTORY_ABI,
  ACCOUNT_ABI,
  AIRACCOUNT_ABI,
  VALIDATOR_ABI,
  AGENT_SESSION_KEY_VALIDATOR_ABI,
  TIER_GUARD_HOOK_ABI,
  AIR_ACCOUNT_COMPOSITE_VALIDATOR_ABI,
  FORCE_EXIT_MODULE_ABI,
  AIRACCOUNT_ADDRESSES,
} from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { UserOperation, PackedUserOperation } from "../../core/types";

/**
 * A viem contract instance bound to a read-only PublicClient.
 *
 * The EntryPoint/AirAccount ABIs are loaded from human-readable signatures via
 * `parseAbi`, which yields the loosely-typed `Abi` shape. As a result `read`/`write`
 * method access is not statically typed per-function; callers index by name and the
 * returned value is `unknown` (cast at the call site). This mirrors the dynamic
 * surface that `ethers.Contract` previously exposed.
 */
/** Default safety buffer (percent) applied to bundler gas estimates. */
const DEFAULT_GAS_ESTIMATE_BUFFER_PERCENT = 10;

/**
 * Adds a percentage buffer to a hex-encoded gas value and returns it as hex.
 * A bufferPercent of 0 returns the value unchanged. Negative values are clamped to 0.
 * Fractional percents are rounded to the nearest integer (e.g. 10.7 → 11) since the
 * buffer is computed in integer (BigInt) arithmetic.
 */
function addGasBuffer(hexValue: string, bufferPercent: number): string {
  const base = BigInt(hexValue);
  const pct = bufferPercent > 0 ? BigInt(Math.round(bufferPercent)) : 0n;
  const buffered = base + (base * pct) / 100n;
  return `0x${buffered.toString(16)}`;
}

export type ViemContractMethods = Record<string, (...args: unknown[]) => Promise<unknown>>;
export interface ViemContract {
  address: Address;
  abi: Abi;
  /** Read (view/pure) calls: `contract.read.fnName([...args])`. */
  read: ViemContractMethods;
  /** State-changing calls (requires a wallet client — not provided by this read-only hub). */
  write: ViemContractMethods;
  estimateGas: ViemContractMethods;
  simulate: ViemContractMethods;
  getEvents: ViemContractMethods;
}

/**
 * Unified Ethereum provider — replaces NestJS EthereumService.
 * Manages RPC + Bundler clients (viem) and contract interactions.
 */
export class EthereumProvider {
  /** Main-network read client. Pass to viem getContract / readContract calls. */
  private readonly provider: PublicClient;
  /** Bundler client — used only for raw eth_ / pimlico_ userOp JSON-RPC. */
  private readonly bundlerProvider: PublicClient;
  private readonly config: ServerConfig;
  private readonly logger: ILogger;

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger("[EthereumProvider]");
    this.provider = createPublicClient({ transport: http(config.rpcUrl) });
    this.bundlerProvider = createPublicClient({ transport: http(config.bundlerRpcUrl) });
  }

  /** Returns the viem PublicClient for the main network RPC. */
  getProvider(): PublicClient {
    return this.provider;
  }

  /** Returns the viem PublicClient bound to the bundler RPC (raw .request only). */
  getBundlerProvider(): PublicClient {
    return this.bundlerProvider;
  }

  /** EVM chain id from the validated ServerConfig (deterministic — no RPC round-trip). */
  getChainId(): number {
    return this.config.chainId;
  }

  /**
   * Raw bundler JSON-RPC call. The bundler exposes non-standard methods
   * (eth_sendUserOperation, pimlico_getUserOperationGasPrice, ...) that are not in
   * viem's typed RPC schema, so we go through the transport's request fn untyped.
   */
  private async bundlerRequest<T = unknown>(method: string, params: unknown[]): Promise<T> {
    return (await this.bundlerProvider.request({
      method: method as never,
      params: params as never,
    })) as T;
  }

  // ── Config helpers ──────────────────────────────────────────────

  private getVersionConfig(version: EntryPointVersion): EntryPointVersionConfig {
    const map: Record<EntryPointVersion, EntryPointVersionConfig | undefined> = {
      [EntryPointVersion.V0_6]: this.config.entryPoints.v06,
      [EntryPointVersion.V0_7]: this.config.entryPoints.v07,
      [EntryPointVersion.V0_8]: this.config.entryPoints.v08,
    };
    const versionConfig = map[version];
    if (!versionConfig) {
      throw new Error(`EntryPoint version ${version} is not configured`);
    }
    return versionConfig;
  }

  getEntryPointAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).entryPointAddress;
  }

  getFactoryAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).factoryAddress;
  }

  getValidatorAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).validatorAddress;
  }

  getDefaultVersion(): EntryPointVersion {
    const v = this.config.defaultVersion;
    if (v === "0.7") return EntryPointVersion.V0_7;
    if (v === "0.8") return EntryPointVersion.V0_8;
    return EntryPointVersion.V0_6;
  }

  // ── Contract factories ──────────────────────────────────────────

  /** Build a read-only viem contract bound to the main-network PublicClient. */
  private contractAt(address: string, abi: readonly string[]): ViemContract {
    return getContract({
      address: address as Address,
      abi: parseAbi(abi as readonly string[]),
      client: this.provider,
    }) as unknown as ViemContract;
  }

  getFactoryContract(version: EntryPointVersion = EntryPointVersion.V0_6): ViemContract {
    const address = this.getFactoryAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? FACTORY_ABI_V6 : AIRACCOUNT_FACTORY_ABI;
    return this.contractAt(address, abi);
  }

  getEntryPointContract(version: EntryPointVersion = EntryPointVersion.V0_6): ViemContract {
    const address = this.getEntryPointAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? ENTRYPOINT_ABI_V6 : ENTRYPOINT_ABI_V7_V8;
    return this.contractAt(address, abi);
  }

  getValidatorContract(version: EntryPointVersion = EntryPointVersion.V0_6): ViemContract {
    const address = this.getValidatorAddress(version);
    return this.contractAt(address, VALIDATOR_ABI);
  }

  getAccountContract(address: string): ViemContract {
    return this.contractAt(address, AIRACCOUNT_ABI);
  }

  // ── M7 Module contracts ─────────────────────────────────────────

  // M7 r4 module helpers — addresses renamed to *M7r4 suffix in beta.3 to avoid ambiguity.
  // These methods are retained for backwards compatibility; callers should pass an explicit address.
  getAgentSessionKeyValidatorContract(address: string = AIRACCOUNT_ADDRESSES.sepolia.agentSessionKeyValidatorM7r4): ViemContract {
    return this.contractAt(address, AGENT_SESSION_KEY_VALIDATOR_ABI);
  }

  getTierGuardHookContract(address: string = AIRACCOUNT_ADDRESSES.sepolia.tierGuardHookM7r4): ViemContract {
    return this.contractAt(address, TIER_GUARD_HOOK_ABI);
  }

  getCompositeValidatorContract(address: string = AIRACCOUNT_ADDRESSES.sepolia.compositeValidatorM7r4): ViemContract {
    return this.contractAt(address, AIR_ACCOUNT_COMPOSITE_VALIDATOR_ABI);
  }

  getForceExitModuleContract(address: string): ViemContract {
    return this.contractAt(address, FORCE_EXIT_MODULE_ABI);
  }

  // ── On-chain queries ────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance({ address: address as Address });
    return formatEther(balance);
  }

  async getNonce(
    accountAddress: string,
    key: number = 0,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<bigint> {
    const entryPoint = this.getEntryPointContract(version);
    return (await (entryPoint.read as Record<string, (args: unknown[]) => Promise<unknown>>).getNonce([
      accountAddress as Address,
      BigInt(key),
    ])) as bigint;
  }

  async getUserOpHash(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    const entryPoint = this.getEntryPointContract(version);
    const read = entryPoint.read as Record<string, (args: unknown[]) => Promise<unknown>>;

    if (version === EntryPointVersion.V0_6) {
      const op = userOp as UserOperation;
      // uint256 fields coerced to bigint for viem (byte-identical to ethers' BigNumberish handling).
      const userOpArray = [
        op.sender,
        BigInt(op.nonce),
        op.initCode || "0x",
        op.callData,
        BigInt(op.callGasLimit),
        BigInt(op.verificationGasLimit),
        BigInt(op.preVerificationGas),
        BigInt(op.maxFeePerGas),
        BigInt(op.maxPriorityFeePerGas),
        op.paymasterAndData || "0x",
        "0x", // Always use empty signature for hash calculation
      ];
      return (await read.getUserOpHash([userOpArray])) as string;
    } else {
      const packedOp = userOp as PackedUserOperation;
      const packedOpArray = [
        packedOp.sender,
        BigInt(packedOp.nonce),
        packedOp.initCode || "0x",
        packedOp.callData,
        packedOp.accountGasLimits,
        BigInt(packedOp.preVerificationGas),
        packedOp.gasFees,
        packedOp.paymasterAndData || "0x",
        "0x",
      ];
      return (await read.getUserOpHash([packedOpArray])) as string;
    }
  }

  // ── Bundler RPC ─────────────────────────────────────────────────

  async estimateUserOperationGas(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<{ callGasLimit: string; verificationGasLimit: string; preVerificationGas: string }> {
    try {
      const est = await this.bundlerRequest<{
        callGasLimit: string;
        verificationGasLimit: string;
        preVerificationGas: string;
      }>("eth_estimateUserOperationGas", [userOp, this.getEntryPointAddress(version)]);

      // Add a safety buffer on top of the dynamic estimate. The bundler simulates
      // gas, but execution-time usage can be higher (cold storage, BLS verification
      // variance), so a margin avoids out-of-gas reverts. preVerificationGas is the
      // deterministic calldata cost and is left as-is.
      const bufferPercent = this.config.gasEstimateBufferPercent ?? DEFAULT_GAS_ESTIMATE_BUFFER_PERCENT;
      return {
        callGasLimit: addGasBuffer(est.callGasLimit, bufferPercent),
        verificationGasLimit: addGasBuffer(est.verificationGasLimit, bufferPercent),
        preVerificationGas: est.preVerificationGas,
      };
    } catch (err) {
      // Do NOT silently swallow. A failed estimate previously fell through to a flat
      // 4M verificationGasLimit, which masked the real cause (bundler 401 / down /
      // un-simulatable userOp) and surfaced downstream as a confusing InsufficientBalance.
      // Log the true error and fall back to configurable static limits.
      const fb = this.config.fallbackGasLimits;
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `eth_estimateUserOperationGas failed (${reason}); falling back to static gas limits. ` +
          `Verify the bundler URL/API key and the userOp parameters — the fallback ignores ` +
          `current gas price and may over-estimate the required prefund.`
      );
      return {
        callGasLimit: fb?.callGasLimit ?? "0x249f0",
        verificationGasLimit: fb?.verificationGasLimit ?? "0x3d0900", // 4M — heavy enough for factory deploy + BLS verification
        preVerificationGas: fb?.preVerificationGas ?? "0x11170",
      };
    }
  }

  async sendUserOperation(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    return await this.bundlerRequest("eth_sendUserOperation", [
      userOp,
      this.getEntryPointAddress(version),
    ]);
  }

  async getUserOperationReceipt(userOpHash: string): Promise<unknown> {
    return await this.bundlerRequest("eth_getUserOperationReceipt", [userOpHash]);
  }

  async waitForUserOp(userOpHash: string, maxAttempts: number = 60): Promise<string> {
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = (await this.getUserOperationReceipt(userOpHash)) as Record<
          string,
          unknown
        > | null;
        if (receipt) {
          const txHash =
            (receipt.transactionHash as string) ||
            ((receipt.receipt as Record<string, unknown>)?.transactionHash as string);
          if (txHash) return txHash;
        }
      } catch {
        // Continue polling
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`UserOp timeout: ${userOpHash}`);
  }

  async getUserOperationGasPrice(): Promise<{
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  }> {
    try {
      const gasPrice = await this.bundlerRequest<{
        fast: { maxFeePerGas: string; maxPriorityFeePerGas: string };
      }>("pimlico_getUserOperationGasPrice", []);
      return {
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
      };
    } catch {
      try {
        const feeData = await this.provider.estimateFeesPerGas();
        const baseFee = feeData.maxFeePerGas || parseUnits("20", 9); // gwei
        const priorityFee = feeData.maxPriorityFeePerGas || parseUnits("2", 9); // gwei
        const maxFeePerGas = (baseFee * 3n) / 2n;
        const maxPriorityFeePerGas = (priorityFee * 3n) / 2n;
        return {
          maxFeePerGas: "0x" + maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
        };
      } catch {
        return {
          maxFeePerGas: "0x" + parseUnits("3", 9).toString(16), // gwei
          maxPriorityFeePerGas: "0x" + parseUnits("1", 9).toString(16), // gwei
        };
      }
    }
  }
}
