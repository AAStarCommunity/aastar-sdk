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

export class PasskeyManager {
  private api: AxiosInstance;

  constructor(baseURL: string, tokenProvider?: () => string | null) {
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
      "/auth/passkey/register/begin",
      params
    );

    // 2. Client-side WebAuthn (Browser UI)
    // @ts-expect-error - simplewebauthn types mismatch sometimes
    const credential = await startRegistration(beginResponse.data);

    // 3. Complete Registration (Verify with backend)
    const completeResponse = await this.api.post("/auth/passkey/register/complete", {
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
      "/auth/passkey/login/begin",
      params
    );

    // 2. Client-side WebAuthn
    const credential = await startAuthentication(beginResponse.data as any);

    // 3. Complete Authentication
    const completeResponse = await this.api.post("/auth/passkey/login/complete", { credential });

    return completeResponse.data;
  }

  /**
   * Verify a transaction (Sign UserOpHash) with Passkey
   * Returns the verification credential needed for the transaction
   */
  async verifyTransaction(params: TransactionVerificationParams): Promise<any> {
    // 1. Begin Verification (Get challenge based on tx params)
    const beginResponse = await this.api.post<BeginTransactionVerificationResponse>(
      "/auth/transaction/verify/begin",
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
      "/auth/device/passkey/begin",
      params
    );

    // 2. WebAuthn
    // @ts-expect-error - simplewebauthn types mismatch sometimes
    const credential = await startRegistration(beginResponse.data);

    // 3. Complete
    const completeResponse = await this.api.post("/auth/device/passkey/complete", {
      email: params.email,
      password: params.password,
      credential,
    });

    return completeResponse.data.passkey;
  }
}
