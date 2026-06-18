import axios, { AxiosInstance } from "axios";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  PasskeyRegistrationParams,
  PasskeyAuthenticationParams,
  PasskeyInfo,
  BeginRegistrationResponse,
  BeginAuthenticationResponse,
  TransactionVerificationParams,
  BeginTransactionVerificationResponse,
} from "./types";

/**
 * Configurable backend routes for the passkey (WebAuthn) flows.
 *
 * These default paths are the standardized contract served by AAStar's
 * `@aastar/passkey-server` (any compatible RP exposing the same endpoints).
 * They are NOT specific to any single backend. Consumers pointing at a
 * different backend can override individual paths without changing code.
 */
export interface PasskeyRoutes {
  /** POST — begin passkey registration. Default: `/auth/passkey/register/begin` */
  registerBegin: string;
  /** POST — complete passkey registration. Default: `/auth/passkey/register/complete` */
  registerComplete: string;
  /** POST — begin passkey login/authentication. Default: `/auth/passkey/login/begin` */
  loginBegin: string;
  /** POST — complete passkey login/authentication. Default: `/auth/passkey/login/complete` */
  loginComplete: string;
  /** POST — begin adding a new device (passkey). Default: `/auth/device/passkey/begin` */
  deviceBegin: string;
  /** POST — complete adding a new device (passkey). Default: `/auth/device/passkey/complete` */
  deviceComplete: string;
  /** POST — begin transaction verification. Default: `/auth/transaction/verify/begin` */
  transactionVerifyBegin: string;
}

/**
 * Default passkey routes — the standardized `@aastar/passkey-server` contract.
 */
export const DEFAULT_PASSKEY_ROUTES: PasskeyRoutes = {
  registerBegin: "/auth/passkey/register/begin",
  registerComplete: "/auth/passkey/register/complete",
  loginBegin: "/auth/passkey/login/begin",
  loginComplete: "/auth/passkey/login/complete",
  deviceBegin: "/auth/device/passkey/begin",
  deviceComplete: "/auth/device/passkey/complete",
  transactionVerifyBegin: "/auth/transaction/verify/begin",
};

export class PasskeyManager {
  private api: AxiosInstance;
  private routes: PasskeyRoutes;

  constructor(
    baseURL: string,
    tokenProvider?: () => string | null,
    routes?: Partial<PasskeyRoutes>
  ) {
    // Merge any overrides over the standardized defaults so behavior is
    // identical when no override is given.
    this.routes = { ...DEFAULT_PASSKEY_ROUTES, ...routes };

    this.api = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add auth interceptor
    if (tokenProvider) {
      this.api.interceptors.request.use(config => {
        const token = tokenProvider();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      });
    }
  }

  /**
   * Complete Passkey Registration Flow
   */
  async register(
    params: PasskeyRegistrationParams
  ): Promise<{ user: any; token: string; passkey: PasskeyInfo }> {
    // 1. Begin Registration (Get options from backend)
    const beginResponse = await this.api.post<BeginRegistrationResponse>(
      this.routes.registerBegin,
      params
    );

    // 2. Client-side WebAuthn (Browser UI)
    // @ts-expect-error - simplewebauthn types mismatch sometimes
    const credential = await startRegistration(beginResponse.data);

    // 3. Complete Registration (Verify with backend)
    const completeResponse = await this.api.post(this.routes.registerComplete, {
      email: params.email,
      username: params.username,
      password: params.password,
      credential,
    });

    return completeResponse.data;
  }

  /**
   * Complete Passkey Login/Authentication Flow
   */
  async authenticate(params?: PasskeyAuthenticationParams): Promise<{ user: any; token: string }> {
    // 1. Begin Authentication
    const beginResponse = await this.api.post<BeginAuthenticationResponse>(
      this.routes.loginBegin,
      params
    );

    // 2. Client-side WebAuthn
    const credential = await startAuthentication(beginResponse.data as any);

    // 3. Complete Authentication
    const completeResponse = await this.api.post(this.routes.loginComplete, { credential });

    return completeResponse.data;
  }

  /**
   * Verify a transaction (Sign UserOpHash) with Passkey
   * Returns the verification credential needed for the transaction
   */
  async verifyTransaction(params: TransactionVerificationParams): Promise<any> {
    // 1. Begin Verification (Get challenge based on tx params)
    const beginResponse = await this.api.post<BeginTransactionVerificationResponse>(
      this.routes.transactionVerifyBegin,
      { transaction: params }
    );

    const { userOpHash, ...authOptions } = beginResponse.data;

    // 2. Client-side WebAuthn (Sign the challenge)
    const credential = await startAuthentication(authOptions as any);

    // NOTE: We don't complete the verification here immediately.
    // The credential is sent along with the transaction to be verified during execution.
    // But for some flows, we might want to verify it pre-execution:

    // Optional: Verify on backend immediately (if API supports it)
    // await this.api.post("/auth/transaction/verify/complete", { credential });

    return {
      credential,
      userOpHash, // Return pre-calculated hash to ensure consistency
    };
  }

  /**
   * Add a new device (Passkey) to existing account
   */
  async addDevice(params: { email: string; password?: string }): Promise<PasskeyInfo> {
    // 1. Begin Device Add
    const beginResponse = await this.api.post<BeginRegistrationResponse>(
      this.routes.deviceBegin,
      params
    );

    // 2. WebAuthn
    // @ts-expect-error - simplewebauthn types mismatch sometimes
    const credential = await startRegistration(beginResponse.data);

    // 3. Complete
    const completeResponse = await this.api.post(this.routes.deviceComplete, {
      email: params.email,
      password: params.password,
      credential,
    });

    return completeResponse.data.passkey;
  }
}
