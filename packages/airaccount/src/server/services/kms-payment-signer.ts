import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion } from "./kms-signer";

// ── Auth modes (v0.20.0 P2 SuperPaymaster convenience signers) ───
//
// Each KMS payment endpoint authorizes the signing operation in ONE of two ways:
//   - a one-time WebAuthn ceremony assertion carried in the request body, or
//   - an agent/session JWT carried in the `Authorization: Bearer <jwt>` header.
// Callers pick exactly one via the discriminated `KmsPaymentAuth` union.

export type KmsPaymentAuth = { jwt: string } | { webAuthnAssertion: WebAuthnAssertion };

/** Shared signature response for all payment signing endpoints. */
export interface KmsPaymentSignatureResponse {
  keyId: string;
  signature: string; // 65-byte hex (R||S||V)
}

// ── SignMicropaymentVoucher ──────────────────────────────────────

export interface KmsSignMicropaymentVoucherRequest {
  keyId: string;
  hdPath?: string; // defaults to m/44'/60'/0'/0/0 server-side
  chainId: number;
  verifyingContract: string; // MicroPaymentChannel address (0x… 20-byte)
  channelId: string; // 0x… 32-byte
  cumulativeAmount: string; // uint256 (decimal or 0x…)
}

// ── SignGTokenAuthorization (EIP-3009 TransferWithAuthorization) ──

export interface KmsSignGTokenAuthorizationRequest {
  keyId: string;
  hdPath?: string; // defaults to m/44'/60'/0'/0/0 server-side
  chainId: number;
  gTokenAddress: string;
  from: string; // MUST equal the derived address
  to: string;
  value: string; // uint256
  validAfter: string;
  validBefore: string;
  nonce: string; // 0x… 32-byte
}

// ── SignX402Payment ──────────────────────────────────────────────

export interface KmsSignX402PaymentRequest {
  keyId: string;
  hdPath?: string; // defaults to m/44'/60'/0'/0/0 server-side
  chainId: number;
  verifyingContract: string;
  paymentId: string; // 0x… 32-byte
  amount: string; // uint256
  recipient: string;
  deadline: string;
}

/**
 * Convenience signers for SuperPaymaster payment flows (v0.20.0 P2).
 *
 * Each method maps to a fixed EIP-712 domain + type that the KMS builds host-side
 * and signs inside the TEE; the SDK only forwards the structured parameters. Every
 * endpoint accepts EITHER a one-time `webAuthnAssertion` in the body OR an agent
 * Bearer JWT — see {@link KmsPaymentAuth}.
 *
 * Wraps a shared {@link KmsHttpClient}; reuse the same instance across the agent /
 * session / payment / monitor services.
 */
export class KmsPaymentSigner {
  constructor(private readonly http: KmsHttpClient) {}

  /**
   * Dispatch a payment-signing request with the chosen auth mode.
   * JWT auth uses `postWithBearer`; WebAuthn auth merges the assertion into the body.
   */
  private async signWithAuth(
    path: string,
    body: Record<string, unknown>,
    auth: KmsPaymentAuth
  ): Promise<KmsPaymentSignatureResponse> {
    if ("jwt" in auth) {
      return this.http.postWithBearer<KmsPaymentSignatureResponse>(path, body, auth.jwt);
    }
    return this.http.post<KmsPaymentSignatureResponse>(path, {
      ...body,
      webAuthnAssertion: auth.webAuthnAssertion,
    });
  }

  /**
   * Sign a MicroPaymentChannel voucher (cumulative-amount EIP-712 message)
   * via `POST /kms/SignMicropaymentVoucher`.
   */
  async signMicropaymentVoucher(
    params: KmsSignMicropaymentVoucherRequest,
    auth: KmsPaymentAuth
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    return this.signWithAuth("/kms/SignMicropaymentVoucher", { ...params }, auth);
  }

  /**
   * Sign an EIP-3009 TransferWithAuthorization for a GToken transfer
   * via `POST /kms/SignGTokenAuthorization`. `from` MUST equal the derived address.
   */
  async signGTokenAuthorization(
    params: KmsSignGTokenAuthorizationRequest,
    auth: KmsPaymentAuth
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    return this.signWithAuth("/kms/SignGTokenAuthorization", { ...params }, auth);
  }

  /**
   * Sign an x402 payment authorization via `POST /kms/SignX402Payment`.
   */
  async signX402Payment(
    params: KmsSignX402PaymentRequest,
    auth: KmsPaymentAuth
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    return this.signWithAuth("/kms/SignX402Payment", { ...params }, auth);
  }
}
