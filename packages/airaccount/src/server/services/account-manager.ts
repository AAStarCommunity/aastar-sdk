import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter, AccountRecord } from "../interfaces/storage-adapter";
import { ISignerAdapter } from "../interfaces/signer-adapter";
import { EntryPointVersion, AIRACCOUNT_FACTORY_ABI, AIRACCOUNT_ADDRESSES } from "../constants/entrypoint";
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
      /** Daily transfer limit in wei. When > 0 the account is created with on-chain guard enforcement. */
      dailyLimit?: bigint;
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

    // Predict account address using M5 factory (createAccount with minimal config).
    // When dailyLimit > 0, write it into the config so the account is guard-enabled at deployment.
    const dailyLimitValue = options?.dailyLimit ?? 0n;
    const minimalConfig = [
      [ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress], // guardians (address[3])
      dailyLimitValue, // dailyLimit (0 = no guard)
      [], // approvedAlgIds
      0n, // minDailyLimit
      [], // initialTokens
      [], // initialTokenConfigs
    ];
    const accountAddress = await factory.getFunction("getAddress")(signerAddress, salt, minimalConfig);

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
      // Persist dailyLimit so buildUserOperation can reconstruct identical initCode at deploy time.
      ...(dailyLimitValue > 0n ? { dailyLimit: dailyLimitValue.toString() } : {}),
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

  /**
   * Build the acceptance hash that guardian devices must sign before account creation.
   * The hash is domain-separated: keccak256("ACCEPT_GUARDIAN" || chainId || factory || owner || salt)
   * Each guardian signs the EIP-191 prefixed version: ethers.hashMessage(ethers.getBytes(hash))
   *
   * @returns hex hash string — encode this into the QR code shown to guardian devices
   */
  buildGuardianAcceptanceHash(
    owner: string,
    salt: number,
    factoryAddress: string,
    chainId: number
  ): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ["string", "uint256", "address", "address", "uint256"],
        ["ACCEPT_GUARDIAN", chainId, factoryAddress, owner, salt]
      )
    );
  }

  /**
   * Create an AirAccount with 3 on-chain guardians:
   *   - guardian1 and guardian2: user's own devices (passkeys on phone 1 and phone 2)
   *   - guardian3: team Safe multisig (defaultCommunityGuardian, set in factory at deploy time)
   *
   * Both guardian1 and guardian2 must sign the acceptance hash produced by
   * buildGuardianAcceptanceHash() before this method is called.
   *
   * Recovery: any 2-of-3 guardians can initiate social recovery after a 48h timelock.
   */
  async createAccountWithGuardians(
    userId: string,
    params: {
      guardian1: string;
      guardian1Sig: string;
      guardian2: string;
      guardian2Sig: string;
      dailyLimit: bigint;
      salt?: number;
      entryPointVersion?: EntryPointVersion;
    }
  ): Promise<AccountRecord> {
    const version = params.entryPointVersion ?? this.ethereum.getDefaultVersion();
    const versionStr = version as string;

    const existingAccounts = await this.storage.getAccounts();
    const existing = existingAccounts.find(
      a => a.userId === userId && a.entryPointVersion === versionStr
    );
    if (existing) return existing;

    const { address: signerAddress } = await this.signer.ensureSigner(userId);
    const salt = params.salt ?? Math.floor(Math.random() * 1000000);

    const factoryAddress = this.ethereum.getFactoryAddress(version);
    const factory = new ethers.Contract(
      factoryAddress,
      AIRACCOUNT_FACTORY_ABI,
      this.ethereum.getProvider()
    );

    const accountAddress = await factory.getFunction("getAddressWithDefaults")(
      signerAddress,
      salt,
      params.guardian1,
      params.guardian2,
      params.dailyLimit
    );

    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode(accountAddress);
      deployed = code !== "0x";
    } catch {
      // Assume not deployed
    }

    const validatorAddress = this.ethereum.getValidatorAddress(version);
    const account: AccountRecord = {
      userId,
      address: accountAddress,
      signerAddress,
      salt,
      deployed,
      deploymentTxHash: null,
      validatorAddress,
      entryPointVersion: versionStr,
      factoryAddress,
      createdAt: new Date().toISOString(),
      // Persist dailyLimit so transfer-manager can reconstruct identical initCode at deploy time.
      ...(params.dailyLimit > 0n ? { dailyLimit: params.dailyLimit.toString() } : {}),
    };

    await this.storage.saveAccount(account);
    this.logger.log(`[AccountManager] account created with guardians: ${accountAddress}`);
    return account;
  }
}
