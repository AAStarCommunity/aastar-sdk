import { hashMessage } from "../../migration/viem/signatures";
import {
  hashTypedData,
  keccak256,
  encodeAbiParameters,
  encodePacked,
  hashMessage as toEthSignedMessageHash,
} from "viem";
import { ILogger } from "../interfaces/logger";
import { KmsHttpClient } from "./kms-http-client";
import {
  PasskeyCeremonySigner,
  RunCeremonyOptions,
  runAuthenticationCeremony,
  runGrantSessionCeremony,
} from "./webauthn-ceremony";

// ── Legacy Passkey Assertion (reusable for BLS dual-signing) ─────

export interface LegacyPasskeyAssertion {
  AuthenticatorData: string; // "0x..."
  ClientDataHash: string; // "0x..."
  Signature: string; // "0x..."
}

// ── WebAuthn Assertion (v0.19.0+, one-time use) ──────────────────

export interface WebAuthnAssertion {
  // PascalCase to match the KMS wire format: the server struct uses
  // #[serde(rename = "ChallengeId")] / #[serde(rename = "Credential")].
  ChallengeId: string;
  Credential: unknown; // AuthenticationResponseJSON from @simplewebauthn/browser
}

// ── CreateKey ────────────────────────────────────────────────────

export interface KmsCreateKeyRequest {
  Description: string;
  KeyUsage?: string;
  KeySpec?: string;
  Origin?: string;
  PasskeyPublicKey: string; // P-256 public key hex (required for new KMS)
}

export interface KmsCreateKeyResponse {
  KeyMetadata: {
    KeyId: string;
    Arn: string;
    CreationDate: string;
    Enabled: boolean;
    Description: string;
    KeyUsage: string;
    KeySpec: string;
    Origin: string;
    Address?: string;
  };
  Mnemonic: string;
  Address?: string;
  Status?: string; // "deriving" — address is derived asynchronously
}

// ── SignHash ─────────────────────────────────────────────────────

export interface KmsSignHashResponse {
  Signature: string;
}

// ── WebAuthn Registration ────────────────────────────────────────

export interface KmsBeginRegistrationRequest {
  Description?: string;
  UserName?: string;
  UserDisplayName?: string;
}

export interface KmsBeginRegistrationResponse {
  ChallengeId: string;
  Options: PublicKeyCredentialCreationOptions;
}

export interface KmsCompleteRegistrationRequest {
  ChallengeId: string;
  Credential: unknown; // RegistrationResponseJSON from @simplewebauthn/browser
  Description?: string;
}

export interface KmsCompleteRegistrationResponse {
  KeyId: string;
  CredentialId: string;
  Status: string;
}

// ── WebAuthn Authentication ──────────────────────────────────────

export interface KmsBeginAuthenticationRequest {
  Address?: string;
  KeyId?: string;
}

export interface KmsBeginAuthenticationResponse {
  ChallengeId: string;
  Options: PublicKeyCredentialRequestOptions;
}

// ── Sign Typed Data (v0.20.0) ────────────────────────────────────
// The KMS hashes the typed data host-side, so the full EIP-712 structure is sent
// (NOT pre-computed domainSeparator/structHash — that was the pre-v0.19 contract).

export interface KmsEip712Domain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
}

/** One entry in a `types` definition: a struct name and its ordered fields. */
export interface KmsEip712TypeDef {
  name: string; // e.g. "Mail", "EIP712Domain"
  fields: Array<{ name: string; type: string }>;
}

/** One field value for the primary type's message. */
export interface KmsEip712FieldValue {
  name: string;
  value: unknown;
}

/**
 * Compute the standard EIP-712 digest for a KMS typed-data request — the same value the
 * KMS hashes host-side, and the payload to commit to in the WebAuthn ceremony (WYSIWYS,
 * AirAccount #68). Converts the KMS wire format (`types` = array of struct defs, `message`
 * = array of `{name,value}`) into viem's `hashTypedData` input. `EIP712Domain` is dropped
 * from `types` (viem derives it from `domain`).
 */
export function eip712Digest(params: {
  domain: KmsEip712Domain;
  primaryType: string;
  types: KmsEip712TypeDef[];
  message: KmsEip712FieldValue[];
}): `0x${string}` {
  const types = Object.fromEntries(
    params.types.filter((t) => t.name !== "EIP712Domain").map((t) => [t.name, t.fields])
  );
  const message = Object.fromEntries(params.message.map((f) => [f.name, f.value]));
  return hashTypedData({
    domain: params.domain as Record<string, unknown>,
    types: types as Record<string, ReadonlyArray<{ name: string; type: string }>>,
    primaryType: params.primaryType,
    message: message as Record<string, unknown>,
  });
}

/**
 * Coerce a uint256-encoded field to bigint, rejecting a JS `number` that has already lost
 * precision (> 2^53). A silently-truncated value would diverge from the contract/TA encoding
 * (PR #137 Codex review). Accepts bigint / decimal-or-0x string / safe-integer number.
 */
