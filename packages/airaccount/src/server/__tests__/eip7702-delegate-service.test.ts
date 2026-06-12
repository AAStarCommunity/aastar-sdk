import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  EIP7702DelegateService,
  AIR_ACCOUNT_DELEGATE_ADDRESS,
} from "../services/eip7702-delegate-service";

const EOA          = "0x1111111111111111111111111111111111111111";
const GUARDIAN_1   = "0x2222222222222222222222222222222222222222";
const GUARDIAN_2   = "0x3333333333333333333333333333333333333333";
const DAILY_LIMIT  = ethers.parseEther("1");
const DUMMY_SIG    = "0x" + "ab".repeat(65);

describe("EIP7702DelegateService", () => {
  let svc: EIP7702DelegateService;

  beforeEach(() => {
    svc = new EIP7702DelegateService();
  });

  it("default delegate address is the Sepolia singleton", () => {
    expect(AIR_ACCOUNT_DELEGATE_ADDRESS.toLowerCase()).toBe(
      "0x8603aaf6c3f07fdae810b323c95a198d796ec52e"
    );
  });

  describe("encodeInitialize", () => {
    it("produces valid hex calldata", () => {
      const cd = svc.encodeInitialize({
        guardian1: GUARDIAN_1,
        guardian1Sig: DUMMY_SIG,
        guardian2: GUARDIAN_2,
        guardian2Sig: DUMMY_SIG,
        dailyLimit: DAILY_LIMIT,
      });
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
      expect(cd.length).toBeGreaterThan(10);
    });

    it("different guardians → different calldata, same selector", () => {
      const cd1 = svc.encodeInitialize({
        guardian1: GUARDIAN_1, guardian1Sig: DUMMY_SIG,
        guardian2: GUARDIAN_2, guardian2Sig: DUMMY_SIG,
        dailyLimit: DAILY_LIMIT,
      });
      const cd2 = svc.encodeInitialize({
        guardian1: "0x4444444444444444444444444444444444444444", guardian1Sig: DUMMY_SIG,
        guardian2: GUARDIAN_2, guardian2Sig: DUMMY_SIG,
        dailyLimit: DAILY_LIMIT,
      });
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
      expect(cd1).not.toBe(cd2);
    });

    it("different dailyLimit → different calldata", () => {
      const cd1 = svc.encodeInitialize({
        guardian1: GUARDIAN_1, guardian1Sig: DUMMY_SIG,
        guardian2: GUARDIAN_2, guardian2Sig: DUMMY_SIG,
        dailyLimit: DAILY_LIMIT,
      });
      const cd2 = svc.encodeInitialize({
        guardian1: GUARDIAN_1, guardian1Sig: DUMMY_SIG,
        guardian2: GUARDIAN_2, guardian2Sig: DUMMY_SIG,
        dailyLimit: ethers.parseEther("0.5"),
      });
      expect(cd1).not.toBe(cd2);
    });
  });

  describe("encodeExecute / encodeExecuteBatch", () => {
    it("encodeExecute produces valid calldata", () => {
      const cd = svc.encodeExecute(EOA, 0n, "0x");
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("encodeExecuteBatch produces valid calldata", () => {
      const cd = svc.encodeExecuteBatch([EOA, GUARDIAN_1], [0n, 0n], ["0x", "0x"]);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("execute and executeBatch have different selectors", () => {
      const exec = svc.encodeExecute(EOA, 0n, "0x");
      const batch = svc.encodeExecuteBatch([EOA], [0n], ["0x"]);
      expect(exec.slice(0, 10)).not.toBe(batch.slice(0, 10));
    });
  });

  describe("buildAuthorizationHash", () => {
    it("returns a 32-byte (66 char) 0x-prefixed hex hash", () => {
      const hash = svc.buildAuthorizationHash(11155111, 0n);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it("different chainId → different hash", () => {
      const h1 = svc.buildAuthorizationHash(11155111, 0n);
      const h2 = svc.buildAuthorizationHash(1, 0n);
      expect(h1).not.toBe(h2);
    });

    it("different nonce → different hash", () => {
      const h1 = svc.buildAuthorizationHash(11155111, 0n);
      const h2 = svc.buildAuthorizationHash(11155111, 1n);
      expect(h1).not.toBe(h2);
    });

    it("same inputs → same hash (deterministic)", () => {
      const h1 = svc.buildAuthorizationHash(11155111, 5n);
      const h2 = svc.buildAuthorizationHash(11155111, 5n);
      expect(h1).toBe(h2);
    });
  });

  describe("buildAuthorization", () => {
    it("returns object with correct shape", () => {
      const auth = svc.buildAuthorization(11155111, 3n, DUMMY_SIG);
      expect(auth.chainId).toBe(11155111);
      expect(auth.nonce).toBe(3n);
      expect(auth.signature).toBe(DUMMY_SIG);
      expect(auth.address.toLowerCase()).toBe(AIR_ACCOUNT_DELEGATE_ADDRESS.toLowerCase());
    });
  });

  describe("verifyAuthorization", () => {
    it("returns true for a valid signature from the EOA", () => {
      // Use a real wallet to produce a valid signature
      const wallet = ethers.Wallet.createRandom();
      const svcLocal = new EIP7702DelegateService();
      const hash = svcLocal.buildAuthorizationHash(11155111, 0n);
      const sig = wallet.signingKey.sign(hash);
      const compact = ethers.Signature.from(sig).serialized;
      expect(svcLocal.verifyAuthorization(wallet.address, 11155111, 0n, compact)).toBe(true);
    });

    it("returns false for wrong EOA address", () => {
      const wallet = ethers.Wallet.createRandom();
      const svcLocal = new EIP7702DelegateService();
      const hash = svcLocal.buildAuthorizationHash(11155111, 0n);
      const sig = wallet.signingKey.sign(hash);
      const compact = ethers.Signature.from(sig).serialized;
      // Different address → mismatch
      expect(svcLocal.verifyAuthorization(GUARDIAN_1, 11155111, 0n, compact)).toBe(false);
    });
  });
});
