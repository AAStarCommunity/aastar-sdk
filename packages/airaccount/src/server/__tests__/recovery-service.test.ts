import { describe, it, expect, vi, beforeEach } from "vitest";
import { zeroAddress, type PublicClient } from "viem";
import { selectorFromId } from "../../migration/viem/hashing";
import {
  RecoveryService,
  RECOVERY_THRESHOLD,
  RECOVERY_TIMELOCK_SECONDS,
  MAX_GUARDIANS,
  GUARDIAN_SIG_VERSION,
  P256_GUARDIAN_SENTINEL,
} from "../services/recovery-service";

const ACCOUNT    = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NEW_OWNER  = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GUARDIAN_1 = "0xcccccccccccccccccccccccccccccccccccccccc";
const GUARDIAN_2 = "0xdddddddddddddddddddddddddddddddddddddddd";

/** A stub viem PublicClient whose reads are dispatched by function name + args. */
function mockReadClient(
  impl: (functionName: string, args?: readonly unknown[]) => unknown
): PublicClient {
  return {
    readContract: vi
      .fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async ({ functionName, args }: any) => impl(functionName, args)),
  } as unknown as PublicClient;
}

/** Encoders are pure and never touch the client. */
const noClient = {} as unknown as PublicClient;

describe("RecoveryService — constants", () => {
  it("threshold is 2 (2-of-3)", () => {
    expect(RECOVERY_THRESHOLD).toBe(2);
  });

  it("max guardians is 3", () => {
    expect(MAX_GUARDIANS).toBe(3);
  });

  it("timelock is 2 days in seconds", () => {
    expect(RECOVERY_TIMELOCK_SECONDS).toBe(172800n);
  });
});

