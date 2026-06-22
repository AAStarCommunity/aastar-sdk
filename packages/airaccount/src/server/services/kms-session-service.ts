import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion, mintDigest } from "./kms-signer";
import {
  PasskeyCeremonySigner,
  RunCeremonyOptions,
  runAuthenticationCeremony,
} from "./webauthn-ceremony";

// ── Create P256 Session Key (v0.20.0) ───────────────────────────

export interface CreateP256SessionKeyRequest {
  /** Human (root) key under which the session key is minted. */
  humanKeyId: string;
  /** Optional human-readable label for the session key. */
  label?: string;
  /**
   * One-time WebAuthn assertion gating creation. The challenge comes from a
   * generic {@link KmsManager.beginAuthentication} ceremony — the caller runs
   * the ceremony and supplies the resulting assertion here.
   */
  webAuthnAssertion?: WebAuthnAssertion;
}

export interface CreateP256SessionKeyResponse {
  keyId: string;
  pubKeyX: string; // 0x… 32-byte P256 public key X coordinate
  pubKeyY: string; // 0x… 32-byte P256 public key Y coordinate
  algorithm: string; // "p256"
  agentCredential: string; // JWT — bearer token for subsequent per-UserOp signing
  expiresAt: number; // unix seconds
}

// ── Sign P256 UserOp (Bearer JWT auth) ──────────────────────────

export interface SignP256UserOpRequest {
  keyId: string;
  payload: string; // hex userOpHash (32 bytes)
  accountAddress: string; // 0x… ERC-4337 account address
}

export interface SignP256UserOpResponse {
  keyId: string;
  pubKeyX: string;
  pubKeyY: string;
  /**
   * 149-byte P256 session-key wire format (hex):
   * [0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)].
   */
  signature: string;
}

// ── Revoke P256 Session Key (v0.20.0) ───────────────────────────

export interface RevokeP256SessionKeyRequest {
  keyId: string;
  /**
   * One-time WebAuthn assertion gating revocation. The challenge comes from a
   * generic {@link KmsManager.beginAuthentication} ceremony — the caller runs
   * the ceremony and supplies the resulting assertion here.
   */
  webAuthnAssertion?: WebAuthnAssertion;
}

export interface RevokeP256SessionKeyResponse {
  success: boolean;
  revokedAt: number; // unix seconds
}

/**
 * Manages the lifecycle of a P-256 session key minted under a human key for
 * ERC-4337 UserOp signing (AAStar TEE KMS v0.20.0).
 *
 * A session key is created under a root (human) key, used to sign UserOps via a
 * TEE-issued bearer JWT (the `agentCredential`), and eventually revoked. The
 * per-UserOp signature is the 149-byte P256 session-key wire format.
 *
 * Relationship to {@link KmsManager.signP256GrantSession}: that method signs the
 * GRANT_P256_SESSION_V2 authorization needed to *install* this key on-chain
 * (granting the session key its on-chain scope/policies). This service instead
 * manages the session key's own lifecycle (create / sign / revoke) once granted.
 *
 * Create and revoke are WebAuthn-gated: the challenge originates from a generic
 * {@link KmsManager.beginAuthentication} ceremony and the caller supplies the
 * resulting assertion. Per-UserOp signing authenticates with the bearer JWT.
 *
 * Wraps a shared {@link KmsHttpClient} — pass `KmsManager.httpClient`.
 */
export class KmsSessionService {
  constructor(private readonly http: KmsHttpClient) {}

  /**
   * Create a P-256 session key under a human key (WebAuthn-gated).
   *
   * `POST /kms/create-p256-session-key`. The `webAuthnAssertion` challenge comes
   * from a generic {@link KmsManager.beginAuthentication} ceremony supplied by
   * the caller. Returns the session key's public key plus an `agentCredential`
   * JWT used to authenticate subsequent {@link signP256UserOp} calls.
   */
  async createP256SessionKey(
    params: CreateP256SessionKeyRequest
  ): Promise<CreateP256SessionKeyResponse> {
    this.http.ensureEnabled();

    return this.http.post<CreateP256SessionKeyResponse>(
      "/kms/create-p256-session-key",
      params
    );
  }

  /**
   * Sign an ERC-4337 UserOp hash with a P-256 session key (Bearer JWT auth).
   *
   * `POST /kms/sign-p256-user-op`, authenticated with the `agentCredential` JWT
   * returned by {@link createP256SessionKey}. Returns the 149-byte P256
   * session-key wire-format signature.
   */
  async signP256UserOp(
    params: SignP256UserOpRequest,
    jwt: string
  ): Promise<SignP256UserOpResponse> {
    this.http.ensureEnabled();

    return this.http.postWithBearer<SignP256UserOpResponse>(
      "/kms/sign-p256-user-op",
      params,
      jwt
    );
  }

  /**
   * Revoke a P-256 session key (WebAuthn-gated, idempotent).
   *
   * `POST /kms/revoke-p256-session-key`. The `webAuthnAssertion` challenge comes
   * from a generic {@link KmsManager.beginAuthentication} ceremony supplied by
   * the caller. Idempotent: revoking an already-revoked key still resolves.
   */
  async revokeP256SessionKey(
    params: RevokeP256SessionKeyRequest
  ): Promise<RevokeP256SessionKeyResponse> {
    this.http.ensureEnabled();

    return this.http.post<RevokeP256SessionKeyResponse>(
      "/kms/revoke-p256-session-key",
      params
    );
  }

  // ── Challenge-binding ceremony variants (#49 / Beta3) ────────────
  //
  // Create + revoke gate on the generic purpose="authentication" challenge bound
  // to the HUMAN key. These helpers run the full ceremony (begin → clientDataJSON
  // → assertion) via the shared {@link runAuthenticationCeremony} helper.

  /**
   * Create a P-256 session key, running the challenge-binding ceremony internally.
   *
   * Auto-binds the v2 mint commitment (AirAccount #115, KMS v0.26.0):
   * `challenge = SHA-256(nonce ‖ mintDigest({ kind: "create-p256", walletId: humanKeyId, label }))`
   * — strict mode requires it; transition mode also accepts it. Pass `options.payload` only to
   * override. `label` defaults to "" to match the KMS server default.
   */
  async createP256SessionKeyWithCeremony(
    params: Omit<CreateP256SessionKeyRequest, "webAuthnAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<CreateP256SessionKeyResponse> {
    this.http.ensureEnabled();
    // Normalize label once so the committed value equals the sent value (#141 Codex Low).
    const label = params.label ?? "";
    const payload =
      options?.payload ?? mintDigest({ kind: "create-p256", walletId: params.humanKeyId, label });
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, params.humanKeyId, signer, {
      ...options,
      payload,
    });
    return this.createP256SessionKey({ ...params, label, webAuthnAssertion });
  }

  /**
   * Revoke a P-256 session key, running the challenge-binding ceremony internally.
   * `humanKeyId` is the owning human key challenged by the ceremony (distinct from
   * the session `keyId` in `params`).
   */
  async revokeP256SessionKeyWithCeremony(
    params: Omit<RevokeP256SessionKeyRequest, "webAuthnAssertion">,
    humanKeyId: string,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<RevokeP256SessionKeyResponse> {
    this.http.ensureEnabled();
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, humanKeyId, signer, options);
    return this.revokeP256SessionKey({ ...params, webAuthnAssertion });
  }
}