function u256(x: number | bigint | string): bigint {
  if (typeof x === "number" && !Number.isSafeInteger(x)) {
    throw new Error(`u256: number ${x} exceeds safe-integer range — pass a bigint or string`);
  }
  return BigInt(x);
}

/**
 * Compute the grant-session `final_hash` — the value the TA signs and the WYSIWYS commitment
 * payload for the grant ceremony (AirAccount #112). Equals the contract's `buildGrantHash()` /
 * `buildP256GrantHash()` output byte-for-byte (`SessionKeyValidator._buildGrantHash` already
 * applies `inner.toEthSignedMessageHash()`); verified against the live contract (E2E oracle).
 * `inner = keccak256(abi.encode(domainTag, chainId,
 * verifyingContract, account, <sessionKey | keyX,keyY>, expiry, contractScope, selectorScope,
 * velocityLimit, velocityWindow, callTargetsHash, selectorsHash, nonce))` with
 * `callTargetsHash = keccak256(abi.encodePacked(callTargets))`,
 * `selectorsHash = keccak256(abi.encodePacked(selectorAllowlist))`; then EIP-191-prefixed.
 */
export function grantSessionFinalHash(
  p: {
    chainId: number;
    verifyingContract: string;
    account: string;
    expiry: number;
    contractScope: string;
    selectorScope: string;
    velocityLimit: number;
    velocityWindow: number;
    callTargets: string[];
    selectorAllowlist: string[];
    // Accept bigint/string too: the grant nonce is abi-encoded as uint256 and a JS number
    // > 2^53 would lose precision before BigInt() and diverge from the contract (#137 Low).
    nonce: number | bigint | string;
  } & ({ sessionKey: string } | { keyX: string; keyY: string })
): `0x${string}` {
  const callTargetsHash = keccak256(encodePacked(["address[]"], [p.callTargets as `0x${string}`[]]));
  const selectorsHash = keccak256(encodePacked(["bytes4[]"], [p.selectorAllowlist as `0x${string}`[]]));
  const isP256 = "keyX" in p;

  const inner = isP256
    ? keccak256(
        encodeAbiParameters(
          [
            { type: "string" }, { type: "uint256" }, { type: "address" }, { type: "address" },
            { type: "bytes32" }, { type: "bytes32" }, { type: "uint48" }, { type: "address" },
            { type: "bytes4" }, { type: "uint16" }, { type: "uint32" }, { type: "bytes32" },
            { type: "bytes32" }, { type: "uint256" },
          ],
          [
            "GRANT_P256_SESSION_V2", u256(p.chainId), p.verifyingContract as `0x${string}`,
            p.account as `0x${string}`, (p as { keyX: string }).keyX as `0x${string}`,
            (p as { keyY: string }).keyY as `0x${string}`, p.expiry, p.contractScope as `0x${string}`,
            p.selectorScope as `0x${string}`, p.velocityLimit, p.velocityWindow, callTargetsHash,
            selectorsHash, u256(p.nonce),
          ]
        )
      )
    : keccak256(
        encodeAbiParameters(
          [
            { type: "string" }, { type: "uint256" }, { type: "address" }, { type: "address" },
            { type: "address" }, { type: "uint48" }, { type: "address" }, { type: "bytes4" },
            { type: "uint16" }, { type: "uint32" }, { type: "bytes32" }, { type: "bytes32" },
            { type: "uint256" },
          ],
          [
            "GRANT_SESSION_V2", u256(p.chainId), p.verifyingContract as `0x${string}`,
            p.account as `0x${string}`, (p as { sessionKey: string }).sessionKey as `0x${string}`,
            p.expiry, p.contractScope as `0x${string}`, p.selectorScope as `0x${string}`,
            p.velocityLimit, p.velocityWindow, callTargetsHash, selectorsHash, u256(p.nonce),
          ]
        )
      );

  return toEthSignedMessageHash({ raw: inner });
}

export interface KmsSignTypedDataRequest {
  keyId: string;
  hdPath?: string; // defaults to m/44'/60'/0'/0/0 server-side
  domain: KmsEip712Domain;
  primaryType: string;
  types: KmsEip712TypeDef[];
  message: KmsEip712FieldValue[];
  /** Required unless a Bearer agent JWT is supplied. Legacy passkeyAssertion is rejected. */
  webAuthnAssertion?: WebAuthnAssertion;
}

export interface KmsSignTypedDataResponse {
  keyId: string;
  signature: string; // 65-byte hex (R||S||V)
}

// ── Grant Session Signing (v0.19.0+) ────────────────────────────

export interface KmsBeginGrantSessionAuthRequest {
  keyId: string;
}

export interface KmsBeginGrantSessionAuthResponse {
  // PascalCase to match the KMS AuthenticationOptionsResponse wire format
  // (#[serde(rename = "ChallengeId" / "Options")]).
  ChallengeId: string;
  Options: PublicKeyCredentialRequestOptions;
}

