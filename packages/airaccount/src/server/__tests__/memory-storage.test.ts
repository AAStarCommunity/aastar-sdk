import { MemoryStorage } from "../adapters/memory-storage";
import { AccountRecord, TransferRecord, PaymasterRecord } from "../interfaces/storage-adapter";

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    userId: "user-1",
    address: "0xaaaa",
    signerAddress: "0xbbbb",
    salt: 123,
    deployed: false,
    deploymentTxHash: null,
    validatorAddress: "0xcccc",
    entryPointVersion: "0.6",
    factoryAddress: "0xdddd",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<TransferRecord> = {}): TransferRecord {
  return {
    id: "tx-1",
    userId: "user-1",
    from: "0xaaaa",
    to: "0xeeee",
    amount: "0.01",
    userOpHash: "0xhash1",
    status: "pending",
    nodeIndices: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  // ── Accounts ────────────────────────────────────────────────

  describe("accounts", () => {
    it("should start with empty accounts", async () => {
      expect(await storage.getAccounts()).toEqual([]);
    });

    it("should save and retrieve accounts", async () => {
      const account = makeAccount();
      await storage.saveAccount(account);

      const accounts = await storage.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].userId).toBe("user-1");
    });

    it("should find account by userId", async () => {
      await storage.saveAccount(makeAccount({ userId: "user-1" }));
      await storage.saveAccount(makeAccount({ userId: "user-2", address: "0xffff" }));

      const found = await storage.findAccountByUserId("user-2");
      expect(found).not.toBeNull();
      expect(found!.address).toBe("0xffff");
    });

    it("should return null for non-existent userId", async () => {
      const found = await storage.findAccountByUserId("no-such-user");
      expect(found).toBeNull();
    });

    it("should update account fields", async () => {
      await storage.saveAccount(makeAccount({ userId: "user-1", deployed: false }));
      await storage.updateAccount("user-1", { deployed: true, deploymentTxHash: "0xtx" });

      const updated = await storage.findAccountByUserId("user-1");
      expect(updated!.deployed).toBe(true);
      expect(updated!.deploymentTxHash).toBe("0xtx");
    });

    it("should not mutate the original object on save", async () => {
      const account = makeAccount();
      await storage.saveAccount(account);
      account.deployed = true;

      const stored = await storage.findAccountByUserId("user-1");
      expect(stored!.deployed).toBe(false);
    });
  });

  // ── Transfers ───────────────────────────────────────────────

  describe("transfers", () => {
    it("should save and find transfers by userId", async () => {
      await storage.saveTransfer(makeTransfer({ id: "tx-1", userId: "user-1" }));
      await storage.saveTransfer(makeTransfer({ id: "tx-2", userId: "user-2" }));
      await storage.saveTransfer(makeTransfer({ id: "tx-3", userId: "user-1" }));

      const user1Transfers = await storage.findTransfersByUserId("user-1");
      expect(user1Transfers).toHaveLength(2);
    });

    it("should find transfer by id", async () => {
      await storage.saveTransfer(makeTransfer({ id: "tx-42" }));

      const found = await storage.findTransferById("tx-42");
      expect(found).not.toBeNull();
      expect(found!.id).toBe("tx-42");
    });

    it("should return null for non-existent transfer id", async () => {
      const found = await storage.findTransferById("non-existent");
      expect(found).toBeNull();
    });

    it("should update transfer status", async () => {
      await storage.saveTransfer(makeTransfer({ id: "tx-1", status: "pending" }));
      await storage.updateTransfer("tx-1", {
        status: "completed",
        transactionHash: "0xtxhash",
      });

      const updated = await storage.findTransferById("tx-1");
      expect(updated!.status).toBe("completed");
      expect(updated!.transactionHash).toBe("0xtxhash");
    });

    it("should return empty array for user with no transfers", async () => {
      const transfers = await storage.findTransfersByUserId("ghost");
      expect(transfers).toEqual([]);
    });
  });

  // ── Paymasters ──────────────────────────────────────────────

  describe("paymasters", () => {
    it("should start with no paymasters for a user", async () => {
      const paymasters = await storage.getPaymasters("user-1");
      expect(paymasters).toEqual([]);
    });

    it("should save and retrieve paymasters per user", async () => {
      const pm: PaymasterRecord = {
        name: "my-pm",
        address: "0x1111",
        type: "custom",
      };
      await storage.savePaymaster("user-1", pm);

      const list = await storage.getPaymasters("user-1");
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("my-pm");

      // Other user should not see it
      const otherList = await storage.getPaymasters("user-2");
      expect(otherList).toEqual([]);
    });

    it("should replace paymaster with same name", async () => {
      await storage.savePaymaster("user-1", {
        name: "pm-a",
        address: "0x1111",
        type: "custom",
      });
      await storage.savePaymaster("user-1", {
        name: "pm-a",
        address: "0x2222",
        type: "pimlico",
        apiKey: "key123",
      });

      const list = await storage.getPaymasters("user-1");
      expect(list).toHaveLength(1);
      expect(list[0].address).toBe("0x2222");
      expect(list[0].type).toBe("pimlico");
    });

    it("should add multiple paymasters with different names", async () => {
      await storage.savePaymaster("user-1", { name: "a", address: "0x1", type: "custom" });
      await storage.savePaymaster("user-1", { name: "b", address: "0x2", type: "custom" });

      const list = await storage.getPaymasters("user-1");
      expect(list).toHaveLength(2);
    });

    it("should remove paymaster by name", async () => {
      await storage.savePaymaster("user-1", { name: "del-me", address: "0x1", type: "custom" });
      await storage.savePaymaster("user-1", { name: "keep-me", address: "0x2", type: "custom" });

      const removed = await storage.removePaymaster("user-1", "del-me");
      expect(removed).toBe(true);

      const list = await storage.getPaymasters("user-1");
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("keep-me");
    });

    it("should return false when removing non-existent paymaster", async () => {
      const removed = await storage.removePaymaster("user-1", "nothing");
      expect(removed).toBe(false);
    });
  });

  // ── BLS Config ──────────────────────────────────────────────

  describe("bls config", () => {
    it("should start with null bls config", async () => {
      const config = await storage.getBlsConfig();
      expect(config).toBeNull();
    });

    it("should update signer nodes cache", async () => {
      const nodes = [
        { nodeId: "n1", nodeName: "Node 1", apiEndpoint: "http://node1", status: "active" },
      ];
      await storage.updateSignerNodesCache(nodes);

      const config = await storage.getBlsConfig();
      expect(config).not.toBeNull();
      expect(config!.signerNodes).toBeDefined();
    });
  });
});
