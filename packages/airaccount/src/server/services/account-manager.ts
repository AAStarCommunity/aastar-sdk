import { zeroAddress, parseEther, hexToBytes, bytesToHex, type Address, type Hash, type WalletClient } from "viem";
import { randomUUID } from "node:crypto";
// AIRACCOUNT_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's encodeFunctionData during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi, encodeFunctionData } from "viem";
import {
  needsValidatorRouter,
  getCanonicalAddresses,
  airAccountActions,
  airAccountFactoryActions,
  buildCreateAccountHash,
} from "@aastar/core";
import type { Hex } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import { solidityPacked } from "../../migration/viem/abi-encoding";
import { EthereumProvider } from "../providers/ethereum-provider";
import {
  readPredictedAddress,
  readPredictedAddressWithDefaults,
} from "../providers/typed-reads";
import { IStorageAdapter, AccountRecord } from "../interfaces/storage-adapter";
import { ISignerAdapter, type SignerAuthContext } from "../interfaces/signer-adapter";
import { EntryPointVersion, AIRACCOUNT_FACTORY_ABI, AIRACCOUNT_ABI } from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import {
  buildFullInitConfig,
  toGuardianSpecs,
  serializeGuardianSpecs,
  initConfigToTuple,
  initConfigFromRecord,
  type FullConfigGuardianParams,
  type P256GuardianKey,
} from "./account-init-config";

// v0.20.0 (#120): InitConfig gained bytes32[3] guardianP256X / guardianP256Y (P-256 guardian
// keys) right after `guardians`. ECDSA-only accounts pass three zero words for each.
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;
const EMPTY_P256: readonly [`0x${string}`, `0x${string}`, `0x${string}`] = [ZERO32, ZERO32, ZERO32];

/**
 * Result of {@link AccountManager.ensureValidatorRouter}.
 * `set: true` only when an on-chain `setValidator(router)` tx was actually sent (`tx`
 * carries the hash). `set: false` is a no-op with a `reason` explaining the decision.
 */
export interface EnsureValidatorRouterResult {
  set: boolean;
  reason?: string;
  tx?: Hash;
  router?: Address;
}

/** Parameters shared by the inline ({@link AccountManager.createAccountWithPasskey}) and two-phase
 * ({@link AccountManager.prepareCreateAccountWithPasskey}) KMS passkey-at-birth create paths (#249). */
export interface PasskeyCreateParams {
  /** Owner device WebAuthn passkey public key (each bytes32) — injected at birth, NOT a guardian. */
  ownerP256X: Hex;
  ownerP256Y: Hex;
  /** Optional P-256 (passkey) guardians installed at deploy time. */
  p256Guardians?: P256GuardianKey[];
  /** Optional ECDSA guardians installed via the full-config path (no acceptance sig). */
  ecdsaGuardians?: Address[];
  /** Daily spend limit in wei. MUST be > 0 (enables the on-chain GUARD). */
  dailyLimit: bigint;
  /** Validator algorithm ids approved at init (e.g. [0x0a] for device-passkey Tier-3). */
  approvedAlgIds?: number[];
  minDailyLimit?: bigint;
  salt?: number | bigint;
  entryPointVersion?: EntryPointVersion;
  /** ownerSig validity window in seconds from now. Default 3600. */
  deadlineSeconds?: number;
}

/** Result of {@link AccountManager.prepareCreateAccountWithPasskey} — the frontend runs a WebAuthn
 * ceremony over `challenge`, then calls {@link AccountManager.submitPreparedCreateAccount}. */