export interface KmsSignGrantSessionRequest {
  keyId: string;
  hdPath?: string;
  chainId: number;
  verifyingContract: string;
  account: string;
  sessionKey: string;
  expiry: number;
  contractScope: string; // server type is String (scope mode marker)
  selectorScope: string; // bytes4 hex — server type is String
  velocityLimit: number;
  velocityWindow: number;
  callTargets: string[];
  selectorAllowlist: string[];
  nonce: number;
  webAuthnAssertion: WebAuthnAssertion;
}

export interface KmsSignGrantSessionResponse {
  keyId: string;
  signature: string; // 65-byte hex (R||S||V, V=27/28)
}

export interface KmsSignP256GrantSessionRequest {
  keyId: string;
  hdPath?: string;
  chainId: number;
  verifyingContract: string;
  account: string;
  keyX: string; // 32-byte hex P256 public key X coordinate
  keyY: string; // 32-byte hex P256 public key Y coordinate
  expiry: number;
  contractScope: string; // server type is String (scope mode marker)
  selectorScope: string; // bytes4 hex — server type is String
  velocityLimit: number;
  velocityWindow: number;
  callTargets: string[];
  selectorAllowlist: string[];
  nonce: number;
  webAuthnAssertion: WebAuthnAssertion;
}

// ── Key Status ───────────────────────────────────────────────────

export interface KmsKeyStatusResponse {
  KeyId: string;
  Status: "creating" | "deriving" | "ready" | "error";
  Address?: string;
  PublicKey?: string;
  DerivationPath?: string;
  Error?: string;
}

// ── Describe Key ─────────────────────────────────────────────────

export interface KmsDescribeKeyResponse {
  KeyMetadata: {
    KeyId: string;
    Address?: string;
    PublicKey?: string;
    DerivationPath?: string;
    PasskeyPublicKey?: string;
    Arn?: string;
    CreationDate?: string;
    Enabled?: boolean;
    Description?: string;
    KeyUsage?: string;
    KeySpec?: string;
    Origin?: string;
  };
}

// ── EthereumTransaction (for POST /Sign) ─────────────────────────

export interface KmsEthereumTransaction {
  chainId: number;
  nonce: number;
  to: string;
  value: string; // uint256 (decimal or 0x…)
  gasPrice: string;
  gas: number;
  data: string;
}

// ── Sign (message or EIP-155 transaction) ────────────────────────

export interface KmsSignRequest {
  KeyId?: string;
  Address?: string;
  DerivationPath?: string;
  /** Provide exactly one of Message or Transaction. */
  Message?: string; // hex
  Transaction?: KmsEthereumTransaction;
  SigningAlgorithm?: string;
  WebAuthn?: WebAuthnAssertion;
  Passkey?: LegacyPasskeyAssertion;
}

export interface KmsSignResponse {
  Signature: string;
  TransactionHash?: string;
}

// ── GetPublicKey ─────────────────────────────────────────────────

export interface KmsGetPublicKeyResponse {
  KeyId: string;
  PublicKey: string;
  Address?: string;
  KeyUsage?: string;
  KeySpec?: string;
}

// ── DeriveAddress ────────────────────────────────────────────────

export interface KmsDeriveAddressResponse {
  Address: string;
  PublicKey?: string;
}

// ── ListKeys ─────────────────────────────────────────────────────

export interface KmsListKeysResponse {
  Keys: Array<{ KeyId: string; KeyArn?: string }>;
  Truncated?: boolean;
  NextMarker?: string;
}

// ── DeleteKey ────────────────────────────────────────────────────

export interface KmsDeleteKeyResponse {
  KeyId: string;
  DeletionDate?: string;
}

// ── ChangePasskey ────────────────────────────────────────────────

export interface KmsChangePasskeyResponse {
  KeyId: string;
  Changed: boolean;
}

// ── UnfreezeKey ──────────────────────────────────────────────────

export interface KmsUnfreezeKeyResponse {
  KeyId: string;
  // "active" once unfrozen (or already active); mirrors the KMS LifecycleStatus enum.
  LifecycleStatus: string;
}

/**
 * KMS service for remote key management with WebAuthn/Passkey integration.
 *
 * Targets the AAStar TEE KMS (v0.20.0, kms.aastar.io). WebAuthn registration /
 * authentication ceremonies are handled by the KMS directly; signing operations
 * require a Passkey assertion (Legacy hex) or a one-time WebAuthn ceremony.
 *
 * Wraps a shared {@link KmsHttpClient}; the composed services (agent / session /
 * payment / monitor) reuse the same client via {@link KmsManager.httpClient}.
 */
export class KmsManager {
  private readonly client: KmsHttpClient;
  readonly logger: ILogger;

  constructor(options: {
    kmsEndpoint?: string;
    kmsEnabled?: boolean;
    kmsApiKey?: string;
    logger?: ILogger;
  }) {
    this.client = new KmsHttpClient(options);
    this.logger = this.client.logger;
  }

  isKmsEnabled(): boolean {
    return this.client.enabled;
  }

  /** Shared HTTP transport — pass to KmsAgentService / KmsSessionService / etc. */
  get httpClient(): KmsHttpClient {
    return this.client;
  }

