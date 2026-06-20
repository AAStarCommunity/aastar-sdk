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
  // The production code (viem) calls factory.read.getAddress([...args]).
  const getAddressFn = vi.fn().mockResolvedValue(ACCOUNT_ADDRESS);
  const mockFactory = {
    read: { getAddress: getAddressFn },
    address: FACTORY_ADDRESS,
  };

  return {
    getDefaultVersion: vi.fn().mockReturnValue(EntryPointVersion.V0_6),
    getFactoryContract: vi.fn().mockReturnValue(mockFactory),
    getValidatorContract: vi.fn().mockReturnValue({ address: VALIDATOR_ADDRESS }),
    getValidatorAddress: vi.fn().mockReturnValue(VALIDATOR_ADDRESS),
    getFactoryAddress: vi.fn().mockReturnValue(FACTORY_ADDRESS),
    getProvider: vi.fn().mockReturnValue({
      getCode: vi.fn().mockResolvedValue("0x"), // not deployed by default
    }),
    getBalance: vi.fn().mockResolvedValue("1.5"),
    getNonce: vi.fn().mockResolvedValue(3n),
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
        getCode: vi.fn().mockResolvedValue("0x6080604052"), // non-empty bytecode
      });

      const account = await manager.createAccount("user-1");
      expect(account.deployed).toBe(true);
    });

    it("marks account as not deployed when getCode throws (RPC failure)", async () => {
      ethereum.getProvider.mockReturnValue({
        getCode: vi.fn().mockRejectedValue(new Error("RPC error")),
      });

      const account = await manager.createAccount("user-1");
      expect(account.deployed).toBe(false);
    });

    it("calls factory getAddress with signer as both creator and signer", async () => {
      await manager.createAccount("user-1", { salt: 99 });

      const mockFactory = ethereum.getFactoryContract.mock.results[0].value;
      // Production code (viem): readPredictedAddress wraps factory.read.getAddress
      // and coerces the uint256 `salt` to bigint (byte-identical encoding to the
      // number reused in the deploy-time initCode).
      expect(mockFactory.read.getAddress).toHaveBeenCalledWith([
        SIGNER_ADDRESS, // signerAddress
        99n,            // salt (uint256 -> bigint)
        expect.any(Array), // minimalConfig
      ]);
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

  // ── buildGuardianAcceptanceHash ────────────────────────────────────

  describe("buildGuardianAcceptanceHash", () => {
    const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const FACTORY = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // hardhat account #1 as stand-in
    const SALT = 42;
    const CHAIN_ID = 11155111;
    const DAILY_LIMIT = 1000000000000000000n; // 1 ETH

    it("produces a consistent hash for the same inputs", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(h1).toBe(h2);
    });

    it("returns a 32-byte hex string", () => {
      const hash = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it("changes hash when chainId changes", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, 1, DAILY_LIMIT);
      expect(h1).not.toBe(h2);
    });

    it("changes hash when factory address changes", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash(OWNER, SALT, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", CHAIN_ID, DAILY_LIMIT);
      expect(h1).not.toBe(h2);
    });

    it("changes hash when owner changes", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(h1).not.toBe(h2);
    });

    it("changes hash when salt changes", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash(OWNER, 99, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(h1).not.toBe(h2);
    });

    it("changes hash when dailyLimit changes (C-3: front-run protection)", () => {
      const h1 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT);
      const h2 = manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, 500000000000000000n);
      expect(h1).not.toBe(h2);
    });

    it("matches contract encoding vector with dailyLimit (C-3 golden value)", () => {
      // Vector computed independently via forge (airaccount-contract):
      //   keccak256(abi.encodePacked(
      //     "ACCEPT_GUARDIAN", uint256(11155111),
      //     address(0x7099...),  // FACTORY
      //     address(0xf39F...),  // OWNER
      //     uint256(42),         // SALT
      //     uint256(1e18)        // DAILY_LIMIT
      //   ))
      // Source: forge script GoldenValue.s.sol → 0x1b674...d6
      expect(
        manager.buildGuardianAcceptanceHash(OWNER, SALT, FACTORY, CHAIN_ID, DAILY_LIMIT)
      ).toBe("0x1b6743191b193d4fa46fe86477caf58392d1eaf8c7e0b2c10fe5dbbcd5999ad6");
    });

    it("accepts bigint salt without precision loss", () => {
      const largeSalt = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      const hash = manager.buildGuardianAcceptanceHash(OWNER, largeSalt, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
      // Must differ from the number-typed MAX_SAFE_INTEGER (would truncate without bigint support)
      const hashAtMax = manager.buildGuardianAcceptanceHash(OWNER, Number.MAX_SAFE_INTEGER, FACTORY, CHAIN_ID, DAILY_LIMIT);
      expect(hash).not.toBe(hashAtMax);
    });

    it("throws when number salt exceeds MAX_SAFE_INTEGER", () => {
      const unsafeSalt = Number.MAX_SAFE_INTEGER + 1; // 2^53 — loses precision as number
      expect(() =>
        manager.buildGuardianAcceptanceHash(OWNER, unsafeSalt, FACTORY, CHAIN_ID, DAILY_LIMIT)
      ).toThrow(/exceeds Number\.MAX_SAFE_INTEGER/);
    });
  });

  // ── encodeModifyTierLimits ─────────────────────────────────────────

  describe("encodeModifyTierLimits", () => {
    const TIER1 = 100000000000000000n;  // 0.1 ETH
    const TIER2 = 1000000000000000000n; // 1 ETH
    const DEADLINE = 9999999999n;
    const DUMMY_SIG = "0x" + "ab".repeat(65);

    it("returns valid hex calldata", () => {
      const cd = manager.encodeModifyTierLimits(TIER1, TIER2, DEADLINE, [DUMMY_SIG]);
      expect(cd).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("calldata starts with consistent function selector", () => {
      const cd1 = manager.encodeModifyTierLimits(TIER1, TIER2, DEADLINE, [DUMMY_SIG]);
      const cd2 = manager.encodeModifyTierLimits(TIER1 * 2n, TIER2, DEADLINE, [DUMMY_SIG]);
      expect(cd1.slice(0, 10)).toBe(cd2.slice(0, 10));
    });

    it("encodes different tier values distinctly", () => {
      const cd1 = manager.encodeModifyTierLimits(TIER1, TIER2, DEADLINE, []);
      const cd2 = manager.encodeModifyTierLimits(TIER1 * 2n, TIER2, DEADLINE, []);
      expect(cd1).not.toBe(cd2);
    });

    it("encodes empty guardian sigs without throwing", () => {
      expect(() =>
        manager.encodeModifyTierLimits(TIER1, TIER2, DEADLINE, [])
      ).not.toThrow();
    });
  });

  // ── createAccountWithGuardians ─────────────────────────────────────

  describe("createAccountWithGuardians", () => {
    const GUARDIAN_ACCOUNT = "0xGuardianAccountAddress0000000000000001";
    const GUARDIAN1 = "0x1111111111111111111111111111111111111111";
    const GUARDIAN1_SIG = "0xaabbccdd";
    const GUARDIAN2 = "0x2222222222222222222222222222222222222222";
    const GUARDIAN2_SIG = "0xeeff0011";
    const DAILY_LIMIT = 1000000000000000000n; // 1 ETH

    function makeV7Mock() {
      const getAddressWithDefaultsFn = vi.fn().mockResolvedValue(GUARDIAN_ACCOUNT);
      const mockFactory = {
        // createAccount uses read.getAddress; createAccountWithGuardians uses read.getAddressWithDefaults.
        read: {
          getAddress: vi.fn().mockResolvedValue(GUARDIAN_ACCOUNT),
          getAddressWithDefaults: getAddressWithDefaultsFn,
        },
        address: FACTORY_ADDRESS,
      };
      return makeEthereumMock({
        getDefaultVersion: vi.fn().mockReturnValue(EntryPointVersion.V0_7),
        getFactoryContract: vi.fn().mockReturnValue(mockFactory),
      });
    }

    it("throws when dailyLimit is zero", async () => {
      const eth7 = makeV7Mock();
      const mgr7 = new AccountManager(eth7 as any, storage, signer, new SilentLogger());
      await expect(
        mgr7.createAccountWithGuardians("user-1", {
          guardian1: GUARDIAN1, guardian1Sig: GUARDIAN1_SIG,
          guardian2: GUARDIAN2, guardian2Sig: GUARDIAN2_SIG,
          dailyLimit: 0n,
        })
      ).rejects.toThrow("dailyLimit > 0");
    });

    it("throws for EntryPoint v0.6", async () => {
      await expect(
        manager.createAccountWithGuardians("user-1", {
          guardian1: GUARDIAN1,
          guardian1Sig: GUARDIAN1_SIG,
          guardian2: GUARDIAN2,
          guardian2Sig: GUARDIAN2_SIG,
          dailyLimit: DAILY_LIMIT,
        })
      ).rejects.toThrow("v0.6");
    });

    it("throws when guardian1 === guardian2", async () => {
      const eth7 = makeV7Mock();
      const mgr7 = new AccountManager(eth7 as any, storage, signer, new SilentLogger());
      await expect(
        mgr7.createAccountWithGuardians("user-1", {
          guardian1: GUARDIAN1,
          guardian1Sig: GUARDIAN1_SIG,
          guardian2: GUARDIAN1, // same as guardian1
          guardian2Sig: GUARDIAN2_SIG,
          dailyLimit: DAILY_LIMIT,
        })
      ).rejects.toThrow("must be different");
    });

    it("stores guardian fields in AccountRecord", async () => {
      const eth7 = makeV7Mock();
      const mgr7 = new AccountManager(eth7 as any, storage, signer, new SilentLogger());

      const account = await mgr7.createAccountWithGuardians("user-1", {
        guardian1: GUARDIAN1,
        guardian1Sig: GUARDIAN1_SIG,
        guardian2: GUARDIAN2,
        guardian2Sig: GUARDIAN2_SIG,
        dailyLimit: DAILY_LIMIT,
        salt: 7,
      });

      expect(account.address).toBe(GUARDIAN_ACCOUNT);
      expect(account.guardian1).toBe(GUARDIAN1);
      expect(account.guardian1Sig).toBe(GUARDIAN1_SIG);
      expect(account.guardian2).toBe(GUARDIAN2);
      expect(account.guardian2Sig).toBe(GUARDIAN2_SIG);
      expect(account.dailyLimit).toBe(DAILY_LIMIT.toString());
    });

    it("returns existing guardian account idempotently", async () => {
      const eth7 = makeV7Mock();
      const mgr7 = new AccountManager(eth7 as any, storage, signer, new SilentLogger());

      const first = await mgr7.createAccountWithGuardians("user-1", {
        guardian1: GUARDIAN1, guardian1Sig: GUARDIAN1_SIG,
        guardian2: GUARDIAN2, guardian2Sig: GUARDIAN2_SIG,
        dailyLimit: DAILY_LIMIT,
      });
      const second = await mgr7.createAccountWithGuardians("user-1", {
        guardian1: GUARDIAN1, guardian1Sig: GUARDIAN1_SIG,
        guardian2: GUARDIAN2, guardian2Sig: GUARDIAN2_SIG,
        dailyLimit: DAILY_LIMIT,
      });

      expect(second).toEqual(first);
      expect((await storage.getAccounts()).length).toBe(1);
    });

    it("does not reuse a no-guardian account as a guardian account", async () => {
      // First create a regular account for user-1 (v0.7)
      const eth7 = makeV7Mock();
      const mgr7 = new AccountManager(eth7 as any, storage, signer, new SilentLogger());
      await mgr7.createAccount("user-1", { entryPointVersion: EntryPointVersion.V0_7 });

      // Now create a guardian account for the same user+version — should create a new record
      await mgr7.createAccountWithGuardians("user-1", {
        guardian1: GUARDIAN1, guardian1Sig: GUARDIAN1_SIG,
        guardian2: GUARDIAN2, guardian2Sig: GUARDIAN2_SIG,
        dailyLimit: DAILY_LIMIT,
      });

      expect((await storage.getAccounts()).length).toBe(2);
    });
  });

  // ── createAccountWithP256Guardians (#118) ──────────────────────────
  describe("createAccountWithP256Guardians", () => {
    const P256_ACCOUNT = "0xP256AccountAddress00000000000000000000001";
    const X1 = `0x${"11".repeat(32)}` as `0x${string}`;
    const Y1 = `0x${"22".repeat(32)}` as `0x${string}`;
    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
    const ZERO32 = `0x${"00".repeat(32)}`;
    const DAILY_LIMIT = 1000000000000000000n; // 1 ETH

    function makeP256Mock() {
      const getAddressFn = vi.fn().mockResolvedValue(P256_ACCOUNT);
      const mockFactory = { read: { getAddress: getAddressFn }, address: FACTORY_ADDRESS };
      return makeEthereumMock({
        getDefaultVersion: vi.fn().mockReturnValue(EntryPointVersion.V0_7),
        getFactoryContract: vi.fn().mockReturnValue(mockFactory),
      });
    }

    it("predicts via the full-config getAddress and persists guardianSpecs/approvedAlgIds/minDailyLimit", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());

      const account = await mgr.createAccountWithP256Guardians("user-1", {
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY_LIMIT,
        minDailyLimit: DAILY_LIMIT / 10n,
        salt: 7,
      });

      expect(account.address).toBe(P256_ACCOUNT);
      expect(account.dailyLimit).toBe(DAILY_LIMIT.toString());
      expect(account.guardianSpecs).toEqual([{ p256: { x: X1, y: Y1 } }]);
      expect(account.approvedAlgIds).toEqual([0x02, 0x03]); // #118 H1: ECDSA + P-256 (0x03, NOT BLS 0x01)
      expect(account.minDailyLimit).toBe((DAILY_LIMIT / 10n).toString());

      // The full 8-field InitConfig tuple was passed to getAddress with P-256 coords in slot 0.
      const factory = eth.getFactoryContract.mock.results[0].value;
      const [owner, salt, configTuple] = factory.read.getAddress.mock.calls[0][0];
      expect(owner).toBe(SIGNER_ADDRESS);
      expect(salt).toBe(7n); // uint256 -> bigint
      expect(configTuple).toHaveLength(8);
      expect(configTuple[0]).toEqual([ZERO_ADDR, ZERO_ADDR, ZERO_ADDR]); // guardians (ECDSA) all zero
      expect(configTuple[1][0]).toBe(X1); // guardianP256X[0]
      expect(configTuple[2][0]).toBe(Y1); // guardianP256Y[0]
      expect(configTuple[1].slice(1)).toEqual([ZERO32, ZERO32]);
      expect(configTuple[3]).toBe(DAILY_LIMIT); // dailyLimit
    });

    it("installs a mixed ECDSA + P-256 set with ECDSA in slot 0 (no acceptance sigs on this path)", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      const ECDSA_G = "0x1111111111111111111111111111111111111111";

      const account = await mgr.createAccountWithP256Guardians("user-1", {
        ecdsaGuardians: [ECDSA_G],
        p256Guardians: [{ x: X1, y: Y1 }],
        dailyLimit: DAILY_LIMIT,
        salt: 9,
      });

      expect(account.guardianSpecs).toEqual([{ ecdsa: ECDSA_G }, { p256: { x: X1, y: Y1 } }]);
      const factory = eth.getFactoryContract.mock.results[0].value;
      const [, , configTuple] = factory.read.getAddress.mock.calls[0][0];
      expect(configTuple[0][0].toLowerCase()).toBe(ECDSA_G); // ECDSA slot 0
      expect(configTuple[1][1]).toBe(X1); // P-256 in slot 1
    });

    it("is deterministic — same inputs predict the same address", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());

      const a = await mgr.createAccountWithP256Guardians("user-a", {
        p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY_LIMIT, salt: 5,
      });
      const b = await mgr.createAccountWithP256Guardians("user-b", {
        p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY_LIMIT, salt: 5,
      });

      const factory = eth.getFactoryContract.mock.results[0].value;
      // Both calls encoded the identical config tuple (=> identical CREATE2 prediction on-chain).
      expect(factory.read.getAddress.mock.calls[0][0][2]).toEqual(
        factory.read.getAddress.mock.calls[1][0][2]
      );
      expect(a.address).toBe(b.address);
    });

    it("throws when no P-256 guardian is supplied", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      await expect(
        mgr.createAccountWithP256Guardians("user-1", { p256Guardians: [], dailyLimit: DAILY_LIMIT })
      ).rejects.toThrow(/at least one P-256 guardian/);
    });

    it("throws when dailyLimit is zero (guard required)", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      await expect(
        mgr.createAccountWithP256Guardians("user-1", { p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: 0n })
      ).rejects.toThrow(/dailyLimit > 0/);
    });

    it("throws for EntryPoint v0.6 (no full-config createAccount path)", async () => {
      // default mock returns v0.6
      await expect(
        manager.createAccountWithP256Guardians("user-1", {
          p256Guardians: [{ x: X1, y: Y1 }],
          dailyLimit: DAILY_LIMIT,
          entryPointVersion: EntryPointVersion.V0_6,
        })
      ).rejects.toThrow(/v0\.7 or v0\.8/);
    });

    // #118 M2: a large salt (> 2^53) must round-trip losslessly — persisted as a decimal string,
    // and the SAME bigint must be used for both the prediction and the deploy-time rebuild.
    it("persists a large (>2^53) bigint salt losslessly as a decimal string", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      const bigSalt = (1n << 64n) + 12345n; // far beyond Number.MAX_SAFE_INTEGER

      const account = await mgr.createAccountWithP256Guardians("user-1", {
        p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY_LIMIT, salt: bigSalt,
      });

      // Stored as a decimal string -> JSON-serializable and lossless.
      expect(account.salt).toBe(bigSalt.toString());
      expect(typeof account.salt).toBe("string");
      expect(BigInt(account.salt)).toBe(bigSalt);
      expect(JSON.parse(JSON.stringify({ salt: account.salt })).salt).toBe(bigSalt.toString());

      // The prediction used the EXACT bigint salt (so deploy-time BigInt(account.salt) === predicted salt).
      const factory = eth.getFactoryContract.mock.results[0].value;
      expect(factory.read.getAddress.mock.calls[0][0][1]).toBe(bigSalt);
    });

    it("rejects an unsafe JS-number salt (> MAX_SAFE_INTEGER) to prevent truncation", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      await expect(
        mgr.createAccountWithP256Guardians("user-1", {
          p256Guardians: [{ x: X1, y: Y1 }],
          dailyLimit: DAILY_LIMIT,
          salt: Number.MAX_SAFE_INTEGER + 1, // 2^53 — loses precision as a JS number
        })
      ).rejects.toThrow(/exceeds Number\.MAX_SAFE_INTEGER/);
    });

    it("is idempotent for the same user+version", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      const first = await mgr.createAccountWithP256Guardians("user-1", {
        p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY_LIMIT,
      });
      const second = await mgr.createAccountWithP256Guardians("user-1", {
        p256Guardians: [{ x: X1, y: Y1 }], dailyLimit: DAILY_LIMIT,
      });
      expect(second).toEqual(first);
      expect((await storage.getAccounts()).length).toBe(1);
    });

    it("createAccount delegates to the P-256 path when p256Guardians is provided", async () => {
      const eth = makeP256Mock();
      const mgr = new AccountManager(eth as any, storage, signer, new SilentLogger());
      const account = await mgr.createAccount("user-1", {
        entryPointVersion: EntryPointVersion.V0_7,
        dailyLimit: DAILY_LIMIT,
        p256Guardians: [{ x: X1, y: Y1 }],
        salt: 3,
      });
      expect(account.guardianSpecs).toEqual([{ p256: { x: X1, y: Y1 } }]);
    });
  });

  // ── ensureValidatorRouter (Gap B) ──────────────────────────────────
  describe("ensureValidatorRouter", () => {
    const SEPOLIA = 11155111;
    const OP_SEPOLIA = 11155420; // canonical aaStarValidator == zeroAddress (not deployed)
    const SEPOLIA_ROUTER = "0xfcDfd17a373E037c3F9C8ffE2c781915E7Ae6e11"; // CANONICAL_ADDRESSES[11155111]
    const ZERO = "0x0000000000000000000000000000000000000000";
    const ACC = "0xAccountForRouterWiring000000000000000001";

    /** Build the EthereumProvider mock surface ensureValidatorRouter reads from. */
    function makeRouterMock(opts: { chainId?: number; validator?: string; code?: string } = {}) {
      const validatorFn = vi.fn().mockResolvedValue(opts.validator ?? ZERO);
      return makeEthereumMock({
        getChainId: vi.fn().mockReturnValue(opts.chainId ?? SEPOLIA),
        getAccountContract: vi.fn().mockReturnValue({ read: { validator: validatorFn } }),
        getProvider: vi.fn().mockReturnValue({
          getCode: vi.fn().mockResolvedValue(opts.code ?? "0x6080604052"), // deployed by default
        }),
      });
    }

    /** Persist a record with the given approvedAlgIds so the manager can resolve them. */
    async function seedRecord(approvedAlgIds: number[] | undefined) {
      await storage.saveAccount({
        userId: "user-1",
        address: ACC,
        signerAddress: SIGNER_ADDRESS,
        salt: "1",
        deployed: true,
        deploymentTxHash: null,
        validatorAddress: VALIDATOR_ADDRESS,
        entryPointVersion: "0.7",
        factoryAddress: FACTORY_ADDRESS,
        createdAt: new Date().toISOString(),
        ...(approvedAlgIds ? { approvedAlgIds } : {}),
      });
    }

    /** A WalletClient stub that records the setValidator write. */
    function makeWalletStub(txHash = "0xRouterTx") {
      return {
        account: { address: SIGNER_ADDRESS },
        chain: undefined,
        writeContract: vi.fn().mockResolvedValue(txHash),
      };
    }

    it("throws Account not found for unknown user", async () => {
      const mgr = new AccountManager(makeRouterMock() as any, storage, signer, new SilentLogger());
      await expect(mgr.ensureValidatorRouter("nobody")).rejects.toThrow("Account not found");
    });

    it("no-op when approvedAlgIds is absent (legacy / ECDSA-only record)", async () => {
      await seedRecord(undefined);
      const mgr = new AccountManager(makeRouterMock() as any, storage, signer, new SilentLogger());
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r).toEqual({ set: false, reason: "no approvedAlgIds / not router-delegated" });
    });

    it("no-op when all approved algIds are inline (not router-delegated)", async () => {
      await seedRecord([0x02, 0x03]); // ECDSA + P256 — both inline
      const mgr = new AccountManager(makeRouterMock() as any, storage, signer, new SilentLogger());
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r).toEqual({ set: false, reason: "no router-delegated algorithm" });
    });

    it("no-op when the chain has no canonical router (zeroAddress)", async () => {
      await seedRecord([0x01]); // BLS — router-delegated
      const mgr = new AccountManager(
        makeRouterMock({ chainId: OP_SEPOLIA }) as any,
        storage,
        signer,
        new SilentLogger()
      );
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r).toEqual({ set: false, reason: `no canonical validator router for chain ${OP_SEPOLIA}` });
    });

    it("no-op when validator() is already set (SET-ONCE)", async () => {
      await seedRecord([0x01]);
      const mgr = new AccountManager(
        makeRouterMock({ validator: SEPOLIA_ROUTER }) as any,
        storage,
        signer,
        new SilentLogger()
      );
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r).toEqual({ set: false, reason: "validator already set" });
    });

    it("no-op when the account is not yet deployed (no code)", async () => {
      await seedRecord([0x01]);
      const mgr = new AccountManager(
        makeRouterMock({ code: "0x" }) as any,
        storage,
        signer,
        new SilentLogger()
      );
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r).toEqual({ set: false, reason: "account not deployed yet — call after deploy" });
    });

    it("returns a clear reason when no owner WalletClient is supplied", async () => {
      await seedRecord([0x01]);
      const mgr = new AccountManager(makeRouterMock() as any, storage, signer, new SilentLogger());
      const r = await mgr.ensureValidatorRouter("user-1");
      expect(r.set).toBe(false);
      expect(r.reason).toMatch(/walletClient/);
      expect(r.router?.toLowerCase()).toBe(SEPOLIA_ROUTER.toLowerCase());
    });

    it("happy path: sends setValidator(canonical router) and returns set=true", async () => {
      await seedRecord([0x01]); // BLS-only — needs the router
      const mgr = new AccountManager(makeRouterMock() as any, storage, signer, new SilentLogger());
      const wallet = makeWalletStub("0xDEADBEEF");

      const r = await mgr.ensureValidatorRouter("user-1", { walletClient: wallet as any });

      expect(r.set).toBe(true);
      expect(r.tx).toBe("0xDEADBEEF");
      expect(r.router?.toLowerCase()).toBe(SEPOLIA_ROUTER.toLowerCase());
      // The core setValidator action routed through the supplied wallet with the canonical router.
      expect(wallet.writeContract).toHaveBeenCalledTimes(1);
      const callArg = wallet.writeContract.mock.calls[0][0];
      expect(callArg.functionName).toBe("setValidator");
      expect(callArg.args).toEqual([SEPOLIA_ROUTER]);
    });

    it("honors an explicit router override on a chain with a zero canonical router", async () => {
      await seedRecord([0x08]); // session — router-delegated
      const mgr = new AccountManager(
        makeRouterMock({ chainId: OP_SEPOLIA }) as any,
        storage,
        signer,
        new SilentLogger()
      );
      const wallet = makeWalletStub("0xABC123");
      const override = "0x1234567890123456789012345678901234567890";

      const r = await mgr.ensureValidatorRouter("user-1", {
        router: override as any,
        walletClient: wallet as any,
      });

      expect(r.set).toBe(true);
      expect(r.router).toBe(override);
      expect(wallet.writeContract.mock.calls[0][0].args).toEqual([override]);
    });
  });
});
