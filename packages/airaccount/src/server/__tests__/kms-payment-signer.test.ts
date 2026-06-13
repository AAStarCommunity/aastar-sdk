import { describe, it, expect, vi, beforeEach } from "vitest";
import { KmsHttpClient } from "../services/kms-http-client";
import {
  KmsPaymentSigner,
  KmsSignMicropaymentVoucherRequest,
  KmsSignGTokenAuthorizationRequest,
  KmsSignX402PaymentRequest,
  KmsPaymentSignatureResponse,
} from "../services/kms-payment-signer";
import { WebAuthnAssertion } from "../services/kms-signer";
import { SilentLogger } from "../interfaces/logger";

function makeClient(kmsEnabled = true) {
  return new KmsHttpClient({ kmsEndpoint: "https://kms.test", kmsEnabled, logger: new SilentLogger() });
}

const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const JWT = "agent.jwt.token";

const ASSERTION: WebAuthnAssertion = {
  ChallengeId: "challenge-1",
  Credential: { id: "cred-1" },
};

const RESPONSE: KmsPaymentSignatureResponse = {
  keyId: "key-abc",
  signature:
    "0x" +
    "aa".repeat(32) +
    "bb".repeat(32) +
    "1b",
};

const VOUCHER: KmsSignMicropaymentVoucherRequest = {
  keyId: "key-abc",
  hdPath: "m/44'/60'/0'/0/0",
  chainId: 11155420,
  verifyingContract: ADDRESS,
  channelId: "0x" + "11".repeat(32),
  cumulativeAmount: "1000000",
};

const GTOKEN_AUTH: KmsSignGTokenAuthorizationRequest = {
  keyId: "key-abc",
  chainId: 11155420,
  gTokenAddress: ADDRESS,
  from: ADDRESS,
  to: "0x0000000000000000000000000000000000000001",
  value: "500",
  validAfter: "0",
  validBefore: "9999999999",
  nonce: "0x" + "22".repeat(32),
};

const X402: KmsSignX402PaymentRequest = {
  keyId: "key-abc",
  chainId: 11155420,
  verifyingContract: ADDRESS,
  paymentId: "0x" + "33".repeat(32),
  amount: "250",
  recipient: "0x0000000000000000000000000000000000000002",
  deadline: "1999999999",
};

describe("KmsPaymentSigner", () => {
  let client: KmsHttpClient;
  let signer: KmsPaymentSigner;
  let postSpy: ReturnType<typeof vi.spyOn>;
  let bearerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = makeClient();
    signer = new KmsPaymentSigner(client);
    postSpy = vi.spyOn(client, "post").mockResolvedValue(RESPONSE);
    bearerSpy = vi.spyOn(client, "postWithBearer").mockResolvedValue(RESPONSE);
  });

  // ── signMicropaymentVoucher ──────────────────────────────────────

  describe("signMicropaymentVoucher", () => {
    it("WebAuthn mode: POSTs to /kms/SignMicropaymentVoucher with params + assertion", async () => {
      const result = await signer.signMicropaymentVoucher(VOUCHER, { webAuthnAssertion: ASSERTION });

      expect(bearerSpy).not.toHaveBeenCalled();
      expect(postSpy).toHaveBeenCalledWith(
        "/kms/SignMicropaymentVoucher",
        expect.objectContaining({ ...VOUCHER, webAuthnAssertion: ASSERTION })
      );
      expect(result).toEqual(RESPONSE);
    });

    it("JWT mode: posts with Bearer jwt and params (no assertion)", async () => {
      const result = await signer.signMicropaymentVoucher(VOUCHER, { jwt: JWT });

      expect(postSpy).not.toHaveBeenCalled();
      expect(bearerSpy).toHaveBeenCalledWith(
        "/kms/SignMicropaymentVoucher",
        expect.objectContaining({ ...VOUCHER }),
        JWT
      );
      const body = bearerSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(body).not.toHaveProperty("webAuthnAssertion");
      expect(result).toEqual(RESPONSE);
    });
  });

  // ── signGTokenAuthorization ──────────────────────────────────────

  describe("signGTokenAuthorization", () => {
    it("WebAuthn mode: POSTs to /kms/SignGTokenAuthorization with params + assertion", async () => {
      const result = await signer.signGTokenAuthorization(GTOKEN_AUTH, {
        webAuthnAssertion: ASSERTION,
      });

      expect(bearerSpy).not.toHaveBeenCalled();
      expect(postSpy).toHaveBeenCalledWith(
        "/kms/SignGTokenAuthorization",
        expect.objectContaining({ ...GTOKEN_AUTH, webAuthnAssertion: ASSERTION })
      );
      expect(result).toEqual(RESPONSE);
    });

    it("JWT mode: posts with Bearer jwt and params", async () => {
      const result = await signer.signGTokenAuthorization(GTOKEN_AUTH, { jwt: JWT });

      expect(postSpy).not.toHaveBeenCalled();
      expect(bearerSpy).toHaveBeenCalledWith(
        "/kms/SignGTokenAuthorization",
        expect.objectContaining({ ...GTOKEN_AUTH }),
        JWT
      );
      expect(result).toEqual(RESPONSE);
    });
  });

  // ── signX402Payment ──────────────────────────────────────────────

  describe("signX402Payment", () => {
    it("WebAuthn mode: POSTs to /kms/SignX402Payment with params + assertion", async () => {
      const result = await signer.signX402Payment(X402, { webAuthnAssertion: ASSERTION });

      expect(bearerSpy).not.toHaveBeenCalled();
      expect(postSpy).toHaveBeenCalledWith(
        "/kms/SignX402Payment",
        expect.objectContaining({ ...X402, webAuthnAssertion: ASSERTION })
      );
      expect(result).toEqual(RESPONSE);
    });

    it("JWT mode: posts with Bearer jwt and params", async () => {
      const result = await signer.signX402Payment(X402, { jwt: JWT });

      expect(postSpy).not.toHaveBeenCalled();
      expect(bearerSpy).toHaveBeenCalledWith(
        "/kms/SignX402Payment",
        expect.objectContaining({ ...X402 }),
        JWT
      );
      expect(result).toEqual(RESPONSE);
    });
  });

  // ── disabled client ──────────────────────────────────────────────

  describe("when KMS is not enabled", () => {
    it("throws before issuing any request", async () => {
      const disabled = new KmsPaymentSigner(makeClient(false));
      await expect(
        disabled.signMicropaymentVoucher(VOUCHER, { jwt: JWT })
      ).rejects.toThrow("KMS service is not enabled");
      await expect(
        disabled.signGTokenAuthorization(GTOKEN_AUTH, { webAuthnAssertion: ASSERTION })
      ).rejects.toThrow("KMS service is not enabled");
      await expect(
        disabled.signX402Payment(X402, { jwt: JWT })
      ).rejects.toThrow("KMS service is not enabled");
    });
  });
});
