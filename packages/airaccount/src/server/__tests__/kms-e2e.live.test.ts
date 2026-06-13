import { describe, it, expect } from "vitest";
import { KmsHttpClient } from "../services/kms-http-client";
import { KmsManager } from "../services/kms-signer";
import { KmsMonitorService } from "../services/kms-monitor-service";
import { SilentLogger } from "../interfaces/logger";

/**
 * Live E2E against the real AAStar TEE KMS (default https://kms.aastar.io, v0.20.0).
 *
 * SKIPPED by default — opt in with `KMS_E2E=1`:
 *   KMS_E2E=1 pnpm --filter @aastar/airaccount exec vitest run src/server/__tests__/kms-e2e.live.test.ts
 *
 * Env:
 *   KMS_E2E           "1" to enable this suite (otherwise the whole block is skipped)
 *   KMS_E2E_ENDPOINT  override endpoint (default https://kms.aastar.io)
 *   KMS_E2E_API_KEY   optional x-api-key (server runs in open mode when no keys registered)
 *   KMS_E2E_ADMIN_TOKEN optional operator token — only used to prove the negative-auth path
 *
 * Coverage here is the SDK↔server contract for the UNAUTHENTICATED + NEGATIVE-AUTH surface:
 * monitoring endpoints (real shapes) and auth-gating (signing without an assertion must 4xx/5xx).
 * Full WebAuthn-ceremony signing E2E is owned by the KMS repo's run-full-e2e.sh (34/34 on real HW),
 * which exercises the hardware authenticator we cannot drive from a unit-test runner.
 */

const E2E_ENABLED = process.env.KMS_E2E === "1";
const ENDPOINT = process.env.KMS_E2E_ENDPOINT ?? "https://kms.aastar.io";
const API_KEY = process.env.KMS_E2E_API_KEY;

const NET_TIMEOUT = 20_000;

function makeClient(): KmsHttpClient {
  return new KmsHttpClient({
    kmsEndpoint: ENDPOINT,
    kmsEnabled: true,
    kmsApiKey: API_KEY,
    logger: new SilentLogger(),
  });
}

describe.runIf(E2E_ENABLED)(`KMS live E2E @ ${ENDPOINT}`, () => {
  const monitor = new KmsMonitorService(makeClient());

  describe("monitoring (unauthenticated)", () => {
    it("health() reports a healthy v0.x service", async () => {
      const res = await monitor.health();
      expect(res.status).toBe("healthy");
      expect(typeof res.version).toBe("string");
    }, NET_TIMEOUT);

    it("version() returns a version string", async () => {
      const res = await monitor.version();
      expect(typeof res.version).toBe("string");
    }, NET_TIMEOUT);

    it("queueStatus() returns numeric queue + circuit-breaker fields", async () => {
      const res = await monitor.queueStatus();
      expect(typeof res.queue_depth).toBe("number");
      expect(typeof res.circuit_breaker_open).toBe("boolean");
      expect(typeof res.consecutive_failures).toBe("number");
    }, NET_TIMEOUT);

    it("stats() returns a machine-readable object", async () => {
      const res = await monitor.stats();
      expect(res).toBeTypeOf("object");
      expect(res).not.toBeNull();
    }, NET_TIMEOUT);

    it("rollbackCounter() returns a monotonic counter", async () => {
      const res = await monitor.rollbackCounter();
      expect(typeof res.counter).toBe("number");
    }, NET_TIMEOUT);
  });

  describe("auth-gating (negative)", () => {
    it("SignTypedData without an assertion is rejected by the server", async () => {
      const kms = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: true, kmsApiKey: API_KEY, logger: new SilentLogger() });
      await expect(
        kms.signTypedDataWithWebAuthn({
          keyId: "00000000-0000-0000-0000-000000000000",
          domain: { name: "Test", version: "1", chainId: 11155111 },
          primaryType: "Mail",
          types: [{ name: "Mail", fields: [{ name: "contents", type: "string" }] }],
          message: [{ name: "contents", value: "hello" }],
          // no webAuthnAssertion → must be rejected
        }),
      ).rejects.toThrow();
    }, NET_TIMEOUT);

    it("admin/purge-key with a bogus operator token is rejected", async () => {
      const token = process.env.KMS_E2E_ADMIN_TOKEN ?? "bogus-operator-token";
      await expect(
        monitor.adminPurgeKey({ key_id: "00000000-0000-0000-0000-000000000000", reason: "e2e-negative" }, token),
      ).rejects.toThrow();
    }, NET_TIMEOUT);
  });
});
