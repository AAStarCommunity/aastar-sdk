import { describe, it, expect } from "vitest";
import { algIdForTier, resolveTier, resolveTokenTier } from "./tier-router";
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
  it("account semantics: tier1>0, tier2==0, value>tier1 → tier 3 (falls through)", () => {
    expect(resolveTier(500n, { tier1Limit: 100n, tier2Limit: 0n })).toBe(3);
  });
});

describe("resolveTokenTier — mirrors GUARD recordTokenSpend (differs at tier2Limit==0)", () => {
  it("no limits → tier 1", () => {
    expect(resolveTokenTier(10n ** 18n, { tier1Limit: 0n, tier2Limit: 0n })).toBe(1);
  });
  it("value <= tier1Limit → tier 1 (inclusive)", () => {
    expect(resolveTokenTier(100n, { tier1Limit: 100n, tier2Limit: 200n })).toBe(1);
  });
  it("tier1 < value <= tier2 → tier 2 (inclusive)", () => {
    expect(resolveTokenTier(200n, { tier1Limit: 100n, tier2Limit: 200n })).toBe(2);
  });
  it("value > tier2Limit → tier 3", () => {
    expect(resolveTokenTier(300n, { tier1Limit: 100n, tier2Limit: 200n })).toBe(3);
  });
  it("KEY DIFF: tier1>0, tier2==0, value>tier1 → tier 2 (uncapped T2, NOT tier 3)", () => {
    // Guard recordTokenSpend: `cfg.tier2Limit == 0 || cumulative <= cfg.tier2Limit` → T2.
    expect(resolveTokenTier(500n, { tier1Limit: 100n, tier2Limit: 0n })).toBe(2);
  });
  it("tier1==0, tier2>0: value <= tier2 → tier 2, value > tier2 → tier 3", () => {
    // Guard: tier1==0 skips the T1 branch; `cumulative <= cfg.tier2Limit` gates T2 vs T3.
    expect(resolveTokenTier(200n, { tier1Limit: 0n, tier2Limit: 200n })).toBe(2);
    expect(resolveTokenTier(201n, { tier1Limit: 0n, tier2Limit: 200n })).toBe(3);
  });
});
