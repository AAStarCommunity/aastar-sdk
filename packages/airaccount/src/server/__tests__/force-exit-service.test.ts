import { describe, it, expect, vi, beforeEach } from "vitest";
import { ethers } from "ethers";
import { ForceExitService, L2_TYPE } from "../services/force-exit-service";

const MODULE_ADDR = "0xdb396ca2dc279f9bcb95fa3d8275f77c9f0c8702";
const ACCOUNT     = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TARGET      = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GUARDIAN_1  = "0xcccccccccccccccccccccccccccccccccccccccc";
const GUARDIAN_2  = "0xdddddddddddddddddddddddddddddddddddddddd";
const GUARDIAN_3  = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

describe("ForceExitService — calldata encoders", () => {
  let svc: ForceExitService;

  beforeEach(() => {
    svc = new ForceExitService(MODULE_ADDR, ethers.getDefaultProvider());
  });

  describe("encodeOnInstall", () => {
    it("encodes L2_TYPE.OPTIMISM (1) as ABI-encoded uint8", () => {
      const cd = svc.encodeOnInstall(L2_TYPE.OPTIMISM);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
      // onInstall(bytes) — first 4 bytes are selector
      expect(cd.length).toBeGreaterThan(10);
    });

    it("encodes L2_TYPE.ARBITRUM (2) differently than OPTIMISM", () => {
      const op = svc.encodeOnInstall(L2_TYPE.OPTIMISM);
      const arb = svc.encodeOnInstall(L2_TYPE.ARBITRUM);
      expect(op).not.toBe(arb);
    });

    it("OPTIMISM value is 1", () => {
      expect(L2_TYPE.OPTIMISM).toBe(1);
    });

    it("ARBITRUM value is 2", () => {
      expect(L2_TYPE.ARBITRUM).toBe(2);
    });
  });

  describe("encodeProposeForceExit", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeProposeForceExit(TARGET, 0n, "0x");
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different target → different calldata, same selector", () => {
      const cd1 = svc.encodeProposeForceExit(TARGET, 0n, "0x");
      const cd2 = svc.encodeProposeForceExit(ACCOUNT, 0n, "0x");
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("non-zero value encoded in calldata", () => {
      const cd1 = svc.encodeProposeForceExit(TARGET, 0n, "0x");
      const cd2 = svc.encodeProposeForceExit(TARGET, 1_000_000n, "0x");
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeApproveForceExit", () => {
    const dummySig = "0x" + "ab".repeat(65);

    it("produces valid hex calldata", () => {
      const cd = svc.encodeApproveForceExit(ACCOUNT, dummySig);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different account → different calldata", () => {
      const cd1 = svc.encodeApproveForceExit(ACCOUNT, dummySig);
      const cd2 = svc.encodeApproveForceExit(TARGET, dummySig);
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeExecuteForceExit", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeExecuteForceExit(ACCOUNT);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });
  });

  describe("encodeCancelForceExit", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeCancelForceExit(ACCOUNT);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("different selector from execute", () => {
      const exec = svc.encodeExecuteForceExit(ACCOUNT);
      const cancel = svc.encodeCancelForceExit(ACCOUNT);
      expect(exec.slice(0, 10)).not.toBe(cancel.slice(0, 10));
    });
  });

  describe("on-chain read mocks — getPendingExit", () => {
    it("returns typed PendingExit from contract result", async () => {
      const mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111n }),
        call: vi.fn().mockResolvedValue(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "uint256", "bytes", "uint256", "uint256", "address[3]"],
            [
              TARGET,
              1_000_000n,
              "0x1234",
              1717200000n,
              3n,
              [GUARDIAN_1, GUARDIAN_2, GUARDIAN_3],
            ]
          )
        ),
      } as unknown as ethers.Provider;

      const svcWithProvider = new ForceExitService(MODULE_ADDR, mockProvider);
      const result = await svcWithProvider.getPendingExit(ACCOUNT);

      expect(result.target.toLowerCase()).toBe(TARGET.toLowerCase());
      expect(result.value).toBe(1_000_000n);
      expect(result.proposedAt).toBe(1717200000n);
      expect(result.approvalBitmap).toBe(3n);
      expect(result.guardians[0].toLowerCase()).toBe(GUARDIAN_1.toLowerCase());
    });
  });
});
