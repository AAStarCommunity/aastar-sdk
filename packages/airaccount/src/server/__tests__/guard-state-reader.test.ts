import { describe, it, expect, vi, beforeEach } from "vitest";
import { zeroAddress, type PublicClient } from "viem";
import { GuardStateReader } from "../services/guard-state-reader";

const ACCOUNT_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const GUARD_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

/**
 * Build a viem PublicClient stub whose `readContract` dispatches by address +
 * function name. The account address resolves `guard()` / `approvedAlgorithms()`;
 * every other address is treated as the guard contract.
 */
function makeClient(
  guardAddress: string,
  guardValues: Partial<Record<string, bigint | boolean>>
): PublicClient {
  return {
    readContract: vi.fn().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async ({ address, functionName }: any) => {
        const isAccount = (address as string).toLowerCase() === ACCOUNT_ADDR.toLowerCase();
        if (isAccount) {
          if (functionName === "guard") return guardAddress;
          if (functionName === "approvedAlgorithms") return guardValues.approvedAlgorithms ?? true;
        }
        switch (functionName) {
          case "dailyLimit":
            return guardValues.dailyLimit ?? 1_000_000n;
          case "remainingDailyAllowance":
            return guardValues.remaining ?? 600_000n;
          case "todaySpent":
            return guardValues.todaySpent ?? 400_000n;
          case "tier1Limit":
            return guardValues.tier1Limit ?? 500_000n;
          case "tier2Limit":
            return guardValues.tier2Limit ?? 800_000n;
          case "minDailyLimit":
            return guardValues.minDailyLimit ?? 0n;
          case "approvedAlgorithms":
            return guardValues.approvedAlgorithms ?? true;
          default:
            throw new Error(`unexpected read: ${functionName}`);
        }
      }
    ),
  } as unknown as PublicClient;
}

describe("GuardStateReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGuardState", () => {
    it("returns null when account has no guard (ZeroAddress)", async () => {
      const reader = new GuardStateReader(makeClient(zeroAddress, {}));
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state).toBeNull();
    });

    it("returns GuardState with correct fields when guard is set", async () => {
      const reader = new GuardStateReader(
        makeClient(GUARD_ADDR, {
          dailyLimit: 1_000_000n,
          remaining: 600_000n,
          todaySpent: 400_000n,
          tier1Limit: 500_000n,
          tier2Limit: 800_000n,
          minDailyLimit: 100_000n,
        })
      );
      const state = await reader.getGuardState(ACCOUNT_ADDR);

      expect(state).not.toBeNull();
      expect(state!.dailyLimit).toBe(1_000_000n);
      expect(state!.todaySpent).toBe(400_000n);
      expect(state!.remaining).toBe(600_000n);
      expect(state!.tier1Limit).toBe(500_000n);
      expect(state!.tier2Limit).toBe(800_000n);
      expect(state!.guardAddress).toBe(GUARD_ADDR);
    });

    it("sets currentTier=1 when spent < tier1Limit", async () => {
      const reader = new GuardStateReader(
        makeClient(GUARD_ADDR, { todaySpent: 100_000n, tier1Limit: 500_000n, tier2Limit: 800_000n })
      );
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(1);
    });

    it("sets currentTier=2 when tier1Limit <= spent < tier2Limit", async () => {
      const reader = new GuardStateReader(
        makeClient(GUARD_ADDR, { todaySpent: 600_000n, tier1Limit: 500_000n, tier2Limit: 800_000n })
      );
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(2);
    });

    it("sets currentTier=3 when spent >= tier2Limit", async () => {
      const reader = new GuardStateReader(
        makeClient(GUARD_ADDR, { todaySpent: 900_000n, tier1Limit: 500_000n, tier2Limit: 800_000n })
      );
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(3);
    });
  });

  describe("requiredTierForAmount", () => {
    it("returns tier 1 when account has no guard", async () => {
      const reader = new GuardStateReader(makeClient(zeroAddress, {}));
      const tier = await reader.requiredTierForAmount(ACCOUNT_ADDR, 1_000_000n);
      expect(tier).toBe(1);
    });

    it("projects spend correctly for tier determination", async () => {
      const reader = new GuardStateReader(
        makeClient(GUARD_ADDR, { todaySpent: 400_000n, tier1Limit: 500_000n, tier2Limit: 800_000n })
      );
      // 400k + 50k = 450k < tier1 → tier 1
      expect(await reader.requiredTierForAmount(ACCOUNT_ADDR, 50_000n)).toBe(1);
    });
  });

  describe("isAlgorithmApproved", () => {
    // v0.17.2-beta.4: read the whitelist from the ACCOUNT (not the guard).
    it("returns account.approvedAlgorithms = true", async () => {
      const reader = new GuardStateReader(makeClient(GUARD_ADDR, { approvedAlgorithms: true }));
      const approved = await reader.isAlgorithmApproved(ACCOUNT_ADDR, 1);
      expect(approved).toBe(true);
    });

    it("returns account.approvedAlgorithms = false", async () => {
      const reader = new GuardStateReader(makeClient(GUARD_ADDR, { approvedAlgorithms: false }));
      const approved = await reader.isAlgorithmApproved(ACCOUNT_ADDR, 1);
      expect(approved).toBe(false);
    });
  });
});
