import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { AccountManager } from "./account-manager";
import { BLSSignatureService } from "./bls-signature-service";
import { GuardChecker } from "./guard-checker";
import { PaymasterManager } from "./paymaster-manager";
import { TokenService } from "./token-service";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, PasskeyAssertionContext } from "../interfaces/signer-adapter";
import { LegacyPasskeyAssertion } from "./kms-signer";
import { EntryPointVersion } from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { UserOperation, PackedUserOperation } from "../../core/types";
import { ERC4337Utils } from "../../core/erc4337";
import { TierLevel } from "../../core/tier";

// ── Public DTOs ───────────────────────────────────────────────────

export interface ExecuteTransferParams {
  to: string;
  amount: string;
  data?: string;
  tokenAddress?: string;
  usePaymaster?: boolean;
  paymasterAddress?: string;
  paymasterData?: string;
  passkeyAssertion?: LegacyPasskeyAssertion;
  /** P256 passkey signature (64 bytes hex). Required for AirAccount Tier 2/3. */
  p256Signature?: string;
  /** Guardian ethers.Signer instance. Required for AirAccount Tier 3. */
  guardianSigner?: ethers.Signer;
  /** Enable AirAccount tiered signature routing. Default: false (legacy BLS-only). */
  useAirAccountTiering?: boolean;
}

export interface EstimateGasParams {
  to: string;
  amount: string;
  data?: string;
  tokenAddress?: string;
}

export interface TransferResult {
  success: boolean;
  transferId: string;
  userOpHash: string;
  status: string;
  message: string;
  from: string;
  to: string;
  amount: string;
}

// ── Helper to generate UUID-like IDs without external dependency ──