export interface PreparedPasskeyCreate {
  /** Opaque handle for {@link AccountManager.submitPreparedCreateAccount}. */
  createId: string;
  /** Counterfactual account address (deploys here). */
  predictedAddress: Address;
  /** The CREATE_ACCOUNT digest the owner must sign (the WebAuthn ceremony challenge for KMS). 32-byte hex. */
  challenge: Hex;
  /** Set on the KMS path: the begun ceremony id + credential-request options for navigator.credentials.get(). */
  challengeId?: string;
  publicKeyOptions?: PublicKeyCredentialRequestOptions;
  nonce: bigint;
  deadline: bigint;
  /** True when the account is already deployed on-chain — no ceremony/submit needed. */
  alreadyDeployed: boolean;
}

/** Internal resolved plan shared by the create paths (validation + config + prediction + idempotency). */
interface ResolvedPasskeyCreate {
  userId: string;
  owner: Address;
  saltBig: bigint;
  config: ReturnType<typeof buildFullInitConfig>;
  specs: ReturnType<typeof toGuardianSpecs>;
  version: EntryPointVersion;
  versionStr: string;
  factoryAddress: Address;
  chainId: number;
  accountAddress: Address;
  ownerP256X: Hex;
  ownerP256Y: Hex;
  dailyLimit: bigint;
  existing?: AccountRecord;
  alreadyDeployed: boolean;
}

/**
 * Account manager — extracted from NestJS AccountService.
 * Creates and retrieves smart accounts without framework dependencies.
 */
