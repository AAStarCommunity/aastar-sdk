import { MemoryStorage } from "../adapters/memory-storage";
import { TransferRecord } from "../interfaces/storage-adapter";
import { TransferManager } from "../services/transfer-manager";
import { SilentLogger } from "../interfaces/logger";

/**
 * TransferManager tests — focused on the pure-logic methods
 * (getTransferStatus, getTransferHistory) that don't need RPC.
 * The full executeTransfer flow requires real chain interaction
 * and is better tested as an integration test.
 */
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
});
