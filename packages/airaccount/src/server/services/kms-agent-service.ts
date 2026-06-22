import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion, LegacyPasskeyAssertion, mintDigest } from "./kms-signer";
import {
  PasskeyCeremonySigner,
  RunCeremonyOptions,
  runAuthenticationCeremony,
} from "./webauthn-ceremony";

// ── CreateAgentKey ───────────────────────────────────────────────

/**
 * Request to mint a new agent key under an existing human key.
 *
 * WebAuthn-gated: the human approves the mint with a one-time WebAuthn ceremony
 * (preferred) or a Legacy passkey assertion. The challenge is obtained via
 * {@link KmsManager.beginAuthentication} (generic, purpose="authentication") —
 * the caller supplies the resulting assertion here.
 */
export interface KmsCreateAgentKeyRequest {
  humanKeyId: string;
  label?: string;
  webAuthnAssertion?: WebAuthnAssertion;
  passkeyAssertion?: LegacyPasskeyAssertion;
}

export interface KmsCreateAgentKeyResponse {
  keyId: string; // "wallet_uuid:agent_index"
  agentAddress: string;
  derivationPath: string;
  agentCredential: string; // TEE-issued JWT
  expiresAt: number;
}

// ── SignAgent ────────────────────────────────────────────────────

/**
 * Request to sign a userOpHash with an agent key, authenticated by the agent's
 * TEE-JWT credential (Bearer). Used for gasless ERC-4337 sponsorship.
 */
export interface KmsSignAgentRequest {
  keyId: string;
  payload: string; // hex userOpHash
  algorithm?: string; // defaults to "secp256k1" server-side
  accountAddress: string; // 0x… ERC-4337 account
}

export interface KmsSignAgentResponse {
  keyId: string;
  agentAddress: string;
  /** Hex 106-byte signature: [0x08][account(20)][key(20)][r(32)][s(32)][v(1)]. */
  signature: string;
}

// ── RefreshAgentCredential ───────────────────────────────────────

/**
 * Request to refresh (re-mint) an agent's TEE-JWT credential before it expires.
 *
 * Authenticated with the existing (still-valid) credential via Bearer JWT, plus
 * a WebAuthn / Legacy passkey assertion from the human key owner.
 */
export interface KmsRefreshAgentCredentialRequest {
  keyId: string;
  webAuthnAssertion?: WebAuthnAssertion;
  passkeyAssertion?: LegacyPasskeyAssertion;
}

/**
 * The server response shape is not strictly documented; this models the fields
 * the SDK relies on. `keyId` is echoed back optionally.
 */
export interface KmsRefreshAgentCredentialResponse {
  keyId?: string;
  agentCredential: string; // new TEE-issued JWT
  expiresAt: number;
}

// ── RevokeAgentCredential ────────────────────────────────────────

/**
 * Request to revoke an agent's credential (WebAuthn-gated).
 *
 * The challenge is obtained via {@link KmsManager.beginAuthentication} (generic,
 * purpose="authentication"); the caller supplies the resulting assertion here.
 */
export interface KmsRevokeAgentCredentialRequest {
  keyId: string;
  webAuthnAssertion?: WebAuthnAssertion;
  passkeyAssertion?: LegacyPasskeyAssertion;
}

export interface KmsRevokeAgentCredentialResponse {
  success: boolean;
  revokedAt: number;
}

/**
 * Agent-key lifecycle service for the AAStar TEE KMS (v0.20.0).
 *
 * An "agent key" is a TEE-JWT credential minted under a human key, used for
 * gasless ERC-4337 sponsorship without re-prompting the human for each signature.
 * Lifecycle:
 *   1. {@link createAgentKey}        — human mints the agent key (WebAuthn-gated)
 *   2. {@link signAgent}             — agent signs userOpHashes (Bearer JWT auth)
 *   3. {@link refreshAgentCredential}— re-mint before expiry (Bearer JWT + WebAuthn)
 *   4. {@link revokeAgentCredential} — human revokes the agent key (WebAuthn-gated)
 *
 * Wraps a shared {@link KmsHttpClient} — obtain it via {@link KmsManager.httpClient}
 * so this service reuses the same connection config and auth headers.
 */
export class KmsAgentService {
  constructor(private readonly http: KmsHttpClient) {}

  /**
   * Mint a new agent key under an existing human key (WebAuthn-gated).
   *
   * The WebAuthn challenge is obtained from a generic
   * {@link KmsManager.beginAuthentication} ceremony (purpose="authentication");
   * the caller supplies the resulting assertion in the request.
   */
  async createAgentKey(
    params: KmsCreateAgentKeyRequest
  ): Promise<KmsCreateAgentKeyResponse> {
    this.http.ensureEnabled();

    return this.http.post<KmsCreateAgentKeyResponse>("/kms/create-agent-key", params);
  }

  /**
   * Sign a userOpHash with an agent key, authenticated by the agent's TEE-JWT
   * credential (`jwt`, the `agentCredential` from {@link createAgentKey}).
   * Returns the 106-byte packed signature for ERC-4337 sponsorship.
   */
  async signAgent(
    params: KmsSignAgentRequest,
    jwt: string
  ): Promise<KmsSignAgentResponse> {
    this.http.ensureEnabled();

    return this.http.postWithBearer<KmsSignAgentResponse>("/kms/sign-agent", params, jwt);
  }

