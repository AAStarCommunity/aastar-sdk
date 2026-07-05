import { describe, it, expect } from "vitest";
import { algIdForTier, resolveTier } from "./tier-router";
import {
  ALG_ECDSA, ALG_CUMULATIVE_T2, ALG_CUMULATIVE_T3, ALG_CUMULATIVE_T2_WA, ALG_CUMULATIVE_T3_WA,
} from "./types";

describe("algIdForTier — WebAuthn-aware (#256)", () => {
  it("raw path: tier 1/2/3 → 0x02 / 0x04 / 0x05", () => {
    expect(algIdForTier(1)).toBe(ALG_ECDSA);          // 0x02
    expect(algIdForTier(2)).toBe(ALG_CUMULATIVE_T2);  // 0x04
    expect(algIdForTier(3)).toBe(ALG_CUMULATIVE_T3);  // 0x05
  });

  it("device-passkey (WebAuthn) path: tier 2/3 → 0x09 / 0x0a (tier 1 stays 0x02)", () => {
    expect(algIdForTier(1, true)).toBe(ALG_ECDSA);           // 0x02 — WA applies to T2/3 only
    expect(algIdForTier(2, true)).toBe(ALG_CUMULATIVE_T2_WA); // 0x09
    expect(algIdForTier(3, true)).toBe(ALG_CUMULATIVE_T3_WA); // 0x0a — the algId a device-passkey T3 account approves
  });

  it("webAuthn=false is the default (backward compatible)", () => {
    expect(algIdForTier(3)).toBe(algIdForTier(3, false));
    expect(algIdForTier(3, false)).toBe(ALG_CUMULATIVE_T3); // 0x05, NOT 0x0a
  });
});

describe("resolveTier (unchanged)", () => {
  it("no limits → tier 1", () => {
    expect(resolveTier(10n ** 18n, { tier1Limit: 0n, tier2Limit: 0n })).toBe(1);
  });
  it("value > tier2Limit → tier 3", () => {
    expect(resolveTier(10n ** 18n, { tier1Limit: 1n, tier2Limit: 2n })).toBe(3);
  });
});
