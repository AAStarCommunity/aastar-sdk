import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion, LegacyPasskeyAssertion } from "./kms-signer";

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
}
