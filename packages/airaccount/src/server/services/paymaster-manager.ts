import { concat, getContract, numberToHex, zeroAddress, type Address, type Hex, type WalletClient } from "viem";
// PAYMASTER_PRICE_ABI / the SuperPaymaster-detection ABI are local human-readable
// signature arrays (not in @aastar/core); parseAbi is required to feed them to
// viem's getContract / writeContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter, PaymasterRecord } from "../interfaces/storage-adapter";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

/**
 * Thrown when a paymaster's on-chain price cache is stale.
 * Caller should invoke `paymasterManager.updatePrice(paymasterAddress)` before retrying.
 */
export class PaymasterPriceStalenessError extends Error {
  constructor(
    public readonly paymasterAddress: string,
    public readonly ageSeconds: number,
    public readonly thresholdSeconds: number
  ) {
    super(
      `Paymaster ${paymasterAddress} price is stale ` +
        `(age: ${Math.floor(ageSeconds / 60)}min, threshold: ${Math.floor(thresholdSeconds / 60)}min). ` +
        `Call updatePrice() on the paymaster contract before retrying.`
    );
    this.name = "PaymasterPriceStalenessError";
  }
}

const PAYMASTER_PRICE_ABI = parseAbi([
  "function token() view returns (address)",
  "function cachedPriceTimestamp() view returns (uint256)",
  "function priceStalenessThreshold() view returns (uint256)",
  "function updatePrice() external",
]);

const SUPER_PAYMASTER_DETECT_ABI = parseAbi([
  "function owner() view returns (address)",
  "function operators(address) view returns (bool,uint256,address,uint256)",
]);

/**
 * Paymaster manager — extracted from NestJS PaymasterService.
 * Storage via IStorageAdapter instead of filesystem JSON files.
 */
export class PaymasterManager {
  private readonly logger: ILogger;

  constructor(
    private readonly ethereum: EthereumProvider,
    private readonly storage: IStorageAdapter,
    logger?: ILogger
  ) {
    this.logger = logger ?? new ConsoleLogger("[PaymasterManager]");
  }

  async getAvailablePaymasters(
    userId: string
  ): Promise<{ name: string; address: string; configured: boolean }[]> {
    const paymasters = await this.storage.getPaymasters(userId);
    return paymasters.map(config => ({
      name: config.name,
      address: config.address,
      configured: !!config.address && config.address !== "0x",
    }));
  }

  async addCustomPaymaster(
    userId: string,
    name: string,
    address: string,
    type: "pimlico" | "stackup" | "alchemy" | "custom" = "custom",
    apiKey?: string,
    endpoint?: string
  ): Promise<void> {
    const paymaster: PaymasterRecord = {
      id: `${userId}-${name}-${Date.now()}`,
      name,
      address,
      type,
      apiKey,
      endpoint,
      createdAt: new Date().toISOString(),
    };
    await this.storage.savePaymaster(userId, paymaster);
  }

  async removeCustomPaymaster(userId: string, name: string): Promise<boolean> {
    return this.storage.removePaymaster(userId, name);
  }

  /**
   * Check whether a paymaster's on-chain price cache is still fresh.
   * Returns `{ fresh, ageSeconds, thresholdSeconds }`.
   * Throws if the contract does not implement `cachedPriceTimestamp()` / `priceStalenessThreshold()`.
   */
  async checkPriceFreshness(paymasterAddress: string): Promise<{
    fresh: boolean;
    ageSeconds: number;
    thresholdSeconds: number;
  }> {
    const provider = this.ethereum.getProvider();
    const contract = getContract({
      address: paymasterAddress as Address,
      abi: PAYMASTER_PRICE_ABI,
      client: provider,
    });
    const [timestamp, threshold] = await Promise.all([
      contract.read.cachedPriceTimestamp() as Promise<bigint>,
      contract.read.priceStalenessThreshold() as Promise<bigint>,
    ]);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - Number(timestamp);
    const thresholdSeconds = Number(threshold);
    return {
      fresh: ageSeconds <= thresholdSeconds,
      ageSeconds,
      thresholdSeconds,
    };
  }

