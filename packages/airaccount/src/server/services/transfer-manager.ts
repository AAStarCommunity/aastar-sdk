import {
  hexToBytes,
  bytesToHex,
  concat,
  numberToHex,
  parseEther,
  keccak256,
  zeroAddress,
  type PublicClient,
  type Address,
  type Abi,
} from "viem";
import { randomUUID } from "node:crypto";
import { generateMessagePoint } from "../../migration/viem/bls-packing";
// Local human-readable ABIs (not in @aastar/core); parseAbi is required to feed
// them to viem's readContract / encodeFunctionData during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi, encodeFunctionData } from "viem";
import { EthereumProvider } from "../providers/ethereum-provider";
import { readValidatorGasEstimate } from "../providers/typed-reads";
import { AccountManager } from "./account-manager";
import { BLSSignatureService, GuardianSigner, DeviceWebAuthnAssertion } from "./bls-signature-service";
import { GuardChecker } from "./guard-checker";
import { wrapExecuteUserOp } from "../utils/execute-user-op";
import { PaymasterManager } from "./paymaster-manager";
import { TokenService } from "./token-service";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, SignerAuthContext } from "../interfaces/signer-adapter";
import { WebAuthnAssertion } from "./kms-signer";
import { LegacyPasskeyAssertion } from "./kms-signer";
import {
  EntryPointVersion,
  ALG_ID,
  AIRACCOUNT_ABI,
  AIRACCOUNT_FACTORY_ABI,
  FACTORY_ABI_V6,
} from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { initConfigFromRecord, initConfigToTuple } from "./account-init-config";

// v0.20.0 (#120): InitConfig gained bytes32[3] guardianP256X / guardianP256Y after `guardians`.
// ECDSA-only deploy initCode passes three zero words for each.
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;
const EMPTY_P256: readonly [`0x${string}`, `0x${string}`, `0x${string}`] = [ZERO32, ZERO32, ZERO32];
import { PaymasterPriceStalenessError } from "./paymaster-manager";
import { UserOperation, PackedUserOperation } from "../../core/types";
import { ERC4337Utils } from "../../core/erc4337";
import { TierLevel, sigsForTier } from "../../core/tier";

// ── Parsed local ABIs ─────────────────────────────────────────────
// Widened to the loose `Abi` type so encodeFunctionData accepts dynamic
// function names + loosely-typed args (mirrors the old ethers.Interface surface).
const AIRACCOUNT_ABI_PARSED: Abi = parseAbi(AIRACCOUNT_ABI);
const AIRACCOUNT_FACTORY_ABI_PARSED: Abi = parseAbi(AIRACCOUNT_FACTORY_ABI);
const FACTORY_ABI_V6_PARSED: Abi = parseAbi(FACTORY_ABI_V6);
const VALIDATOR_GETTER_ABI: Abi = parseAbi(["function validator() view returns (address)"]);

/** encodeFunctionData over a loosely-typed Abi (was `iface.encodeFunctionData`). */
function encodeFn(abi: Abi, functionName: string, args: readonly unknown[]): `0x${string}` {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeFunctionData({ abi, functionName, args } as any);
}

// ── Signature strategy detection ─────────────────────────────────

/**
 * Determines whether to use plain ECDSA and whether the account is a compositeValidator.
 * Exported for unit testing.
 */
export async function detectSignatureStrategy(
  provider: PublicClient,
  accountAddress: string
): Promise<{ useECDSA: boolean; isCompositeValidator: boolean }> {
  try {
    const accountCode = await provider.getCode({ address: accountAddress as Address });
    if (!accountCode || accountCode === "0x") {
      // AirAccount factory invariant: all counterfactual addresses are compositeValidator deployments.
      return { useECDSA: true, isCompositeValidator: true };
    }
    const v = (await provider.readContract({
      address: accountAddress as Address,
      abi: VALIDATOR_GETTER_ABI,
      functionName: "validator",
    })) as string;
    // validator() exists → confirmed compositeValidator account.
    return { useECDSA: v === zeroAddress, isCompositeValidator: true };
  } catch {
    // Covers both getCode() and validator() failures (network error or non-compositeValidator account).
    // Use raw ECDSA (no algId prefix) to avoid AA24 on non-compositeValidator accounts.
    return { useECDSA: true, isCompositeValidator: false };
  }
}

// ── Public DTOs ───────────────────────────────────────────────────

