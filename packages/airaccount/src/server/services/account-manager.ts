import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter, AccountRecord } from "../interfaces/storage-adapter";
import { ISignerAdapter } from "../interfaces/signer-adapter";
import { EntryPointVersion } from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

/**
 * Account manager — extracted from NestJS AccountService.
 * Creates and retrieves smart accounts without framework dependencies.
 */
export class AccountManager {
  private readonly logger: ILogger;

  constructor(
    private readonly ethereum: EthereumProvider,
    private readonly storage: IStorageAdapter,
    private readonly signer: ISignerAdapter,
    logger?: ILogger
  ) {
    this.logger = logger ?? new ConsoleLogger("[AccountManager]");
  }

  async createAccount(
    userId: string,
    options?: {
      entryPointVersion?: EntryPointVersion;
      salt?: number;
    }
  ): Promise<AccountRecord> {
    const version = options?.entryPointVersion ?? this.ethereum.getDefaultVersion();
    const versionStr = version as string;

    // Check for existing account with this version
    const existingAccounts = await this.storage.getAccounts();
    const existing = existingAccounts.find(
      a => a.userId === userId && a.entryPointVersion === versionStr
    );
    if (existing) return existing;

    const factory = this.ethereum.getFactoryContract(version);
    const validatorAddress =
      ((this.ethereum.getValidatorContract(version) as ethers.BaseContract).target as string) ||
      this.ethereum.getValidatorAddress(version);

    // Ensure signer wallet exists
    const { address: signerAddress } = await this.signer.ensureSigner(userId);
    const salt = options?.salt ?? Math.floor(Math.random() * 1000000);

    // Predict account address using new M4 factory (createAccountWithDefaults)
    const zeroAddr = ethers.ZeroAddress;
    const defaultDailyLimit = ethers.parseEther("1000"); // 1000 ETH daily limit
    const accountAddress = await factory.getAddressWithDefaults(
      signerAddress,
      salt,
      zeroAddr,
      zeroAddr,
      defaultDailyLimit
    );

    // Check deployment status
    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode(accountAddress);
      deployed = code !== "0x";
    } catch {
      // Assume not deployed
    }

    const account: AccountRecord = {
      userId,
      address: accountAddress,
      signerAddress,
      salt,
      deployed,
      deploymentTxHash: null,
      validatorAddress,
      entryPointVersion: versionStr,
      factoryAddress: (factory.target as string) || this.ethereum.getFactoryAddress(version),
      createdAt: new Date().toISOString(),
    };

    await this.storage.saveAccount(account);
    return account;
  }

  async getAccount(
    userId: string
  ): Promise<(AccountRecord & { balance: string; nonce: string }) | null> {
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) return null;

    let balance = "0";
    try {
      balance = await this.ethereum.getBalance(account.address);
    } catch {
      // Use default
    }

    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;
    const nonce = await this.ethereum.getNonce(account.address, 0, version);

    return { ...account, balance, nonce: nonce.toString() };
  }

  async getAccountAddress(userId: string): Promise<string> {
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) throw new Error("Account not found");
    return account.address;
  }

  async getAccountBalance(
    userId: string
  ): Promise<{ address: string; balance: string; balanceInWei: string }> {
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) throw new Error("Account not found");
    const balance = await this.ethereum.getBalance(account.address);
    return {
      address: account.address,
      balance,
      balanceInWei: ethers.parseEther(balance).toString(),
    };
  }

  async getAccountNonce(userId: string): Promise<{ address: string; nonce: string }> {
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) throw new Error("Account not found");
    const nonce = await this.ethereum.getNonce(account.address);
    return { address: account.address, nonce: nonce.toString() };
  }

  async getAccountByUserId(userId: string): Promise<AccountRecord | null> {
    return this.storage.findAccountByUserId(userId);
  }
}
