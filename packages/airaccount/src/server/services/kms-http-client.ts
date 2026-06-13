import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

/**
 * Canonical production KMS endpoint (IMX93 TEE behind Cloudflare Tunnel).
 * v0.20.0 (Beta2) — see AirAccount/kms/CHANGELOG.md.
 */
export const DEFAULT_KMS_ENDPOINT = "https://kms.aastar.io";

export interface KmsHttpClientOptions {
  kmsEndpoint?: string;
  kmsEnabled?: boolean;
  kmsApiKey?: string;
  logger?: ILogger;
}

/**
 * Shared low-level HTTP transport for all KMS service classes.
 *
 * Centralises axios setup (baseURL, x-api-key), the `enabled` gate, and the three
 * request flavours the KMS uses:
 *   - plain JSON         → `post` / `get`
 *   - AWS-KMS framed     → `amzPost` (adds x-amz-target + x-amz-json-1.1 content type)
 *   - agent/session JWT  → `postWithBearer` (Authorization: Bearer <jwt>)
 *
 * KmsManager and the composed services (agent / session / payment / monitor) all share
 * one instance so they reuse the same connection config and auth headers.
 */
export class KmsHttpClient {
  readonly endpoint: string;
  readonly enabled: boolean;
  readonly logger: ILogger;
  private readonly apiKey?: string;
  private readonly http: AxiosInstance;

  constructor(options: KmsHttpClientOptions) {
    this.endpoint = options.kmsEndpoint ?? DEFAULT_KMS_ENDPOINT;
    this.enabled = options.kmsEnabled === true;
    this.apiKey = options.kmsApiKey;
    this.logger = options.logger ?? new ConsoleLogger("[KmsHttpClient]");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    this.http = axios.create({ baseURL: this.endpoint, headers });
  }

  /** Throw if KMS is not enabled — every operation must call this first. */
  ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error("KMS service is not enabled");
    }
  }

  /**
   * Plain JSON POST. The axios `config` arg is only forwarded when defined, so a
   * config-less call results in `http.post(path, body)` (2 args) — preserving the
   * exact call shape the existing unit tests assert against.
   */
  async post<T>(path: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = config === undefined
      ? await this.http.post(path, body)
      : await this.http.post(path, body, config);
    return response.data as T;
  }

  /** Plain JSON GET. */
  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = config === undefined
      ? await this.http.get(path)
      : await this.http.get(path, config);
    return response.data as T;
  }

  /** POST with AWS-KMS framing (x-amz-target header) — required for wallet/signing ops. */
  async amzPost<T>(path: string, target: string, body: unknown): Promise<T> {
    return this.post<T>(path, body, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "x-amz-target": target,
      },
    });
  }

  /** POST authenticated with a TEE-issued agent/session JWT (Authorization: Bearer). */
  async postWithBearer<T>(path: string, body: unknown, jwt: string): Promise<T> {
    return this.post<T>(path, body, {
      headers: { authorization: `Bearer ${jwt}` },
    });
  }
}
