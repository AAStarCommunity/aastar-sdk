import { describe, it, expect, vi, beforeEach } from "vitest";
import { KmsHttpClient } from "../services/kms-http-client";
import { KmsMonitorService } from "../services/kms-monitor-service";
import { SilentLogger } from "../interfaces/logger";

function makeClient(enabled = true) {
  return new KmsHttpClient({
    kmsEndpoint: "https://kms.test",
    kmsEnabled: enabled,
    logger: new SilentLogger(),
  });
}

describe("KmsMonitorService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── health (no auth, ignores enabled gate) ────────────────────────

  describe("health", () => {
    it("GETs /health and passes through the response", async () => {
      const client = makeClient();
      const payload = {
        status: "ok",
        service: "kms",
        ta_mode: "secure",
        version: "0.20.0",
      };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.health();

      expect(getSpy).toHaveBeenCalledWith("/health");
      expect(result).toEqual(payload);
    });

    it("works on a disabled client (does not throw)", async () => {
      const client = makeClient(false);
      vi.spyOn(client, "get").mockResolvedValue({ status: "ok" });

      const service = new KmsMonitorService(client);
      await expect(service.health()).resolves.toEqual({ status: "ok" });
    });
  });

  // ── version (no auth, ignores enabled gate) ───────────────────────

  describe("version", () => {
    it("GETs /version and passes through the response", async () => {
      const client = makeClient();
      const payload = {
        version: "0.20.0",
        ta_mode: "secure",
        endpoints: ["/health", "/stats"],
        extra: "passthrough",
      };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.version();

      expect(getSpy).toHaveBeenCalledWith("/version");
      expect(result).toEqual(payload);
    });

    it("works on a disabled client (does not throw)", async () => {
      const client = makeClient(false);
      vi.spyOn(client, "get").mockResolvedValue({ version: "0.20.0" });

      const service = new KmsMonitorService(client);
      await expect(service.version()).resolves.toEqual({ version: "0.20.0" });
    });
  });

  // ── queueStatus ───────────────────────────────────────────────────

  describe("queueStatus", () => {
    it("GETs /QueueStatus and passes through the response", async () => {
      const client = makeClient();
      const payload = {
        queue_depth: 3,
        estimated_wait_seconds: 12,
        circuit_breaker_open: false,
        consecutive_failures: 0,
      };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.queueStatus();

      expect(getSpy).toHaveBeenCalledWith("/QueueStatus");
      expect(result).toEqual(payload);
    });

    it("throws on a disabled client", async () => {
      const client = makeClient(false);
      const service = new KmsMonitorService(client);
      await expect(service.queueStatus()).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── rollbackCounter ───────────────────────────────────────────────

  describe("rollbackCounter", () => {
    it("GETs /RollbackCounter and passes through the response", async () => {
      const client = makeClient();
      const payload = { counter: 42, raw: "0x2a" };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.rollbackCounter();

      expect(getSpy).toHaveBeenCalledWith("/RollbackCounter");
      expect(result).toEqual(payload);
    });

    it("throws on a disabled client", async () => {
      const client = makeClient(false);
      const service = new KmsMonitorService(client);
      await expect(service.rollbackCounter()).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── stats ─────────────────────────────────────────────────────────

  describe("stats", () => {
    it("GETs /stats and passes through the response", async () => {
      const client = makeClient();
      const payload = {
        wallets: { total: 10 },
        tx: { signed: 100 },
        queue: { depth: 2 },
        warnings: [],
      };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.stats();

      expect(getSpy).toHaveBeenCalledWith("/stats");
      expect(result).toEqual(payload);
    });

    it("throws on a disabled client", async () => {
      const client = makeClient(false);
      const service = new KmsMonitorService(client);
      await expect(service.stats()).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── adminPurgeKey ─────────────────────────────────────────────────

  describe("adminPurgeKey", () => {
    it("POSTs to /admin/purge-key with body and admin Bearer token", async () => {
      const client = makeClient();
      const payload = { purged: true };
      const bearerSpy = vi.spyOn(client, "postWithBearer").mockResolvedValue(payload);

      const service = new KmsMonitorService(client);
      const result = await service.adminPurgeKey(
        { key_id: "key-abc", reason: "compromised" },
        "admin-token-123"
      );

      expect(bearerSpy).toHaveBeenCalledWith(
        "/admin/purge-key",
        { key_id: "key-abc", reason: "compromised" },
        "admin-token-123"
      );
      expect(result).toEqual(payload);
    });

    it("throws on a disabled client", async () => {
      const client = makeClient(false);
      const service = new KmsMonitorService(client);
      await expect(
        service.adminPurgeKey({ key_id: "key-abc", reason: "compromised" }, "admin-token-123")
      ).rejects.toThrow("KMS service is not enabled");
    });
  });

  // ── TEE remote-attestation (#37/#12/#87) ──────────────────────────
  describe("attestation", () => {
    it("getAttestation GETs /attestation with the nonce query param (public, no enable gate)", async () => {
      const client = makeClient(false); // public endpoint — must work even when disabled
      const payload = { schema: "v1", nonce: "0xabcd", ta_measurement: "0x11", signature: "0x22" };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const result = await new KmsMonitorService(client).getAttestation("0xabcd");

      expect(getSpy).toHaveBeenCalledWith("/attestation", { params: { nonce: "0xabcd" } });
      expect(result).toEqual(payload);
    });

    it("getAttestationMeasurements GETs the signed manifest", async () => {
      const client = makeClient();
      const payload = { body: { "0.18.0": "0xmeas" }, publisher_key: "0xpk", signature: "0xsig" };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const result = await new KmsMonitorService(client).getAttestationMeasurements();

      expect(getSpy).toHaveBeenCalledWith("/.well-known/attestation-measurements.json");
      expect(result).toEqual(payload);
    });

    it("getAttestationMeasurementsProof GETs the Sigsum proof sidecar", async () => {
      const client = makeClient();
      const payload = { proof: { leaf: "0x33" } };
      const getSpy = vi.spyOn(client, "get").mockResolvedValue(payload);

      const result = await new KmsMonitorService(client).getAttestationMeasurementsProof();

      expect(getSpy).toHaveBeenCalledWith("/.well-known/attestation-measurements-proof.json");
      expect(result).toEqual(payload);
    });
  });
});
