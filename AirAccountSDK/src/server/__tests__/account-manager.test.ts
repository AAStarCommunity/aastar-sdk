import { AccountManager } from "../services/account-manager";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";
import { SilentLogger } from "../interfaces/logger";
import { EntryPointVersion } from "../constants/entrypoint";

// Hardhat account #0 — deterministic private key for tests
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SIGNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ACCOUNT_ADDRESS = "0xDeployedAccountAddress000000000000000001";
const VALIDATOR_ADDRESS = "0xValidatorAddress0000000000000000000000001";
const FACTORY_ADDRESS = "0xFactoryAddress00000000000000000000000001";

/** Build a minimal EthereumProvider mock. */
function makeEthereumMock(overrides: Record<string, jest.Mock> = {}) {
  const mockFactory = {
    "getAddress(address,address,address,bool,uint256)": jest
      .fn()
      .mockResolvedValue(ACCOUNT_ADDRESS),
    target: FACTORY_ADDRESS,
  };

  return {
    getDefaultVersion: jest.fn().mockReturnValue(EntryPointVersion.V0_6),
    getFactoryContract: jest.fn().mockReturnValue(mockFactory),
    getValidatorContract: jest.fn().mockReturnValue({ target: VALIDATOR_ADDRESS }),
    getValidatorAddress: jest.fn().mockReturnValue(VALIDATOR_ADDRESS),
    getFactoryAddress: jest.fn().mockReturnValue(FACTORY_ADDRESS),
    getProvider: jest.fn().mockReturnValue({
      getCode: jest.fn().mockResolvedValue("0x"), // not deployed by default
    }),
    getBalance: jest.fn().mockResolvedValue("1.5"),
    getNonce: jest.fn().mockResolvedValue(3n),
    ...overrides,
  };
}