export class AccountManager {
  private readonly logger: ILogger;
  /** In-memory store for two-phase passkey creates (prepare → ceremony → submit). Single-process;
   * a multi-worker deployment needs a shared store. Entries are TTL-evicted (the challenge is short-lived). */
  private readonly preparedCreates = new Map<string, {
    userId: string;
    plan: ResolvedPasskeyCreate;
    nonce: bigint;
    deadline: bigint;
    hash: Hex;
    challengeId?: string;
    createdAt: number;
  }>();
  private static readonly PREPARED_CREATE_TTL_MS = 5 * 60 * 1000;

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
    // Gap B: a router-delegated algId (BLS/T2/T3/weighted/session/...) cannot validate until the
    // account's validator router is wired via setValidator(). The factory does NOT auto-wire it, and
    // setValidator is onlyOwner + needs deployed code — so it CANNOT run at predict-time here (the
    // account is still counterfactual). Flag the explicit post-deploy step rather than attempting it now.
    if (needsValidatorRouter(config.approvedAlgIds)) {
      this.logger.log(
        `[AccountManager] account ${accountAddress} approved a router-delegated algorithm ` +
          `(approvedAlgIds=[${config.approvedAlgIds.join(", ")}]); use deployAndWireValidator(userId, ` +
          `{ walletClient }) to deploy + setValidator(router) in one call (or ensureValidatorRouter(userId) ` +
          `after a manual deploy) — required for those algIds to validate.`
      );
    }
    return account;
  }

  /**
   * KMS-style **passkey-at-birth** account creation via the v0.22.0 factory RELAY mode (#249) — INLINE
   * single-method form. Works for an EOA/local owner (signs the digest inline), OR a KMS owner IF you
   * already hold a ceremony assertion committed to the digest. For the STANDARD KMS flow where the user
   * runs the WebAuthn ceremony separately, use the two-phase {@link prepareCreateAccountWithPasskey} /
   * {@link submitPreparedCreateAccount} — the ceremony challenge must commit to the digest, which is only
   * known AFTER the nonce/deadline are resolved (so a single method can't hand the caller the challenge).
   *
   * The owner passkey (`ownerP256X/Y`) + validator are wired AT BIRTH in one `createAccount` tx. A KMS
   * owner key (TEE) can't send a raw tx, so authorization is an EIP-191 `ownerSig` over the SDK-built
   * CREATE_ACCOUNT digest ({@link buildCreateAccountHash} — never hand-rolled) and a funded
   * `deployerWallet` relays + pays gas.
   */
  async createAccountWithPasskey(
    userId: string,
    params: PasskeyCreateParams,
    opts: { deployerWallet: WalletClient; signerCtx?: SignerAuthContext }
  ): Promise<AccountRecord> {
    if (!opts?.deployerWallet?.account) {
      throw new Error("createAccountWithPasskey: opts.deployerWallet (funded relayer) is required");
    }
    const plan = await this._resolvePasskeyCreate(userId, params);
    if (plan.existing) return plan.existing;
    if (plan.alreadyDeployed) return this._persistPasskeyRecord(plan, null);

    const nonce = (await this._factoryRead(plan.factoryAddress).createNonces({ owner: plan.owner })) as bigint;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 3600));
    const hash = this._passkeyCreateHash(plan, nonce, deadline);
    // Sign the digest as RAW BYTES — a "0x…" string is EIP-191'd as UTF-8 by the KMS adapter (#249).
    const ownerSig = await this.signer.signMessage(userId, hexToBytes(hash), opts.signerCtx);
    return this._relayPasskeyDeploy(plan, nonce, deadline, ownerSig, opts.deployerWallet);
  }

  /**
   * Two-phase KMS passkey-at-birth — **PHASE 1** (#249). Resolves the account + computes the
   * CREATE_ACCOUNT digest (the only thing a KMS WebAuthn ceremony can commit its challenge to) and, for
   * KMS signers, BEGINS the ceremony. The frontend runs `navigator.credentials.get(publicKeyOptions)`
   * (or uses `challenge` directly) and passes the assertion to {@link submitPreparedCreateAccount}.
   *
   * Mirrors `prepareTransfer`/`submitPreparedTransfer` — necessary because the ceremony challenge must
   * commit to the digest, which depends on the internally-resolved nonce/deadline, so the caller cannot
   * precompute it (the chicken-and-egg the single-method form hits for separated-ceremony KMS owners).
   */
  async prepareCreateAccountWithPasskey(userId: string, params: PasskeyCreateParams): Promise<PreparedPasskeyCreate> {
    const plan = await this._resolvePasskeyCreate(userId, params);
    const createId = randomUUID();
    if (plan.existing || plan.alreadyDeployed) {
      // Nothing to sign — submit short-circuits to the existing/on-chain record.
      this.preparedCreates.set(createId, { userId, plan, nonce: 0n, deadline: 0n, hash: ZERO32, createdAt: Date.now() });
      return { createId, predictedAddress: plan.accountAddress, challenge: ZERO32, nonce: 0n, deadline: 0n, alreadyDeployed: true };
    }
    const nonce = (await this._factoryRead(plan.factoryAddress).createNonces({ owner: plan.owner })) as bigint;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 3600));
    const hash = this._passkeyCreateHash(plan, nonce, deadline);

    // KMS owner signing needs a challenge-bound ceremony over the EXACT digest submit will sign.
    let challengeId: string | undefined;
    let publicKeyOptions: PublicKeyCredentialRequestOptions | undefined;
    if (this.signer.beginCeremony) {
      ({ challengeId, publicKeyOptions } = await this.signer.beginCeremony(userId, hexToBytes(hash)));
    }
    this._evictExpiredCreates();
    this.preparedCreates.set(createId, { userId, plan, nonce, deadline, hash, challengeId, createdAt: Date.now() });
    return { createId, predictedAddress: plan.accountAddress, challenge: hash, challengeId, publicKeyOptions, nonce, deadline, alreadyDeployed: false };
  }

  /**
   * Two-phase KMS passkey-at-birth — **PHASE 2** (#249). Signs the prepared digest with the user's
   * ceremony assertion (KMS owner key, via `opts.signerCtx`) and relays `createAccount` through
   * `deployerWallet`. Returns the deployed record.
   */
  async submitPreparedCreateAccount(
    createId: string,
    opts: { deployerWallet: WalletClient; signerCtx?: SignerAuthContext }
  ): Promise<AccountRecord> {
    const entry = this.preparedCreates.get(createId);
    if (!entry) throw new Error(`submitPreparedCreateAccount: unknown or expired createId ${createId}`);
    if (Date.now() - entry.createdAt > AccountManager.PREPARED_CREATE_TTL_MS) {
      this.preparedCreates.delete(createId);
      throw new Error(`submitPreparedCreateAccount: prepared create ${createId} expired`);
    }
    if (!opts?.deployerWallet?.account) {
      throw new Error("submitPreparedCreateAccount: opts.deployerWallet (funded relayer) is required");
    }
    const { plan, nonce, deadline, hash } = entry;
    if (plan.existing) { this.preparedCreates.delete(createId); return plan.existing; }
    if (plan.alreadyDeployed) { this.preparedCreates.delete(createId); return this._persistPasskeyRecord(plan, null); }

    const ownerSig = await this.signer.signMessage(entry.userId, hexToBytes(hash), opts.signerCtx);
    const account = await this._relayPasskeyDeploy(plan, nonce, deadline, ownerSig, opts.deployerWallet);
    this.preparedCreates.delete(createId);
    return account;
  }

  // ── Private helpers shared by the inline + two-phase passkey-create paths ──────────────────────

  private _factoryRead(factoryAddress: Address) {
    return airAccountFactoryActions(factoryAddress)(this.ethereum.getProvider() as never);
  }

  private _passkeyCreateHash(plan: ResolvedPasskeyCreate, nonce: bigint, deadline: bigint): Hex {
    return buildCreateAccountHash({
      chainId: plan.chainId, factory: plan.factoryAddress, owner: plan.owner, salt: plan.saltBig,
      ownerP256X: plan.ownerP256X, ownerP256Y: plan.ownerP256Y, config: plan.config, nonce, deadline,
    });
  }

  private _evictExpiredCreates(): void {
    const now = Date.now();
    for (const [id, e] of this.preparedCreates) {
      if (now - e.createdAt > AccountManager.PREPARED_CREATE_TTL_MS) this.preparedCreates.delete(id);
    }
  }

  /** Validate + build config + predict + idempotency. Throws on bad input; sets existing/alreadyDeployed. */
  private async _resolvePasskeyCreate(userId: string, params: PasskeyCreateParams): Promise<ResolvedPasskeyCreate> {
    const zero32 = `0x${"00".repeat(32)}`;
    if (!params.ownerP256X || params.ownerP256X.toLowerCase() === zero32 ||
        !params.ownerP256Y || params.ownerP256Y.toLowerCase() === zero32) {
      throw new Error("createAccountWithPasskey requires a non-zero ownerP256X/Y (the owner device passkey)");
    }
    if (params.dailyLimit <= 0n) {
      throw new Error("createAccountWithPasskey requires dailyLimit > 0 (enables the on-chain guard)");
    }
    const version = params.entryPointVersion ?? this.ethereum.getDefaultVersion();
    if (version === EntryPointVersion.V0_6) {
      throw new Error("createAccountWithPasskey requires EntryPoint v0.7 or v0.8 (full-config createAccount)");
    }
    const versionStr = version as string;

    // The owner passkey is NOT a guardian — it is the explicit ownerP256X/Y.
    const fullParams: FullConfigGuardianParams = {
      p256Guardians: params.p256Guardians ?? [],
      ecdsaGuardians: params.ecdsaGuardians,
      dailyLimit: params.dailyLimit,
      approvedAlgIds: params.approvedAlgIds,
      minDailyLimit: params.minDailyLimit,
    };
    const specs = toGuardianSpecs(fullParams);
    const config = buildFullInitConfig(fullParams);

    const { address: owner } = await this.signer.ensureSigner(userId);

    // Guardian sanity (factory reverts DuplicateGuardian / guardian==owner; getAddress does not → fail fast
    // so a pre-funded predicted address is never stranded). Codex §5 #249.
    const nonZeroGuardians = (config.guardians as readonly Address[]).filter((g) => g !== zeroAddress);
    for (let i = 0; i < nonZeroGuardians.length; i++) {
      if (nonZeroGuardians[i].toLowerCase() === owner.toLowerCase()) {
        throw new Error(`createAccountWithPasskey: guardian ${nonZeroGuardians[i]} must not equal the owner`);
      }
      for (let j = i + 1; j < nonZeroGuardians.length; j++) {
        if (nonZeroGuardians[i].toLowerCase() === nonZeroGuardians[j].toLowerCase()) {
          throw new Error(`createAccountWithPasskey: duplicate ECDSA guardian ${nonZeroGuardians[i]}`);
        }
      }
    }

    if (typeof params.salt === "number" && !Number.isSafeInteger(params.salt)) {
      throw new Error(`salt ${params.salt} exceeds Number.MAX_SAFE_INTEGER; pass a bigint`);
    }
    const saltBig = BigInt(params.salt ?? Math.floor(Math.random() * 1000000));

    const factoryAddress = this.ethereum.getFactoryAddress(version) as Address;
    const chainId = this.ethereum.getChainId();
    const accountAddress = await this._factoryRead(factoryAddress).getAddress({
      owner, salt: saltBig, config, ownerP256X: params.ownerP256X, ownerP256Y: params.ownerP256Y,
    });

    const existing = (await this.storage.getAccounts()).find(
      a => a.userId === userId && a.entryPointVersion === versionStr && a.address === accountAddress
    );
    let alreadyDeployed = false;
    if (!existing) {
      try {
        const code = await this.ethereum.getProvider().getCode({ address: accountAddress as Address });
        alreadyDeployed = !!code && code !== "0x";
      } catch { /* treat as not deployed */ }
    }

    return {
      userId, owner, saltBig, config, specs, version, versionStr, factoryAddress, chainId, accountAddress,
      ownerP256X: params.ownerP256X, ownerP256Y: params.ownerP256Y, dailyLimit: params.dailyLimit,
      existing, alreadyDeployed,
    };
  }

  /** Relay createAccount via the deployer + persist the deployed record. */
  private async _relayPasskeyDeploy(
    plan: ResolvedPasskeyCreate, nonce: bigint, deadline: bigint, ownerSig: `0x${string}`, deployerWallet: WalletClient
  ): Promise<AccountRecord> {
    const deployTx = (await airAccountFactoryActions(plan.factoryAddress)(deployerWallet).createAccount({
      owner: plan.owner, salt: plan.saltBig, config: plan.config,
      ownerP256X: plan.ownerP256X, ownerP256Y: plan.ownerP256Y,
      nonce, deadline, ownerSig, account: deployerWallet.account,
    })) as Hash;
    const rcpt = await this.ethereum.getProvider().waitForTransactionReceipt({ hash: deployTx });
    if (rcpt.status !== "success") {
      throw new Error(`createAccountWithPasskey: relay deploy reverted (tx ${deployTx})`);
    }
    this.logger.log(`[AccountManager] passkey-at-birth account relayed: ${plan.accountAddress} (tx ${deployTx})`);
    return this._persistPasskeyRecord(plan, deployTx);
  }

  private async _persistPasskeyRecord(plan: ResolvedPasskeyCreate, deployTx: Hash | null): Promise<AccountRecord> {
    const account: AccountRecord = {
      userId: plan.userId,
      address: plan.accountAddress,
      signerAddress: plan.owner,
      salt: plan.saltBig.toString(),
      deployed: true,
      deploymentTxHash: deployTx,
      validatorAddress: this.ethereum.getValidatorAddress(plan.version),
      entryPointVersion: plan.versionStr,
      factoryAddress: plan.factoryAddress,
      createdAt: new Date().toISOString(),
      dailyLimit: plan.dailyLimit.toString(),
      guardianSpecs: serializeGuardianSpecs(plan.specs),
      approvedAlgIds: [...plan.config.approvedAlgIds],
      minDailyLimit: plan.config.minDailyLimit.toString(),
    };
    await this.storage.saveAccount(account);
    return account;
  }

  /**
   * Gap B — wire the validator router for an account that approved a ROUTER-DELEGATED signature
   * algorithm (BLS 0x01, cumulative T2 0x04, T3 0x05, weighted 0x07, session 0x08, ...). Such an
   * account's `_validateTripleSignature` / `_callBLSValidator` return `1` (FAIL) while
   * `validator() == address(0)`, so the algorithm is non-functional until the owner calls
   * `setValidator(router)` (onlyOwner, SET-ONCE). Inline algIds (ECDSA 0x02, P256 0x03, COMBINED_T1
   * 0x06) need no router and are a no-op here.
   *
   * MUST be called AFTER the account is deployed (setValidator is onlyOwner and needs code) — the
   * lazy/counterfactual deploy path cannot setValidator at predict-time. Idempotent: re-running after
   * the validator is set is a no-op (`reason: 'validator already set'`).
   *
   * On-chain access matches the rest of this package: reads via the EthereumProvider's PublicClient
   * (`getAccountContract(...).read.validator()` and `getProvider().getCode()`); the state-changing
   * `setValidator` is sent through a caller-supplied `WalletClient` whose account is the owner —
   * the same convention used by `PaymasterManager.updatePrice` / `ForceExitService` (this manager's
   * narrow `ISignerAdapter` only EIP-191 personal-signs and cannot send transactions).
   *
   * @param userId  the account owner's user id (storage key)
   * @param opts.router        override the router address (defaults to the chain's canonical
   *                           `aaStarValidator`); pass to target a non-canonical router
   * @param opts.walletClient  viem WalletClient signing as the account OWNER — REQUIRED to send the tx
   */
  async ensureValidatorRouter(
    userId: string,
    opts?: { router?: Address; walletClient?: WalletClient }
  ): Promise<EnsureValidatorRouterResult> {
    // (1) Load the record + resolve approvedAlgIds. Absent => ECDSA-only legacy record => no router.
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) throw new Error("Account not found");
    const approvedAlgIds = account.approvedAlgIds;
    if (!approvedAlgIds || approvedAlgIds.length === 0) {
      return { set: false, reason: "no approvedAlgIds / not router-delegated" };
    }

    // (2) All approved algIds are inline => nothing to route.
    if (!needsValidatorRouter(approvedAlgIds)) {
      return { set: false, reason: "no router-delegated algorithm" };
    }

    // (3) Resolve the router: explicit override, else the chain's canonical aaStarValidator.
    const chainId = this.ethereum.getChainId();
    const canonicalRouter = getCanonicalAddresses(chainId)?.aaStarValidator as Address | undefined;
    const router = opts?.router ?? canonicalRouter;
    if (!router || router.toLowerCase() === zeroAddress) {
      return { set: false, reason: `no canonical validator router for chain ${chainId}` };
    }

    // (4) Check deployment FIRST. setValidator is onlyOwner and needs deployed code; and reading
    //     validator() on a counterfactual (not-yet-deployed) account reverts (eth_call returns 0x),
    //     so the deploy check MUST precede the validator() read — otherwise a pre-deploy call throws
    //     instead of returning the clean "not deployed yet" reason.
    let deployed = false;
    try {
      const code = await this.ethereum.getProvider().getCode({ address: account.address as Address });
      deployed = !!code && code !== "0x";
    } catch {
      // Treat an RPC failure as "not deployed" — never attempt setValidator on an unknown-code account.
    }
    if (!deployed) {
      return { set: false, reason: "account not deployed yet — call after deploy" };
    }

    // (5) Read the account's current validator(). Non-zero => already wired (SET-ONCE) => no-op.
    const current = (await this.ethereum
      .getAccountContract(account.address)
      .read.validator([])) as Address;
    if (current && current.toLowerCase() !== zeroAddress) {
      return { set: false, reason: "validator already set" };
    }

    // (6) Send setValidator(router) signed by the owner. The write goes through a caller-supplied
    // WalletClient (this manager has no signer that can send transactions). Use the core setValidator
    // action so the encoding stays the single-source-of-truth ABI from @aastar/core.
    const walletClient = opts?.walletClient;
    if (!walletClient || !walletClient.account) {
      return {
        set: false,
        reason: "walletClient (account owner) required to send setValidator",
        router,
      };
    }
    const tx = (await airAccountActions(account.address as Address)(walletClient).setValidator({
      validator: router,
      account: walletClient.account,
    })) as Hash;
    this.logger.log(
      `[AccountManager] setValidator(${router}) sent for account ${account.address} (tx ${tx})`
    );
    return { set: true, tx, router };
  }

  /**
   * Gap B (complete auto-wiring): deploy a router-delegated account AND set its validator router in
   * ONE call, so a BLS / cumulative / session-key account is immediately functional — no separate
   * manual `ensureValidatorRouter` step. The factory's lazy first-UserOp deploy cannot bootstrap such
   * an account (its own algorithm can't validate until the router is wired), so this performs an
   * explicit `factory.createAccount(owner, salt, config)` deploy (if the account has no code yet),
   * waits for it, then wires `setValidator(router)`. Both txs go through the caller-supplied owner/
   * deployer `WalletClient` (this manager holds no transaction signer). For inline algIds (ECDSA/P256/
   * COMBINED_T1) the validator step is a documented no-op.
   *
   * @returns `{ deployTx?, validator }` — `deployTx` is undefined if the account was already deployed.
   */
  async deployAndWireValidator(
    userId: string,
    opts: { walletClient: WalletClient; router?: Address }
  ): Promise<{ deployTx?: Hash; validator: EnsureValidatorRouterResult }> {
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) throw new Error("Account not found");
    const walletClient = opts.walletClient;
    if (!walletClient || !walletClient.account) {
      throw new Error("deployAndWireValidator: a walletClient (deployer/owner) is required");
    }

    // (1) Deploy via the FULL-config createAccount(owner, salt, config) if the account has no code yet.
    let deployTx: Hash | undefined;
    let code = "0x";
    try {
      code = (await this.ethereum.getProvider().getCode({ address: account.address as Address })) ?? "0x";
    } catch {
      // Treat an RPC failure as "not deployed" — the createAccount below is idempotent (CREATE2).
    }
    if (!code || code === "0x") {
      // Rebuild the byte-identical InitConfig the account was predicted against (same owner/salt/config
      // ⇒ same CREATE2 address as the persisted record).
      const config = initConfigFromRecord(account);
      deployTx = (await airAccountFactoryActions(account.factoryAddress as Address)(walletClient).createAccount({
        owner: account.signerAddress as Address,
        salt: BigInt(account.salt),
        config,
        account: walletClient.account,
      })) as Hash;
      // setValidator (step 2) is onlyOwner + needs deployed code — wait for the deploy to land first.
      await this.ethereum.getProvider().waitForTransactionReceipt({ hash: deployTx });
      account.deployed = true;
      account.deploymentTxHash = deployTx;
      await this.storage.saveAccount(account);
      this.logger.log(`[AccountManager] deployed account ${account.address} (tx ${deployTx})`);
    }

    // (2) Wire the validator router. No-op when the account uses only inline algIds or it's already set.
    const validator = await this.ensureValidatorRouter(userId, {
      walletClient,
      router: opts.router,
    });
    // Wait for the setValidator tx to land so the account is on-chain-READY when this call returns
    // (ensureValidatorRouter itself fires-and-returns the hash without waiting).
    if (validator.set && validator.tx) {
      await this.ethereum.getProvider().waitForTransactionReceipt({ hash: validator.tx });
    }
    return { deployTx, validator };
  }
}
