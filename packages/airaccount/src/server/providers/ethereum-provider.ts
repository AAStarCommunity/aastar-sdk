import { ethers } from "ethers";
import { ServerConfig, EntryPointVersionConfig } from "../config";
import {
  EntryPointVersion,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  AIRACCOUNT_FACTORY_ABI,
  ACCOUNT_ABI,
  VALIDATOR_ABI,
} from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { UserOperation, PackedUserOperation } from "../../core/types";

/**
 * Unified Ethereum provider — replaces NestJS EthereumService.
 * Manages RPC + Bundler providers and contract interactions.
 */
export class EthereumProvider {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly bundlerProvider: ethers.JsonRpcProvider;
  private readonly config: ServerConfig;
  private readonly logger: ILogger;

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger("[EthereumProvider]");
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.bundlerProvider = new ethers.JsonRpcProvider(config.bundlerRpcUrl);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getBundlerProvider(): ethers.JsonRpcProvider {
    return this.bundlerProvider;
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

  getFactoryContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getFactoryAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? FACTORY_ABI_V6 : AIRACCOUNT_FACTORY_ABI;
    return new ethers.Contract(address, abi, this.provider);
  }

  getEntryPointContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getEntryPointAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? ENTRYPOINT_ABI_V6 : ENTRYPOINT_ABI_V7_V8;
    return new ethers.Contract(address, abi, this.provider);
  }

  getValidatorContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getValidatorAddress(version);
    return new ethers.Contract(address, VALIDATOR_ABI, this.provider);
  }

  getAccountContract(address: string): ethers.Contract {
    return new ethers.Contract(address, ACCOUNT_ABI, this.provider);
  }

  // ── On-chain queries ────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getNonce(
    accountAddress: string,
    key: number = 0,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<bigint> {
    const entryPoint = this.getEntryPointContract(version);
    return await entryPoint.getNonce(accountAddress, key);
  }

  async getUserOpHash(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    const entryPoint = this.getEntryPointContract(version);

    if (version === EntryPointVersion.V0_6) {
      const op = userOp as UserOperation;
      const userOpArray = [
        op.sender,
        op.nonce,
        op.initCode || "0x",
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData || "0x",
        "0x", // Always use empty signature for hash calculation
      ];
      return await entryPoint.getUserOpHash(userOpArray);
    } else {
      const packedOp = userOp as PackedUserOperation;
      const packedOpArray = [
        packedOp.sender,
        packedOp.nonce,
        packedOp.initCode || "0x",
        packedOp.callData,
        packedOp.accountGasLimits,
        packedOp.preVerificationGas,
        packedOp.gasFees,
        packedOp.paymasterAndData || "0x",
        "0x",
      ];
      return await entryPoint.getUserOpHash(packedOpArray);
    }
  }

  // ── Bundler RPC ─────────────────────────────────────────────────

  async estimateUserOperationGas(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<{ callGasLimit: string; verificationGasLimit: string; preVerificationGas: string }> {
    try {
      return await this.bundlerProvider.send("eth_estimateUserOperationGas", [
        userOp,
        this.getEntryPointAddress(version),
      ]);
    } catch {
      return {
        callGasLimit: "0x249f0",
        verificationGasLimit: "0x3d0900", // 4M — enough for M4 factory deployment + BLS verification
        preVerificationGas: "0x11170",
      };
    }
  }

  async sendUserOperation(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    return await this.bundlerProvider.send("eth_sendUserOperation", [
      userOp,
      this.getEntryPointAddress(version),
    ]);
  }

  async getUserOperationReceipt(userOpHash: string): Promise<unknown> {
    return await this.bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash]);
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
      const gasPrice = await this.bundlerProvider.send("pimlico_getUserOperationGasPrice", []);
      return {
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
      };
    } catch {
      try {
        const feeData = await this.provider.getFeeData();
        const baseFee = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
        const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");
        const maxFeePerGas = (baseFee * 3n) / 2n;
        const maxPriorityFeePerGas = (priorityFee * 3n) / 2n;
        return {
          maxFeePerGas: "0x" + maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
        };
      } catch {
        return {
          maxFeePerGas: "0x" + ethers.parseUnits("3", "gwei").toString(16),
          maxPriorityFeePerGas: "0x" + ethers.parseUnits("1", "gwei").toString(16),
        };
      }
    }
  }
}
