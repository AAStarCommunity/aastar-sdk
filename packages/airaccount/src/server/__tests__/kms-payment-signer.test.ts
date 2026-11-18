import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeFunctionData, domainSeparator, encodeFunctionResult, keccak256, toHex } from "viem";
import { clearEip712DomainCache, GTokenAuthorizationABI } from "@aastar/core";
import { KmsHttpClient } from "../services/kms-http-client";
import {
  KmsPaymentSigner,
  micropaymentVoucherDigest,
  micropaymentVoucherContractDigest,
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

// A client on the payments' chain whose token answers DOMAIN_SEPARATOR() and TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
// read through eth_call pinned to one block hash (as GTokenAuthorization does).
const TRANSFER_TYPEHASH = keccak256(toHex("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"));
const PIN = "0x" + "ab".repeat(32);
function gTokenChain(domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}`; salt?: `0x${string}` }, typehash = TRANSFER_TYPEHASH) {
  return {
    getChainId: vi.fn(async () => domain.chainId),
    getBlock: vi.fn(async () => ({ number: 1n, hash: PIN })),
    request: vi.fn(async ({ method, params }: any) => {
      if (method !== "eth_call" || params[1]?.blockHash !== PIN || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
      const { functionName } = decodeFunctionData({ abi: GTokenAuthorizationABI, data: params[0].data });
      const result = functionName === "DOMAIN_SEPARATOR" ? domainSeparator({ domain }) : typehash;
      return encodeFunctionResult({ abi: GTokenAuthorizationABI, functionName, result } as any);
    }),
  } as any;
}
const GTOKEN_DOMAIN = { name: "GToken", version: "1", chainId: 11155420, verifyingContract: ADDRESS as `0x${string}` };

describe("KmsPaymentSigner", () => {
  let client: KmsHttpClient;
  let signer: KmsPaymentSigner;
  let postSpy: ReturnType<typeof vi.spyOn>;
  let bearerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = makeClient();
    clearEip712DomainCache();
    signer = new KmsPaymentSigner(client, { publicClient: gTokenChain(GTOKEN_DOMAIN) });
    postSpy = vi.spyOn(client, "post").mockResolvedValue(RESPONSE);
    bearerSpy = vi.spyOn(client, "postWithBearer").mockResolvedValue(RESPONSE);
  });

  // ── signMicropaymentVoucher ──────────────────────────────────────

  describe("signMicropaymentVoucher", () => {
    it("the KMS digest (uint256 cumulativeAmount) differs from the one MicroPaymentChannel verifies (uint128)", () => {
      expect(micropaymentVoucherDigest(VOUCHER)).not.toBe(micropaymentVoucherContractDigest(VOUCHER));
    });

    it("refuses before any request, in both auth modes, while the KMS signs a voucher the contract rejects (FU-118)", async () => {
      await expect(signer.signMicropaymentVoucher(VOUCHER, { webAuthnAssertion: ASSERTION })).rejects.toThrow("MicroPaymentChannel verifies");
      await expect(signer.signMicropaymentVoucher(VOUCHER, { jwt: JWT })).rejects.toThrow("(FU-118)");
      expect(postSpy).not.toHaveBeenCalled();
      expect(bearerSpy).not.toHaveBeenCalled();
    });

    it("the ceremony variant refuses before the ceremony starts", async () => {
      await expect(signer.signMicropaymentVoucherWithCeremony(VOUCHER, {} as any)).rejects.toThrow("(FU-118)");
      expect(postSpy).not.toHaveBeenCalled();
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

    it("a token whose on-chain domain is not exactly the KMS's GToken/1 (name, version, or a salt, even zero) gets no request", async () => {
      const salted = (salt: `0x${string}`) => ({ ...GTOKEN_DOMAIN, salt });
      for (const domain of [{ ...GTOKEN_DOMAIN, name: "GToken2" }, { ...GTOKEN_DOMAIN, version: "2" }, salted(("0x" + "00".repeat(32)) as `0x${string}`), salted(("0x" + "01".repeat(32)) as `0x${string}`)]) {
        const s2 = new KmsPaymentSigner(client, { publicClient: gTokenChain(domain) });
        await expect(s2.signGTokenAuthorization(GTOKEN_AUTH, { jwt: JWT })).rejects.toThrow("is not the KMS domain GToken/1");
        await expect(s2.signGTokenAuthorizationWithCeremony(GTOKEN_AUTH, {} as any)).rejects.toThrow("is not the KMS domain GToken/1");
      }
      const otherChain = new KmsPaymentSigner(client, { publicClient: gTokenChain({ ...GTOKEN_DOMAIN, chainId: 10 }) });
      await expect(otherChain.signGTokenAuthorization(GTOKEN_AUTH, { jwt: JWT })).rejects.toThrow("the publicClient is on chain 10, the authorization is for chain 11155420");
      expect(bearerSpy).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it("a token whose TransferWithAuthorization type differs from the KMS's gets no request", async () => {
      const s2 = new KmsPaymentSigner(client, { publicClient: gTokenChain(GTOKEN_DOMAIN, keccak256(toHex("TransferWithAuthorization(address from,address to,uint256 value,uint256 validBefore,uint256 validAfter,bytes32 nonce)"))) });
      await expect(s2.signGTokenAuthorization(GTOKEN_AUTH, { jwt: JWT })).rejects.toThrow("TRANSFER_WITH_AUTHORIZATION_TYPEHASH");
      expect(bearerSpy).not.toHaveBeenCalled();
    });

    it("without a publicClient the domain cannot be checked, so it refuses", async () => {
      const blind = new KmsPaymentSigner(client);
      await expect(blind.signGTokenAuthorization(GTOKEN_AUTH, { jwt: JWT })).rejects.toThrow("pass publicClient");
      expect(bearerSpy).not.toHaveBeenCalled();
    });
  });

  // ── signX402Payment ──────────────────────────────────────────────

  describe("signX402Payment", () => {
    it("refuses before any request, in every mode: no contract verifies this PaymentPayload (FU-119)", async () => {
      await expect(signer.signX402Payment(X402, { webAuthnAssertion: ASSERTION })).rejects.toThrow("no on-chain verifier");
      await expect(signer.signX402Payment(X402, { jwt: JWT })).rejects.toThrow("(FU-119)");
      await expect(signer.signX402PaymentWithCeremony(X402, {} as any)).rejects.toThrow("(FU-119)");
      expect(postSpy).not.toHaveBeenCalled();
      expect(bearerSpy).not.toHaveBeenCalled();
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