export interface ExecuteTransferParams {
  to: string;
  amount: string;
  data?: string;
  tokenAddress?: string;
  usePaymaster?: boolean;
  paymasterAddress?: string;
  paymasterData?: string;
  /** ERC-20 token address for deposit-pull paymasters (e.g. PMv4) that require
   *  the gas token address appended to paymasterData. Used when the paymaster
   *  contract does not expose a public token() getter for auto-detection. */
  paymasterTokenAddress?: string;
  /**
   * LEGACY raw passkey assertion for KMS signing.
   * @deprecated KMS v0.20.0+ rejects it (replayable). Use {@link webAuthnAssertion}.
   */
  passkeyAssertion?: LegacyPasskeyAssertion;
  /**
   * One-time, challenge-bound WebAuthn ceremony assertion for KMS owner signing
   * (replay-safe; what the KMS now requires). The frontend runs the
   * BeginAuthentication ceremony with the user's device passkey and passes the
   * resulting `{ ChallengeId, Credential }` here. The challenge is consumed once,
   * so this authorizes exactly ONE owner signature — use the tiered path
   * (`useAirAccountTiering: true`), which needs a single owner signature.
   */
  webAuthnAssertion?: WebAuthnAssertion;
  /** P256 passkey signature (64 bytes hex). Required for AirAccount Tier 2/3. */
  p256Signature?: string;
  /** Guardian signer instance. Required for AirAccount Tier 3. */
  guardianSigner?: GuardianSigner;
  /** Enable AirAccount tiered signature routing. Default: false (legacy BLS-only). */
  useAirAccountTiering?: boolean;
  /**
   * Use the on-chain WebAuthn-passkey cumulative path (algId 0x09/0x0a) for Tier-2/3 instead of the
   * raw-P256 cumulative (0x04/0x05). Set this when the account's passkey is a real device WebAuthn
   * credential (the common case): the frontend runs ONE `navigator.credentials.get()` ceremony with
   * `challenge = the prepared userOpHash`, and submit derives the on-chain passkey factor from that
   * assertion (no KMS owner ceremony, no manual packing). Requires `useAirAccountTiering: true`.
   */
  useWebAuthnPasskey?: boolean;
  /**
   * Wrap the execute()/executeBatch() callData with the `executeUserOp` selector
   * (v0.17.2-beta.4 bundler-compat). REQUIRED for guard-enabled accounts submitted
   * through a standard ERC-4337 bundler; the account re-derives the signature algId
   * in-frame. Default: false. No-guard accounts and owner-direct calls leave it off.
   */
  wrapExecuteUserOp?: boolean;
}

export interface EstimateGasParams {
  to: string;
  amount: string;
  data?: string;
  tokenAddress?: string;
  /** Match the executeUserOp wrapping used at submission so gas estimation is accurate (v0.17.2-beta.4). */
  wrapExecuteUserOp?: boolean;
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

/** Signatures a resolved tier requires (null tier = ECDSA/legacy path → owner/passkey only). Reuses
 *  the single tier→sigs mapping from core/tier so the two definitions never drift. */
function requiredSigsForTier(tier: number | null): { passkey: boolean; bls: boolean; guardian: number } {
  if (tier == null) return { passkey: true, bls: false, guardian: 0 };
  return sigsForTier(tier as TierLevel);
}

/** Phase-1 output of {@link TransferManager.prepareTransfer} (the strict device-passkey flow). */
export interface PreparedTransfer {
  /** Opaque handle to pass back to {@link TransferManager.submitPreparedTransfer}. */
  transferId: string;
  /**
   * KMS BeginAuthentication ChallengeId — pair it with the credential as the webAuthnAssertion.
   * Absent on the WebAuthn passkey path (`useWebAuthnPasskey`), which runs no KMS ceremony — there
   * the frontend uses `userOpHash` itself as the navigator.credentials.get() challenge.
   */
  challengeId?: string;
  /**
   * Credential-request options to feed `navigator.credentials.get` / `startAuthentication`.
   * Its `challenge` is ALREADY the WYSIWYS commitment over the correct payload (SDK-computed).
   * Absent on the WebAuthn passkey path (use `userOpHash` as the challenge).
   */
  publicKeyOptions?: PublicKeyCredentialRequestOptions;
  /** The UserOp hash (informational; the frontend does not need to sign it directly). */
  userOpHash: string;
  /**
   * The resolved AirAccount tier for this transfer (1/2/3), or `null` for the ECDSA / legacy-BLS path.
   * Tier 3 (amount > tier2Limit) REQUIRES a guardian co-signature at submit — pass it via
   * `submitPreparedTransfer({ ..., guardianSigner })`, or the submit will fail-fast before any gas.
   */
  tier: TierLevel | null;
  /** Which signatures this transfer needs, so the UI knows whether to collect a guardian co-sign. */
  requiredSigs: { passkey: boolean; bls: boolean; guardian: number };
}

/** How long a prepareTransfer record lives before it's evicted (the WebAuthn challenge is short-lived). */
const PREPARED_TTL_MS = 10 * 60_000;

// ── Helper to generate collision-resistant IDs (CSPRNG, not Math.random) ──
// transferIds double as the prepareTransfer lookup handle, so use a cryptographically
// random UUID (#143 Codex NEW-5) — Math.random is not collision-safe and is a code smell here.

function generateId(): string {
  return randomUUID();
}

/**
 * Transfer manager — extracted from NestJS TransferService.
 * No passkey verification: callers are responsible for their own auth.
 */
export class TransferManager {
  private readonly logger: ILogger;