  private ensureEnabled(): void {
    this.client.ensureEnabled();
  }

  /** POST with x-amz-target header (required for wallet/signing operations). */
  private async amzPost<T>(path: string, target: string, body: unknown): Promise<T> {
    return this.client.amzPost<T>(path, target, body);
  }

  // ── Key Management ──────────────────────────────────────────────

  async createKey(description: string, passkeyPublicKey: string): Promise<KmsCreateKeyResponse> {
    this.ensureEnabled();

    return this.amzPost("/CreateKey", "TrentService.CreateKey", {
      Description: description,
      KeyUsage: "SIGN_VERIFY",
      KeySpec: "ECC_SECG_P256K1",
      Origin: "EXTERNAL_KMS",
      PasskeyPublicKey: passkeyPublicKey,
    });
  }

  async getKeyStatus(keyId: string): Promise<KmsKeyStatusResponse> {
    this.ensureEnabled();

    return this.client.get<KmsKeyStatusResponse>("/KeyStatus", {
      params: { KeyId: keyId },
    });
  }

  async describeKey(keyId: string): Promise<KmsDescribeKeyResponse> {
    this.ensureEnabled();

    return this.amzPost("/DescribeKey", "TrentService.DescribeKey", { KeyId: keyId });
  }

  /** Get a key's public key (uncompressed). Not WebAuthn-gated. */
  async getPublicKey(target: { KeyId?: string; Address?: string }): Promise<KmsGetPublicKeyResponse> {
    this.ensureEnabled();
    return this.amzPost("/GetPublicKey", "TrentService.GetPublicKey", target);
  }

  /**
   * Derive an Ethereum address at a BIP-44 path (WebAuthn-gated).
   * Provide a WebAuthn ceremony assertion (preferred) or a Legacy passkey assertion.
   */
  async deriveAddress(params: {
    KeyId: string;
    DerivationPath: string;
    WebAuthn?: WebAuthnAssertion;
    Passkey?: LegacyPasskeyAssertion;
  }): Promise<KmsDeriveAddressResponse> {
    this.ensureEnabled();
    return this.amzPost("/DeriveAddress", "TrentService.DeriveAddress", params);
  }

  /** List keys (paginated). Not WebAuthn-gated. */
  async listKeys(params: { Limit?: number; Marker?: string } = {}): Promise<KmsListKeysResponse> {
    this.ensureEnabled();
    return this.amzPost("/ListKeys", "TrentService.ListKeys", params);
  }

  /**
   * Schedule key deletion (AWS-KMS action ScheduleKeyDeletion; WebAuthn-gated).
   * RPMB-bound on the TEE — requires a passkey/WebAuthn assertion on the normal path.
   */
  async deleteKey(params: {
    KeyId: string;
    PendingWindowInDays?: number;
    WebAuthn?: WebAuthnAssertion;
    Passkey?: LegacyPasskeyAssertion;
  }): Promise<KmsDeleteKeyResponse> {
    this.ensureEnabled();
    return this.amzPost("/DeleteKey", "TrentService.ScheduleKeyDeletion", params);
  }

  /**
   * Unfreeze a dormant (frozen) key (issue #42; WebAuthn-gated).
   * A key auto-frozen by the dormant-key sweep rejects signing until unfrozen.
   * The TEE verifies the owner via the same strict WebAuthn ceremony as
   * {@link deleteKey}; ownership is checked even when the key is already active,
   * so this cannot be used as an unauthenticated key-state probe. Unlike DeleteKey
   * this endpoint takes no `x-amz-target` header — it authenticates via the default
   * API key plus the WebAuthn assertion in the body.
   */
  async unfreezeKey(params: {
    KeyId: string;
    WebAuthn?: WebAuthnAssertion;
  }): Promise<KmsUnfreezeKeyResponse> {
    this.ensureEnabled();
    return this.client.post<KmsUnfreezeKeyResponse>("/UnfreezeKey", params);
  }

  /**
   * Rotate the WebAuthn passkey bound to a key (WebAuthn-gated, RPMB-bound).
   * `PasskeyPublicKey` is the NEW P-256 public key (0x04… 65-byte uncompressed).
   */
  async changePasskey(params: {
    KeyId: string;
    PasskeyPublicKey: string;
    WebAuthn?: WebAuthnAssertion;
    Passkey?: LegacyPasskeyAssertion;
  }): Promise<KmsChangePasskeyResponse> {
    this.ensureEnabled();
    return this.amzPost("/ChangePasskey", "TrentService.ChangePasskey", params);
  }

  // ── Ceremony wrappers for non-signing passkey ops (strict-readiness #135 item 2) ──
  // These are NON-signing ops, so the challenge is the raw nonce (no payload commitment),
  // but they MUST go through the ceremony (clientDataJSON present) — strict mode hard-rejects
  // any assertion without clientDataJSON. Run the ceremony internally so callers never reach
  // for the deprecated legacy `Passkey` field.

