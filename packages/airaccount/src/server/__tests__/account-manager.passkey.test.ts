import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountManager } from "../services/account-manager";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";
import { EntryPointVersion } from "../constants/entrypoint";
import { bytesToHex, type Address, type Hex } from "viem";

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

function makeEthereumMock(opts: { deployed?: boolean; nonce?: bigint; noncesSeq?: bigint[]; receiptStatus?: "success" | "reverted" } = {}) {
  let ni = 0;
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "getAddress") return PREDICTED;
    if (functionName === "createNonces") {
      if (opts.noncesSeq) return opts.noncesSeq[Math.min(ni++, opts.noncesSeq.length - 1)];
      return opts.nonce ?? 0n;
    }
    throw new Error(`unexpected read ${functionName}`);
  });
  const provider = {
    getCode: vi.fn().mockResolvedValue(opts.deployed ? "0xabcd" : "0x"),
    readContract,
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: opts.receiptStatus ?? "success" }),
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

    // signMessage called once over the 32-byte digest as RAW BYTES (Uint8Array, not a "0x…" string — a
    // string is EIP-191'd as UTF-8 text by the KMS adapter and would sign the wrong preimage; #249 Codex §5).
    expect(signSpy).toHaveBeenCalledTimes(1);
    const signedHash = signSpy.mock.calls[0][1] as Uint8Array;
    expect(signedHash).toBeInstanceOf(Uint8Array);
    expect(signedHash.length).toBe(32);
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

  it("rejects a zero owner() from the signer — un-finalizable account (#261)", async () => {
    // A passkey-only account (owner()==0x0) deploys but the DVT owner-auth gate rejects it (P256-owner
    // auth is Stage 2 / DVT #40), so Tier-2/3 would silently fail later. Fail fast at creation.
    const ethereum = makeEthereumMock();
    const zeroSigner = {
      ensureSigner: vi.fn().mockResolvedValue({ address: "0x0000000000000000000000000000000000000000" }),
      signMessage: vi.fn(),
    };
    const mgr = new AccountManager(ethereum as never, storage, zeroSigner as never, { log: vi.fn(), error: vi.fn() } as never);
    await expect(
      mgr.createAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 }, { deployerWallet: makeDeployerWallet() })
    ).rejects.toThrow(/zero owner/);
  });

  it("prepareCreateAccountWithPasskey ALSO rejects a zero owner — the guard is in the shared _resolvePasskeyCreate (#262 review)", async () => {
    // The prepare→submit two-phase path resolves the plan via the SAME _resolvePasskeyCreate helper that
    // holds the zero-owner guard, so it CANNOT bypass it. Pin that.
    const ethereum = makeEthereumMock();
    const zeroSigner = {
      ensureSigner: vi.fn().mockResolvedValue({ address: "0x0000000000000000000000000000000000000000" }),
      signMessage: vi.fn(),
      beginCeremony: vi.fn(),
    };
    const mgr = new AccountManager(ethereum as never, storage, zeroSigner as never, { log: vi.fn(), error: vi.fn() } as never);
    await expect(
      mgr.prepareCreateAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 })
    ).rejects.toThrow(/zero owner/);
  });

  it("rejects a guardian equal to the owner (would revert on-chain → stranded funds)", async () => {
    const ethereum = makeEthereumMock();
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    await expect(
      mgr.createAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, ecdsaGuardians: [OWNER], dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 }, { deployerWallet: makeDeployerWallet() })
    ).rejects.toThrow(/must not equal the owner/);
  });

  it("rejects duplicate ECDSA guardians (factory DuplicateGuardian)", async () => {
    const ethereum = makeEthereumMock();
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const dup = "0x4444444444444444444444444444444444444444" as Address;
    await expect(
      mgr.createAccountWithPasskey("u", { ownerP256X: PX, ownerP256Y: PY, ecdsaGuardians: [dup, dup], dailyLimit: 10n ** 18n, entryPointVersion: EntryPointVersion.V0_7 }, { deployerWallet: makeDeployerWallet() })
    ).rejects.toThrow(/duplicate ECDSA guardian/);
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

// Two-phase (#249): KMS owners run a separate WebAuthn ceremony whose challenge must commit to the
// CREATE_ACCOUNT digest — but the digest depends on nonce/deadline resolved INSIDE the SDK, so a single
// method can't hand the caller the challenge (chicken-and-egg). prepare → ceremony → submit splits it.
describe("AccountManager two-phase passkey create (#249)", () => {
  let storage: MemoryStorage;
  let signer: LocalWalletSigner;
  beforeEach(() => { storage = new MemoryStorage(); signer = new LocalWalletSigner(OWNER_PK); });

  const params = { ownerP256X: PX, ownerP256Y: PY, dailyLimit: 10n ** 18n, minDailyLimit: 10n ** 17n, approvedAlgIds: [0x0a], salt: 42n, entryPointVersion: EntryPointVersion.V0_7 };

  it("prepare returns the CREATE_ACCOUNT digest as the challenge + predicted address", async () => {
    const ethereum = makeEthereumMock({ nonce: 0n });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const prep = await mgr.prepareCreateAccountWithPasskey("user-1", params);
    expect(prep.createId).toBeTruthy();
    expect(prep.predictedAddress).toBe(PREDICTED);
    expect(prep.challenge).toMatch(/^0x[0-9a-f]{64}$/);
    expect(prep.alreadyDeployed).toBe(false);
    expect(prep.nonce).toBe(0n);
    expect(prep.challengeId).toBeUndefined(); // LocalWallet has no beginCeremony
  });

  it("submit signs the PREPARED digest (raw bytes) and relays createAccount with that ownerSig", async () => {
    const ethereum = makeEthereumMock({ nonce: 0n });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const prep = await mgr.prepareCreateAccountWithPasskey("user-1", params);
    const signSpy = vi.spyOn(signer, "signMessage");
    const deployer = makeDeployerWallet();
    const rec = await mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer });

    // Signs the EXACT prepared challenge, as raw bytes.
    expect(signSpy).toHaveBeenCalledTimes(1);
    const signed = signSpy.mock.calls[0][1] as Uint8Array;
    expect(signed).toBeInstanceOf(Uint8Array);
    expect(bytesToHex(signed)).toBe(prep.challenge);
    const ownerSig = await signSpy.mock.results[0].value as Hex;

    // Relays createAccount with that ownerSig.
    const callArgs = (deployer.writeContract as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.functionName).toBe("createAccount");
    expect(callArgs.args[7]).toBe(ownerSig);
    expect(rec.deployed).toBe(true);
    expect(rec.deploymentTxHash).toBe(TX);

    // createId is consumed (single-use).
    await expect(mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer })).rejects.toThrow(/unknown or expired/);
  });

  it("KMS signer: prepare begins the ceremony over the 32-byte digest (challenge commits to the hash)", async () => {
    const ethereum = makeEthereumMock({ nonce: 0n });
    const kmsSigner = {
      ensureSigner: vi.fn().mockResolvedValue({ address: OWNER }),
      signMessage: vi.fn().mockResolvedValue(("0x" + "ab".repeat(65)) as Hex),
      beginCeremony: vi.fn().mockResolvedValue({ challengeId: "ch-1", publicKeyOptions: { challenge: "x" } }),
    };
    const mgr = new AccountManager(ethereum as never, storage, kmsSigner as never, { log: vi.fn(), error: vi.fn() } as never);
    const prep = await mgr.prepareCreateAccountWithPasskey("user-1", params);
    expect(kmsSigner.beginCeremony).toHaveBeenCalledTimes(1);
    const ceremonyMsg = kmsSigner.beginCeremony.mock.calls[0][1] as Uint8Array;
    expect(ceremonyMsg).toBeInstanceOf(Uint8Array);
    expect(bytesToHex(ceremonyMsg)).toBe(prep.challenge); // ceremony challenge == the digest submit signs
    expect(prep.challengeId).toBe("ch-1");
    expect(prep.publicKeyOptions).toBeTruthy();
  });

  it("submit rejects an unknown createId", async () => {
    const ethereum = makeEthereumMock();
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    await expect(mgr.submitPreparedCreateAccount("nope", { deployerWallet: makeDeployerWallet() })).rejects.toThrow(/unknown or expired/);
  });

  it("submit aborts (and consumes the createId) when createNonces advanced since prepare", async () => {
    // createNonces returns 0n at prepare, then 1n at submit — the ceremony assertion is bound to the
    // old nonce's digest, so submit MUST abort rather than relay with a stale nonce. (Codex §5 HIGH.)
    const ethereum = makeEthereumMock({ noncesSeq: [0n, 1n] });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const prep = await mgr.prepareCreateAccountWithPasskey("user-1", params);
    const deployer = makeDeployerWallet();
    await expect(mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer })).rejects.toThrow(/advanced 0→1|re-run prepare/);
    expect(deployer.writeContract).not.toHaveBeenCalled();
    // single-use: the createId is gone even though it aborted.
    await expect(mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer })).rejects.toThrow(/unknown or expired/);
  });

  it("createId is single-use even when the relay fails (no stale-nonce replay)", async () => {
    const ethereum = makeEthereumMock({ nonce: 0n, receiptStatus: "reverted" });
    const mgr = new AccountManager(ethereum as never, storage, signer, { log: vi.fn(), error: vi.fn() } as never);
    const prep = await mgr.prepareCreateAccountWithPasskey("user-1", params);
    const deployer = makeDeployerWallet();
    await expect(mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer })).rejects.toThrow(/relay deploy reverted/);
    await expect(mgr.submitPreparedCreateAccount(prep.createId, { deployerWallet: deployer })).rejects.toThrow(/unknown or expired/);
  });
});
