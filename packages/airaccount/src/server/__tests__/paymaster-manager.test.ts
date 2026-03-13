import { PaymasterManager } from "../services/paymaster-manager";
import { MemoryStorage } from "../adapters/memory-storage";
import { SilentLogger } from "../interfaces/logger";
import { EthereumProvider } from "../providers/ethereum-provider";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeEthereumProvider(): EthereumProvider {
  return new EthereumProvider({
    rpcUrl: "http://localhost:8545",
    bundlerRpcUrl: "http://localhost:4337",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0x1111111111111111111111111111111111111111",
        validatorAddress: "0x2222222222222222222222222222222222222222",
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner(PRIVATE_KEY),
    logger: new SilentLogger(),
  });
}

describe("PaymasterManager", () => {
  let pm: PaymasterManager;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    pm = new PaymasterManager(makeEthereumProvider(), storage, new SilentLogger());
  });

  describe("addCustomPaymaster / getAvailablePaymasters", () => {
    it("should return empty list initially", async () => {
      const list = await pm.getAvailablePaymasters("user-1");
      expect(list).toEqual([]);
    });

    it("should add and retrieve a custom paymaster", async () => {
      await pm.addCustomPaymaster(
        "user-1",
        "my-pm",
        "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
        "custom"
      );

      const list = await pm.getAvailablePaymasters("user-1");
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("my-pm");
      expect(list[0].configured).toBe(true);
    });

    it("should mark paymaster with 0x address as not configured", async () => {
      await storage.savePaymaster("user-1", {
        name: "empty",
        address: "0x",
        type: "custom",
      });

      const list = await pm.getAvailablePaymasters("user-1");
      expect(list[0].configured).toBe(false);
    });
  });

  describe("removeCustomPaymaster", () => {
    it("should remove an existing paymaster", async () => {
      await pm.addCustomPaymaster(
        "user-1",
        "to-delete",
        "0x1234567890123456789012345678901234567890"
      );
      const removed = await pm.removeCustomPaymaster("user-1", "to-delete");
      expect(removed).toBe(true);

      const list = await pm.getAvailablePaymasters("user-1");
      expect(list).toHaveLength(0);
    });

    it("should return false for non-existent paymaster", async () => {
      const removed = await pm.removeCustomPaymaster("user-1", "nope");
      expect(removed).toBe(false);
    });
  });

  describe("getPaymasterData", () => {
    it("should return address directly for custom user-provided v0.6 paymaster", async () => {
      const addr = "0x1234567890AbcDeF1234567890abcDEf12345678";
      const v06EntryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

      const data = await pm.getPaymasterData(
        "user-1",
        "custom-user-provided",
        {},
        v06EntryPoint,
        addr
      );

      expect(data.toLowerCase()).toBe(addr.toLowerCase());
    });

    it("should return packed data for custom user-provided v0.7 paymaster", async () => {
      const addr = "0x1234567890AbcDeF1234567890abcDEf12345678";
      const v07EntryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

      const data = await pm.getPaymasterData(
        "user-1",
        "custom-user-provided",
        {},
        v07EntryPoint,
        addr
      );

      // Should start with the paymaster address (lowercase)
      expect(data.slice(0, 42).toLowerCase()).toBe(addr.toLowerCase());
      // Should be longer than just the address (includes gas limits)
      expect(data.length).toBeGreaterThan(42);
    });

    it("should throw for invalid address format", async () => {
      await expect(
        pm.getPaymasterData("user-1", "custom-user-provided", {}, "0x1234", "not-an-address")
      ).rejects.toThrow("Invalid paymaster address format");
    });

    it("should throw for unknown paymaster name", async () => {
      await expect(pm.getPaymasterData("user-1", "unknown-pm", {}, "0x1234")).rejects.toThrow(
        "Paymaster unknown-pm not found"
      );
    });

    it("should return address for stored custom type", async () => {
      const addr = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
      await pm.addCustomPaymaster("user-1", "my-custom", addr, "custom");

      const data = await pm.getPaymasterData(
        "user-1",
        "my-custom",
        {},
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
      );
      expect(data).toBe(addr);
    });

    it("should return 0x for pimlico type without API key", async () => {
      await storage.savePaymaster("user-1", {
        name: "no-key",
        address: "0x1234567890123456789012345678901234567890",
        type: "pimlico",
        // no apiKey
      });

      const data = await pm.getPaymasterData(
        "user-1",
        "no-key",
        {},
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
      );
      expect(data).toBe("0x");
    });

    it("should return 0x for stackup type without API key", async () => {
      await storage.savePaymaster("user-1", {
        name: "no-key-su",
        address: "0x1234567890123456789012345678901234567890",
        type: "stackup",
      });

      const data = await pm.getPaymasterData(
        "user-1",
        "no-key-su",
        {},
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
      );
      expect(data).toBe("0x");
    });

    it("should return 0x for alchemy type without API key", async () => {
      await storage.savePaymaster("user-1", {
        name: "no-key-alch",
        address: "0x1234567890123456789012345678901234567890",
        type: "alchemy",
      });

      const data = await pm.getPaymasterData(
        "user-1",
        "no-key-alch",
        {},
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
      );
      expect(data).toBe("0x");
    });
  });
});
