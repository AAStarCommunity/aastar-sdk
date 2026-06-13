import { describe, it, expect, vi, beforeEach } from "vitest";
import { KmsManager } from "../services/kms-signer";
import { KmsHttpClient } from "../services/kms-http-client";
import { SilentLogger } from "../interfaces/logger";

// P1 core key-management methods on KmsManager: getPublicKey / deriveAddress /
// listKeys / deleteKey / changePasskey / sign. These all go through the shared
// KmsHttpClient.amzPost, so we spy on the manager's httpClient.

const ENDPOINT = "https://kms.test.example";

function makeManager(enabled = true): KmsManager {
  return new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: enabled, logger: new SilentLogger() });
}

describe("KmsManager — P1 key management", () => {
  let m: KmsManager;
  let amzSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    m = makeManager();
    amzSpy = vi.spyOn(m.httpClient, "amzPost").mockResolvedValue({} as never);
  });

  describe("getPublicKey", () => {
    it("amzPosts to /GetPublicKey with TrentService.GetPublicKey", async () => {
      amzSpy.mockResolvedValueOnce({ KeyId: "k1", PublicKey: "0x04ab" } as never);
      const res = await m.getPublicKey({ KeyId: "k1" });
      expect(amzSpy).toHaveBeenCalledWith("/GetPublicKey", "TrentService.GetPublicKey", { KeyId: "k1" });
      expect(res.PublicKey).toBe("0x04ab");
    });
  });

  describe("deriveAddress", () => {
    it("amzPosts to /DeriveAddress with TrentService.DeriveAddress", async () => {
      amzSpy.mockResolvedValueOnce({ Address: "0xabc" } as never);
      const params = { KeyId: "k1", DerivationPath: "m/44'/60'/0'/0/0" };
      const res = await m.deriveAddress(params);
      expect(amzSpy).toHaveBeenCalledWith("/DeriveAddress", "TrentService.DeriveAddress", params);
      expect(res.Address).toBe("0xabc");
    });
  });

  describe("listKeys", () => {
    it("amzPosts to /ListKeys with TrentService.ListKeys (empty params default)", async () => {
      amzSpy.mockResolvedValueOnce({ Keys: [{ KeyId: "k1" }] } as never);
      const res = await m.listKeys();
      expect(amzSpy).toHaveBeenCalledWith("/ListKeys", "TrentService.ListKeys", {});
      expect(res.Keys).toHaveLength(1);
    });

    it("forwards Limit/Marker", async () => {
      await m.listKeys({ Limit: 10, Marker: "next" });
      expect(amzSpy).toHaveBeenCalledWith("/ListKeys", "TrentService.ListKeys", { Limit: 10, Marker: "next" });
    });
  });

  describe("deleteKey", () => {
    it("uses the ScheduleKeyDeletion AWS action name", async () => {
      amzSpy.mockResolvedValueOnce({ KeyId: "k1", DeletionDate: "2026-07-01" } as never);
      const params = { KeyId: "k1", PendingWindowInDays: 7 };
      const res = await m.deleteKey(params);
      expect(amzSpy).toHaveBeenCalledWith("/DeleteKey", "TrentService.ScheduleKeyDeletion", params);
      expect(res.DeletionDate).toBe("2026-07-01");
    });
  });

  describe("changePasskey", () => {
    it("amzPosts to /ChangePasskey", async () => {
      amzSpy.mockResolvedValueOnce({ KeyId: "k1", Changed: true } as never);
      const params = { KeyId: "k1", PasskeyPublicKey: "0x04newkey" };
      const res = await m.changePasskey(params);
      expect(amzSpy).toHaveBeenCalledWith("/ChangePasskey", "TrentService.ChangePasskey", params);
      expect(res.Changed).toBe(true);
    });
  });

  describe("sign", () => {
    it("signs a message via /Sign with TrentService.Sign", async () => {
      amzSpy.mockResolvedValueOnce({ Signature: "0xsig" } as never);
      const params = { KeyId: "k1", Message: "0xdeadbeef" };
      const res = await m.sign(params);
      expect(amzSpy).toHaveBeenCalledWith("/Sign", "TrentService.Sign", params);
      expect(res.Signature).toBe("0xsig");
    });

    it("signs an EIP-155 transaction and returns a TransactionHash", async () => {
      amzSpy.mockResolvedValueOnce({ Signature: "0xsig", TransactionHash: "0xtxh" } as never);
      const res = await m.sign({
        KeyId: "k1",
        Transaction: { chainId: 11155111, nonce: 0, to: "0xabc", value: "0", gasPrice: "1", gas: 21000, data: "0x" },
      });
      expect(res.TransactionHash).toBe("0xtxh");
    });
  });

  describe("disabled client", () => {
    it("every P1 method rejects when KMS is not enabled", async () => {
      const disabled = makeManager(false);
      await expect(disabled.getPublicKey({ KeyId: "k1" })).rejects.toThrow("KMS service is not enabled");
      await expect(disabled.deriveAddress({ KeyId: "k1", DerivationPath: "m" })).rejects.toThrow("KMS service is not enabled");
      await expect(disabled.listKeys()).rejects.toThrow("KMS service is not enabled");
      await expect(disabled.deleteKey({ KeyId: "k1" })).rejects.toThrow("KMS service is not enabled");
      await expect(disabled.changePasskey({ KeyId: "k1", PasskeyPublicKey: "0x04" })).rejects.toThrow("KMS service is not enabled");
      await expect(disabled.sign({ KeyId: "k1", Message: "0x" })).rejects.toThrow("KMS service is not enabled");
    });
  });
});
