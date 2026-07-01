import { describe, it, expect, beforeEach, vi } from "vitest";
import { zeroAddress, bytesToHex, sha256, concat, hexToBytes, stringToBytes, type Hex, type PublicClient } from "viem";
import { p256 } from "@noble/curves/nist.js";
import { MemoryStorage } from "../adapters/memory-storage";
import { TransferRecord } from "../interfaces/storage-adapter";
import { TransferManager, detectSignatureStrategy } from "../services/transfer-manager";
import { SilentLogger } from "../interfaces/logger";
import { EntryPointVersion } from "../constants/entrypoint";

/**
 * TransferManager tests — focused on the pure-logic methods
 * (getTransferStatus, getTransferHistory) that don't need RPC.
 * The full executeTransfer flow requires real chain interaction
 * and is better tested as an integration test.
 */

/** A synthetic device-passkey WebAuthn assertion (software P-256) whose challenge == userOpHash. */
function makeDeviceAssertion(userOpHash: Hex) {
  const b64 = (bytes: Uint8Array) => {
    let bin = ""; for (const c of bytes) bin += String.fromCharCode(c);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const clientDataJSON = '{"type":"webauthn.get","challenge":"' + b64(hexToBytes(userOpHash)) + '","origin":"https://app"}';
  const authenticatorData = hexToBytes(("0x" + "ab".repeat(32) + "05" + "00000001") as Hex);
  const payloadHash = sha256(concat([bytesToHex(authenticatorData), sha256(stringToBytes(clientDataJSON))]));
  const der = p256.sign(hexToBytes(payloadHash), hexToBytes(("0x" + "11".repeat(32)) as Hex), { lowS: true, prehash: false, format: "der" });
  return { authenticatorData, clientDataJSON, signature: der };
}

describe("TransferManager", () => {
  let storage: MemoryStorage;

  // We create a minimal TransferManager by only testing methods
  // that rely on storage, not the full dependency chain.
  // For getTransferStatus / getTransferHistory we only need storage access.

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  // Helper to create a TransferManager with all mock deps
  function makeManager(): TransferManager {
    return new TransferManager(
      {} as any, // ethereum
      {} as any, // accountManager
      {} as any, // blsService
      {} as any, // paymasterManager
      {} as any, // tokenService
      storage,
      {} as any, // signer
      new SilentLogger()
    );
  }

  describe("getTransferStatus", () => {
    it("should return transfer status with description", async () => {
      const transfer: TransferRecord = {
        id: "tx-1",
        userId: "user-1",
        from: "0xaaaa",
        to: "0xbbbb",
        amount: "0.01",
        userOpHash: "0xhash",
        status: "completed",
        nodeIndices: [],
        createdAt: new Date().toISOString(),
        transactionHash: "0xtxhash123",
      };
      await storage.saveTransfer(transfer);

      const manager = makeManager();
      const result = await manager.getTransferStatus("user-1", "tx-1");

      expect(result.status).toBe("completed");
      expect(result.statusDescription).toBe("Transaction confirmed on chain");
      expect(result.explorerUrl).toContain("0xtxhash123");
    });

    it("should include elapsed time for pending transfers", async () => {
      const createdAt = new Date(Date.now() - 10000).toISOString(); // 10s ago
      await storage.saveTransfer({
        id: "tx-2",
        userId: "user-1",
        from: "0xaaaa",
        to: "0xbbbb",
        amount: "0.01",
        userOpHash: "0xhash2",
        status: "pending",
        nodeIndices: [],
        createdAt,
      });

      const manager = makeManager();
      const result = await manager.getTransferStatus("user-1", "tx-2");

      expect(result.elapsedSeconds).toBeGreaterThanOrEqual(9);
      expect(result.statusDescription).toBe("Preparing transaction and generating signatures");
    });

    it("should throw for non-existent transfer", async () => {
      const manager = makeManager();
      await expect(manager.getTransferStatus("user-1", "non-existent")).rejects.toThrow(
        "Transfer not found"
      );
    });

    it("should throw when userId does not match", async () => {
      await storage.saveTransfer({
        id: "tx-3",
        userId: "user-1",
        from: "0xaaaa",
        to: "0xbbbb",
        amount: "0.01",
        userOpHash: "0xhash",
        status: "pending",
        nodeIndices: [],
        createdAt: new Date().toISOString(),
      });

      const manager = makeManager();
      await expect(
        manager.getTransferStatus("user-2", "tx-3") // wrong user
      ).rejects.toThrow("Transfer not found");
    });

    it("should show failed status description", async () => {
      await storage.saveTransfer({
        id: "tx-4",
        userId: "user-1",
        from: "0xaaaa",
        to: "0xbbbb",
        amount: "0.01",
        userOpHash: "0xhash",
        status: "failed",
        error: "something went wrong",
        nodeIndices: [],
        createdAt: new Date().toISOString(),
      });

      const manager = makeManager();
      const result = await manager.getTransferStatus("user-1", "tx-4");
      expect(result.statusDescription).toBe("Transaction failed");
    });
  });

  describe("submitPreparedTransfer Tier-3 guardian fail-fast (#176 phase 2)", () => {
    function seedPrepared(mgr: TransferManager, tier: number) {
      (mgr as any).prepared.set("t1", {
        userId: "u1", userOp: {}, userOpHash: "0xhash", version: "0.7",
        accountAddress: "0xacc", params: {}, ownerMessageHex: "0x", createdAt: Date.now(),
      });
      vi.spyOn(mgr as any, "resolveSignStrategy").mockResolvedValue({ useECDSA: false, isCompositeValidator: true, tier });
      vi.spyOn(mgr as any, "ownerMessageForStrategy").mockResolvedValue(new Uint8Array()); // bytesToHex → "0x", matches
    }

    it("throws (no gas) when Tier 3 and no guardianSigner is supplied", async () => {
      const mgr = makeManager();
      seedPrepared(mgr, 3);
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1", webAuthnAssertion: {} as any })
      ).rejects.toThrow(/Tier-3.*guardian/);
    });

    it("does NOT block a Tier-2 transfer for a missing guardian", async () => {
      const mgr = makeManager();
      seedPrepared(mgr, 2);
      // applySignature will fail later (mock deps), but NOT with the Tier-3 guardian fail-fast.
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1", webAuthnAssertion: {} as any })
      ).rejects.not.toThrow(/Tier-3.*guardian/);
    });

    it("throws (no gas) when Tier 2 and no p256Signature is supplied (#234)", async () => {
      const mgr = makeManager();
      seedPrepared(mgr, 2);
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1", webAuthnAssertion: {} as any })
      ).rejects.toThrow(/device-passkey P256/);
    });

    it("rejects a malformed p256Signature WITHOUT consuming the prepared transfer (#236 review)", async () => {
      const mgr = makeManager();
      seedPrepared(mgr, 2);
      await expect(
        mgr.submitPreparedTransfer("u1", {
          transferId: "t1",
          webAuthnAssertion: {} as any,
          p256Signature: "0xdeadbeef", // non-empty but not 64 bytes
        })
      ).rejects.toThrow(/must be 64-byte hex/);
      // The one-time prepared transfer must survive a format error so the caller can resubmit.
      expect((mgr as any).prepared.has("t1")).toBe(true);
    });

    it("accepts p256Signature at submit (does not throw the P256 fail-fast) for Tier 2/3 (#234)", async () => {
      const mgr = makeManager();
      seedPrepared(mgr, 3);
      // Both factors supplied at submit time — the fail-fasts pass; it fails later on mock deps only.
      await expect(
        mgr.submitPreparedTransfer("u1", {
          transferId: "t1",
          webAuthnAssertion: {} as any,
          guardianSigner: { signMessage: async () => "0x" } as any,
          p256Signature: "0x" + "ab".repeat(64),
        })
      ).rejects.not.toThrow(/device-passkey P256|Tier-3.*guardian/);
    });
  });

  describe("submitPreparedTransfer WebAuthn passkey path (#234 wrap)", () => {
    function seedWA(mgr: TransferManager, tier: number) {
      const validHash = "0x" + "11".repeat(32); // buildDvtRequest hexToBytes(userOpHash) needs valid hex
      const z32 = "0x" + "00".repeat(32);
      (mgr as any).prepared.set("t1", {
        // A v0.7 PACKED userOp (buildDvtRequest #257 requires accountGasLimits/gasFees present).
        userId: "u1",
        userOp: { sender: "0xacc", nonce: 0n, initCode: "0x", callData: "0x", accountGasLimits: z32, preVerificationGas: 0n, gasFees: z32, paymasterAndData: "0x", signature: "0x" },
        userOpHash: validHash, version: "0.7",
        accountAddress: "0xacc", params: { useWebAuthnPasskey: true }, ownerMessageHex: validHash, createdAt: Date.now(),
      });
      vi.spyOn(mgr as any, "resolveSignStrategy").mockResolvedValue({ useECDSA: false, isCompositeValidator: true, tier });
    }
    const ASSERTION = { authenticatorData: "0x00", clientDataJSON: "0x00", signature: "0x00" } as any;

    it("throws (no gas) when deviceWebAuthn is missing", async () => {
      const mgr = makeManager();
      seedWA(mgr, 2);
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1" })
      ).rejects.toThrow(/deviceWebAuthn/);
    });

    it("throws (no gas) when Tier 3 and no guardianSigner", async () => {
      const mgr = makeManager();
      seedWA(mgr, 3);
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1", deviceWebAuthn: ASSERTION })
      ).rejects.toThrow(/Tier-3.*guardian/);
    });

    it("does NOT require webAuthnAssertion on the WebAuthn path (passes the fail-fasts)", async () => {
      const mgr = makeManager();
      seedWA(mgr, 3);
      // No webAuthnAssertion supplied — the WA path must not demand it; it fails later on the mock blsService.
      await expect(
        mgr.submitPreparedTransfer("u1", {
          transferId: "t1",
          deviceWebAuthn: ASSERTION,
          guardianSigner: { signMessage: async () => "0x" } as any,
        })
      ).rejects.not.toThrow(/deviceWebAuthn|Tier-3.*guardian|webAuthnAssertion is required/);
    });

    it("preserves the prepared entry when async signing fails (DVT down) — resubmittable (#240 review)", async () => {
      const mgr = makeManager();
      seedWA(mgr, 2);
      // Simulate an async signing failure AFTER the synchronous fail-fasts (e.g. DVT unreachable).
      // buildDvtRequest (owner-auth for the DVT, #257) runs first — give it a working signer so the
      // failure comes from the DVT round-trip, matching the scenario.
      (mgr as any).signer = { signMessage: async () => ("0x" + "ab".repeat(65)) };
      (mgr as any).blsService = {
        generateWebAuthnTieredSignature: async () => {
          throw new Error("No active BLS signer nodes available");
        },
      };
      // #261: buildDvtRequest now packs the device assertion into a tag-0x02 ownerAuth, so it must be a
      // VALID assertion over the prepared userOpHash (0x11..) — else it fails there, not at the BLS mock.
      await expect(
        mgr.submitPreparedTransfer("u1", { transferId: "t1", deviceWebAuthn: makeDeviceAssertion("0x" + "11".repeat(32)) })
      ).rejects.toThrow(/BLS signer nodes/);
      // The one-time prepared transfer must SURVIVE an async failure so the caller can resubmit
      // without re-running prepareTransfer + a fresh WebAuthn ceremony.
      expect((mgr as any).prepared.has("t1")).toBe(true);
    });
  });

  describe("detectSignatureStrategy", () => {
    const ACCOUNT = "0x1234567890123456789012345678901234567890";

    // detectSignatureStrategy now takes a viem PublicClient: getCode({address})
    // returns the bytecode (Hex | undefined) and readContract({...}) returns the
    // already-decoded validator() address.
    function makeProvider(opts: {
      code: string;
      validatorResult?: string;
      validatorThrows?: boolean;
    }): PublicClient {
      return {
        getCode: vi.fn().mockResolvedValue(opts.code),
        readContract: vi.fn().mockImplementation(async () => {
          if (opts.validatorThrows) throw new Error("revert");
          return opts.validatorResult ?? zeroAddress;
        }),
      } as unknown as PublicClient;
    }

    it("undeployed account → useECDSA=true, isCompositeValidator=true", async () => {
      const provider = makeProvider({ code: "0x" });
      const result = await detectSignatureStrategy(provider, ACCOUNT);
      expect(result.useECDSA).toBe(true);
      expect(result.isCompositeValidator).toBe(true);
    });

    it("deployed compositeValidator with no validator set → useECDSA=true, isCompositeValidator=true", async () => {
      const provider = makeProvider({
        code: "0x608060",
        validatorResult: zeroAddress,
      });
      const result = await detectSignatureStrategy(provider, ACCOUNT);
      expect(result.useECDSA).toBe(true);
      expect(result.isCompositeValidator).toBe(true);
    });

    it("deployed compositeValidator with validator set → useECDSA=false, isCompositeValidator=true", async () => {
      const validatorAddr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
      const provider = makeProvider({
        code: "0x608060",
        validatorResult: validatorAddr,
      });
      const result = await detectSignatureStrategy(provider, ACCOUNT);
      expect(result.useECDSA).toBe(false);
      expect(result.isCompositeValidator).toBe(true);
    });

    it("validator() call throws → useECDSA=true, isCompositeValidator=false (no algId prefix)", async () => {
      const provider = makeProvider({ code: "0x608060", validatorThrows: true });
      const result = await detectSignatureStrategy(provider, ACCOUNT);
      expect(result.useECDSA).toBe(true);
      expect(result.isCompositeValidator).toBe(false);
    });
  });

  describe("resolveSignStrategy — tiering precedence over the ECDSA heuristic (#234)", () => {
    // A weighted/composite AirAccount can report validator()==address(0) yet still require a tiered
    // composite signature. detectSignatureStrategy returns useECDSA=true for that account; the bug
    // was that tier resolution was gated on !useECDSA, so tier-2/3 ops silently fell back to a single
    // inline-ECDSA (0x02) signature → on-chain AA24.
    function makeManagerWith(opts: {
      validatorResult?: string;
      tier?: number;
      withGuardChecker?: boolean;
    }): TransferManager {
      const provider = {
        getCode: vi.fn().mockResolvedValue("0x608060"), // deployed
        readContract: vi.fn().mockResolvedValue(opts.validatorResult ?? zeroAddress),
      } as unknown as PublicClient;
      const ethereum = { getProvider: () => provider } as any;
      const guardChecker = opts.withGuardChecker
        ? ({ preCheck: vi.fn().mockResolvedValue({ ok: true, tier: opts.tier ?? 3, errors: [] }) } as any)
        : undefined;
      return new TransferManager(
        ethereum,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        storage,
        {} as any,
        new SilentLogger(),
        guardChecker
      );
    }

    const PARAMS = (extra: object = {}) => ({ to: "0xbbbb", amount: "0.051", useAirAccountTiering: true, ...extra });

    it("validator()==0 + useAirAccountTiering: tiering wins (useECDSA forced false, tier resolved)", async () => {
      const mgr = makeManagerWith({ validatorResult: zeroAddress, tier: 3, withGuardChecker: true });
      const strat = await (mgr as any).resolveSignStrategy("0xacc", EntryPointVersion.V0_7, PARAMS());
      // Pre-fix this returned { useECDSA: true, tier: null } → silent 0x02+ECDSA for a tier-3 op.
      expect(strat.useECDSA).toBe(false);
      expect(strat.tier).toBe(3);
    });

    it("does NOT silently ignore useAirAccountTiering when no guardChecker is configured", async () => {
      const mgr = makeManagerWith({ validatorResult: zeroAddress, withGuardChecker: false });
      await expect(
        (mgr as any).resolveSignStrategy("0xacc", EntryPointVersion.V0_7, PARAMS())
      ).rejects.toThrow(/useAirAccountTiering.*no TierGuardChecker/);
    });

    it("non-tiering caller on a validator()==0 account still uses ECDSA (unchanged)", async () => {
      const mgr = makeManagerWith({ validatorResult: zeroAddress, withGuardChecker: true });
      const strat = await (mgr as any).resolveSignStrategy("0xacc", EntryPointVersion.V0_7, {
        to: "0xbbbb",
        amount: "0.051",
        // useAirAccountTiering omitted
      });
      expect(strat.useECDSA).toBe(true);
      expect(strat.tier).toBeNull();
    });
  });

  describe("getTransferHistory", () => {
    it("should return empty result for user with no transfers", async () => {
      const manager = makeManager();
      const result = await manager.getTransferHistory("user-1");

      expect(result.transfers).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("should return transfers sorted by date descending", async () => {
      await storage.saveTransfer({
        id: "tx-old",
        userId: "user-1",
        from: "0xa",
        to: "0xb",
        amount: "0.01",
        userOpHash: "0x1",
        status: "completed",
        nodeIndices: [],
        createdAt: "2024-01-01T00:00:00Z",
      });
      await storage.saveTransfer({
        id: "tx-new",
        userId: "user-1",
        from: "0xa",
        to: "0xb",
        amount: "0.02",
        userOpHash: "0x2",
        status: "completed",
        nodeIndices: [],
        createdAt: "2024-06-01T00:00:00Z",
      });

      const manager = makeManager();
      const result = await manager.getTransferHistory("user-1");

      expect(result.transfers).toHaveLength(2);
      expect(result.transfers[0].id).toBe("tx-new");
      expect(result.transfers[1].id).toBe("tx-old");
    });

    it("should paginate results", async () => {
      for (let i = 0; i < 5; i++) {
        await storage.saveTransfer({
          id: `tx-${i}`,
          userId: "user-1",
          from: "0xa",
          to: "0xb",
          amount: "0.01",
          userOpHash: `0x${i}`,
          status: "completed",
          nodeIndices: [],
          createdAt: new Date(2024, i, 1).toISOString(),
        });
      }

      const manager = makeManager();
      const page1 = await manager.getTransferHistory("user-1", 1, 2);
      expect(page1.transfers).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page2 = await manager.getTransferHistory("user-1", 2, 2);
      expect(page2.transfers).toHaveLength(2);

      const page3 = await manager.getTransferHistory("user-1", 3, 2);
      expect(page3.transfers).toHaveLength(1);
    });

    it("should not include transfers from other users", async () => {
      await storage.saveTransfer({
        id: "tx-user1",
        userId: "user-1",
        from: "0xa",
        to: "0xb",
        amount: "0.01",
        userOpHash: "0x1",
        status: "completed",
        nodeIndices: [],
        createdAt: new Date().toISOString(),
      });
      await storage.saveTransfer({
        id: "tx-user2",
        userId: "user-2",
        from: "0xc",
        to: "0xd",
        amount: "0.02",
        userOpHash: "0x2",
        status: "completed",
        nodeIndices: [],
        createdAt: new Date().toISOString(),
      });

      const manager = makeManager();
      const result = await manager.getTransferHistory("user-1");
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].id).toBe("tx-user1");
    });
  });

  describe("applySignature — single-use ceremony assertion (#259)", () => {
    const PACKED = {
      sender: "0xacc", nonce: 0n, initCode: "0x", callData: "0x",
      accountGasLimits: "0x" + "00".repeat(32), preVerificationGas: 0n,
      gasFees: "0x" + "00".repeat(32), paymasterAndData: "0x", signature: "0x",
    };
    const CTX = { webAuthnAssertion: { ChallengeId: "c1", Credential: {} } } as any;
    const HASH = "0x" + "11".repeat(32);

    it("Tier-1 does NOT build a DVT request (no second sign of the one-time assertion)", async () => {
      const mgr = makeManager();
      (mgr as any).signer = { signMessage: vi.fn().mockResolvedValue("0x" + "ab".repeat(65)) };
      (mgr as any).blsService = { generateTieredSignature: vi.fn().mockResolvedValue("0xsig") };
      const buildSpy = vi.spyOn(mgr as any, "buildDvtRequest");

      await (mgr as any).applySignature("u1", { ...PACKED }, HASH, {}, CTX, { useECDSA: false, isCompositeValidator: false, tier: 1 });

      // Tier-1 is a raw owner ECDSA over userOpHash + uses no DVT — building a dvtRequest would spend the
      // single-use ceremony a SECOND time (ownerAuth) and 400 on the spent challenge.
      expect(buildSpy).not.toHaveBeenCalled();
      expect((mgr as any).blsService.generateTieredSignature).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 1, dvtRequest: undefined })
      );
    });

    it("Tier-2/3 builds exactly ONE ceremony sign (ownerAuth); the composite adds no owner sign", async () => {
      const mgr = makeManager();
      const signMessage = vi.fn().mockResolvedValue("0x" + "ab".repeat(65));
      (mgr as any).signer = { signMessage };
      (mgr as any).blsService = { generateTieredSignature: vi.fn().mockResolvedValue("0xsig") };
      const buildSpy = vi.spyOn(mgr as any, "buildDvtRequest");

      await (mgr as any).applySignature("u1", { ...PACKED }, HASH, {}, CTX, { useECDSA: false, isCompositeValidator: true, tier: 2 });

      expect(buildSpy).toHaveBeenCalledTimes(1); // Tier-2/3 DOES need the DVT ownerAuth
      expect(signMessage).toHaveBeenCalledTimes(1); // exactly one ceremony sign (ownerAuth); mocked composite adds none
    });

    it("Tier-2/3 ceremony binds to userOpHash (not messagePointHash) so strict-KMS matches the submit sign (#259 Codex)", async () => {
      const mgr = makeManager();
      // The prepareTransfer ceremony commitment MUST equal what submit signs. For Tier-2/3 the only owner
      // sign is now the DVT ownerAuth over userOpHash (#257) — NOT the messagePoint signature (dropped by
      // #258 M1). Binding to keccak256(messagePoint) would make the strict-KMS challenge mismatch → 400.
      for (const tier of [2, 3]) {
        const msg = await (mgr as any).ownerMessageForStrategy({ useECDSA: false, tier }, HASH);
        expect(bytesToHex(msg as Uint8Array)).toBe(HASH); // raw userOpHash bytes, not messagePointHash
      }
      const ecdsa = await (mgr as any).ownerMessageForStrategy({ useECDSA: true, tier: null }, HASH);
      expect(bytesToHex(ecdsa as Uint8Array)).toBe(HASH);
    });
  });

  describe("buildDvtRequest — tagged ownerAuth (#261)", () => {
    const PACKED = {
      sender: "0xacc", nonce: 0n, initCode: "0x", callData: "0x",
      accountGasLimits: "0x" + "00".repeat(32), preVerificationGas: 0n,
      gasFees: "0x" + "00".repeat(32), paymasterAndData: "0x", signature: "0x",
    };
    const HASH = ("0x" + "cd".repeat(32)) as Hex;

    it("device-passkey → tag 0x02 WebAuthn ownerAuth, and does NOT KMS-sign", async () => {
      const mgr = makeManager();
      const signMessage = vi.fn();
      (mgr as any).signer = { signMessage };
      const req = await (mgr as any).buildDvtRequest("u1", { ...PACKED }, HASH, undefined, makeDeviceAssertion(HASH));
      expect(hexToBytes(req.ownerAuth as Hex)[0]).toBe(0x02); // WEBAUTHN tag
      expect(signMessage).not.toHaveBeenCalled(); // no KMS owner sign on the device-passkey path
    });

    it("ECDSA/KMS (no deviceWebAuthn) → tag 0x01 ‖ personal_sign(userOpHash)", async () => {
      const mgr = makeManager();
      const sig = ("0x" + "ab".repeat(65)) as Hex;
      const signMessage = vi.fn().mockResolvedValue(sig);
      (mgr as any).signer = { signMessage };
      const req = await (mgr as any).buildDvtRequest("u1", { ...PACKED }, HASH, { webAuthnAssertion: {} }, undefined);
      expect(hexToBytes(req.ownerAuth as Hex)[0]).toBe(0x01); // ECDSA tag
      expect(("0x" + (req.ownerAuth as string).slice(4))).toBe(sig); // remainder is exactly the 65-byte sig
      expect(signMessage).toHaveBeenCalledTimes(1);
    });
  });
});
