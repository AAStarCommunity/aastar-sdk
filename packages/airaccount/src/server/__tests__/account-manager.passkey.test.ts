import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountManager } from "../services/account-manager";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";
import { EntryPointVersion } from "../constants/entrypoint";
import type { Address, Hex } from "viem";

// createAccountWithPasskey (#249): KMS-style passkey-at-birth via v0.22.0 RELAY mode. The byte-exactness
// of the digest is proven on-chain (createaccount-relay-passkey-e2e.ts); here we verify the COMPOSITION:
// the method signs the SDK-built CREATE_ACCOUNT digest with the owner (KMS) signer and relays
// createAccount with that ownerSig (msg.sender = deployer != owner), persisting a deployed record.
const FACTORY = "0x0eb0E7a61d5D9e03bc3578f8C1b0d9f40cc0a5B9" as Address;
const VALIDATOR = "0xfcDfd17a373E037c3F9C8ffE2c781915E7Ae6e11" as Address;
const PREDICTED = "0xC51DBbBb08Dcf57c0765a53F59d6Ddef0ab7B826" as Address;
const DEPLOYER = "0xb5600060e6de5E11D3636731964218E53caadf0E" as Address;
// LocalWalletSigner derives owner from this key (anvil #0).
const OWNER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;
const PX = `0x${"22".repeat(32)}` as Hex;
const PY = `0x${"33".repeat(32)}` as Hex;
const TX = "0xf6d5f3474d59939a710def0386e62d4aa0fb255214793766560d090173db04ac" as Hex;

function makeEthereumMock(opts: { deployed?: boolean; nonce?: bigint } = {}) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "getAddress") return PREDICTED;
    if (functionName === "createNonces") return opts.nonce ?? 0n;
    throw new Error(`unexpected read ${functionName}`);
  });
  const provider = {
    getCode: vi.fn().mockResolvedValue(opts.deployed ? "0xabcd" : "0x"),
    readContract,
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
  };
  return {
    getDefaultVersion: vi.fn().mockReturnValue(EntryPointVersion.V0_7),
    getChainId: vi.fn().mockReturnValue(11155111),
    getFactoryAddress: vi.fn().mockReturnValue(FACTORY),
    getValidatorAddress: vi.fn().mockReturnValue(VALIDATOR),
    getProvider: vi.fn().mockReturnValue(provider),
    _provider: provider,
  };
}

function makeDeployerWallet() {
  return {
    account: { address: DEPLOYER },
    chain: { id: 11155111 },
    writeContract: vi.fn().mockResolvedValue(TX),
  } as never;
}

describe("AccountManager.createAccountWithPasskey (#249)", () => {
  let storage: MemoryStorage;
  let signer: LocalWalletSigner;

  beforeEach(() => {
    storage = new MemoryStorage();
    signer = new LocalWalletSigner(OWNER_PK);
  });

  it("signs the SDK CREATE_ACCOUNT digest and relays createAccount with the ownerSig", async () => {
    const ethereum = makeEthereumMock({ nonce: 0n });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const signSpy = vi.spyOn(signer, "signMessage");
    const deployer = makeDeployerWallet();

    const rec = await mgr.createAccountWithPasskey(
      "user-1",
      { ownerP256X: PX, ownerP256Y: PY, ecdsaGuardians: ["0x4444444444444444444444444444444444444444" as Address], dailyLimit: 10n ** 18n, minDailyLimit: 10n ** 17n, approvedAlgIds: [0x0a], salt: 42n, entryPointVersion: EntryPointVersion.V0_7 },
      { deployerWallet: deployer }
    );

    // signMessage called once over a 32-byte digest (NOT a hand-rolled hash — it is buildCreateAccountHash's
    // output; byte-exactness is the golden unit test + the on-chain relay e2e).
    expect(signSpy).toHaveBeenCalledTimes(1);
    const signedHash = signSpy.mock.calls[0][1] as Hex;
    expect(signedHash).toMatch(/^0x[0-9a-f]{64}$/);
    const ownerSig = await signSpy.mock.results[0].value as Hex;

    // Relay: createAccount called on the DEPLOYER wallet (msg.sender = deployer != owner) with that ownerSig.
    expect(deployer.writeContract).toHaveBeenCalledTimes(1);
    const callArgs = (deployer.writeContract as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.functionName).toBe("createAccount");
    expect(callArgs.args[0]).toBe(OWNER);          // owner
    expect(callArgs.args[3]).toBe(PX);             // ownerP256X
    expect(callArgs.args[4]).toBe(PY);             // ownerP256Y
    expect(callArgs.args[7]).toBe(ownerSig);       // ownerSig (relay mode, the signed digest)
    expect(callArgs.args[7]).not.toBe("0x");

    // Persisted as DEPLOYED.
    expect(rec.address).toBe(PREDICTED);
    expect(rec.deployed).toBe(true);
    expect(rec.deploymentTxHash).toBe(TX);
    expect(rec.signerAddress).toBe(OWNER);
  });

  it("rejects a zero owner passkey", async () => {
    const ethereum = makeEthereumMock();
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    await expect(
      mgr.createAccountWithPasskey("u", { ownerP256X: `0x${"00".repeat(32)}` as Hex, ownerP256Y: PY, dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 }, { deployerWallet: makeDeployerWallet() })
    ).rejects.toThrow(/non-zero ownerP256X/);
  });

  it("requires a deployer wallet", async () => {
    const ethereum = makeEthereumMock();
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    await expect(
      mgr.createAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 }, { deployerWallet: {} as never })
    ).rejects.toThrow(/deployerWallet/);
  });

  it("adopts an already-deployed account without re-relaying", async () => {
    const ethereum = makeEthereumMock({ deployed: true });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const signSpy = vi.spyOn(signer, "signMessage");
    const deployer = makeDeployerWallet();
    const rec = await mgr.createAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7, salt: 7n }, { deployerWallet: deployer });
    expect(signSpy).not.toHaveBeenCalled();
    expect(deployer.writeContract).not.toHaveBeenCalled();
    expect(rec.deployed).toBe(true);
  });
});
