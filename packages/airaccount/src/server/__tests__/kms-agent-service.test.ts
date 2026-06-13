import { describe, it, expect, vi, beforeEach } from "vitest";
import { KmsHttpClient } from "../services/kms-http-client";
import {
  KmsAgentService,
  KmsCreateAgentKeyRequest,
  KmsSignAgentRequest,
  KmsRefreshAgentCredentialRequest,
  KmsRevokeAgentCredentialRequest,
} from "../services/kms-agent-service";
import { WebAuthnAssertion } from "../services/kms-signer";
import { SilentLogger } from "../interfaces/logger";

const ENDPOINT = "https://kms.test";
const JWT = "eyJ.agent.credential";
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const KEY_ID = "wallet-uuid:0";

const WEBAUTHN: WebAuthnAssertion = {
  ChallengeId: "ch-1",
  Credential: { id: "cred-1" },
};

function makeClient(enabled = true): KmsHttpClient {
  return new KmsHttpClient({
    kmsEndpoint: ENDPOINT,
    kmsEnabled: enabled,
    logger: new SilentLogger(),
  });
}

describe("KmsAgentService", () => {
  let client: KmsHttpClient;
  let service: KmsAgentService;

  beforeEach(() => {
    client = makeClient(true);
    service = new KmsAgentService(client);
  });

  // ── createAgentKey ──────────────────────────────────────────────

  describe("createAgentKey", () => {
    it("POSTs to /kms/create-agent-key with the request body and returns the response", async () => {
      const response = {
        keyId: "wallet-uuid:0",
        agentAddress: ACCOUNT,
        derivationPath: "m/44'/60'/0'/0/1",
        agentCredential: JWT,
        expiresAt: 1_900_000_000,
      };
      const spy = vi.spyOn(client, "post").mockResolvedValue(response);

      const params: KmsCreateAgentKeyRequest = {
        humanKeyId: "human-key-1",
        label: "sponsor-bot",
        webAuthnAssertion: WEBAUTHN,
      };
      const result = await service.createAgentKey(params);

      expect(spy).toHaveBeenCalledWith("/kms/create-agent-key", params);
      expect(result).toEqual(response);
    });

    it("rejects when KMS is not enabled", async () => {
      const disabled = new KmsAgentService(makeClient(false));
      await expect(
        disabled.createAgentKey({ humanKeyId: "human-key-1" })
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── signAgent ───────────────────────────────────────────────────

  describe("signAgent", () => {
    it("POSTs to /kms/sign-agent with Bearer JWT and returns the response", async () => {
      const response = {
        keyId: KEY_ID,
        agentAddress: ACCOUNT,
        signature: "0x08" + "ab".repeat(105),
      };
      const spy = vi.spyOn(client, "postWithBearer").mockResolvedValue(response);

      const params: KmsSignAgentRequest = {
        keyId: KEY_ID,
        payload: "0xdeadbeef",
        accountAddress: ACCOUNT,
      };
      const result = await service.signAgent(params, JWT);

      expect(spy).toHaveBeenCalledWith("/kms/sign-agent", params, JWT);
      expect(result).toEqual(response);
    });

    it("rejects when KMS is not enabled", async () => {
      const disabled = new KmsAgentService(makeClient(false));
      await expect(
        disabled.signAgent(
          { keyId: KEY_ID, payload: "0xdeadbeef", accountAddress: ACCOUNT },
          JWT
        )
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── refreshAgentCredential ──────────────────────────────────────

  describe("refreshAgentCredential", () => {
    it("POSTs to /kms/refresh-agent-credential with Bearer JWT and returns the response", async () => {
      const response = {
        keyId: KEY_ID,
        agentCredential: "eyJ.new.credential",
        expiresAt: 2_000_000_000,
      };
      const spy = vi.spyOn(client, "postWithBearer").mockResolvedValue(response);

      const params: KmsRefreshAgentCredentialRequest = {
        keyId: KEY_ID,
        webAuthnAssertion: WEBAUTHN,
      };
      const result = await service.refreshAgentCredential(params, JWT);

      expect(spy).toHaveBeenCalledWith(
        "/kms/refresh-agent-credential",
        params,
        JWT
      );
      expect(result).toEqual(response);
    });

    it("rejects when KMS is not enabled", async () => {
      const disabled = new KmsAgentService(makeClient(false));
      await expect(
        disabled.refreshAgentCredential({ keyId: KEY_ID }, JWT)
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── revokeAgentCredential ───────────────────────────────────────

  describe("revokeAgentCredential", () => {
    it("POSTs to /kms/revoke-agent-credential with the request body and returns the response", async () => {
      const response = { success: true, revokedAt: 1_950_000_000 };
      const spy = vi.spyOn(client, "post").mockResolvedValue(response);

      const params: KmsRevokeAgentCredentialRequest = {
        keyId: KEY_ID,
        webAuthnAssertion: WEBAUTHN,
      };
      const result = await service.revokeAgentCredential(params);

      expect(spy).toHaveBeenCalledWith("/kms/revoke-agent-credential", params);
      expect(result).toEqual(response);
    });

    it("rejects when KMS is not enabled", async () => {
      const disabled = new KmsAgentService(makeClient(false));
      await expect(
        disabled.revokeAgentCredential({ keyId: KEY_ID })
      ).rejects.toThrow("KMS service is not enabled");
    });
  });
});