  private readonly guardChecker: GuardChecker | null;

  /**
   * In-memory store for two-phase transfers between prepareTransfer and submitPreparedTransfer.
   * Single-process only — a multi-worker deployment must back this with a shared store (the
   * prepared UserOp + its committed challenge must be retrievable by whichever worker submits).
   */
  private readonly prepared = new Map<
    string,
    {
      userId: string;
      userOp: UserOperation | PackedUserOperation;
      userOpHash: string;
      version: EntryPointVersion;
      accountAddress: string;
      params: ExecuteTransferParams;
      /** The owner-ceremony message the commitment was bound to — re-checked at submit (tier drift). */
      ownerMessageHex: `0x${string}`;
      createdAt: number;
    }
  >();

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
    const code = await this.ethereum.getProvider().getCode({ address: account.address as Address });
    const needsDeployment = !code || code === "0x";
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
      version,
      params.paymasterTokenAddress,
      params.wrapExecuteUserOp ?? false
    );

    // Get hash
    const userOpHash = await this.ethereum.getUserOpHash(userOp, version);

    // Ensure wallet exists
    await this.signer.ensureSigner(userId);

    // Auth context for KMS-backed signing. Prefer the replay-safe WebAuthn ceremony
    // assertion; fall back to the deprecated legacy raw passkey assertion.
    if (params.webAuthnAssertion && params.passkeyAssertion) {
      throw new Error(
        "Provide either webAuthnAssertion (preferred) or passkeyAssertion, not both."
      );
    }
    const assertionCtx: SignerAuthContext | undefined = params.webAuthnAssertion
      ? { webAuthnAssertion: params.webAuthnAssertion }
      : params.passkeyAssertion
        ? { assertion: params.passkeyAssertion }
        : undefined;

    const strategy = await this.resolveSignStrategy(account.address, version, params);
    await this.applySignature(userId, userOp, userOpHash, params, assertionCtx, strategy);

