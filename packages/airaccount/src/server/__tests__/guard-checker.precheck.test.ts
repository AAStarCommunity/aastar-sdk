import { describe, it, expect, vi } from "vitest";

// The account approves ONLY the device-passkey WA algId 0x0a (Cumulative T3 WebAuthn) — NOT the raw 0x05.
vi.mock("../providers/typed-reads", async (orig) => ({
  ...(await (orig as () => Promise<Record<string, unknown>>)()),
  readAlgorithmApproved: vi.fn(async (_c: unknown, algId: number) => algId === 0x0a),
}));

import { GuardChecker } from "../services/guard-checker";
import { SilentLogger } from "../interfaces/logger";

function makeChecker() {
  const ethereum = { getAccountContract: vi.fn(() => ({})) } as never;
  const gc = new GuardChecker(ethereum, new SilentLogger());
  // Tier-3 for any value > 2 (tier1Limit=1, tier2Limit=2). Guard on, no daily cap.
  vi.spyOn(gc, "fetchTierConfig").mockResolvedValue({ tier1Limit: 1n, tier2Limit: 2n });
  vi.spyOn(gc, "fetchGuardStatus").mockResolvedValue({ hasGuard: true, dailyLimit: 0n, dailyRemaining: 0n } as never);
  return gc;
}

describe("GuardChecker.preCheck — device-passkey algId (#256)", () => {
  it("device-passkey Tier-3 (useWebAuthnPasskey=true) queries 0x0a and PASSES", async () => {
    const r = await makeChecker().preCheck("0xacc", 10n ** 18n, true);
    expect(r.tier).toBe(3);
    expect(r.algId).toBe(0x0a); // WA variant — the algId a device-passkey account approves
    expect(r.ok).toBe(true);
  });

  it("without the flag it queries 0x05 and FALSE-FAILS (the pre-fix #256 bug)", async () => {
    const r = await makeChecker().preCheck("0xacc", 10n ** 18n, false);
    expect(r.algId).toBe(0x05); // raw variant — NOT what the device-passkey account approved
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/0x05|not approved/);
  });
});