describe("AccountManager", () => {
  let storage: MemoryStorage;
  let signer: LocalWalletSigner;
  let ethereum: ReturnType<typeof makeEthereumMock>;
  let manager: AccountManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    signer = new LocalWalletSigner(PRIVATE_KEY);
    ethereum = makeEthereumMock();
    manager = new AccountManager(ethereum as any, storage, signer, new SilentLogger());
  });

  // ── createAccount ──────────────────────────────────────────────────

  describe("createAccount", () => {
    it("creates a new account and persists it", async () => {
      const account = await manager.createAccount("user-1", { salt: 42 });

      expect(account.userId).toBe("user-1");
      expect(account.address).toBe(ACCOUNT_ADDRESS);
      expect(account.signerAddress).toBe(SIGNER_ADDRESS);
      expect(account.salt).toBe(42);
      expect(account.deployed).toBe(false);
      expect(account.validatorAddress).toBe(VALIDATOR_ADDRESS);
      expect(account.factoryAddress).toBe(FACTORY_ADDRESS);
      expect(account.entryPointVersion).toBe("0.6");
      expect(account.deploymentTxHash).toBeNull();
      expect(account.createdAt).toBeTruthy();

      const saved = await storage.findAccountByUserId("user-1");
      expect(saved).toMatchObject({ userId: "user-1", address: ACCOUNT_ADDRESS });
    });

    it("returns the existing account without creating a duplicate", async () => {
      const first = await manager.createAccount("user-1");
      const second = await manager.createAccount("user-1");

      expect(second).toEqual(first);
      expect((await storage.getAccounts()).length).toBe(1);
    });

    it("creates separate accounts for different users", async () => {
      await manager.createAccount("user-1");
      await manager.createAccount("user-2");

      expect((await storage.getAccounts()).length).toBe(2);
    });

    it("creates separate accounts for different EntryPoint versions", async () => {
      await manager.createAccount("user-1", { entryPointVersion: EntryPointVersion.V0_6 });
      await manager.createAccount("user-1", { entryPointVersion: EntryPointVersion.V0_7 });

      expect((await storage.getAccounts()).length).toBe(2);
    });

    it("uses the provided EntryPoint version", async () => {
      await manager.createAccount("user-1", { entryPointVersion: EntryPointVersion.V0_7 });
      expect(ethereum.getFactoryContract).toHaveBeenCalledWith(EntryPointVersion.V0_7);
    });

    it("falls back to default version when none provided", async () => {
      await manager.createAccount("user-1");
      expect(ethereum.getDefaultVersion).toHaveBeenCalled();
    });

    it("marks account as deployed when contract code exists", async () => {
      ethereum.getProvider.mockReturnValue({
        getCode: jest.fn().mockResolvedValue("0x6080604052"), // non-empty bytecode
      });

      const account = await manager.createAccount("user-1");
      expect(account.deployed).toBe(true);
    });

    it("marks account as not deployed when getCode throws (RPC failure)", async () => {
      ethereum.getProvider.mockReturnValue({
        getCode: jest.fn().mockRejectedValue(new Error("RPC error")),
      });

      const account = await manager.createAccount("user-1");
      expect(account.deployed).toBe(false);
    });

    it("calls factory getAddress with signer as both creator and signer", async () => {
      await manager.createAccount("user-1", { salt: 99 });

      const mockFactory = ethereum.getFactoryContract.mock.results[0].value;
      expect(mockFactory["getAddress(address,address,address,bool,uint256)"]).toHaveBeenCalledWith(
        SIGNER_ADDRESS, // creator
        SIGNER_ADDRESS, // signer
        VALIDATOR_ADDRESS,
        true,
        99
      );
    });
  });

  // ── getAccount ─────────────────────────────────────────────────────

  describe("getAccount", () => {
    it("returns null when no account exists", async () => {
      expect(await manager.getAccount("unknown")).toBeNull();
    });

    it("returns account enriched with balance and nonce", async () => {
      await manager.createAccount("user-1");
      const result = await manager.getAccount("user-1");

      expect(result).not.toBeNull();
      expect(result!.balance).toBe("1.5");
      expect(result!.nonce).toBe("3");
    });

    it('uses balance "0" when getBalance throws', async () => {
      ethereum.getBalance.mockRejectedValue(new Error("RPC failure"));
      await manager.createAccount("user-1");

      const result = await manager.getAccount("user-1");
      expect(result!.balance).toBe("0");
    });

    it("still returns nonce even when balance fetch fails", async () => {
      ethereum.getBalance.mockRejectedValue(new Error("RPC failure"));
      await manager.createAccount("user-1");

      const result = await manager.getAccount("user-1");
      expect(result!.nonce).toBe("3");
    });
  });

  // ── getAccountAddress ──────────────────────────────────────────────

  describe("getAccountAddress", () => {
    it("returns the account address", async () => {
      await manager.createAccount("user-1");
      expect(await manager.getAccountAddress("user-1")).toBe(ACCOUNT_ADDRESS);
    });

    it("throws Account not found for unknown user", async () => {
      await expect(manager.getAccountAddress("nobody")).rejects.toThrow("Account not found");
    });
  });

  // ── getAccountBalance ──────────────────────────────────────────────

  describe("getAccountBalance", () => {
    it("returns address, balance, and balanceInWei", async () => {
      await manager.createAccount("user-1");
      const result = await manager.getAccountBalance("user-1");

      expect(result.address).toBe(ACCOUNT_ADDRESS);
      expect(result.balance).toBe("1.5");
      expect(result.balanceInWei).toMatch(/^\d+$/);
    });

    it("throws Account not found for unknown user", async () => {
      await expect(manager.getAccountBalance("nobody")).rejects.toThrow("Account not found");
    });
  });

  // ── getAccountNonce ────────────────────────────────────────────────

  describe("getAccountNonce", () => {
    it("returns address and nonce as string", async () => {
      await manager.createAccount("user-1");
      const result = await manager.getAccountNonce("user-1");

      expect(result.address).toBe(ACCOUNT_ADDRESS);
      expect(result.nonce).toBe("3");
    });

    it("throws Account not found for unknown user", async () => {
      await expect(manager.getAccountNonce("nobody")).rejects.toThrow("Account not found");
    });
  });

  // ── getAccountByUserId ─────────────────────────────────────────────

  describe("getAccountByUserId", () => {
    it("returns null when no account exists", async () => {
      expect(await manager.getAccountByUserId("nobody")).toBeNull();
    });

    it("returns the account record when found", async () => {
      await manager.createAccount("user-1");
      const result = await manager.getAccountByUserId("user-1");
      expect(result?.userId).toBe("user-1");
    });
  });
});