  /** Schedule key deletion, running the WebAuthn ceremony internally (raw-nonce). */
  async deleteKeyWithCeremony(
    params: { KeyId: string; PendingWindowInDays?: number },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsDeleteKeyResponse> {
    this.ensureEnabled();
    const WebAuthn = await this.runAuthenticationCeremony(params.KeyId, signer, options);
    return this.deleteKey({ ...params, WebAuthn });
  }

  /** Unfreeze a dormant key, running the WebAuthn ceremony internally (raw-nonce). */
  async unfreezeKeyWithCeremony(
    params: { KeyId: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsUnfreezeKeyResponse> {
    this.ensureEnabled();
    const WebAuthn = await this.runAuthenticationCeremony(params.KeyId, signer, options);
    return this.unfreezeKey({ ...params, WebAuthn });
  }

  /** Rotate the bound passkey, running the WebAuthn ceremony internally (raw-nonce). */
  async changePasskeyWithCeremony(
    params: { KeyId: string; PasskeyPublicKey: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsChangePasskeyResponse> {
    this.ensureEnabled();
    const WebAuthn = await this.runAuthenticationCeremony(params.KeyId, signer, options);
    return this.changePasskey({ ...params, WebAuthn });
  }

  /**
   * Sign a message or an EIP-155 transaction (WebAuthn-gated).
   * Provide exactly one of `Message` (hex) or `Transaction`. For a raw 32-byte
   * digest use {@link signHash} / {@link signHashWithWebAuthn} instead.
   */
  async sign(params: KmsSignRequest): Promise<KmsSignResponse> {
    this.ensureEnabled();
    return this.amzPost("/Sign", "TrentService.Sign", params);
  }

  /**
   * Poll KeyStatus until the key is ready (address derived) or timeout.
   * STM32 key derivation takes 60-75 seconds on first creation.
   */
  async pollUntilReady(
    keyId: string,
    timeoutMs: number = 120_000,
    intervalMs: number = 3_000
  ): Promise<KmsKeyStatusResponse> {
    this.ensureEnabled();

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getKeyStatus(keyId);
      this.logger.debug(`Key ${keyId} status: ${status.Status}`);

      if (status.Status === "ready") {
        return status;
      }
      if (status.Status === "error") {
        throw new Error(`KMS key derivation failed: ${status.Error ?? "unknown error"}`);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`KMS key derivation timed out after ${timeoutMs}ms`);
  }

  // ── Signing ─────────────────────────────────────────────────────

  /**
   * Sign a hash using Legacy Passkey assertion (reusable for BLS dual-signing).
   */
  async signHash(
    hash: string,
    assertion: LegacyPasskeyAssertion,
    target: { Address?: string; KeyId?: string }
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();

    const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

    const body: Record<string, unknown> = {
      Hash: formattedHash,
      Passkey: assertion,
    };

    if (target.Address) {
      body.Address = target.Address;
    }
    if (target.KeyId) {
      body.KeyId = target.KeyId;
    }

    return this.amzPost("/SignHash", "TrentService.SignHash", body);
  }

  /**
   * Sign a hash using a WebAuthn ceremony assertion (one-time use).
   */
  async signHashWithWebAuthn(
    hash: string,
    challengeId: string,
    credential: unknown,
    target: { Address?: string; KeyId?: string }
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();

    const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

    const body: Record<string, unknown> = {
      Hash: formattedHash,
      WebAuthn: { ChallengeId: challengeId, Credential: credential },
    };

    if (target.Address) {
      body.Address = target.Address;
    }
    if (target.KeyId) {
      body.KeyId = target.KeyId;
    }

    return this.amzPost("/SignHash", "TrentService.SignHash", body);
  }

  // ── Sign Typed Data (v0.19.0+) ─────────────────────────────────

  /**
   * Sign arbitrary EIP-712 typed data via `POST /kms/SignTypedData` (v0.20.0).
   *
   * The KMS hashes the typed data host-side, so the FULL EIP-712 structure
   * (domain / primaryType / types / message) is sent — not a pre-hashed
   * domainSeparator/structHash. The `webAuthnAssertion` challenge comes from a
   * generic {@link beginAuthentication} ceremony (purpose="authentication").
   *
   * Alternatively, agents authenticate with a Bearer JWT — see KmsAgentService.
   */
  async signTypedDataWithWebAuthn(
    params: KmsSignTypedDataRequest
  ): Promise<KmsSignTypedDataResponse> {
    this.ensureEnabled();

    return this.client.post<KmsSignTypedDataResponse>("/kms/SignTypedData", params);
  }

  // ── Grant Session Off-chain Signing (v0.19.0+) ─────────────────

  /**
   * Begin a grant-session WebAuthn challenge.
   * The returned challengeId can ONLY be used with sign-grant-session, not sign-typed-data.
   */
  async beginGrantSessionAuth(
    params: KmsBeginGrantSessionAuthRequest
  ): Promise<KmsBeginGrantSessionAuthResponse> {
    this.ensureEnabled();

    return this.client.get<KmsBeginGrantSessionAuthResponse>("/kms/begin-grant-session-auth", {
      params: { keyId: params.keyId },
    });
  }

  /**
   * Sign a GRANT_SESSION_V2 hash off-chain inside the TEE (secp256k1 session key).
   * Returns a 65-byte signature (R||S||V, V=27/28) for use in grantSessionWithSig().
   */
  async signGrantSession(
    params: KmsSignGrantSessionRequest
  ): Promise<KmsSignGrantSessionResponse> {
    this.ensureEnabled();

    return this.client.post<KmsSignGrantSessionResponse>("/kms/sign-grant-session", params);
  }

  /**
   * Sign a GRANT_P256_SESSION_V2 hash off-chain inside the TEE (P256 session key).
   * Returns a 65-byte signature for use in grantP256SessionWithSig().
   */
  async signP256GrantSession(
    params: KmsSignP256GrantSessionRequest
  ): Promise<KmsSignGrantSessionResponse> {
    this.ensureEnabled();

    return this.client.post<KmsSignGrantSessionResponse>("/kms/sign-p256-grant-session", params);
  }

  // ── Challenge-binding ceremonies (#49 / Beta3) ──────────────────
  //
  // These run the full WebAuthn challenge-binding ceremony in one call:
  // fetch the TA one-time nonce, embed it in clientDataJSON, build + sign the
  // assertion, then invoke the signing endpoint with the resulting
  // `WebAuthn` / `webAuthnAssertion`. They share the
  // {@link runAuthenticationCeremony} / {@link runGrantSessionCeremony} helper,
  // so every path produces an identical, replay-protected assertion structure.

  /**
   * Run a generic authentication ceremony (purpose="authentication") bound to a
   * fresh TA challenge. The returned assertion is valid for DeriveAddress / Sign
   * / SignHash / SignTypedData / agent-key / p256-session signing.
   */
  async runAuthenticationCeremony(
    keyId: string,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<WebAuthnAssertion> {
    this.ensureEnabled();
    return runAuthenticationCeremony(this.client, keyId, signer, options);
  }

  /**
   * Run a grant-session ceremony (purpose="grant-session") bound to a fresh TA
   * challenge — required by {@link signGrantSession} / {@link signP256GrantSession}
   * (the generic 'authentication' challenge is rejected there for replay safety).
   */
  async runGrantSessionCeremony(
    keyId: string,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<WebAuthnAssertion> {
    this.ensureEnabled();
    return runGrantSessionCeremony(this.client, keyId, signer, options);
  }

  /** Derive an address, running the challenge-binding ceremony internally. */
  async deriveAddressWithCeremony(
    params: { KeyId: string; DerivationPath: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsDeriveAddressResponse> {
    this.ensureEnabled();
    const WebAuthn = await this.runAuthenticationCeremony(params.KeyId, signer, options);
    return this.deriveAddress({ ...params, WebAuthn });
  }

  /**
   * Sign a message or EIP-155 transaction via `/Sign`, running the ceremony internally.
   * `params.KeyId` is required.
   *
   * ⚠️ STRICT MODE: unlike {@link signHashWithCeremony} / {@link signTypedDataWithCeremony},
   * this does NOT auto-bind a payload commitment, because the TA derives the signed digest
   * from `Message` / `Transaction` host-side (EIP-191 / RLP) and the SDK can't reproduce it
   * byte-exactly for every input. So it sends the RAW nonce by default — which the KMS will
   * REJECT once strict mode (#63) is on. For strict-safe signing either:
   *   - pass `options.payload` = the exact digest the TA will sign (you computed it), or
   *   - prefer {@link signHashWithCeremony} (commits to a known 32-byte hash).
   */
  async signWithCeremony(
    params: Omit<KmsSignRequest, "WebAuthn" | "Passkey"> & { KeyId: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignResponse> {
    this.ensureEnabled();
    const WebAuthn = await this.runAuthenticationCeremony(params.KeyId, signer, options);
    return this.sign({ ...params, WebAuthn });
  }

  /**
   * Sign a 32-byte digest, running the challenge-binding ceremony internally.
   * Binds the challenge to `hash` (WYSIWYS commitment, #68) by default — pass an
   * explicit `options.payload` only to override.
   */
  async signHashWithCeremony(
    hash: string,
    target: { KeyId: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();
    const assertion = await this.runAuthenticationCeremony(target.KeyId, signer, {
      ...options,
      payload: options?.payload ?? (hash as `0x${string}`),
    });
    return this.signHashWithWebAuthn(hash, assertion.ChallengeId, assertion.Credential, target);
  }

  /**
   * Sign EIP-712 typed data, running the challenge-binding ceremony internally.
   * Auto-binds the WYSIWYS commitment (#68): the ceremony challenge is
   * `SHA-256(nonce ‖ eip712Digest)`, where `eip712Digest` is the standard EIP-712
   * digest the KMS hashes host-side — computed here via {@link eip712Digest} so the
   * user's signature commits to the exact typed-data payload. Pass an explicit
   * `options.payload` only to override.
   */
  async signTypedDataWithCeremony(
    params: Omit<KmsSignTypedDataRequest, "webAuthnAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignTypedDataResponse> {
    this.ensureEnabled();
    const payload = options?.payload ?? eip712Digest(params);
    const webAuthnAssertion = await this.runAuthenticationCeremony(params.keyId, signer, {
      ...options,
      payload,
    });
    return this.signTypedDataWithWebAuthn({ ...params, webAuthnAssertion });
  }

  /**
   * Sign a GRANT_SESSION_V2 hash, running the grant-session ceremony internally
   * (uses the purpose-bound `begin-grant-session-auth` challenge).
   */
  async signGrantSessionWithCeremony(
    params: Omit<KmsSignGrantSessionRequest, "webAuthnAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignGrantSessionResponse> {
    this.ensureEnabled();
    const webAuthnAssertion = await this.runGrantSessionCeremony(params.keyId, signer, {
      ...options,
      payload: options?.payload ?? grantSessionFinalHash(params),
    });
    return this.signGrantSession({ ...params, webAuthnAssertion });
  }

  /**
   * Sign a GRANT_P256_SESSION_V2 hash, running the grant-session ceremony
   * internally (uses the purpose-bound `begin-grant-session-auth` challenge).
   */
  async signP256GrantSessionWithCeremony(
    params: Omit<KmsSignP256GrantSessionRequest, "webAuthnAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignGrantSessionResponse> {
    this.ensureEnabled();
    const webAuthnAssertion = await this.runGrantSessionCeremony(params.keyId, signer, {
      ...options,
      payload: options?.payload ?? grantSessionFinalHash(params),
    });
    return this.signP256GrantSession({ ...params, webAuthnAssertion });
  }

  // ── WebAuthn Ceremonies ─────────────────────────────────────────

  async beginRegistration(
    params: KmsBeginRegistrationRequest
  ): Promise<KmsBeginRegistrationResponse> {
    this.ensureEnabled();

    return this.client.post<KmsBeginRegistrationResponse>("/BeginRegistration", params);
  }

  async completeRegistration(
    params: KmsCompleteRegistrationRequest
  ): Promise<KmsCompleteRegistrationResponse> {
    this.ensureEnabled();

    return this.client.post<KmsCompleteRegistrationResponse>("/CompleteRegistration", params);
  }

  async beginAuthentication(
    params: KmsBeginAuthenticationRequest
  ): Promise<KmsBeginAuthenticationResponse> {
    this.ensureEnabled();

    return this.client.post<KmsBeginAuthenticationResponse>("/BeginAuthentication", params);
  }

  /**
   * Begin a generic WebAuthn authentication ceremony for a key, returning a
   * challenge usable for SignHash / SignTypedData (purpose="authentication").
   *
   * NOTE: there is no dedicated `begin-webauthn-auth` endpoint — this delegates
   * to `POST /BeginAuthentication`. (Grant-session signing needs a purpose-bound
   * challenge from {@link beginGrantSessionAuth} instead.)
   */
  async beginWebAuthnAuth(keyId: string): Promise<KmsBeginAuthenticationResponse> {
    this.ensureEnabled();

    return this.client.post<KmsBeginAuthenticationResponse>("/BeginAuthentication", { KeyId: keyId });
  }

  // ── Factory ─────────────────────────────────────────────────────

  /**
   * Create a KMS signer that authorizes each signature with a LEGACY raw passkey
   * assertion (reusable, no challenge consumption).
   *
   * @deprecated The KMS (v0.20.0+) rejects legacy raw passkey assertions for
   * signing/mutating operations (`/SignHash` → 400, "no challenge binding —
   * replayable"), unless `KMS_ALLOW_LEGACY_PASSKEY=1` is set on the KMS (test
   * only). Prefer {@link createKmsSignerWithCeremony}, which runs a one-time
   * challenge-bound WebAuthn ceremony per signature.
   */
  createKmsSigner(
    keyId: string,
    address: string,
    assertionProvider: () => Promise<LegacyPasskeyAssertion>
  ): KmsSigner {
    this.ensureEnabled();
    return new KmsSigner(keyId, address, this, { mode: "legacy", assertionProvider });
  }

  /**
   * Create a KMS signer that authorizes each signature with a one-time,
   * challenge-bound WebAuthn ceremony (production-safe; replay-protected).
   *
   * Every `signMessage` call runs a FRESH ceremony (BeginAuthentication →
   * authenticator assertion → `/SignHash` with the `WebAuthn` field), because the
   * KMS consumes the challenge atomically (one challenge ⇒ one signature). A
   * Tier-2/3 BLS transfer that needs N owner signatures therefore triggers N
   * ceremonies — see {@link BLSSignatureService} (which now skips the unused
   * userOpHash owner-ECDSA for tiered signatures, so Tier-2 needs only one).
   *
   * @param ceremonySigner authenticator that signs the WebAuthn challenge
   *   (a browser passkey on the client, or {@link P256PasskeySigner} server-side).
   */
  createKmsSignerWithCeremony(
    keyId: string,
    address: string,
    ceremonySigner: PasskeyCeremonySigner,
    ceremonyOptions?: Omit<RunCeremonyOptions, "signer">,
    commitPayload = true
  ): KmsSigner {
    this.ensureEnabled();
    return new KmsSigner(keyId, address, this, {
      mode: "ceremony",
      ceremonySigner,
      ceremonyOptions,
      commitPayload,
    });
  }
}

/** How a {@link KmsSigner} authorizes each `/SignHash` call. */
export type KmsSignerAuth =
  | { mode: "legacy"; assertionProvider: () => Promise<LegacyPasskeyAssertion> }
  | {
      mode: "ceremony";
      ceremonySigner: PasskeyCeremonySigner;
      ceremonyOptions?: Omit<RunCeremonyOptions, "signer">;
      /**
       * Bind each ceremony challenge to the payload via `SHA-256(nonce ‖ hash)`
       * (WYSIWYS, AirAccount #68). DEFAULT `true` — verified end-to-end against the live
       * KMS (kms.aastar.io) once AirAccount#110 (host/TA challenge alignment) shipped; the
       * KMS transition mode accepts it now and strict mode (#63) will REQUIRE it. Set
       * `false` only to force the legacy raw-nonce challenge (not strict-safe).
       */
      commitPayload?: boolean;
    };

/**
 * KMS-backed signer (EIP-191 personal-sign over a digest).
 *
 * Two authorization modes (see {@link KmsSignerAuth}):
 *  - `ceremony` (preferred): each signature runs a fresh one-time WebAuthn
 *    ceremony and calls KMS `SignHash` with the challenge-bound `WebAuthn` field
 *    (replay-safe; what the KMS now requires).
 *  - `legacy` (deprecated): each signature reuses a raw passkey assertion via
 *    KMS `SignHash` `Passkey` field — rejected by KMS unless
 *    `KMS_ALLOW_LEGACY_PASSKEY=1` (test only).
 *
 * Narrowed during the ethers -> viem migration: only the EIP-191 personal-sign
 * and address-read behaviour is consumed by the SDK.
 */
export class KmsSigner {
  constructor(
    private readonly keyId: string,
    private readonly _address: string,
    private readonly kmsManager: KmsManager,
    private readonly auth: KmsSignerAuth
  ) {}

  async getAddress(): Promise<string> {
    return this._address;
  }

  /**
   * EIP-191 personal-sign over a digest. A string is hashed as UTF-8 text, a byte
   * array as raw bytes — byte-identical to ethers `hashMessage`.
   *
   * @param webAuthnAssertion OPTIONAL pre-built, one-time ceremony assertion. Use
   *   this in server flows where the passkey lives on the USER's device: the
   *   frontend runs the BeginAuthentication ceremony and the backend forwards the
   *   resulting `{ ChallengeId, Credential }` here. When supplied it takes
   *   precedence over the signer's baked-in auth mode. Each assertion is one-time
   *   (the KMS consumes the challenge), so a caller that needs N signatures must
   *   supply N distinct assertions.
   *
   *   WYSIWYS (AirAccount #68): the frontend MUST build the assertion over the
   *   payload-committed challenge `commitChallenge(nonce, hashOf(message))`, not the
   *   raw nonce — otherwise a compromised host could swap the signed payload. The
   *   raw-nonce assertion only works while the KMS runs in transition mode. (The
   *   signer's own ceremony mode does this automatically.)
   */
  async signMessage(
    message: string | Uint8Array,
    webAuthnAssertion?: WebAuthnAssertion
  ): Promise<string> {
    const messageHash = hashMessage(message);
    const target = { Address: this._address };

    // (1) Frontend-produced ceremony assertion forwarded per-call (device passkey).
    if (webAuthnAssertion) {
      const signResponse = await this.kmsManager.signHashWithWebAuthn(
        messageHash,
        webAuthnAssertion.ChallengeId,
        webAuthnAssertion.Credential,
        target
      );
      return "0x" + signResponse.Signature;
    }

    // (2) Signer-held authenticator runs a fresh ceremony itself (server/agent key).
    if (this.auth.mode === "ceremony") {
      // Fresh one-time ceremony per signature (replay-safe). The challenge is the raw
      // nonce by default — what the live KMS host verifies against. Opt into the
      // SHA-256(nonce ‖ hash) payload commitment (WYSIWYS, #68) ONLY when the KMS host
      // is updated to expect it (else "Challenge mismatch").
      const assertion = await this.kmsManager.runAuthenticationCeremony(
        this.keyId,
        this.auth.ceremonySigner,
        this.auth.commitPayload
          ? { ...this.auth.ceremonyOptions, payload: messageHash as `0x${string}` }
          : this.auth.ceremonyOptions
      );
      const signResponse = await this.kmsManager.signHashWithWebAuthn(
        messageHash,
        assertion.ChallengeId,
        assertion.Credential,
        target
      );
      return "0x" + signResponse.Signature;
    }

    const assertion = await this.auth.assertionProvider();
    const signResponse = await this.kmsManager.signHash(messageHash, assertion, target);
    return "0x" + signResponse.Signature;
  }
}