  /**
   * Call `updatePrice()` on a paymaster contract (permissionless).
   * Useful when `checkPriceFreshness()` reports stale price.
   *
   * @param walletClient - A viem WalletClient (with an account) that will send
   *   the transaction (must have gas). Replaces the former ethers Signer param.
   */
  async updatePrice(paymasterAddress: string, walletClient: WalletClient): Promise<string> {
    const account = walletClient.account;
    if (!account) {
      throw new Error("updatePrice requires a WalletClient with a configured account");
    }
    const hash = await walletClient.writeContract({
      address: paymasterAddress as Address,
      abi: PAYMASTER_PRICE_ABI,
      functionName: "updatePrice",
      args: [],
      gas: BigInt(300_000),
      account,
      chain: walletClient.chain,
    });
    await this.ethereum.getProvider().waitForTransactionReceipt({ hash });
    this.logger.log(`Paymaster ${paymasterAddress} price updated, tx: ${hash}`);
    return hash;
  }

  async getPaymasterData(
    userId: string,
    paymasterName: string,
    userOp: unknown,
    entryPoint: string,
    customAddress?: string,
    options?: { tokenAddress?: string }
  ): Promise<string> {
    // Handle custom user-provided paymaster addresses
    if (paymasterName === "custom-user-provided" && customAddress) {
      const formattedAddress = customAddress.toLowerCase().startsWith("0x")
        ? customAddress
        : `0x${customAddress}`;

      if (!/^0x[a-fA-F0-9]{40}$/.test(formattedAddress)) {
        throw new Error(`Invalid paymaster address format: ${customAddress}`);
      }

      const isV07OrV08 =
        entryPoint.toLowerCase() === "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase() ||
        entryPoint.toLowerCase() === "0x0576a174D229E3cFA37253523E645A78A0C91B57".toLowerCase();

      if (isV07OrV08) {
        const provider = this.ethereum.getProvider();

        // Detect SuperPaymaster vs PaymasterV4
        let isSuperPaymaster = false;
        let operatorAddress = "0x";
        try {
          const spContract = getContract({
            address: formattedAddress as Address,
            abi: SUPER_PAYMASTER_DETECT_ABI,
            client: provider,
          });
          const owner = (await spContract.read.owner()) as Address;
          const opInfo = (await spContract.read.operators([owner])) as readonly [
            boolean,
            bigint,
            Address,
            bigint,
          ];
          if (opInfo && opInfo[0] === true) {
            isSuperPaymaster = true;
            operatorAddress = owner;
            this.logger.log(`SuperPaymaster detected, operator: ${operatorAddress}`);
          }
        } catch {
          /* not SuperPaymaster */
        }

        if (isSuperPaymaster) {
          const verGas = BigInt(80000);
          // recordXPNTsDebt + event emit in postOp observed ~117k gas on Sepolia; 300k gives safe headroom.
          const postGas = BigInt(300_000);
          const maxRate = (BigInt(1) << BigInt(256)) - BigInt(1);
          return concat([
            formattedAddress as Hex,
            numberToHex(verGas, { size: 16 }),
            numberToHex(postGas, { size: 16 }),
            operatorAddress as Hex,
            numberToHex(maxRate, { size: 32 }),
          ]);
        }

        // PaymasterV4 deposit model: paymasterData contains the ERC-20 token address
        // that the user pays gas with (20 bytes appended after the gas limits).
        // Auto-detect via token() on the contract; fall back to empty if not available.
        const paymasterVerificationGasLimit = BigInt(0x30000);
        const paymasterPostOpGasLimit = BigInt(0x30000);

        let tokenAddress: string | null = options?.tokenAddress ?? null;
        if (tokenAddress) {
          this.logger.log(`PaymasterV4 token from options: ${tokenAddress}`);
        } else {
          try {
            const pmContract = getContract({
              address: formattedAddress as Address,
              abi: PAYMASTER_PRICE_ABI,
              client: provider,
            });
            tokenAddress = (await pmContract.read.token()) as string;
            if (tokenAddress === zeroAddress) tokenAddress = null;
            if (tokenAddress) {
              this.logger.log(`PaymasterV4 token auto-detected: ${tokenAddress}`);
            }
          } catch {
            this.logger.log(`PaymasterV4 token() not available, paymasterData will have no token`);
          }
        }

        const parts: Hex[] = [
          formattedAddress as Hex,
          numberToHex(paymasterVerificationGasLimit, { size: 16 }),
          numberToHex(paymasterPostOpGasLimit, { size: 16 }),
        ];
        if (tokenAddress) {
          parts.push(tokenAddress as Hex);
        }
        return concat(parts);
      }

      return formattedAddress;
    }

    const paymasters = await this.storage.getPaymasters(userId);
    const config = paymasters.find(p => p.name === paymasterName);
    if (!config) {
      throw new Error(`Paymaster ${paymasterName} not found`);
    }

    switch (config.type) {
      case "pimlico":
        if (!config.apiKey) return "0x";
        return this.getPimlicoPaymasterData(config, userOp, entryPoint);
      case "stackup":
        if (!config.apiKey) return "0x";
        return this.getStackUpPaymasterData(config, userOp, entryPoint);
      case "alchemy":
        if (!config.apiKey) return "0x";
        return this.getAlchemyPaymasterData(config, userOp, entryPoint);
      case "custom":
        if (
          config.address.toLowerCase() ===
            "0x0000000000325602a77416A16136FDafd04b299f".toLowerCase() &&
          config.apiKey
        ) {
          return this.getPimlicoPaymasterData(
            { ...config, type: "pimlico", endpoint: "https://api.pimlico.io/v2/11155111/rpc" },
            userOp,
            entryPoint
          );
        }
        return config.address;
      default:
        return "0x";
    }
  }

