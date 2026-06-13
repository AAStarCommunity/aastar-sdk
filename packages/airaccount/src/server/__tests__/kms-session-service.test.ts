import { describe, it, expect, vi, beforeEach } from "vitest";
import { KmsHttpClient } from "../services/kms-http-client";
import {
  KmsSessionService,
  CreateP256SessionKeyResponse,
  SignP256UserOpResponse,
  RevokeP256SessionKeyResponse,
} from "../services/kms-session-service";
import { WebAuthnAssertion } from "../services/kms-signer";
import { SilentLogger } from "../interfaces/logger";

const HUMAN_KEY_ID = "human-key-1";
const SESSION_KEY_ID = "session-key-1";
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const JWT = "eyJhbGciOiJFUzI1NiJ9.fake.jwt";

const PUB_X = "0x" + "11".repeat(32);
const PUB_Y = "0x" + "22".repeat(32);
// 149-byte wire format: [0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)]
const WIRE_SIG = "0x08" + "ab".repeat(148);

const MOCK_ASSERTION: WebAuthnAssertion = {
  ChallengeId: "challenge-1",
  Credential: { id: "cred-1" },
};

function makeClient(enabled = true) {
  return new KmsHttpClient({
    kmsEndpoint: "https://kms.test",
    kmsEnabled: enabled,
    logger: new SilentLogger(),
  });
}

describe("KmsSessionService", () => {
  let client: KmsHttpClient;
  let service: KmsSessionService;

  beforeEach(() => {
    client = makeClient();
    service = new KmsSessionService(client);
  });

  describe("createP256SessionKey", () => {
    it("POSTs to /kms/create-p256-session-key and passes through the result", async () => {
      const response: CreateP256SessionKeyResponse = {
        keyId: SESSION_KEY_ID,
        pubKeyX: PUB_X,
        pubKeyY: PUB_Y,
        algorithm: "p256",
        agentCredential: JWT,
        expiresAt: 1893456000,
      };
      const spy = vi.spyOn(client, "post").mockResolvedValue(response);

      const result = await service.createP256SessionKey({
        humanKeyId: HUMAN_KEY_ID,
        label: "my session",
        webAuthnAssertion: MOCK_ASSERTION,
      });

      expect(spy).toHaveBeenCalledWith("/kms/create-p256-session-key", {
        humanKeyId: HUMAN_KEY_ID,
        label: "my session",
        webAuthnAssertion: MOCK_ASSERTION,
      });
      expect(result).toEqual(response);
    });

    it("throws when KMS is not enabled", async () => {
      const disabled = new KmsSessionService(makeClient(false));
      await expect(
        disabled.createP256SessionKey({ humanKeyId: HUMAN_KEY_ID })
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  describe("signP256UserOp", () => {
    it("POSTs to /kms/sign-p256-user-op with bearer JWT and passes through the result", async () => {
      const response: SignP256UserOpResponse = {
        keyId: SESSION_KEY_ID,
        pubKeyX: PUB_X,
        pubKeyY: PUB_Y,
        signature: WIRE_SIG,
      };
      const spy = vi.spyOn(client, "postWithBearer").mockResolvedValue(response);

      const payload = "0x" + "cd".repeat(32);
      const result = await service.signP256UserOp(
        { keyId: SESSION_KEY_ID, payload, accountAddress: ACCOUNT },
        JWT
      );

      expect(spy).toHaveBeenCalledWith(
        "/kms/sign-p256-user-op",
        { keyId: SESSION_KEY_ID, payload, accountAddress: ACCOUNT },
        JWT
      );
      expect(result).toEqual(response);
      expect(result.signature).toBe(WIRE_SIG);
    });

    it("throws when KMS is not enabled", async () => {
      const disabled = new KmsSessionService(makeClient(false));
      await expect(
        disabled.signP256UserOp(
          { keyId: SESSION_KEY_ID, payload: "0xab", accountAddress: ACCOUNT },
          JWT
        )
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  describe("revokeP256SessionKey", () => {
    it("POSTs to /kms/revoke-p256-session-key and passes through the result", async () => {
      const response: RevokeP256SessionKeyResponse = {
        success: true,
        revokedAt: 1893456000,
      };
      const spy = vi.spyOn(client, "post").mockResolvedValue(response);

      const result = await service.revokeP256SessionKey({
        keyId: SESSION_KEY_ID,
        webAuthnAssertion: MOCK_ASSERTION,
      });

      expect(spy).toHaveBeenCalledWith("/kms/revoke-p256-session-key", {
        keyId: SESSION_KEY_ID,
        webAuthnAssertion: MOCK_ASSERTION,
      });
      expect(result).toEqual(response);
    });

    it("throws when KMS is not enabled", async () => {
      const disabled = new KmsSessionService(makeClient(false));
      await expect(
        disabled.revokeP256SessionKey({ keyId: SESSION_KEY_ID })
      ).rejects.toThrow("KMS service is not enabled");
    });
  });
});
