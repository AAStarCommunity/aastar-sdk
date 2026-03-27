import { describe, it, expect, vi, beforeEach } from "vitest";

const { MockContract, ZERO_ADDRESS } = vi.hoisted(() => ({
  MockContract: vi.fn(),
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

vi.mock("ethers", () => ({
  ethers: {
    ZeroAddress: "0x0000000000000000000000000000000000000000",
    Contract: MockContract,
  },
  ZeroAddress: "0x0000000000000000000000000000000000000000",
  Contract: MockContract,
}));

import { ethers } from "ethers";

import { GuardStateReader } from "../services/guard-state-reader";

const ACCOUNT_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const GUARD_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function setupContracts(guardAddress: string, guardValues: Partial<Record<string, bigint | boolean>>) {
  const mockGuard = {
    dailyLimit: vi.fn().mockResolvedValue(guardValues.dailyLimit ?? 1_000_000n),
    remainingDailyAllowance: vi.fn().mockResolvedValue(guardValues.remaining ?? 600_000n),
    todaySpent: vi.fn().mockResolvedValue(guardValues.todaySpent ?? 400_000n),
    tier1Limit: vi.fn().mockResolvedValue(guardValues.tier1Limit ?? 500_000n),
    tier2Limit: vi.fn().mockResolvedValue(guardValues.tier2Limit ?? 800_000n),
    minDailyLimit: vi.fn().mockResolvedValue(guardValues.minDailyLimit ?? 0n),
    approvedAlgorithms: vi.fn().mockResolvedValue(guardValues.approvedAlgorithms ?? true),
  };

  const mockAccount = {
    guard: vi.fn().mockResolvedValue(guardAddress),
  };

  MockContract.mockImplementation(function (addr: string) {
    const obj = addr === ACCOUNT_ADDR ? mockAccount : mockGuard;
    Object.assign(this as object, obj);
  });
}

describe("GuardStateReader", () => {
  const provider = {} as ethers.JsonRpcProvider;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGuardState", () => {
    it("returns null when account has no guard (ZeroAddress)", async () => {
      setupContracts(ethers.ZeroAddress, {});
      const reader = new GuardStateReader(provider);
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state).toBeNull();
    });

    it("returns GuardState with correct fields when guard is set", async () => {
      setupContracts(GUARD_ADDR, {
        dailyLimit: 1_000_000n,
        remaining: 600_000n,
        todaySpent: 400_000n,
        tier1Limit: 500_000n,
        tier2Limit: 800_000n,
        minDailyLimit: 100_000n,
      });
      const reader = new GuardStateReader(provider);
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
      setupContracts(GUARD_ADDR, {
        todaySpent: 100_000n,
        tier1Limit: 500_000n,
        tier2Limit: 800_000n,
      });
      const reader = new GuardStateReader(provider);
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(1);
    });

    it("sets currentTier=2 when tier1Limit <= spent < tier2Limit", async () => {
      setupContracts(GUARD_ADDR, {
        todaySpent: 600_000n,
        tier1Limit: 500_000n,
        tier2Limit: 800_000n,
      });
      const reader = new GuardStateReader(provider);
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(2);
    });

    it("sets currentTier=3 when spent >= tier2Limit", async () => {
      setupContracts(GUARD_ADDR, {
        todaySpent: 900_000n,
        tier1Limit: 500_000n,
        tier2Limit: 800_000n,
      });
      const reader = new GuardStateReader(provider);
      const state = await reader.getGuardState(ACCOUNT_ADDR);
      expect(state!.currentTier).toBe(3);
    });
  });

  describe("requiredTierForAmount", () => {
    it("returns tier 1 when account has no guard", async () => {
      setupContracts(ethers.ZeroAddress, {});
      const reader = new GuardStateReader(provider);
      const tier = await reader.requiredTierForAmount(ACCOUNT_ADDR, 1_000_000n);
      expect(tier).toBe(1);
    });

    it("projects spend correctly for tier determination", async () => {
      setupContracts(GUARD_ADDR, {
        todaySpent: 400_000n,
        tier1Limit: 500_000n,
        tier2Limit: 800_000n,
      });
      const reader = new GuardStateReader(provider);
      // 400k + 50k = 450k < tier1 → tier 1
      expect(await reader.requiredTierForAmount(ACCOUNT_ADDR, 50_000n)).toBe(1);
    });
  });

  describe("isAlgorithmApproved", () => {
    it("returns true when account has no guard", async () => {
      setupContracts(ethers.ZeroAddress, {});
      const reader = new GuardStateReader(provider);
      const approved = await reader.isAlgorithmApproved(ACCOUNT_ADDR, 1);
      expect(approved).toBe(true);
    });

    it("returns guard.approvedAlgorithms result when guard exists", async () => {
      setupContracts(GUARD_ADDR, { approvedAlgorithms: true });
      const reader = new GuardStateReader(provider);
      const approved = await reader.isAlgorithmApproved(ACCOUNT_ADDR, 1);
      expect(approved).toBe(true);
    });
  });
});