  private async getPimlicoPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string
  ): Promise<string> {
    const url = `${config.endpoint}?apikey=${config.apiKey}`;
    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "pm_sponsorUserOperation",
        params: [userOp, entryPoint, {}],
        id: 1,
      }),
    });

    const result = (await response.json()) as {
      error?: { message?: string };
      result?: {
        paymasterAndData?: string;
        paymaster?: string;
        paymasterVerificationGasLimit?: string;
        paymasterPostOpGasLimit?: string;
        paymasterData?: string;
      };
    };

    if (result.error) {
      throw new Error(
        `Pimlico sponsorship failed: ${result.error.message || JSON.stringify(result.error)}`
      );
    }

    if (result.result) {
      if (result.result.paymasterAndData) {
        return result.result.paymasterAndData;
      }
      if (result.result.paymaster) {
        return concat([
          result.result.paymaster as Hex,
          numberToHex(BigInt(result.result.paymasterVerificationGasLimit || "0x30000"), {
            size: 16,
          }),
          numberToHex(BigInt(result.result.paymasterPostOpGasLimit || "0x30000"), { size: 16 }),
          (result.result.paymasterData || "0x") as Hex,
        ]);
      }
    }

    throw new Error("Pimlico API did not return valid paymaster data");
  }

  private async getStackUpPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_sponsorUserOperation",
          params: { userOperation: userOp, entryPoint, context: { type: "payg" } },
          id: 1,
        }),
      });
      const result = (await response.json()) as { error?: unknown; result?: string };
      if (result.error) return "0x";
      return result.result || "0x";
    } catch {
      return "0x";
    }
  }

  private async getAlchemyPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "alchemy_requestGasAndPaymasterAndData",
          params: [{ policyId: "default", entryPoint, userOperation: userOp }],
          id: 1,
        }),
      });
      const result = (await response.json()) as {
        error?: unknown;
        result?: { paymasterAndData?: string };
      };
      if (result.error) return "0x";
      return result.result?.paymasterAndData || "0x";
    } catch {
      return "0x";
    }
  }
}
