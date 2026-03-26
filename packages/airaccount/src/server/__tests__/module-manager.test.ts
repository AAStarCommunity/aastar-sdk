import { describe, it, expect } from "vitest";
import { buildInstallModuleHash, buildUninstallModuleHash, ModuleManager } from "../services/module-manager";

const CHAIN_ID = 11155111;
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MODULE = "0x4135c539fec5e200fe9762b721f6829b2315cbe1";

describe("buildInstallModuleHash", () => {
  it("returns a bytes32-like hex string", () => {
    const hash = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("defaults moduleInitData to '0x' when omitted", () => {
    const h1 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const h2 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, "0x");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different moduleInitData", () => {
    const h1 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, "0x");
    const h2 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, "0xdeadbeef");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different moduleTypeId", () => {
    const h1 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const h2 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 2, MODULE);
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different chainIds", () => {
    const h1 = buildInstallModuleHash(1, ACCOUNT, 1, MODULE);
    const h2 = buildInstallModuleHash(11155111, ACCOUNT, 1, MODULE);
    expect(h1).not.toBe(h2);
  });
});

describe("buildUninstallModuleHash", () => {
  it("returns a bytes32-like hex string", () => {
    const hash = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("is deterministic for the same inputs", () => {
    const h1 = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const h2 = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    expect(h1).toBe(h2);
  });

  it("differs from install hash for same params", () => {
    const install = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const uninstall = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    expect(install).not.toBe(uninstall);
  });
});

describe("ModuleManager.encodeInstall", () => {
  const provider = {} as never; // not used in sync encode methods
  const mm = new ModuleManager(provider, CHAIN_ID);

  it("returns valid hex calldata", () => {
    const calldata = mm.encodeInstall({
      account: ACCOUNT,
      moduleTypeId: 1,
      module: MODULE,
    });
    expect(calldata).toMatch(/^0x[0-9a-f]+$/i);
    expect(calldata.length).toBeGreaterThan(10);
  });

  it("encodes with guardian sigs prepended", () => {
    const sig = "0x" + "ab".repeat(65);
    const withSig = mm.encodeInstall({
      account: ACCOUNT,
      moduleTypeId: 1,
      module: MODULE,
      guardianSigs: [sig],
    });
    const withoutSig = mm.encodeInstall({
      account: ACCOUNT,
      moduleTypeId: 1,
      module: MODULE,
    });
    expect(withSig).not.toBe(withoutSig);
    expect(withSig.length).toBeGreaterThan(withoutSig.length);
  });
});

describe("ModuleManager.encodeUninstall", () => {
  const provider = {} as never;
  const mm = new ModuleManager(provider, CHAIN_ID);

  it("returns valid hex calldata", () => {
    const sig = "0x" + "ab".repeat(65);
    const calldata = mm.encodeUninstall({
      account: ACCOUNT,
      moduleTypeId: 1,
      module: MODULE,
      guardianSig1: sig,
      guardianSig2: sig,
    });
    expect(calldata).toMatch(/^0x[0-9a-f]+$/i);
    expect(calldata.length).toBeGreaterThan(10);
  });
});

describe("ModuleManager.installHash / uninstallHash", () => {
  const provider = {} as never;
  const mm = new ModuleManager(provider, CHAIN_ID);

  it("installHash delegates to buildInstallModuleHash", () => {
    const direct = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const via = mm.installHash(ACCOUNT, 1, MODULE);
    expect(via).toBe(direct);
  });

  it("uninstallHash delegates to buildUninstallModuleHash", () => {
    const direct = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE);
    const via = mm.uninstallHash(ACCOUNT, 1, MODULE);
    expect(via).toBe(direct);
  });
});
