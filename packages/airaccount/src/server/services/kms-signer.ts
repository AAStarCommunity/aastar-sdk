import { ethers } from "ethers";
import axios, { AxiosInstance } from "axios";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

// ── Legacy Passkey Assertion (reusable for BLS dual-signing) ─────

export interface LegacyPasskeyAssertion {
  AuthenticatorData: string; // "0x..."
  ClientDataHash: string; // "0x..."
  Signature: string; // "0x..."
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

/**
 * KMS service for remote key management with WebAuthn/Passkey integration.
 *
 * The new STM32 KMS (kms1.aastar.io) natively integrates WebAuthn, so
 * registration/authentication ceremonies are handled by the KMS directly.
 * Signing operations require a Passkey assertion (Legacy hex or WebAuthn ceremony).
 */
export class KmsManager {
  private readonly kmsEndpoint: string;
  private readonly isEnabled: boolean;
  private readonly apiKey?: string;
  private readonly logger: ILogger;
  private readonly http: AxiosInstance;

  constructor(options: {
    kmsEndpoint?: string;
    kmsEnabled?: boolean;
    kmsApiKey?: string;
    logger?: ILogger;
  }) {
    this.kmsEndpoint = options.kmsEndpoint ?? "https://kms1.aastar.io";
    this.isEnabled = options.kmsEnabled === true;
    this.apiKey = options.kmsApiKey;
    this.logger = options.logger ?? new ConsoleLogger("[KmsManager]");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    this.http = axios.create({
      baseURL: this.kmsEndpoint,
      headers,
    });
  }

  isKmsEnabled(): boolean {
    return this.isEnabled;
  }

  private ensureEnabled(): void {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }
  }

  /** POST with x-amz-target header (required for wallet/signing operations). */
  private async amzPost<T>(path: string, target: string, body: unknown): Promise<T> {
    const response = await this.http.post(path, body, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "x-amz-target": target,
      },
    });
    return response.data as T;
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

    const response = await this.http.get("/KeyStatus", {
      params: { KeyId: keyId },
    });
    return response.data as KmsKeyStatusResponse;
  }

  async describeKey(keyId: string): Promise<KmsDescribeKeyResponse> {
    this.ensureEnabled();

    return this.amzPost("/DescribeKey", "TrentService.DescribeKey", { KeyId: keyId });
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

  // ── WebAuthn Ceremonies ─────────────────────────────────────────

  async beginRegistration(
    params: KmsBeginRegistrationRequest
  ): Promise<KmsBeginRegistrationResponse> {
    this.ensureEnabled();

    const response = await this.http.post("/BeginRegistration", params);
    return response.data as KmsBeginRegistrationResponse;
  }

  async completeRegistration(
    params: KmsCompleteRegistrationRequest
  ): Promise<KmsCompleteRegistrationResponse> {
    this.ensureEnabled();

    const response = await this.http.post("/CompleteRegistration", params);
    return response.data as KmsCompleteRegistrationResponse;
  }

  async beginAuthentication(
    params: KmsBeginAuthenticationRequest
  ): Promise<KmsBeginAuthenticationResponse> {
    this.ensureEnabled();

    const response = await this.http.post("/BeginAuthentication", params);
    return response.data as KmsBeginAuthenticationResponse;
  }

  // ── Factory ─────────────────────────────────────────────────────

  createKmsSigner(
    keyId: string,
    address: string,
    assertionProvider: () => Promise<LegacyPasskeyAssertion>,
    provider?: ethers.Provider
  ): KmsSigner {
    this.ensureEnabled();
    return new KmsSigner(keyId, address, this, assertionProvider, provider);
  }
}

/**
 * ethers.AbstractSigner backed by KMS with Passkey assertion.
 *
 * Each signing operation calls the `assertionProvider` to obtain a Legacy
 * Passkey assertion, which is then passed to KMS SignHash. The Legacy format
 * is reusable (no challenge consumption), enabling BLS dual-signing.
 */
export class KmsSigner extends ethers.AbstractSigner {
  constructor(
    private readonly keyId: string,
    private readonly _address: string,
    private readonly kmsManager: KmsManager,
    private readonly assertionProvider: () => Promise<LegacyPasskeyAssertion>,
    provider?: ethers.Provider
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.toUtf8Bytes(message) : message;
    const messageHash = ethers.hashMessage(messageBytes);
    const assertion = await this.assertionProvider();
    const signResponse = await this.kmsManager.signHash(messageHash, assertion, {
      Address: this._address,
    });
    return "0x" + signResponse.Signature;
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider is required for signing transactions");
    }
    const populated = await this.populateTransaction(tx);
    const unsignedTx = ethers.Transaction.from(populated);
    const txHash = unsignedTx.hash;
    if (!txHash) {
      throw new Error("Failed to compute transaction hash");
    }
    const assertion = await this.assertionProvider();
    const signResponse = await this.kmsManager.signHash(txHash, assertion, {
      Address: this._address,
    });
    const sig = ethers.Signature.from("0x" + signResponse.Signature);
    unsignedTx.signature = sig;
    return unsignedTx.serialized;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);
    const assertion = await this.assertionProvider();
    const signResponse = await this.kmsManager.signHash(hash, assertion, {
      Address: this._address,
    });
    return "0x" + signResponse.Signature;
  }

  connect(provider: ethers.Provider): KmsSigner {
    return new KmsSigner(
      this.keyId,
      this._address,
      this.kmsManager,
      this.assertionProvider,
      provider
    );
  }
}