  /**
   * Refresh (re-mint) an agent credential before it expires. Authenticated with
   * the existing credential (`jwt`, Bearer) plus a human WebAuthn / passkey
   * assertion in the request.
   */
  async refreshAgentCredential(
    params: KmsRefreshAgentCredentialRequest,
    jwt: string
  ): Promise<KmsRefreshAgentCredentialResponse> {
    this.http.ensureEnabled();

    return this.http.postWithBearer<KmsRefreshAgentCredentialResponse>(
      "/kms/refresh-agent-credential",
      params,
      jwt
    );
  }

  /**
   * Revoke an agent's credential (WebAuthn-gated).
   *
   * The WebAuthn challenge is obtained from a generic
   * {@link KmsManager.beginAuthentication} ceremony (purpose="authentication");
   * the caller supplies the resulting assertion in the request.
   */
  async revokeAgentCredential(
    params: KmsRevokeAgentCredentialRequest
  ): Promise<KmsRevokeAgentCredentialResponse> {
    this.http.ensureEnabled();

    return this.http.post<KmsRevokeAgentCredentialResponse>(
      "/kms/revoke-agent-credential",
      params
    );
  }

  // ── Challenge-binding ceremony variants (#49 / Beta3) ────────────
  //
  // All agent-key WebAuthn gates use the generic purpose="authentication"
  // challenge bound to the HUMAN key. These helpers run the full ceremony
  // (begin → clientDataJSON → assertion) via the shared
  // {@link runAuthenticationCeremony} helper, then invoke the endpoint.

  /**
   * Mint an agent key, running the challenge-binding ceremony internally.
   *
   * Auto-binds the v2 mint commitment (AirAccount #115, KMS v0.26.0):
   * `challenge = SHA-256(nonce ‖ mintDigest({ kind: "create-agent", walletId: humanKeyId, label }))`
   * — strict mode requires it; transition mode also accepts it. Pass `options.payload` only to
   * override. `label` defaults to "" to match the KMS server default.
   */
  async createAgentKeyWithCeremony(
    params: Omit<KmsCreateAgentKeyRequest, "webAuthnAssertion" | "passkeyAssertion">,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsCreateAgentKeyResponse> {
    this.http.ensureEnabled();
    // Normalize label once so the value we COMMIT to is the exact value we SEND (#141 Codex Low).
    const label = params.label ?? "";
    const payload =
      options?.payload ?? mintDigest({ kind: "create-agent", walletId: params.humanKeyId, label });
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, params.humanKeyId, signer, {
      ...options,
      payload,
    });
    return this.createAgentKey({ ...params, label, webAuthnAssertion });
  }

  /**
   * Refresh an agent credential, running the challenge-binding ceremony
   * internally. `humanKeyId` is the owning human key challenged by the ceremony
   * (distinct from the agent `keyId` in `params`); `jwt` is the existing credential.
   *
   * Auto-binds the v2 REFRESH commitment (KMS v0.26.0):
   * `challenge = SHA-256(nonce ‖ mintDigest({ kind: "refresh-agent", walletId: humanKeyId, agentIndex }))`
   * where `agentIndex` is parsed from `params.keyId` ("wallet_uuid:agent_index"). REFRESH uses a
   * distinct tag from CREATE so the gesture cannot be replayed as a mint. Pass `options.payload`
   * to override.
   */
  async refreshAgentCredentialWithCeremony(
    params: Omit<KmsRefreshAgentCredentialRequest, "webAuthnAssertion" | "passkeyAssertion">,
    humanKeyId: string,
    jwt: string,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsRefreshAgentCredentialResponse> {
    this.http.ensureEnabled();
    let payload = options?.payload;
    if (!payload) {
      // keyId is exactly "<uuid>:<index>" — a loose split would let "uuid:" or "uuid:0:x"
      // silently resolve to agent_index 0 and commit to the WRONG agent (#141 Codex Medium).
      const match = /^([0-9a-fA-F-]{36}):(\d+)$/.exec(params.keyId);
      if (!match) {
        throw new Error(`refreshAgentCredentialWithCeremony: invalid keyId "${params.keyId}" (expected "<uuid>:<index>")`);
      }
      payload = mintDigest({ kind: "refresh-agent", walletId: humanKeyId, agentIndex: Number(match[2]) });
    }
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, humanKeyId, signer, { ...options, payload });
    return this.refreshAgentCredential({ ...params, webAuthnAssertion }, jwt);
  }

  /**
   * Revoke an agent credential, running the challenge-binding ceremony internally.
   * `humanKeyId` is the owning human key challenged by the ceremony (distinct from
   * the agent `keyId` in `params`).
   */
  async revokeAgentCredentialWithCeremony(
    params: Omit<KmsRevokeAgentCredentialRequest, "webAuthnAssertion" | "passkeyAssertion">,
    humanKeyId: string,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer">
  ): Promise<KmsRevokeAgentCredentialResponse> {
    this.http.ensureEnabled();
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, humanKeyId, signer, options);
    return this.revokeAgentCredential({ ...params, webAuthnAssertion });
  }
}
