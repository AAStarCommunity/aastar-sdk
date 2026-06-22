import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion, eip712Digest } from "./kms-signer";
import {
  PasskeyCeremonySigner,
  RunCeremonyOptions,
  runAuthenticationCeremony,
} from "./webauthn-ceremony";

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

  // ── Ceremony-internal variants with WYSIWYS payload commitment (#68 / #135 item 1) ──
  // Each payment endpoint is a fixed-schema SignTypedData host-side, so the commitment
  // payload is the EIP-712 digest of that schema. We compute it SDK-side (digest helpers
  // below, schemas mirrored from kms/host/src/api_server.rs) and bind the ceremony
  // challenge to it: challenge = SHA-256(nonce ‖ eip712Digest). Live-verified against KMS.

  /** Sign a MicroPaymentChannel voucher, running the committed ceremony internally. */
  async signMicropaymentVoucherWithCeremony(
    params: KmsSignMicropaymentVoucherRequest,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, params.keyId, signer, {
      ...options,
      payload: micropaymentVoucherDigest(params),
    });
    return this.signMicropaymentVoucher(params, { webAuthnAssertion });
  }

  /** Sign a GToken EIP-3009 authorization, running the committed ceremony internally. */
  async signGTokenAuthorizationWithCeremony(
    params: KmsSignGTokenAuthorizationRequest,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, params.keyId, signer, {
      ...options,
      payload: gTokenAuthorizationDigest(params),
    });
    return this.signGTokenAuthorization(params, { webAuthnAssertion });
  }

  /** Sign an x402 payment, running the committed ceremony internally. */
  async signX402PaymentWithCeremony(
    params: KmsSignX402PaymentRequest,
    signer: PasskeyCeremonySigner,
    options?: Omit<RunCeremonyOptions, "signer" | "payload">
  ): Promise<KmsPaymentSignatureResponse> {
    this.http.ensureEnabled();
    const webAuthnAssertion = await runAuthenticationCeremony(this.http, params.keyId, signer, {
      ...options,
      payload: x402PaymentDigest(params),
    });
    return this.signX402Payment(params, { webAuthnAssertion });
  }
}

// ── EIP-712 digests for the convenience payment schemas ──────────────────────────
// Domains/types mirror kms/host/src/api_server.rs (sign_micropayment_voucher :3056,
// sign_gtoken_authorization :3138, sign_x402_payment :3216). Used to compute the WYSIWYS
// commitment payload; keep BYTE-IDENTICAL to the KMS host construction.

/** EIP-712 digest for a MicroPaymentChannel `Voucher` (domain MicroPaymentChannel/1.0.0). */
export function micropaymentVoucherDigest(p: KmsSignMicropaymentVoucherRequest): `0x${string}` {
  return eip712Digest({
    domain: { name: "MicroPaymentChannel", version: "1.0.0", chainId: p.chainId, verifyingContract: p.verifyingContract },
    primaryType: "Voucher",
    types: [
      {
        name: "Voucher",
        fields: [
          { name: "channelId", type: "bytes32" },
          { name: "cumulativeAmount", type: "uint256" },
        ],
      },
    ],
    message: [
      { name: "channelId", value: p.channelId },
      { name: "cumulativeAmount", value: p.cumulativeAmount },
    ],
  });
}

/** EIP-712 digest for a GToken EIP-3009 `TransferWithAuthorization` (domain GToken/1). */
export function gTokenAuthorizationDigest(p: KmsSignGTokenAuthorizationRequest): `0x${string}` {
  return eip712Digest({
    domain: { name: "GToken", version: "1", chainId: p.chainId, verifyingContract: p.gTokenAddress },
    primaryType: "TransferWithAuthorization",
    types: [
      {
        name: "TransferWithAuthorization",
        fields: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
    ],
    message: [
      { name: "from", value: p.from },
      { name: "to", value: p.to },
      { name: "value", value: p.value },
      { name: "validAfter", value: p.validAfter },
      { name: "validBefore", value: p.validBefore },
      { name: "nonce", value: p.nonce },
    ],
  });
}

/** EIP-712 digest for an x402 `PaymentPayload` (domain SuperPaymaster/1). */
export function x402PaymentDigest(p: KmsSignX402PaymentRequest): `0x${string}` {
  return eip712Digest({
    domain: { name: "SuperPaymaster", version: "1", chainId: p.chainId, verifyingContract: p.verifyingContract },
    primaryType: "PaymentPayload",
    types: [
      {
        name: "PaymentPayload",
        fields: [
          { name: "paymentId", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    message: [
      { name: "paymentId", value: p.paymentId },
      { name: "amount", value: p.amount },
      { name: "recipient", value: p.recipient },
      { name: "deadline", value: p.deadline },
    ],
  });
}
