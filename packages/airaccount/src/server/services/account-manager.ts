import { zeroAddress, parseEther, type Address } from "viem";
// AIRACCOUNT_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's encodeFunctionData during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi, encodeFunctionData } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import { solidityPacked } from "../../migration/viem/abi-encoding";
import { EthereumProvider } from "../providers/ethereum-provider";
import {
  readPredictedAddress,
  readPredictedAddressWithDefaults,
} from "../providers/typed-reads";
import { IStorageAdapter, AccountRecord } from "../interfaces/storage-adapter";
import { ISignerAdapter } from "../interfaces/signer-adapter";
import { EntryPointVersion, AIRACCOUNT_FACTORY_ABI, AIRACCOUNT_ABI } from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import {
  buildFullInitConfig,
  toGuardianSpecs,
  serializeGuardianSpecs,
  initConfigToTuple,
  type FullConfigGuardianParams,
  type P256GuardianKey,
} from "./account-init-config";

// v0.20.0 (#120): InitConfig gained bytes32[3] guardianP256X / guardianP256Y (P-256 guardian
// keys) right after `guardians`. ECDSA-only accounts pass three zero words for each.
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;
const EMPTY_P256: readonly [`0x${string}`, `0x${string}`, `0x${string}`] = [ZERO32, ZERO32, ZERO32];

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
      salt?: number | bigint;
      /** Daily transfer limit in wei. When > 0 the account is created with on-chain guard enforcement. */
      dailyLimit?: bigint;
      /**
       * P-256 (passkey) guardians to install at deploy time. When present, the account is created
       * via the full-config createAccount(owner, salt, config) path (delegates to
       * {@link createAccountWithP256Guardians}); `dailyLimit` MUST be > 0 (guardians enable the guard).
       */
      p256Guardians?: P256GuardianKey[];
      /** Optional ECDSA guardians installed via the same full-config path (no acceptance sig required). */
      ecdsaGuardians?: Address[];
      /** Validator algorithm ids approved at init (full-config path). Defaults to ECDSA (+P-256). */
      approvedAlgIds?: number[];
      /** Floor the daily limit may be lowered to via the guard (full-config path). Defaults to 0. */
      minDailyLimit?: bigint;
    }
  ): Promise<AccountRecord> {
    // Full-config path: any passkey (P-256) guardian routes through the 8-field InitConfig builder
    // so the deploy-time initCode can inject guardianP256X/Y (the ECDSA-only createAccountWithDefaults
    // path cannot). See createAccountWithP256Guardians for the contract-level rationale.
    if (options?.p256Guardians && options.p256Guardians.length > 0) {
      return this.createAccountWithP256Guardians(userId, {
        p256Guardians: options.p256Guardians,
        ecdsaGuardians: options.ecdsaGuardians,
        dailyLimit: options.dailyLimit ?? 0n,
        approvedAlgIds: options.approvedAlgIds,
        minDailyLimit: options.minDailyLimit,
        salt: options.salt,
        entryPointVersion: options.entryPointVersion,
      });
    }

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
      (this.ethereum.getValidatorContract(version).address as string) ||
      this.ethereum.getValidatorAddress(version);

    // Ensure signer wallet exists
    const { address: signerAddress } = await this.signer.ensureSigner(userId);
    const salt = options?.salt ?? Math.floor(Math.random() * 1000000);

    // Predict account address using M5 factory (createAccount with minimal config).
    // When dailyLimit > 0, write it into the config so the account is guard-enabled at deployment.
    const dailyLimitValue = options?.dailyLimit ?? 0n;
    const minimalConfig = [
      [zeroAddress, zeroAddress, zeroAddress], // guardians (address[3])
      EMPTY_P256, // guardianP256X (bytes32[3]) — v0.20.0
      EMPTY_P256, // guardianP256Y (bytes32[3]) — v0.20.0
      dailyLimitValue, // dailyLimit (0 = no guard)
      [], // approvedAlgIds
      0n, // minDailyLimit
      [], // initialTokens
      [], // initialTokenConfigs
    ];
    // uint256 `salt` coerced to bigint via the typed wrapper. The predicted
    // address is the fund-custody address; the bigint encoding is byte-identical
    // to the JS-number `salt` reused in the deploy-time initCode, so the
    // counterfactual address is unchanged.
    const accountAddress = await readPredictedAddress(
      factory,
      signerAddress,
      BigInt(salt),
      minimalConfig
    );

    // Check deployment status
    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode({ address: accountAddress as Address });
      deployed = !!code && code !== "0x";
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
      factoryAddress: (factory.address as string) || this.ethereum.getFactoryAddress(version),
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
      balanceInWei: parseEther(balance).toString(),
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
   *
   * Encoding: keccak256(solidityPacked(
   *   ["string","uint256","address","address","uint256","uint256"],
   *   ["ACCEPT_GUARDIAN", chainId, factoryAddress, owner, salt, dailyLimit]
   * ))
   *
   * dailyLimit is bound in the hash (PR #47 / C-3) to prevent a front-runner from
   * replaying guardian sigs with a weaker limit on the same counterfactual address.
   *
   * Returns the RAW keccak256 hash (no EIP-191 prefix).
   * Guardians MUST sign via personal_sign / ethers.signMessage(ethers.getBytes(hash)).
   * Do NOT use eth_sign — the EIP-191 "\x19Ethereum Signed Message:\n32" prefix
   * is applied inside the contract (toEthSignedMessageHash) before ecrecover, not here.
   *
   * @returns raw hex keccak256 hash — encode this into the QR code shown to guardian devices
   */
  buildGuardianAcceptanceHash(
    owner: string,
    salt: number | bigint,
    factoryAddress: string,
    chainId: number,
    dailyLimit: bigint
  ): string {
    if (typeof salt === "number" && !Number.isSafeInteger(salt)) {
      throw new Error(
        `salt value ${salt} exceeds Number.MAX_SAFE_INTEGER; pass as bigint to avoid precision loss`
      );
    }
    // viem's encodePacked rejects plain `number` for uint256 — coerce to bigint.
    return keccak256(
      solidityPacked(
        ["string", "uint256", "address", "address", "uint256", "uint256"],
        ["ACCEPT_GUARDIAN", BigInt(chainId), factoryAddress, owner, BigInt(salt), dailyLimit]
      )
    );
  }

  /**
   * Encode calldata for modifyTierLimitsWithGuardians() — guardian-gated tier-limit change (PR #43).
   *
   * Both tier1 and tier2 can be raised or lowered, subject to guardian approval.
   * Caller is responsible for building and submitting the resulting UserOp.
   *
   * @param tier1        New Tier-1 ceiling in wei (ECDSA-only spending; 0 = no limit)
   * @param tier2        New Tier-2 ceiling in wei (dual-factor; 0 = no limit)
   * @param deadline     Unix timestamp — guardian sigs rejected after this
   * @param guardianSigs 65-byte EIP-191 hex signatures from required guardians
   */
  encodeModifyTierLimits(
    tier1: bigint,
    tier2: bigint,
    deadline: bigint,
    guardianSigs: string[]
  ): string {
    return encodeFunctionData({
      abi: parseAbi(AIRACCOUNT_ABI),
      functionName: "modifyTierLimitsWithGuardians",
      args: [tier1, tier2, deadline, guardianSigs as `0x${string}`[]],
    });
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
      salt?: number | bigint;
      entryPointVersion?: EntryPointVersion;
    }
  ): Promise<AccountRecord> {
    if (params.guardian1.toLowerCase() === params.guardian2.toLowerCase()) {
      throw new Error("guardian1 and guardian2 must be different addresses");
    }
    if (params.dailyLimit <= 0n) {
      throw new Error("Guardian accounts require dailyLimit > 0 (on-chain enforcement)");
    }

    const version = params.entryPointVersion ?? this.ethereum.getDefaultVersion();
    if (version === EntryPointVersion.V0_6) {
      throw new Error(
        "createAccountWithGuardians requires EntryPoint v0.7 or v0.8; " +
          "v0.6 factory does not support getAddressWithDefaults"
      );
    }
    const versionStr = version as string;

    const existingAccounts = await this.storage.getAccounts();
    const existing = existingAccounts.find(
      a => a.userId === userId && a.entryPointVersion === versionStr && a.guardian1
    );
    if (existing) return existing;

    const { address: signerAddress } = await this.signer.ensureSigner(userId);
    const salt = params.salt ?? Math.floor(Math.random() * 1000000);

    const factory = this.ethereum.getFactoryContract(version);
    const factoryAddress = (factory.address as string) ?? this.ethereum.getFactoryAddress(version);

    // uint256 `salt` and `dailyLimit` are enforced as bigint by the typed wrapper.
    const accountAddress = await readPredictedAddressWithDefaults(
      factory,
      signerAddress,
      BigInt(salt),
      params.guardian1,
      params.guardian2,
      params.dailyLimit
    );

    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode({ address: accountAddress as Address });
      deployed = !!code && code !== "0x";
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
      // Persist guardian addresses and sigs so transfer-manager can use createAccountWithDefaults
      // to reconstruct the correct initCode on first UserOp deployment.
      guardian1: params.guardian1,
      guardian1Sig: params.guardian1Sig,
      guardian2: params.guardian2,
      guardian2Sig: params.guardian2Sig,
    };

    await this.storage.saveAccount(account);
    this.logger.log(`[AccountManager] account created with guardians: ${accountAddress}`);
    return account;
  }

  /**
   * Create an AirAccount with one or more P-256 (WebAuthn passkey) guardians installed at
   * DEPLOY time — the server-client path #118 adds for KMS-custodied / counterfactual accounts
   * (e.g. YAA) that cannot drive the viem extension layer for account creation.
   *
   * Uses the factory's full-config `createAccount(owner, salt, config)` path because it is the
   * ONLY entrypoint that accepts an 8-field `InitConfig` (and therefore `guardianP256X/Y`). The
   * 8-field config is built by the core `buildInitConfig` (0.22.0) — never hand-rolled — and the
   * address is predicted via the factory's full-config `getAddress(owner, salt, config)` (NOT
   * `getAddressWithDefaults`), binding the address to `keccak256(config)`.
   *
   * ### Acceptance-signature semantics (verified against AAStarAirAccountFactoryV7.sol)
   * On this path the contract performs NO guardian-acceptance signature check — for P-256 OR ECDSA
   * guardians. Front-run protection comes from `_getSalt(owner, salt, _getConfigHash(config))`:
   * any change to the guardian set (or any other config field) yields a different CREATE2 address,
   * so an attacker cannot collide on the victim's counterfactual address with a weaker config.
   * P-256 guardians are an owner-bootstrap (single guardian can't form a recovery quorum), so no
   * acceptance ceremony exists for them by design (#110④). This is why optional ECDSA guardians may
   * also be passed here WITHOUT signatures — distinct from createAccountWithGuardians(), which uses
   * the owner-only-salt `createAccountWithDefaults` path and DOES require ECDSA acceptance sigs.
   *
   * The deploy UserOp is still signed by the existing KMS owner-key path (unchanged): this method
   * only predicts the address and persists the full config; transfer-manager rebuilds the
   * byte-identical initCode (via {@link initConfigFromRecord}) at first-UserOp deploy time.
   *
   * @throws if no P-256 guardian is supplied, dailyLimit <= 0, or EntryPoint is v0.6.
   */
  async createAccountWithP256Guardians(
    userId: string,
    params: {
      /** P-256 (passkey) guardian public keys to install at deploy time (at least one required). */
      p256Guardians: P256GuardianKey[];
      /** Optional ECDSA guardians installed via the same full-config path (no acceptance sig). */
      ecdsaGuardians?: Address[];
      /** Daily spend limit in wei. MUST be > 0 — a guardian set enables the on-chain guard. */
      dailyLimit: bigint;
      /** Validator algorithm ids approved at init. Defaults to ECDSA (+P-256 when a passkey is present). */
      approvedAlgIds?: number[];
      /** Floor the daily limit may be lowered to via the guard. Defaults to 0. */
      minDailyLimit?: bigint;
      salt?: number | bigint;
      entryPointVersion?: EntryPointVersion;
    }
  ): Promise<AccountRecord> {
    if (!params.p256Guardians || params.p256Guardians.length === 0) {
      throw new Error("createAccountWithP256Guardians requires at least one P-256 guardian");
    }
    if (params.dailyLimit <= 0n) {
      throw new Error(
        "P-256 guardian accounts require dailyLimit > 0 (a guardian set enables the on-chain guard)"
      );
    }

    const version = params.entryPointVersion ?? this.ethereum.getDefaultVersion();
    if (version === EntryPointVersion.V0_6) {
      throw new Error(
        "createAccountWithP256Guardians requires EntryPoint v0.7 or v0.8; " +
          "the v0.6 factory does not support the full-config createAccount(InitConfig) path"
      );
    }
    const versionStr = version as string;

    // Build the FULL 8-field InitConfig (incl. guardianP256X/Y) via the core builder. This also
    // validates: <= 3 guardians, P-256 coords all-or-nothing + non-zero, sentinel misuse, dailyLimit > 0.
    const fullParams: FullConfigGuardianParams = {
      p256Guardians: params.p256Guardians,
      ecdsaGuardians: params.ecdsaGuardians,
      dailyLimit: params.dailyLimit,
      approvedAlgIds: params.approvedAlgIds,
      minDailyLimit: params.minDailyLimit,
    };
    const specs = toGuardianSpecs(fullParams);
    const config = buildFullInitConfig(fullParams);

    // One full-config (P-256) account per (user, version) — idempotent like the other create paths.
    const existingAccounts = await this.storage.getAccounts();
    const existing = existingAccounts.find(
      a =>
        a.userId === userId &&
        a.entryPointVersion === versionStr &&
        !!a.guardianSpecs &&
        a.guardianSpecs.length > 0
    );
    if (existing) return existing;

    const { address: signerAddress } = await this.signer.ensureSigner(userId);
    // #118 M2: a JS-number salt outside the 53-bit safe range silently truncates, so the predicted
    // and deploy-time salts would diverge -> different CREATE2 address -> stranded funds. Reject it
    // (pass a bigint for large salts) and persist a lossless DECIMAL STRING below.
    if (typeof params.salt === "number" && !Number.isSafeInteger(params.salt)) {
      throw new Error(
        `salt value ${params.salt} exceeds Number.MAX_SAFE_INTEGER; pass it as a bigint to avoid precision loss`
      );
    }
    const saltBig = BigInt(params.salt ?? Math.floor(Math.random() * 1000000));

    const factory = this.ethereum.getFactoryContract(version);
    const factoryAddress = (factory.address as string) ?? this.ethereum.getFactoryAddress(version);

    // Predict via the FULL-config getAddress(owner, salt, config). The address is bound to
    // keccak256(config), so the deploy-time initCode MUST embed the byte-identical config AND the
    // identical salt (transfer-manager rebuilds both from the persisted record fields below).
    const accountAddress = await readPredictedAddress(
      factory,
      signerAddress,
      saltBig,
      initConfigToTuple(config)
    );

    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode({ address: accountAddress as Address });
      deployed = !!code && code !== "0x";
    } catch {
      // Assume not deployed
    }

    const validatorAddress = this.ethereum.getValidatorAddress(version);
    const account: AccountRecord = {
      userId,
      address: accountAddress,
      signerAddress,
      // Persist as a lossless decimal string (#118 M2); transfer-manager rebuilds via BigInt(account.salt).
      salt: saltBig.toString(),
      deployed,
      deploymentTxHash: null,
      validatorAddress,
      entryPointVersion: versionStr,
      factoryAddress,
      createdAt: new Date().toISOString(),
      dailyLimit: params.dailyLimit.toString(),
      // Persist the RESOLVED config so transfer-manager rebuilds byte-identical initCode at deploy.
      guardianSpecs: serializeGuardianSpecs(specs),
      approvedAlgIds: [...config.approvedAlgIds],
      minDailyLimit: config.minDailyLimit.toString(),
    };

    await this.storage.saveAccount(account);
    this.logger.log(
      `[AccountManager] account created with ${params.p256Guardians.length} P-256 guardian(s): ${accountAddress}`
    );
    return account;
  }
}
