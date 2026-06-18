import { hashMessage } from "../../migration/viem/signatures";
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
   * Sign a message or EIP-155 transaction, running the challenge-binding ceremony
   * internally. `params.KeyId` is required (it identifies the wallet to challenge).
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

  /** Sign a 32-byte digest, running the challenge-binding ceremony internally. */
  async signHashWithCeremony(
    hash: string,
    target: { KeyId: string },
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();
    const assertion = await this.runAuthenticationCeremony(target.KeyId, signer, options);
    return this.signHashWithWebAuthn(hash, assertion.ChallengeId, assertion.Credential, target);
  }

  /** Sign EIP-712 typed data, running the challenge-binding ceremony internally. */
  async signTypedDataWithCeremony(
    params: Omit<KmsSignTypedDataRequest, "webAuthnAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsSignTypedDataResponse> {
    this.ensureEnabled();
    const webAuthnAssertion = await this.runAuthenticationCeremony(params.keyId, signer, options);
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
    const webAuthnAssertion = await this.runGrantSessionCeremony(params.keyId, signer, options);
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
    const webAuthnAssertion = await this.runGrantSessionCeremony(params.keyId, signer, options);
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

  createKmsSigner(
    keyId: string,
    address: string,
    assertionProvider: () => Promise<LegacyPasskeyAssertion>
  ): KmsSigner {
    this.ensureEnabled();
    return new KmsSigner(keyId, address, this, assertionProvider);
  }
}

/**
 * KMS-backed signer with Passkey assertion.
 *
 * Each signing operation calls the `assertionProvider` to obtain a Legacy
 * Passkey assertion, which is then passed to KMS SignHash. The Legacy format
 * is reusable (no challenge consumption), enabling BLS dual-signing.
 *
 * Narrowed during the ethers -> viem migration: only the EIP-191 personal-sign
 * and address-read behaviour is actually consumed by the SDK, so the former
 * ethers.AbstractSigner surface (signTransaction / signTypedData / connect /
 * provider) has been dropped.
 */
export class KmsSigner {
  constructor(
    private readonly keyId: string,
    private readonly _address: string,
    private readonly kmsManager: KmsManager,
    private readonly assertionProvider: () => Promise<LegacyPasskeyAssertion>
  ) {}

  async getAddress(): Promise<string> {
    return this._address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    // EIP-191 personal-sign: a string is hashed as UTF-8 text, a byte array as
    // raw bytes — byte-identical to ethers `hashMessage(toUtf8Bytes(str) | bytes)`.
    const messageHash = hashMessage(message);
    const assertion = await this.assertionProvider();
    const signResponse = await this.kmsManager.signHash(messageHash, assertion, {
      Address: this._address,
    });
    return "0x" + signResponse.Signature;
  }
}
