import { KmsHttpClient } from "./kms-http-client";

// ── Health (GET /health, no auth) ────────────────────────────────

/**
 * Liveness probe response. Returned by `GET /health` without auth — works even
 * when the SDK's KMS feature flag is off.
 */
export interface KmsHealthResponse {
  status: string;
  service?: string;
  ta_mode?: string;
  version?: string;
}

// ── Version (GET /version, no auth) ──────────────────────────────

/**
 * Version / capability descriptor. Returned by `GET /version` without auth.
 * Extra fields are passed through.
 */
export interface KmsVersionResponse {
  version?: string;
  ta_mode?: string;
  endpoints?: string[];
  [k: string]: unknown;
}

// ── Queue Status (GET /QueueStatus) ──────────────────────────────

/**
 * KMS request-queue health, including circuit-breaker state. Useful for
 * back-pressure decisions before submitting signing operations.
 */
export interface KmsQueueStatusResponse {
  queue_depth: number;
  estimated_wait_seconds: number;
  circuit_breaker_open: boolean;
  consecutive_failures: number;
}

// ── Rollback Counter (GET /RollbackCounter, v0.20.0) ─────────────

/**
 * RPMB anti-rollback monotonic counter (diagnostic, v0.20.0). The exact shape
 * is undocumented; the known `counter` field is surfaced and all other fields
 * are passed through.
 */
export interface KmsRollbackCounterResponse {
  counter?: number;
  [k: string]: unknown;
}

// ── Stats (GET /stats, v0.20.0) ──────────────────────────────────

/**
 * Machine-readable runtime statistics (v0.20.0). Pass-through; the response is
 * not strongly typed. Known top-level fields:
 *   - `wallets`  — wallet / key counts
 *   - `tx`       — transaction / signing counts
 *   - `queue`    — queue depth and timing metrics
 *   - `warnings` — active operational warnings
 */
export interface KmsStatsResponse {
  [k: string]: unknown;
}

// ── TEE remote-attestation (GET /attestation + .well-known, #37/#12/#87) ──

/** `GET /attestation` evidence bound to a caller nonce (#37). */
export interface KmsAttestationResponse {
  schema?: string;
  nonce?: string;
  ta_uuid?: string;
  ta_measurement?: string;
  signature?: string;
  attest_pubkey_exp?: string;
  attest_pubkey_mod?: string;
  sig_alg?: number;
  ree_time_secs?: number;
  trust_root?: string;
  [k: string]: unknown;
}

/** `GET /.well-known/attestation-measurements.json` — Ed25519-signed manifest (#12). */
export interface KmsAttestationManifestResponse {
  body?: Record<string, unknown>;
  publisher_key?: string;
  signature?: string;
  [k: string]: unknown;
}

/** `GET /.well-known/attestation-measurements-proof.json` — Sigsum proof sidecar (#87). */
export interface KmsAttestationProofResponse {
  proof?: Record<string, unknown>;
  [k: string]: unknown;
}

// ── Admin Purge Key (POST /admin/purge-key, v0.20.0) ─────────────

/**
 * Response of the destructive operator-only purge action (v0.20.0).
 * Pass-through; the response shape is not strongly typed.
 */
export interface KmsPurgeKeyResponse {
  [k: string]: unknown;
}

/**
 * Infrastructure monitoring + operator admin surface for the AAStar TEE KMS
 * (v0.20.0, kms.aastar.io).
 *
 * Wraps a shared {@link KmsHttpClient}. Liveness probes (`health`, `version`)
 * intentionally bypass the `enabled` gate so they work even when the SDK's KMS
 * feature flag is off; every other method calls `ensureEnabled()` first.
 */
export class KmsMonitorService {
  constructor(private readonly http: KmsHttpClient) {}

  /**
   * Liveness probe (`GET /health`, no auth). Does NOT require the KMS feature
   * flag to be enabled.
   */
  async health(): Promise<KmsHealthResponse> {
    return this.http.get<KmsHealthResponse>("/health");
  }

  /**
   * Version / capability descriptor (`GET /version`, no auth). Does NOT require
   * the KMS feature flag to be enabled.
   */
  async version(): Promise<KmsVersionResponse> {
    return this.http.get<KmsVersionResponse>("/version");
  }

  /**
   * Request-queue health and circuit-breaker state (`GET /QueueStatus`).
   */
  async queueStatus(): Promise<KmsQueueStatusResponse> {
    this.http.ensureEnabled();
    return this.http.get<KmsQueueStatusResponse>("/QueueStatus");
  }

  /**
   * RPMB anti-rollback monotonic counter (`GET /RollbackCounter`, diagnostic,
   * v0.20.0).
   */
  async rollbackCounter(): Promise<KmsRollbackCounterResponse> {
    this.http.ensureEnabled();
    return this.http.get<KmsRollbackCounterResponse>("/RollbackCounter");
  }

  /**
   * Machine-readable runtime statistics (`GET /stats`, v0.20.0) — wallets, tx,
   * queue, warnings.
   */
  async stats(): Promise<KmsStatsResponse> {
    this.http.ensureEnabled();
    return this.http.get<KmsStatsResponse>("/stats");
  }

  /**
   * TEE remote-attestation evidence bound to a caller nonce (`GET /attestation`,
   * #37). Public (no auth) — pass a fresh random `nonce` (hex, ≤64 bytes) to bind
   * the evidence + defeat replay, then verify the returned signed measurement.
   */
  async getAttestation(nonce: string): Promise<KmsAttestationResponse> {
    return this.http.get<KmsAttestationResponse>("/attestation", { params: { nonce } });
  }

  /**
   * Ed25519-signed measurement manifest, version → ta_measurement
   * (`GET /.well-known/attestation-measurements.json`, #12). Public.
   */
  async getAttestationMeasurements(): Promise<KmsAttestationManifestResponse> {
    return this.http.get<KmsAttestationManifestResponse>("/.well-known/attestation-measurements.json");
  }

  /**
   * Sigsum transparency proof sidecar for the measurement manifest
   * (`GET /.well-known/attestation-measurements-proof.json`, #87). Public.
   */
  async getAttestationMeasurementsProof(): Promise<KmsAttestationProofResponse> {
    return this.http.get<KmsAttestationProofResponse>("/.well-known/attestation-measurements-proof.json");
  }

  /**
   * WARNING — DESTRUCTIVE, IRREVERSIBLE. Force-purges a key from both the TEE
   * and the SQLite store with NO passkey/WebAuthn check (`POST /admin/purge-key`,
   * v0.20.0). Operator-only: authorised solely by the `KMS_ADMIN_TOKEN` operator
   * secret sent as `Authorization: Bearer <adminToken>`. There is no recovery
   * once a key is purged.
   *
   * @internal Operator/break-glass tooling only — not part of the general SDK surface.
   *   The endpoint is gated server-side and intentionally omitted from the public KMS
   *   docs; do not expose it in application-facing flows.
   */
  async adminPurgeKey(
    params: { key_id: string; reason: string },
    adminToken: string
  ): Promise<KmsPurgeKeyResponse> {
    this.http.ensureEnabled();
    return this.http.postWithBearer<KmsPurgeKeyResponse>("/admin/purge-key", params, adminToken);
  }
}