    return this.finalizeAndSubmit(userId, account.address, version, userOp, userOpHash, params);
  }

  // ── Two-phase transfer (strict device-passkey / "case B", AirAccount #354) ───────────────
  //
  // executeTransfer is one-shot (build → sign → submit) and takes the assertion as INPUT, so a
  // device-passkey frontend can only sign the raw nonce → rejected under KMS strict mode (the
  // challenge must commit to the payload). prepareTransfer/submitPreparedTransfer split it:
  //   1. prepareTransfer  — SDK builds the UserOp, computes the EXACT digest the owner signature
  //      will sign (tier-aware, EIP-191), starts the KMS ceremony, and returns options whose
  //      `challenge` is the WYSIWYS commitment. The SDK owns the payload; the frontend never guesses.
  //   2. (frontend) navigator.credentials.get(publicKeyOptions) with the user's device passkey.
  //   3. submitPreparedTransfer — SDK signs with that assertion (the committed digest matches) + submits.

  /**
   * Phase 1: build the UserOp + bind the WYSIWYS commitment, returning everything the frontend
   * ceremony needs. Requires a signer adapter implementing {@link ISignerAdapter.beginCeremony}
   * (e.g. {@link KmsSignerAdapter}) and the tiered path (`useAirAccountTiering: true`) or a plain
   * ECDSA account — the legacy non-tiered BLS path needs two owner signatures and can't be
   * single-assertion prepared.
   *
   * NOTE: the prepared UserOp is held in-memory keyed by `transferId` until
   * {@link submitPreparedTransfer} (single-process; a multi-worker deployment needs a shared store).
   */
  async prepareTransfer(userId: string, params: ExecuteTransferParams): Promise<PreparedTransfer> {
    // The KMS ceremony (beginCeremony) is only needed for the owner-signature paths. The WebAuthn
    // passkey path signs userOpHash directly on the device (challenge=userOpHash), so it needs no
    // KMS ceremony — defer that requirement to the non-WebAuthn branch below.
    if (!params.useWebAuthnPasskey && !this.signer.beginCeremony) {
      throw new Error(
        "prepareTransfer needs a signer adapter that implements beginCeremony (e.g. KmsSignerAdapter)."
      );
    }
    const account = await this.accountManager.getAccountByUserId(userId);
    if (!account) throw new Error("User account not found");

    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;
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
      version,
      params.paymasterTokenAddress,
      params.wrapExecuteUserOp ?? false
    );
    const userOpHash = await this.ethereum.getUserOpHash(userOp, version);

    const strategy = await this.resolveSignStrategy(account.address, version, params);

    // Opportunistically evict stale prepared entries (O(entries) — fine for typical prepare
    // volumes; a high-throughput deployment should move to an expiry queue / shared store).
    const now = Date.now();
    for (const [id, e] of this.prepared) {
      if (now - e.createdAt > PREPARED_TTL_MS) this.prepared.delete(id);
    }
    const transferId = generateId();

    // ── WebAuthn passkey path: no KMS ceremony — the device signs `userOpHash` directly ─────────
    if (params.useWebAuthnPasskey) {
      if (strategy.tier == null || strategy.tier < 2) {
        throw new Error(
          "prepareTransfer: useWebAuthnPasskey applies to Tier-2/3 only (the device passkey is the " +
            "cumulative on-chain factor for tier>=2). For Tier-1 use the plain owner path."
        );
      }
      this.prepared.set(transferId, {
        userId,
        userOp,
        userOpHash,
        version,
        accountAddress: account.address,
        params,
        // WA: the frontend uses `userOpHash` itself as the WebAuthn ceremony challenge; there is no
        // separate committed owner message. Store the hash as a marker (submit re-checks the tier only).
        ownerMessageHex: userOpHash as `0x${string}`,
        createdAt: now,
      });
      // challengeId/publicKeyOptions are undefined: the frontend runs navigator.credentials.get with
      // `challenge = userOpHash` itself (no KMS BeginAuthentication).
      return { transferId, userOpHash, tier: strategy.tier as TierLevel, requiredSigs: requiredSigsForTier(strategy.tier) };
    }

    await this.signer.ensureSigner(userId);
    // The exact message the SINGLE owner signature will sign (the adapter then applies EIP-191
    // + commitChallenge). Tier-dependent — this is precisely the logic the SDK must own.
    const message = await this.ownerMessageForStrategy(strategy, userOpHash);
    const { challengeId, publicKeyOptions } = await this.signer.beginCeremony!(userId, message);

    this.prepared.set(transferId, {
      userId,
      userOp,
      userOpHash,
      version,
      accountAddress: account.address,
      params,
      ownerMessageHex: bytesToHex(message),
      createdAt: now,
    });
    return { transferId, challengeId, publicKeyOptions, userOpHash, tier: strategy.tier as TierLevel | null, requiredSigs: requiredSigsForTier(strategy.tier) };
  }

  /**
   * Phase 3: finish a {@link prepareTransfer} with the frontend's device-passkey assertion.
   * The committed digest matches what prepareTransfer bound, so the KMS accepts it under strict.
   * The prepared record is consumed (single-use).
   */
  async submitPreparedTransfer(
    userId: string,
    params: {
      transferId: string;
      /** KMS-ceremony assertion for the owner-signature paths. Not used by the WebAuthn passkey path. */
      webAuthnAssertion?: WebAuthnAssertion;
      /**
       * Guardian co-signer, REQUIRED when the prepared transfer is Tier 3 (see {@link PreparedTransfer.tier}).
       * Collected at submit time (after the UI saw it was needed). If omitted for a Tier-3 transfer,
       * submit fail-fasts (no gas) instead of producing an incomplete signature that reverts on-chain.
       */
      guardianSigner?: GuardianSigner;
      /**
       * Device-passkey P256 signature (64-byte `r‖s` hex) over the prepared `userOpHash`, for the
       * RAW-P256 cumulative path (algId 0x04/0x05). For real device WebAuthn passkeys use
       * `deviceWebAuthn` + `useWebAuthnPasskey` instead (the device can't produce a raw r‖s).
       */
      p256Signature?: string;
      /**
       * The device WebAuthn assertion (`navigator.credentials.get()` response over `challenge = userOpHash`)
       * for the WebAuthn passkey cumulative path (algId 0x09/0x0a). Required when the prepared transfer
       * was created with `useWebAuthnPasskey: true`. The SDK derives the on-chain passkey factor + fetches
       * the DVT BLS aggregate + packs the composite — no manual packing.
       */
      deviceWebAuthn?: DeviceWebAuthnAssertion;
    }
  ): Promise<TransferResult> {
    const prep = this.prepared.get(params.transferId);
    if (!prep || prep.userId !== userId) {
      throw new Error("submitPreparedTransfer: no matching prepared transfer (unknown id, wrong user, or expired).");
    }
    if (Date.now() - prep.createdAt > PREPARED_TTL_MS) {
      this.prepared.delete(params.transferId);
      throw new Error("submitPreparedTransfer: prepared transfer expired; call prepareTransfer again.");
    }

    // ── WebAuthn passkey path: derive the composite from the device assertion (no KMS ceremony) ──
    if (prep.params.useWebAuthnPasskey) {
      const strategy = await this.resolveSignStrategy(prep.accountAddress, prep.version, prep.params);
      const tier = strategy.tier;
      if (tier == null || tier < 2) {
        throw new Error("submitPreparedTransfer: WebAuthn passkey path is Tier-2/3 only.");
      }
      if (!params.deviceWebAuthn) {
        throw new Error(
          "submitPreparedTransfer: this is a WebAuthn passkey transfer — pass `deviceWebAuthn` " +
            "(the navigator.credentials.get() assertion whose challenge is the prepared userOpHash)."
        );
      }
      if (tier >= 3 && !params.guardianSigner && !prep.params.guardianSigner) {
        throw new Error(
          "submitPreparedTransfer: this is a Tier-3 transfer and needs a guardian co-signature — pass `guardianSigner`."
        );
      }
      this.prepared.delete(params.transferId); // one-time
      prep.userOp.signature = (await this.blsService.generateWebAuthnTieredSignature({
        tier: tier as TierLevel,
        userId,
        userOpHash: prep.userOpHash,
        deviceWebAuthn: params.deviceWebAuthn,
        guardianSigner: params.guardianSigner ?? prep.params.guardianSigner,
      })) as `0x${string}`;
      return this.finalizeAndSubmit(
        userId,
        prep.accountAddress,
        prep.version,
        prep.userOp,
        prep.userOpHash,
        prep.params,
        params.transferId
      );
    }

    if (!params.webAuthnAssertion) {
      throw new Error("submitPreparedTransfer: webAuthnAssertion is required for the owner-signature path.");
    }
    // Tier-drift guard: the committed challenge was bound to the prepare-time payload. Resolve the
    // strategy ONCE and reuse it for BOTH the comparison and the signing, so submit signs exactly
    // the committed payload (#143 Codex). If the tier/state changed, fail fast with a clear error
    // BEFORE consuming the assertion, instead of letting the KMS reject opaquely.
    const strategy = await this.resolveSignStrategy(prep.accountAddress, prep.version, prep.params);
    const currentMessage = bytesToHex(await this.ownerMessageForStrategy(strategy, prep.userOpHash));
    if (currentMessage !== prep.ownerMessageHex) {
      this.prepared.delete(params.transferId);
      throw new Error(
        "submitPreparedTransfer: signing tier/state changed since prepareTransfer (the committed " +
          "challenge no longer matches the payload); call prepareTransfer again."
      );
    }
    // Tier 3 needs a guardian co-sign. Take it from the submit call (the usual browser flow — the
    // guardian signs after the UI saw tier 3) or fall back to one passed at prepare time. Fail-fast
    // here with a clear message before consuming the one-time assertion / spending gas.
    if (strategy.tier != null && strategy.tier >= 3 && !params.guardianSigner && !prep.params.guardianSigner) {
      throw new Error(
        "submitPreparedTransfer: this is a Tier-3 transfer (amount > tier2Limit) and needs a guardian " +
          "co-signature — pass `guardianSigner`. (Collect it from a guardian before submitting; not " +
          "submitting avoids burning gas on a signature the account would reject.)"
      );
    }
    // Tier 2/3 need the device-passkey P256 signature over the prepared userOpHash. It can only be
    // supplied at submit (the hash isn't known before prepare), so fail-fast here BEFORE consuming the
    // one-time assertion / spending gas, instead of letting generateTieredSignature throw mid-flow.
    if (strategy.tier != null && strategy.tier >= 2) {
      const effectiveP256 = params.p256Signature ?? prep.params.p256Signature;
      if (!effectiveP256) {
        throw new Error(
          "submitPreparedTransfer: this is a Tier-2/3 transfer and needs the device-passkey P256 " +
            "signature — pass `p256Signature` (64-byte r‖s hex) over the prepared `userOpHash`. " +
            "(Sign the userOpHash that prepareTransfer returned with the device passkey before submitting.)"
        );
      }
      // Validate the format BEFORE deleting the (one-time) prepared transfer: a non-empty but
      // malformed value would otherwise pass the presence check, consume the prepared transfer via
      // prepared.delete(), then fail deep in signing — forcing a needless prepareTransfer retry.
      if (!/^0x[0-9a-fA-F]{128}$/.test(effectiveP256)) {
        throw new Error(
          "submitPreparedTransfer: `p256Signature` must be 64-byte hex (0x + 128 hex chars: r‖s), " +
            `got ${effectiveP256.length}-char value. The prepared transfer is preserved — fix the ` +
            "signature and resubmit (no need to call prepareTransfer again)."
        );
      }
    }
    const signParams = {
      ...prep.params,
      ...(params.guardianSigner ? { guardianSigner: params.guardianSigner } : {}),
      ...(params.p256Signature ? { p256Signature: params.p256Signature } : {}),
    };

    this.prepared.delete(params.transferId); // one-time (the assertion's challenge is also one-time)

    await this.applySignature(
      userId,
      prep.userOp,
      prep.userOpHash,
      signParams,
      { webAuthnAssertion: params.webAuthnAssertion },
      strategy
    );
    return this.finalizeAndSubmit(
      userId,
      prep.accountAddress,
      prep.version,
      prep.userOp,
      prep.userOpHash,
      prep.params,
      params.transferId
    );
  }

  /**
   * Resolve the signature strategy ONCE (account detection + tier pre-check) so the committed
   * payload and the signed payload derive from the SAME decision — no re-derivation drift between
   * prepareTransfer's commitment and submitPreparedTransfer's signing (#143 Codex).
   * `tier === null` means "not the AirAccount tiered path" (ECDSA or legacy BLS).
   */
  private async resolveSignStrategy(
    accountAddress: string,
    version: EntryPointVersion,
    params: ExecuteTransferParams
  ): Promise<{ useECDSA: boolean; isCompositeValidator: boolean; tier: number | null }> {
    let useECDSA = false;
    let isCompositeValidator = false;
    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      ({ useECDSA, isCompositeValidator } = await detectSignatureStrategy(
        this.ethereum.getProvider(),
        accountAddress
      ));
    }
    // An explicit tiering opt-in MUST be honored — but it needs a guardChecker to resolve the
    // tier. Silently ignoring the request (and falling back to the inline-ECDSA path) is how a
    // tier-2/3 op ends up under-weight on-chain, so fail loudly instead (#234, same class as #229).
    if (params.useAirAccountTiering && !this.guardChecker) {
      throw new Error(
        "useAirAccountTiering:true was requested but no TierGuardChecker is configured, so the " +
          "signing tier cannot be resolved. Configure the guard checker, or omit useAirAccountTiering."
      );
    }

    let tier: number | null = null;
    // Tiering opt-in is AUTHORITATIVE over the ECDSA heuristic. A weighted/composite AirAccount can
    // report validator()==address(0) (no external validator router — validation happens in-account
    // via the weight config) yet still REQUIRE a tiered composite signature (algId 0x04/0x05) for
    // tier>=2. Gating tier resolution on !useECDSA let such accounts silently emit an under-weight
    // inline-ECDSA (0x02) signature for tier-2/3 ops, surfacing only as an opaque on-chain AA24 (#234).
    if (params.useAirAccountTiering && this.guardChecker) {
      const transferValue = params.tokenAddress ? 0n : parseEther(params.amount);
      const preCheck = await this.guardChecker.preCheck(accountAddress, transferValue);
      if (!preCheck.ok) throw new Error(`Guard pre-check failed: ${preCheck.errors.join("; ")}`);
      tier = preCheck.tier;
      // Don't let the inline-ECDSA path shadow the tiered composite signature. (Tier 1 still emits a
      // bare ECDSA via generateTieredSignature, which the account accepts as inline ECDSA, so this is
      // a no-op for tier 1 and the actual fix for tier-2/3.)
      if (tier != null) useECDSA = false;
    }
    return { useECDSA, isCompositeValidator, tier };
  }

  /**
   * The exact message the single owner signature will sign (before the adapter's EIP-191 wrap),
   * for a resolved strategy — so prepareTransfer binds the commitment to the value submit signs:
   *  - ECDSA / Tier-1: the userOpHash.
   *  - Tier-2/3: `keccak256(messagePoint)` — Tier-2/3 omit the owner ECDSA over userOpHash, so the
   *    one owner signature is the messagePoint signature (mirrors BLSSignatureService).
   */
  private async ownerMessageForStrategy(
    strategy: { useECDSA: boolean; tier: number | null },
    userOpHash: string
  ): Promise<Uint8Array> {
    if (strategy.useECDSA || strategy.tier === 1) return hexToBytes(userOpHash as `0x${string}`);
    if (strategy.tier != null) {
      const messagePoint = await generateMessagePoint(userOpHash);
      return hexToBytes(keccak256(messagePoint as `0x${string}`));
    }
    throw new Error(
      "prepareTransfer: the non-tiered BLS path needs two owner signatures and can't be prepared " +
        "with a single device-passkey assertion. Use useAirAccountTiering:true (single signature)."
    );
  }

  /**
   * Set `userOp.signature` for an ALREADY-RESOLVED strategy (ECDSA / AirAccount tiered / legacy
   * BLS). Shared by executeTransfer and submitPreparedTransfer so the signing logic never drifts;
   * taking the resolved strategy (not re-detecting) means submit signs exactly the committed payload.
   */
  private async applySignature(
    userId: string,
    userOp: UserOperation | PackedUserOperation,
    userOpHash: string,
    params: ExecuteTransferParams,
    assertionCtx: SignerAuthContext | undefined,
    strategy: { useECDSA: boolean; isCompositeValidator: boolean; tier: number | null }
  ): Promise<void> {
    // A WebAuthn ceremony assertion is ONE-TIME; the legacy non-tiered BLS path needs TWO owner
    // signatures under the same ctx (second SignHash hits a spent challenge). Fail fast.
    if (
      assertionCtx &&
      "webAuthnAssertion" in assertionCtx &&
      !strategy.useECDSA &&
      strategy.tier == null
    ) {
      throw new Error(
        "A one-time webAuthnAssertion cannot authorize the legacy non-tiered BLS dual-sign " +
          "(two owner signatures, one spent challenge). Use useAirAccountTiering:true " +
          "(single owner signature), or supply two assertions via the legacy path."
      );
    }

    if (strategy.useECDSA) {
      const ecdsaSig = await this.signer.signMessage(
        userId,
        hexToBytes(userOpHash as `0x${string}`),
        assertionCtx
      );
      if (strategy.isCompositeValidator) {
        this.logger.log("ECDSA path for compositeValidator: prepending algId prefix");
        userOp.signature = concat([numberToHex(ALG_ID.ECDSA, { size: 1 }), ecdsaSig as `0x${string}`]);
      } else {
        this.logger.log("ECDSA path for non-compositeValidator: raw signature");
        userOp.signature = ecdsaSig;
      }
    } else if (strategy.tier != null) {
      this.logger.log(`Tier ${strategy.tier} selected`);
      userOp.signature = await this.blsService.generateTieredSignature({
        tier: strategy.tier as TierLevel,
        userId,
        userOpHash,
        p256Signature: params.p256Signature,
        guardianSigner: params.guardianSigner,
        ctx: assertionCtx,
      });
    } else {
      // BLS accounts are always compositeValidator by design — algId prefix applied unconditionally.
      const blsData = await this.blsService.generateBLSSignature(userId, userOpHash, assertionCtx);
      const packedBls = await this.blsService.packSignature(blsData);
      userOp.signature = concat([numberToHex(ALG_ID.BLS, { size: 1 }), packedBls as `0x${string}`]);
    }
  }

  /** Persist the transfer record and submit it to the bundler asynchronously. */
  private async finalizeAndSubmit(
    userId: string,
    accountAddress: string,
    version: EntryPointVersion,
    userOp: UserOperation | PackedUserOperation,
    userOpHash: string,
    params: ExecuteTransferParams,
    transferId: string = generateId()
  ): Promise<TransferResult> {
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
      from: accountAddress,
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

    this.processTransferAsync(transferId, userOp, accountAddress, version);

    return {
      success: true,
      transferId,
      userOpHash,
      status: "pending",
      message: "Transfer submitted successfully. Use transferId to check status.",
      from: accountAddress,
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
      const code = await this.ethereum.getProvider().getCode({ address: from as Address });
      if (code && code !== "0x") {
        const account = (await this.storage.getAccounts()).find(a => a.address === from);
        if (account && !account.deployed) {
          await this.storage.updateAccount(account.userId, {
            deployed: true,
            deploymentTxHash: txHash,
          });
        }
      }
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : String(error);

      // Translate bundler "expires too soon" into a structured PaymasterPriceStalenessError
      // so callers can detect and handle stale paymaster price without string-matching.
      if (
        message.includes("expires too soon") ||
        message.includes("AA32") ||
        message.includes("paymaster deposit not locked")
      ) {
        const validUntilMatch = message.match(/validUntil=(\d+)/);
        const hint = validUntilMatch
          ? ` (validUntil=${validUntilMatch[1]}, expired ${Math.floor(Date.now() / 1000) - Number(validUntilMatch[1])}s ago)`
          : "";
        message =
          `Paymaster price is stale${hint}. ` +
          `Call paymasterManager.checkPriceFreshness(paymasterAddress) to diagnose, ` +
          `then paymasterManager.updatePrice(paymasterAddress, signer) to refresh. ` +
          `Original error: ${message}`;
        error = new PaymasterPriceStalenessError(
          "unknown" /* paymasterAddress not available here */,
          0,
          0
        );
        (error as PaymasterPriceStalenessError & { message: string }).message = message;
      }

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
      version,
      undefined,
      params.wrapExecuteUserOp ?? false
    );

    const formatted = this.formatUserOpForBundler(userOp, version);
    const gasEstimates = await this.ethereum.estimateUserOperationGas(formatted, version);
    const gasPrices = await this.ethereum.getUserOperationGasPrice();

    const validatorContract = this.ethereum.getValidatorContract(version);
    // Typed wrapper enforces the uint256 `nodeCount` as bigint (a JS number would
    // risk silent truncation outside the 53-bit safe range on the loose surface).
    const validatorGasEstimate = await readValidatorGasEstimate(validatorContract, 3n);

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
    version: EntryPointVersion = EntryPointVersion.V0_6,
    paymasterTokenAddress?: string,
    wrapExecuteUserOpFlag: boolean = false
  ): Promise<UserOperation | PackedUserOperation> {
    const nonce = await this.ethereum.getNonce(sender, 0, version);

    // initCode for deployment
    const provider = this.ethereum.getProvider();
    const code = await provider.getCode({ address: sender as Address });
    const needsDeployment = !code || code === "0x";

    let initCode = "0x";
    if (needsDeployment) {
      const accounts = await this.storage.getAccounts();
      const account = accounts.find(a => a.address === sender);
      if (account) {
        const factory = this.ethereum.getFactoryContract(version);
        const factoryAddress = factory.address;

        let deployCalldata: string;
        if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
          const storedDailyLimit = account.dailyLimit ? BigInt(account.dailyLimit) : 0n;
          if (account.guardianSpecs && account.guardianSpecs.length > 0) {
            // Full-config (P-256 / mixed-guardian) account (#118): rebuild the BYTE-IDENTICAL
            // 8-field InitConfig from the persisted record so the deploy CREATE2 address matches
            // the create-time prediction (the factory binds the address to keccak256(config)).
            const rebuilt = initConfigFromRecord(account);
            deployCalldata = encodeFn(AIRACCOUNT_FACTORY_ABI_PARSED, "createAccount", [
              account.signerAddress,
              BigInt(account.salt),
              initConfigToTuple(rebuilt),
            ]);
          } else if (account.guardian1 && account.guardian2 && account.guardian1Sig && account.guardian2Sig) {
            // Guardian account: use createAccountWithDefaults so the factory-computed address
            // matches the stored sender (which was predicted via getAddressWithDefaults).
            // bytes params require 0x-prefixed hex — guard against missing prefix.
            const sig1 = account.guardian1Sig.startsWith("0x")
              ? account.guardian1Sig
              : `0x${account.guardian1Sig}`;
            const sig2 = account.guardian2Sig.startsWith("0x")
              ? account.guardian2Sig
              : `0x${account.guardian2Sig}`;
            deployCalldata = encodeFn(AIRACCOUNT_FACTORY_ABI_PARSED, "createAccountWithDefaults", [
              account.signerAddress,
              BigInt(account.salt),
              account.guardian1,
              sig1,
              account.guardian2,
              sig2,
              storedDailyLimit,
            ]);
          } else {
            // Standard account: createAccount with zero guardians and stored dailyLimit.
            const minimalConfig = [
              [zeroAddress, zeroAddress, zeroAddress], // guardians (address[3])
              EMPTY_P256, // guardianP256X (bytes32[3]) — v0.20.0
              EMPTY_P256, // guardianP256Y (bytes32[3]) — v0.20.0
              storedDailyLimit,
              [], // approvedAlgIds
              0n, // minDailyLimit
              [], // initialTokens
              [], // initialTokenConfigs
            ];
            deployCalldata = encodeFn(AIRACCOUNT_FACTORY_ABI_PARSED, "createAccount", [
              account.signerAddress,
              BigInt(account.salt),
              minimalConfig,
            ]);
          }
        } else {
          deployCalldata = encodeFn(FACTORY_ABI_V6_PARSED, "createAccountWithAAStarValidator", [
            account.signerAddress,
            account.signerAddress,
            account.validatorAddress,
            true,
            BigInt(account.salt),
          ]);
        }

        initCode = concat([factoryAddress as `0x${string}`, deployCalldata as `0x${string}`]);
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
      callData = encodeFn(AIRACCOUNT_ABI_PARSED, "execute", [tokenAddress, 0n, transferCalldata]);
    } else {
      callData = encodeFn(AIRACCOUNT_ABI_PARSED, "execute", [to, parseEther(amount), data]);
    }

    // v0.17.2-beta.4: guard-enabled accounts must route bundler UserOps through
    // executeUserOp so the account re-derives the signature algId in-frame.
    if (wrapExecuteUserOpFlag) {
      callData = wrapExecuteUserOp(callData);
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
          paymasterAddress,
          paymasterTokenAddress ? { tokenAddress: paymasterTokenAddress } : undefined
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