function generateId(): string {
  const hex = () => Math.random().toString(16).slice(2, 10);
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

/**
 * Transfer manager — extracted from NestJS TransferService.
 * No passkey verification: callers are responsible for their own auth.
 */
export class TransferManager {
  private readonly logger: ILogger;

  private readonly guardChecker: GuardChecker | null;

  constructor(
    private readonly ethereum: EthereumProvider,
    private readonly accountManager: AccountManager,
    private readonly blsService: BLSSignatureService,
    private readonly paymasterManager: PaymasterManager,
    private readonly tokenService: TokenService,
    private readonly storage: IStorageAdapter,
    private readonly signer: ISignerAdapter,
    logger?: ILogger,
    guardChecker?: GuardChecker
  ) {
    this.logger = logger ?? new ConsoleLogger("[TransferManager]");
    this.guardChecker = guardChecker ?? null;
  }

  async executeTransfer(userId: string, params: ExecuteTransferParams): Promise<TransferResult> {
    // Get user's account
    const account = await this.accountManager.getAccountByUserId(userId);
    if (!account) throw new Error("User account not found");

    // Check deployment
    const code = await this.ethereum.getProvider().getCode(account.address);
    const needsDeployment = code === "0x";
    if (needsDeployment) {
      this.logger.log("Account needs deployment, will deploy with first transaction");
    }

    // Balance validation
    const smartAccountBalance = parseFloat(await this.ethereum.getBalance(account.address));
    const isTokenTransfer = !!params.tokenAddress;
    const transferAmount = isTokenTransfer ? 0 : parseFloat(params.amount);

    if (!params.usePaymaster) {
      const minRequiredBalance = 0.0002;
      const totalNeeded = transferAmount + minRequiredBalance;
      if (smartAccountBalance < totalNeeded) {
        throw new Error(
          `Insufficient balance: Account has ${smartAccountBalance} ETH but needs ${totalNeeded} ETH`
        );
      }
    } else if (!isTokenTransfer && transferAmount > smartAccountBalance) {
      throw new Error(
        `Insufficient balance: Account has ${smartAccountBalance} ETH but trying to send ${transferAmount} ETH`
      );
    }

    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;

    // Build UserOperation
    const userOp = await this.buildUserOperation(
      userId,
      account.address,
      params.to,
      params.amount,
      params.data || "0x",
      params.usePaymaster,
      params.paymasterAddress,
      params.paymasterData,
      params.tokenAddress,
      version
    );

    // Get hash
    const userOpHash = await this.ethereum.getUserOpHash(userOp, version);

    // Ensure wallet exists
    await this.signer.ensureSigner(userId);

    // BLS signature (pass assertion context for KMS-backed signing)
    const assertionCtx: PasskeyAssertionContext | undefined = params.passkeyAssertion
      ? { assertion: params.passkeyAssertion }
      : undefined;

    // M4 accounts: check if validator is set; if not, use ECDSA instead of BLS
    let useECDSA = false;
    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      try {
        const provider = this.ethereum.getProvider();
        const accountCode = await provider.getCode(account.address);
        if (accountCode === "0x") {
          useECDSA = true;
        } else {
          const acc = new ethers.Contract(account.address, ["function validator() view returns (address)"], provider);
          const v = await acc.validator();
          if (v === ethers.ZeroAddress) useECDSA = true;
        }
      } catch { useECDSA = true; }
    }

    if (useECDSA) {
      // M4 ECDSA path: raw 65-byte sig, no validator needed
      this.logger.log("M4: using ECDSA signature (validator not set)");
      const signer = await this.signer.getSigner(userId, assertionCtx);
      const ecdsaSig = await signer.signMessage(ethers.getBytes(userOpHash));
      userOp.signature = ecdsaSig;
    } else if (params.useAirAccountTiering && this.guardChecker) {
      // AirAccount tiered signature routing
      const transferValue = params.tokenAddress ? 0n : ethers.parseEther(params.amount);
      const preCheck = await this.guardChecker.preCheck(account.address, transferValue);

      if (!preCheck.ok) {
        throw new Error(`Guard pre-check failed: ${preCheck.errors.join("; ")}`);
      }

      this.logger.log(
        `Tier ${preCheck.tier} selected (algId=0x${preCheck.algId.toString(16).padStart(2, "0")})`
      );

      userOp.signature = await this.blsService.generateTieredSignature({
        tier: preCheck.tier as TierLevel,
        userId,
        userOpHash,
        p256Signature: params.p256Signature,
        guardianSigner: params.guardianSigner,
        ctx: assertionCtx,
      });
    } else {
      // BLS triple signature with algId 0x01 prefix for M4 account routing
      const blsData = await this.blsService.generateBLSSignature(userId, userOpHash, assertionCtx);
      const packedBls = await this.blsService.packSignature(blsData);
      // Prepend algId=0x01 byte for M4 _validateSignature routing
      userOp.signature = "0x01" + packedBls.slice(2);
    }

    // Create transfer record
    const transferId = generateId();
    let tokenSymbol = "ETH";
    if (params.tokenAddress) {
      try {
        const tokenInfo = await this.tokenService.getTokenInfo(params.tokenAddress);
        tokenSymbol = tokenInfo.symbol;
      } catch {
        tokenSymbol = `${params.tokenAddress.slice(0, 6)}...${params.tokenAddress.slice(-4)}`;
      }
    }

    await this.storage.saveTransfer({
      id: transferId,
      userId,
      from: account.address,
      to: params.to,
      amount: params.amount,
      data: params.data,
      userOpHash,
      status: "pending",
      nodeIndices: [],
      createdAt: new Date().toISOString(),
      tokenAddress: params.tokenAddress,
      tokenSymbol,
    });

    // Process asynchronously
    this.processTransferAsync(transferId, userOp, account.address, version);

    return {
      success: true,
      transferId,
      userOpHash,
      status: "pending",
      message: "Transfer submitted successfully. Use transferId to check status.",
      from: account.address,
      to: params.to,
      amount: params.amount,
    };
  }

  private async processTransferAsync(
    transferId: string,
    userOp: UserOperation | PackedUserOperation,
    from: string,
    version: EntryPointVersion
  ): Promise<void> {
    try {
      const formatted = this.formatUserOpForBundler(userOp, version);
      const bundlerUserOpHash = await this.ethereum.sendUserOperation(formatted, version);

      await this.storage.updateTransfer(transferId, {
        bundlerUserOpHash,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      } as Partial<import("../interfaces/storage-adapter").TransferRecord>);

      const txHash = await this.ethereum.waitForUserOp(bundlerUserOpHash);

      await this.storage.updateTransfer(transferId, {
        transactionHash: txHash,
        status: "completed",
        completedAt: new Date().toISOString(),
      } as Partial<import("../interfaces/storage-adapter").TransferRecord>);

      // Update deployment status if first tx
      const code = await this.ethereum.getProvider().getCode(from);
      if (code !== "0x") {
        const account = (await this.storage.getAccounts()).find(a => a.address === from);
        if (account && !account.deployed) {
          await this.storage.updateAccount(account.userId, {
            deployed: true,
            deploymentTxHash: txHash,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.storage.updateTransfer(transferId, {
        status: "failed",
        error: message,
        failedAt: new Date().toISOString(),
      } as Partial<import("../interfaces/storage-adapter").TransferRecord>);
      this.logger.error(`Transfer ${transferId} failed: ${message}`);
    }
  }

  async estimateGas(userId: string, params: EstimateGasParams) {
    const account = await this.accountManager.getAccountByUserId(userId);
    if (!account) throw new Error("User account not found");

    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;

    const userOp = await this.buildUserOperation(
      userId,
      account.address,
      params.to,
      params.amount,
      params.data || "0x",
      false,
      undefined,
      undefined,
      params.tokenAddress,
      version
    );

    const formatted = this.formatUserOpForBundler(userOp, version);
    const gasEstimates = await this.ethereum.estimateUserOperationGas(formatted, version);
    const gasPrices = await this.ethereum.getUserOperationGasPrice();

    const validatorContract = this.ethereum.getValidatorContract(version);
    const validatorGasEstimate = await validatorContract.getGasEstimate(3);

    return {
      callGasLimit: gasEstimates.callGasLimit,
      verificationGasLimit: gasEstimates.verificationGasLimit,
      preVerificationGas: gasEstimates.preVerificationGas,
      validatorGasEstimate: validatorGasEstimate.toString(),
      totalGasEstimate: (
        BigInt(gasEstimates.callGasLimit) +
        BigInt(gasEstimates.verificationGasLimit) +
        BigInt(gasEstimates.preVerificationGas)
      ).toString(),
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    };
  }

  async getTransferStatus(userId: string, transferId: string) {
    const transfer = await this.storage.findTransferById(transferId);
    if (!transfer || transfer.userId !== userId) {
      throw new Error("Transfer not found");
    }

    const response: Record<string, unknown> = { ...transfer };

    if (transfer.status === "pending" || transfer.status === "submitted") {
      const elapsed = Math.floor((Date.now() - new Date(transfer.createdAt).getTime()) / 1000);
      response.elapsedSeconds = elapsed;
    }

    if (transfer.transactionHash) {
      response.explorerUrl = `https://sepolia.etherscan.io/tx/${transfer.transactionHash}`;
    }

    const statusDescriptions: Record<string, string> = {
      pending: "Preparing transaction and generating signatures",
      submitted: "Transaction submitted to bundler, waiting for confirmation",
      completed: "Transaction confirmed on chain",
      failed: "Transaction failed",
    };
    response.statusDescription = statusDescriptions[transfer.status] || transfer.status;

    return response;
  }

  async getTransferHistory(userId: string, page = 1, limit = 10) {
    const transfers = await this.storage.findTransfersByUserId(userId);
    if (!transfers || transfers.length === 0) {
      return { transfers: [], total: 0, page, limit, totalPages: 0 };
    }

    transfers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const start = (page - 1) * limit;
    const paginated = transfers.slice(start, start + limit);

    return {
      transfers: paginated,
      total: transfers.length,
      page,
      limit,
      totalPages: Math.ceil(transfers.length / limit),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async buildUserOperation(
    userId: string,
    sender: string,
    to: string,
    amount: string,
    data: string,
    usePaymaster?: boolean,
    paymasterAddress?: string,
    _paymasterData?: string,
    tokenAddress?: string,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<UserOperation | PackedUserOperation> {
    const accountContract = this.ethereum.getAccountContract(sender);
    const nonce = await this.ethereum.getNonce(sender, 0, version);

    // initCode for deployment
    const provider = this.ethereum.getProvider();
    const code = await provider.getCode(sender);
    const needsDeployment = code === "0x";

    let initCode = "0x";
    if (needsDeployment) {
      const accounts = await this.storage.getAccounts();
      const account = accounts.find(a => a.address === sender);
      if (account) {
        const factory = this.ethereum.getFactoryContract(version);
        const factoryAddress = await factory.getAddress();

        let deployCalldata: string;
        if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
          // New M4 factory: createAccountWithDefaults(owner, salt, guardian1, guardian2, dailyLimit)
          deployCalldata = factory.interface.encodeFunctionData("createAccountWithDefaults", [
            account.signerAddress,
            account.salt,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.parseEther("1000"),
          ]);
        } else {
          deployCalldata = factory.interface.encodeFunctionData("createAccountWithAAStarValidator", [
            account.signerAddress,
            account.signerAddress,
            account.validatorAddress,
            true,
            account.salt,
          ]);
        }

        initCode = ethers.concat([factoryAddress, deployCalldata]);
      }
    }

    // callData
    let callData: string;
    if (tokenAddress) {
      const tokenInfo = await this.tokenService.getTokenInfo(tokenAddress);
      const transferCalldata = this.tokenService.generateTransferCalldata(
        to,
        amount,
        tokenInfo.decimals
      );
      callData = accountContract.interface.encodeFunctionData("execute", [
        tokenAddress,
        0,
        transferCalldata,
      ]);
    } else {
      callData = accountContract.interface.encodeFunctionData("execute", [
        to,
        ethers.parseEther(amount),
        data,
      ]);
    }

    const gasPrices = await this.ethereum.getUserOperationGasPrice();

    const isV07 = version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8;

    let baseUserOp: Record<string, unknown>;
    if (isV07) {
      // v0.7/v0.8: use factory/factoryData and separate paymaster fields
      let factory: string | undefined;
      let factoryData: string | undefined;
      if (initCode && initCode !== "0x" && initCode.length > 2) {
        factory = initCode.slice(0, 42);
        factoryData = initCode.length > 42 ? "0x" + initCode.slice(42) : "0x";
      }
      baseUserOp = {
        sender,
        nonce: "0x" + nonce.toString(16),
        ...(factory ? { factory, factoryData } : {}),
        callData,
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        signature: "0x",
      };
    } else {
      // v0.6: use initCode and paymasterAndData
      baseUserOp = {
        sender,
        nonce: "0x" + nonce.toString(16),
        initCode,
        callData,
        callGasLimit: "0x0",
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "0x",
      };
    }

    // Paymaster
    let paymasterAndData = "0x";
    if (usePaymaster) {
      if (paymasterAddress) {
        const entryPoint = this.ethereum.getEntryPointAddress(version);
        paymasterAndData = await this.paymasterManager.getPaymasterData(
          userId,
          "custom-user-provided",
          baseUserOp,
          entryPoint,
          paymasterAddress
        );
      } else {
        const available = await this.paymasterManager.getAvailablePaymasters(userId);
        const configured = available.find(pm => pm.configured);
        if (configured) {
          const entryPoint = this.ethereum.getEntryPointAddress(version);
          paymasterAndData = await this.paymasterManager.getPaymasterData(
            userId,
            configured.name,
            baseUserOp,
            entryPoint
          );
        } else {
          throw new Error("No paymaster configured and no paymaster address provided");
        }
      }

      if (!paymasterAndData || paymasterAndData === "0x") {
        throw new Error(
          `Paymaster failed to provide sponsorship data. The paymaster at ${paymasterAddress} may not be configured correctly.`
        );
      }

      if (isV07) {
        // For v0.7, split paymasterAndData into separate fields on the baseUserOp
        baseUserOp.paymaster = paymasterAndData.slice(0, 42);
        if (paymasterAndData.length >= 74) {
          baseUserOp.paymasterVerificationGasLimit =
            "0x" + BigInt("0x" + paymasterAndData.slice(42, 74)).toString(16);
        }
        if (paymasterAndData.length >= 106) {
          baseUserOp.paymasterPostOpGasLimit =
            "0x" + BigInt("0x" + paymasterAndData.slice(74, 106)).toString(16);
        }
        if (paymasterAndData.length > 106) {
          baseUserOp.paymasterData = "0x" + paymasterAndData.slice(106);
        }
      } else {
        baseUserOp.paymasterAndData = paymasterAndData;
      }
    }

    // Gas estimation
    const gasEstimates = await this.ethereum.estimateUserOperationGas(baseUserOp, version);

    const standardUserOp: UserOperation = {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit: BigInt(gasEstimates.callGasLimit),
      verificationGasLimit: BigInt(gasEstimates.verificationGasLimit),
      preVerificationGas: BigInt(gasEstimates.preVerificationGas),
      maxFeePerGas: BigInt(gasPrices.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(gasPrices.maxPriorityFeePerGas),
      paymasterAndData,
      signature: "0x",
    };

    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      return ERC4337Utils.packUserOperation(standardUserOp);
    }

    return standardUserOp;
  }

  private formatUserOpForBundler(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Record<string, unknown> {
    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      const packedOp = userOp as PackedUserOperation;
      const gasLimits = ERC4337Utils.unpackAccountGasLimits(packedOp.accountGasLimits);
      const gasFees = ERC4337Utils.unpackGasFees(packedOp.gasFees);

      let factory: string | undefined;
      let factoryData: string | undefined;
      if (packedOp.initCode && packedOp.initCode !== "0x" && packedOp.initCode.length > 2) {
        factory = packedOp.initCode.slice(0, 42);
        if (packedOp.initCode.length > 42) {
          factoryData = "0x" + packedOp.initCode.slice(42);
        }
      }

      let paymaster: string | undefined;
      let paymasterVerificationGasLimit: string | undefined;
      let paymasterPostOpGasLimit: string | undefined;
      let paymasterData: string | undefined;

      if (
        packedOp.paymasterAndData &&
        packedOp.paymasterAndData !== "0x" &&
        packedOp.paymasterAndData.length > 2
      ) {
        paymaster = packedOp.paymasterAndData.slice(0, 42);
        if (packedOp.paymasterAndData.length >= 74) {
          paymasterVerificationGasLimit =
            "0x" + BigInt("0x" + packedOp.paymasterAndData.slice(42, 74)).toString(16);
        }
        if (packedOp.paymasterAndData.length >= 106) {
          paymasterPostOpGasLimit =
            "0x" + BigInt("0x" + packedOp.paymasterAndData.slice(74, 106)).toString(16);
        }
        if (packedOp.paymasterAndData.length > 106) {
          paymasterData = "0x" + packedOp.paymasterAndData.slice(106);
        }
      }

      const result: Record<string, unknown> = {
        sender: packedOp.sender,
        nonce:
          typeof packedOp.nonce === "bigint"
            ? "0x" + packedOp.nonce.toString(16)
            : packedOp.nonce.toString().startsWith("0x")
              ? packedOp.nonce.toString()
              : "0x" + BigInt(packedOp.nonce).toString(16),
        callData: packedOp.callData,
        callGasLimit: "0x" + gasLimits.callGasLimit.toString(16),
        verificationGasLimit: "0x" + gasLimits.verificationGasLimit.toString(16),
        preVerificationGas:
          typeof packedOp.preVerificationGas === "bigint"
            ? "0x" + packedOp.preVerificationGas.toString(16)
            : packedOp.preVerificationGas.toString().startsWith("0x")
              ? packedOp.preVerificationGas.toString()
              : "0x" + BigInt(packedOp.preVerificationGas).toString(16),
        maxFeePerGas: "0x" + gasFees.maxFeePerGas.toString(16),
        maxPriorityFeePerGas: "0x" + gasFees.maxPriorityFeePerGas.toString(16),
        signature: packedOp.signature || "0x",
      };

      if (factory) result.factory = factory;
      if (factoryData) result.factoryData = factoryData;

      if (paymaster) {
        result.paymaster = paymaster;
        result.paymasterVerificationGasLimit = paymasterVerificationGasLimit || "0x30000";
        result.paymasterPostOpGasLimit = paymasterPostOpGasLimit || "0x30000";
        if (paymasterData && paymasterData !== "0x") {
          result.paymasterData = paymasterData;
        }
      }

      return result;
    }

    // v0.6 format
    const op = userOp as UserOperation;
    return {
      sender: op.sender,
      nonce: "0x" + op.nonce.toString(16),
      initCode: op.initCode,
      callData: op.callData,
      callGasLimit: "0x" + op.callGasLimit.toString(16),
      verificationGasLimit: "0x" + op.verificationGasLimit.toString(16),
      preVerificationGas: "0x" + op.preVerificationGas.toString(16),
      maxFeePerGas: "0x" + op.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + op.maxPriorityFeePerGas.toString(16),
      paymasterAndData: op.paymasterAndData,
      signature: op.signature,
    };
  }
}