describe("RecoveryService — calldata encoders", () => {
  let svc: RecoveryService;

  beforeEach(() => {
    svc = new RecoveryService(noClient);
  });

  describe("encodeAddGuardian", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeAddGuardian(GUARDIAN_1);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different guardian → different calldata, same selector", () => {
      const cd1 = svc.encodeAddGuardian(GUARDIAN_1);
      const cd2 = svc.encodeAddGuardian(GUARDIAN_2);
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeRemoveGuardian", () => {
    const sig = "0x" + "ab".repeat(65);

    it("produces valid hex calldata", () => {
      const cd = svc.encodeRemoveGuardian(0, [sig, sig]);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different index → different calldata", () => {
      const cd1 = svc.encodeRemoveGuardian(0, [sig, sig]);
      const cd2 = svc.encodeRemoveGuardian(1, [sig, sig]);
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeProposeRecovery", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeProposeRecovery(NEW_OWNER);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different newOwner → different calldata, same selector", () => {
      const cd1 = svc.encodeProposeRecovery(NEW_OWNER);
      const cd2 = svc.encodeProposeRecovery(GUARDIAN_1);
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeApproveRecovery / encodeCancelRecovery / encodeExecuteRecovery", () => {
    it("each produces valid hex calldata", () => {
      expect(svc.encodeApproveRecovery()).toMatch(/^0x[0-9a-f]+$/i);
      expect(svc.encodeCancelRecovery()).toMatch(/^0x[0-9a-f]+$/i);
      expect(svc.encodeExecuteRecovery()).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("no-arg encoders are bare 4-byte selectors", () => {
      expect(svc.encodeApproveRecovery()).toHaveLength(10);
      expect(svc.encodeCancelRecovery()).toHaveLength(10);
      expect(svc.encodeExecuteRecovery()).toHaveLength(10);
    });
  });

  describe("exact 4-byte selectors match the canonical contract signatures", () => {
    const sel = (sig: string) => selectorFromId(sig);
    it("each encoder uses the exact on-chain function signature", () => {
      expect(svc.encodeAddGuardian(GUARDIAN_1).slice(0, 10)).toBe(sel("addGuardian(address)"));
      expect(svc.encodeRemoveGuardian(0, []).slice(0, 10)).toBe(sel("removeGuardian(uint8,bytes[])"));
      expect(svc.encodeProposeRecovery(NEW_OWNER).slice(0, 10)).toBe(sel("proposeRecovery(address)"));
      expect(svc.encodeApproveRecovery()).toBe(sel("approveRecovery()"));
      expect(svc.encodeCancelRecovery()).toBe(sel("cancelRecovery()"));
      expect(svc.encodeExecuteRecovery()).toBe(sel("executeRecovery()"));
    });
  });

  describe("distinct selectors across all methods", () => {
    it("every recovery method has a unique 4-byte selector", () => {
      const selectors = [
        svc.encodeAddGuardian(GUARDIAN_1),
        svc.encodeRemoveGuardian(0, []),
        svc.encodeProposeRecovery(NEW_OWNER),
        svc.encodeApproveRecovery(),
        svc.encodeCancelRecovery(),
        svc.encodeExecuteRecovery(),
      ].map((cd) => cd.slice(0, 10));

      expect(new Set(selectors).size).toBe(selectors.length);
    });
  });
});

describe("RecoveryService — on-chain read mocks", () => {
  it("getActiveRecovery decodes the RecoveryProposal struct + derived fields", async () => {
    const proposedAt = 1717200000n;
    const approvalBitmap = 0b011n; // guardians 0 and 1 approved → count 2
    const cancellationBitmap = 0b100n; // guardian 2 voted to cancel → count 1

    const client = mockReadClient((functionName) => {
      if (functionName === "activeRecovery") {
        return [NEW_OWNER, proposedAt, approvalBitmap, cancellationBitmap];
      }
      throw new Error(`unexpected read: ${functionName}`);
    });

    const svc = new RecoveryService(client);
    const result = await svc.getActiveRecovery(ACCOUNT);

    expect(result.newOwner.toLowerCase()).toBe(NEW_OWNER.toLowerCase());
    expect(result.proposedAt).toBe(proposedAt);
    expect(result.approvalBitmap).toBe(approvalBitmap);
    expect(result.cancellationBitmap).toBe(cancellationBitmap);
    expect(result.approvalCount).toBe(2);
    expect(result.cancellationCount).toBe(1);
    expect(result.executeAfter).toBe(proposedAt + RECOVERY_TIMELOCK_SECONDS);
    expect(result.isActive).toBe(true);
  });

  it("getActiveRecovery reports isActive=false when newOwner is zero", async () => {
    const client = mockReadClient((functionName) => {
      if (functionName === "activeRecovery") {
        return [zeroAddress, 0n, 0n, 0n];
      }
      throw new Error(`unexpected read: ${functionName}`);
    });

    const svc = new RecoveryService(client);
    const result = await svc.getActiveRecovery(ACCOUNT);

    expect(result.isActive).toBe(false);
    expect(result.approvalCount).toBe(0);
  });

  it("getGuardianCount returns the guardian count as a number", async () => {
    const client = mockReadClient((functionName) => {
      if (functionName === "guardianCount") return 2;
      throw new Error(`unexpected read: ${functionName}`);
    });

    const svc = new RecoveryService(client);
    expect(await svc.getGuardianCount(ACCOUNT)).toBe(2);
  });

  it("getGuardians reads guardianCount then each guardians(i), dropping zero slots", async () => {
    const client = mockReadClient((functionName, args) => {
      if (functionName === "guardianCount") return 2;
      if (functionName === "guardians") {
        const idx = Number(args?.[0]);
        return idx === 0 ? GUARDIAN_1 : GUARDIAN_2;
      }
      throw new Error(`unexpected read: ${functionName}`);
    });

    const svc = new RecoveryService(client);
    const guardians = await svc.getGuardians(ACCOUNT);
    expect(guardians.map((g) => g.toLowerCase())).toEqual([
      GUARDIAN_1.toLowerCase(),
      GUARDIAN_2.toLowerCase(),
    ]);
  });
});

describe("RecoveryService — buildRemoveGuardianHash (v0.20.0 spec §6.4)", () => {
  // The signed opData changed to abi.encode(nonce, index, guardianToRemove, p256X, p256Y)
  // — bound to the slot index + P-256 key (#120 final-review [HIGH]). Golden vectors below
  // were computed independently from the contract's _guardianOpHash construction.
  const svc = new RecoveryService(noClient);

  it("GUARDIAN_SIG_VERSION is 4 and sentinel is 0x..7026", () => {
    expect(GUARDIAN_SIG_VERSION).toBe(4);
    expect(P256_GUARDIAN_SENTINEL.toLowerCase()).toBe(
      "0x0000000000000000000000000000000000007026"
    );
  });

  it("ECDSA slot (p256 keys default to bytes32(0)) → golden vector", () => {
    const h = svc.buildRemoveGuardianHash({
      account: ACCOUNT,
      chainId: 11155111,
      removalNonce: 0n,
      index: 1,
      guardianToRemove: GUARDIAN_1,
    });
    expect(h).toBe(
      "0x113805cf9aec205556719d6d874fc79f67fdb99c2577fe9dc2ee05eec40afbf2"
    );
  });

  it("P-256 slot (sentinel + nonzero keys) → golden vector", () => {
    const h = svc.buildRemoveGuardianHash({
      account: ACCOUNT,
      chainId: 11155111,
      removalNonce: 5n,
      index: 2,
      guardianToRemove: P256_GUARDIAN_SENTINEL,
      p256X: ("0x" + "11".repeat(32)) as `0x${string}`,
      p256Y: ("0x" + "22".repeat(32)) as `0x${string}`,
    });
    expect(h).toBe(
      "0xfd250bdab328fd0fb127c99b8903c8263576abd90a45d4682853f8f6d4d1f04f"
    );
  });

  it("returns a 32-byte hash and is deterministic", () => {
    const args = { account: ACCOUNT, chainId: 11155111, removalNonce: 3n, index: 0, guardianToRemove: GUARDIAN_2 };
    const a = svc.buildRemoveGuardianHash(args);
    const b = svc.buildRemoveGuardianHash(args);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(a).toBe(b);
  });

  it("binds index, nonce, guardian, account, chainId, and p256 key (no cross-slot replay)", () => {
    const base = { account: ACCOUNT, chainId: 11155111, removalNonce: 0n, index: 0, guardianToRemove: GUARDIAN_1 } as const;
    const h0 = svc.buildRemoveGuardianHash(base);
    expect(svc.buildRemoveGuardianHash({ ...base, index: 1 })).not.toBe(h0);
    expect(svc.buildRemoveGuardianHash({ ...base, removalNonce: 1n })).not.toBe(h0);
    expect(svc.buildRemoveGuardianHash({ ...base, guardianToRemove: GUARDIAN_2 })).not.toBe(h0);
    expect(svc.buildRemoveGuardianHash({ ...base, account: NEW_OWNER })).not.toBe(h0);
    expect(svc.buildRemoveGuardianHash({ ...base, chainId: 1 })).not.toBe(h0);
    expect(svc.buildRemoveGuardianHash({ ...base, p256X: ("0x" + "11".repeat(32)) as `0x${string}` })).not.toBe(h0);
  });
});
