import { describe, it, expect } from "vitest";
import { parseEther, parseUnits, type Address } from "viem";
import { resolveTierProfile, REFERENCE_ETH_PROFILES } from "../services/tier-profile";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address; // 6-decimal
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address;

describe("resolveTierProfile (#266 unified profile)", () => {
  it("splits a profile into birth-bakeable InitConfig params + native-ETH tier limits", () => {
    const r = resolveTierProfile({
      eth: REFERENCE_ETH_PROFILES.beginner, // 0.01 / 0.1 / 0.2 ETH
      tokens: [
        { address: USDC, tier1: parseUnits("100", 6), tier2: parseUnits("1000", 6), dailyLimit: parseUnits("2000", 6) },
        { address: USDT, tier1: parseUnits("50", 6), tier2: parseUnits("500", 6), dailyLimit: parseUnits("1000", 6) },
      ],
    });
    // ETH daily → InitConfig; ETH tier1/tier2 → setTierLimits.
    expect(r.dailyLimit).toBe(parseEther("0.2"));
    expect(r.ethTierLimits).toEqual({ tier1: parseEther("0.01"), tier2: parseEther("0.1") });
    // Tokens → initialTokens + index-aligned initialTokenConfigs.
    expect(r.initialTokens).toEqual([USDC, USDT]);
    expect(r.initialTokenConfigs[0]).toEqual({ tier1Limit: parseUnits("100", 6), tier2Limit: parseUnits("1000", 6), dailyLimit: parseUnits("2000", 6) });
    expect(r.initialTokenConfigs).toHaveLength(2);
  });

  it("works ETH-only (no tokens) — empty token arrays", () => {
    const r = resolveTierProfile({ eth: REFERENCE_ETH_PROFILES.trader });
    expect(r.initialTokens).toEqual([]);
    expect(r.initialTokenConfigs).toEqual([]);
    expect(r.dailyLimit).toBe(parseEther("5"));
    expect(r.ethTierLimits.tier2).toBe(parseEther("1"));
  });

  it("rejects tier1 > tier2 (ETH)", () => {
    expect(() => resolveTierProfile({ eth: { tier1: parseEther("1"), tier2: parseEther("0.1"), dailyLimit: parseEther("5") } }))
      .toThrow(/tier1.*must be <= tier2/);
  });

  it("rejects tier2 > dailyLimit (token)", () => {
    expect(() => resolveTierProfile({
      eth: REFERENCE_ETH_PROFILES.conservative,
      tokens: [{ address: USDC, tier1: parseUnits("100", 6), tier2: parseUnits("3000", 6), dailyLimit: parseUnits("2000", 6) }],
    })).toThrow(/must be <= dailyLimit/);
  });

  it("rejects dailyLimit == 0 (guard disabled)", () => {
    expect(() => resolveTierProfile({ eth: { tier1: 0n, tier2: 0n, dailyLimit: 0n } }))
      .toThrow(/dailyLimit must be > 0/);
  });
});
