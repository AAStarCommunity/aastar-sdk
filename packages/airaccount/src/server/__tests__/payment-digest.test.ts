import { describe, it, expect } from "vitest";
import {
  micropaymentVoucherDigest,
  gTokenAuthorizationDigest,
  x402PaymentDigest,
} from "../services/kms-payment-signer";
import { hashTypedData } from "viem";

// These digests are the WYSIWYS commitment payload for the convenience payment signers and
// MUST stay byte-identical to the KMS host-side EIP-712 (kms/host/src/api_server.rs). The
// schemas (domain name/version + type fields) are locked here; a drift breaks signing under
// strict mode. Cross-checked against viem hashTypedData (independent of eip712Digest's wiring).

const ADDR = ("0x" + "11".repeat(20)) as `0x${string}`;
const B32 = ("0x" + "22".repeat(32)) as `0x${string}`;

describe("payment-signer EIP-712 digests (schema lock)", () => {
  it("Voucher: MicroPaymentChannel / 1.0.0", () => {
    const got = micropaymentVoucherDigest({ keyId: "k", chainId: 11155111, verifyingContract: ADDR, channelId: B32, cumulativeAmount: "1000" } as any);
    const want = hashTypedData({
      domain: { name: "MicroPaymentChannel", version: "1.0.0", chainId: 11155111, verifyingContract: ADDR },
      types: { Voucher: [{ name: "channelId", type: "bytes32" }, { name: "cumulativeAmount", type: "uint256" }] },
      primaryType: "Voucher",
      message: { channelId: B32, cumulativeAmount: 1000n },
    });
    expect(got).toBe(want);
    expect(got).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("GToken TransferWithAuthorization: GToken / 1", () => {
    const got = gTokenAuthorizationDigest({ keyId: "k", chainId: 11155111, gTokenAddress: ADDR, from: ADDR, to: ADDR, value: "1", validAfter: "0", validBefore: "99", nonce: B32 } as any);
    const want = hashTypedData({
      domain: { name: "GToken", version: "1", chainId: 11155111, verifyingContract: ADDR },
      types: { TransferWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ] },
      primaryType: "TransferWithAuthorization",
      message: { from: ADDR, to: ADDR, value: 1n, validAfter: 0n, validBefore: 99n, nonce: B32 },
    });
    expect(got).toBe(want);
  });

  it("x402 PaymentPayload: SuperPaymaster / 1", () => {
    const got = x402PaymentDigest({ keyId: "k", chainId: 11155111, verifyingContract: ADDR, paymentId: B32, amount: "2", recipient: ADDR, deadline: "9" } as any);
    const want = hashTypedData({
      domain: { name: "SuperPaymaster", version: "1", chainId: 11155111, verifyingContract: ADDR },
      types: { PaymentPayload: [
        { name: "paymentId", type: "bytes32" }, { name: "amount", type: "uint256" },
        { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" },
      ] },
      primaryType: "PaymentPayload",
      message: { paymentId: B32, amount: 2n, recipient: ADDR, deadline: 9n },
    });
    expect(got).toBe(want);
  });
});
