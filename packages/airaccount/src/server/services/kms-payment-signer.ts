import { type Address, type PublicClient, hashTypedData, isAddressEqual } from "viem";
import { resolveEip712Domain, resolveReportedEip712Domain } from "@aastar/core";
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
  /**
   * @param publicClient - a client on the chain the payments are for. Every method checks, before it calls the KMS
   *   (and before any ceremony), that what the KMS will sign is what the on-chain verifier accepts; without a client
   *   the checks that need the chain refuse. See {@link KmsPaymentSigner.precheck}.
   */
  constructor(private readonly http: KmsHttpClient, private readonly opts: { publicClient?: PublicClient } = {}) {}

  /**
   * Pre-checks against the contracts that verify these signatures (the KMS host builds the domain and type itself;
   * the digests below mirror it):
   * - voucher: the digest under MicroPaymentChannel's type (`uint128 cumulativeAmount`, its VOUCHER_TYPEHASH) must
   *   equal the digest the KMS signs. Today they differ (the KMS host uses `uint256`), so this refuses until the KMS
   *   host is fixed (FU-118). Then the KMS domain must equal the channel's eip712Domain() on the chain.
   * - GToken authorization: the KMS domain { "GToken", "1", chainId, gTokenAddress } must be the token's domain on
   *   the chain, checked against its DOMAIN_SEPARATOR().
   * - x402 PaymentPayload ("SuperPaymaster"/"1"): nothing on chain verifies it (SuperPaymaster verifies no EIP-712
   *   signature; x402's verifier is X402Facilitator with its own type), so it always refuses (FU-119).
   */
  private async precheck(
    kind: "voucher" | "gtoken" | "x402",
    params: KmsSignMicropaymentVoucherRequest | KmsSignGTokenAuthorizationRequest | KmsSignX402PaymentRequest
  ): Promise<void> {
    if (kind === "x402") {
      throw new Error(
        "signX402Payment: the KMS PaymentPayload (domain SuperPaymaster/1) has no on-chain verifier; refusing to start the signature (FU-119)"
      );
    }
    const pc = this.opts.publicClient;
    if (kind === "voucher") {
      const p = params as KmsSignMicropaymentVoucherRequest;
      const kmsDigest = micropaymentVoucherDigest(p);
      const contractDigest = micropaymentVoucherContractDigest(p);
      if (kmsDigest !== contractDigest) {
        throw new Error(
          `signMicropaymentVoucher: the KMS would sign ${kmsDigest} (cumulativeAmount as uint256) but MicroPaymentChannel verifies ${contractDigest} (uint128); refusing to start a signature the contract rejects (FU-118)`
        );
      }
      if (!pc) throw new Error("signMicropaymentVoucher: pass publicClient to KmsPaymentSigner so the channel's domain can be checked; refusing");
      const { domain } = await resolveReportedEip712Domain(pc, p.verifyingContract as Address, { expectedChainId: p.chainId });
      if (domain.name !== "MicroPaymentChannel" || domain.version !== "1.0.0") {
        throw new Error(`signMicropaymentVoucher: the channel reports domain ${domain.name}/${domain.version}, the KMS signs MicroPaymentChannel/1.0.0; refusing`);
      }
      return;
    }
    const p = params as KmsSignGTokenAuthorizationRequest;
    if (!pc) throw new Error("signGTokenAuthorization: pass publicClient to KmsPaymentSigner so the GToken domain can be checked; refusing");
    const { domain } = await resolveEip712Domain(pc, p.gTokenAddress as Address);
    if (domain.name !== "GToken" || domain.version !== "1" || domain.chainId !== p.chainId || !domain.verifyingContract || !isAddressEqual(domain.verifyingContract, p.gTokenAddress as Address)) {
      throw new Error(
        `signGTokenAuthorization: the token's domain is ${JSON.stringify(domain)}, the KMS signs GToken/1 on chain ${p.chainId} for ${p.gTokenAddress}; refusing`
      );
    }
  }

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
    await this.precheck("voucher", params);
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
    await this.precheck("gtoken", params);
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
    await this.precheck("x402", params);
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
    await this.precheck("voucher", params); // before the ceremony: the user is not asked to approve a voucher the contract rejects
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
    await this.precheck("gtoken", params);
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
    await this.precheck("x402", params);
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

/**
 * The voucher digest MicroPaymentChannel verifies: same domain as the KMS uses, but the contract's type
 * `Voucher(bytes32 channelId,uint128 cumulativeAmount)` (MicroPaymentChannel.sol VOUCHER_TYPEHASH). It differs from
 * {@link micropaymentVoucherDigest} while the KMS host signs `uint256` (FU-118).
 */
export function micropaymentVoucherContractDigest(p: KmsSignMicropaymentVoucherRequest): `0x${string}` {
  return hashTypedData({
    domain: { name: "MicroPaymentChannel", version: "1.0.0", chainId: p.chainId, verifyingContract: p.verifyingContract as Address },
    types: { Voucher: [{ name: "channelId", type: "bytes32" }, { name: "cumulativeAmount", type: "uint128" }] },
    primaryType: "Voucher",
    message: { channelId: p.channelId as `0x${string}`, cumulativeAmount: BigInt(p.cumulativeAmount) },
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
