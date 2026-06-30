import { describe, it, expect, vi } from "vitest";
import { readAccountGuardAddress } from "../providers/typed-reads";

// #254 regression: v0.22.0 accounts REMOVED getConfigDescription() (it reverts), so reading the guard via
// getConfigDescription().guardAddress bricked guard-checker / prepareTransfer for every v0.22.0 account.
// readAccountGuardAddress must read guard() directly (on-chain verified: getConfigDescription reverts,
// guard() returns the AAStarGlobalGuard address).
describe("readAccountGuardAddress (#254 guard-read regression)", () => {
  it("reads guard() and never calls the removed getConfigDescription()", async () => {
    const GUARD = "0x185923fda8728e2b1CF781e78c2Da995A54A8BC0";
    const account = {
      read: {
        guard: vi.fn().mockResolvedValue(GUARD),
        // v0.22.0: getConfigDescription is absent → any call reverts. It must NOT be invoked.
        getConfigDescription: vi.fn().mockRejectedValue(new Error('function "getConfigDescription" reverted')),
      },
    } as never;

    await expect(readAccountGuardAddress(account)).resolves.toBe(GUARD);
    expect((account as { read: { guard: ReturnType<typeof vi.fn> } }).read.guard).toHaveBeenCalledTimes(1);
    expect((account as { read: { getConfigDescription: ReturnType<typeof vi.fn> } }).read.getConfigDescription).not.toHaveBeenCalled();
  });

  it("propagates a zero guard address (no guard enforced)", async () => {
    const ZERO = "0x0000000000000000000000000000000000000000";
    const account = { read: { guard: vi.fn().mockResolvedValue(ZERO) } } as never;
    await expect(readAccountGuardAddress(account)).resolves.toBe(ZERO);
  });
});
