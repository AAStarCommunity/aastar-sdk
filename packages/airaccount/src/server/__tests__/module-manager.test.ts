import { describe, it, expect } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  keccak256,
  type Hex,
} from "viem";
import { parseAbi } from "viem";
import { buildInstallModuleHash, buildUninstallModuleHash, ModuleManager } from "../services/module-manager";

const CHAIN_ID = 11155111;
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MODULE = "0x4135c539fec5e200fe9762b721f6829b2315cbe1";
const NONCE = 7n;
const GUARDIAN_SIG_VERSION = 4;

// Frozen golden vectors (computed once, independently). A viem-behavior change or an
// accidental layout edit fails the byte-exact assertions below — not just a same-source
// re-derivation. Inputs: CHAIN_ID, ACCOUNT, MODULE, moduleTypeId=1, NONCE=7n, initData=0xdeadbeef.
const GOLDEN_INSTALL_DIGEST = "0x24d8059931ab38b6b3327a1965bd79c90de2886767d4e53150beb8a03d07c7f0";
const GOLDEN_UNINSTALL_DIGEST = "0x328f81ce2bf7e829f9951bcea1ffa05718e09f7ed107e67843405de6c5da4e30";

const AA_ABI = parseAbi([
  "function installModule(uint256 moduleTypeId, address module, bytes initData)",
  "function uninstallModule(uint256 moduleTypeId, address module, bytes deInitData)",
]);

// Independent re-implementation of the contract's ECDSA guardian INNER digest
// (AirAccountExtension._verifyGuardianSigByIdx, before toEthSignedMessageHash) — NOT
// calling the SUT, so it cross-checks field order / types / nonce / version prefix.
// No EIP-191 prefix: the guardian signs this via signMessage({ message: { raw: hash } }) and viem adds it.
function expectedDigest(opLabel: string, opData: Hex): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint256" }, { type: "address" }, { type: "string" }, { type: "bytes" }],
      [GUARDIAN_SIG_VERSION, BigInt(CHAIN_ID), ACCOUNT as Hex, opLabel, opData],
    ),
  );
}

describe("buildInstallModuleHash (v0.20.2 byte-exact)", () => {
  it("matches the contract digest: keccak256(abi.encode(ver,chainId,account,'INSTALL_MODULE',opData)).toEthSignedMessageHash()", () => {
    const moduleInitData = "0xdeadbeef" as Hex;
    const opData = encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }],
      [1n, MODULE as Hex, keccak256(moduleInitData), NONCE],
    );
    const want = expectedDigest("INSTALL_MODULE", opData);
    const got = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, moduleInitData);
    expect(got).toBe(want);
    expect(got).toBe(GOLDEN_INSTALL_DIGEST); // frozen byte-exact vector
    expect(got).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("folds the module-management nonce into the digest (replay guard #75)", () => {
    const h6 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, 6n);
    const h7 = buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, 7n);
    expect(h6).not.toBe(h7);
  });

  it("defaults moduleInitData to '0x' and varies with it", () => {
    expect(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE)).toBe(
      buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0x"),
    );
    expect(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0x")).not.toBe(
      buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0xdeadbeef"),
    );
  });

  it("varies with moduleTypeId and chainId", () => {
    expect(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE)).not.toBe(
      buildInstallModuleHash(CHAIN_ID, ACCOUNT, 2, MODULE, NONCE),
    );
    expect(buildInstallModuleHash(1, ACCOUNT, 1, MODULE, NONCE)).not.toBe(
      buildInstallModuleHash(11155111, ACCOUNT, 1, MODULE, NONCE),
    );
  });
});

describe("buildUninstallModuleHash (v0.20.2 byte-exact)", () => {
  it("matches the contract digest with opData = abi.encode(moduleTypeId, module, nonce)", () => {
    const opData = encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [1n, MODULE as Hex, NONCE],
    );
    const got = buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE);
    expect(got).toBe(expectedDigest("UNINSTALL_MODULE", opData));
    expect(got).toBe(GOLDEN_UNINSTALL_DIGEST); // frozen byte-exact vector
  });

  it("differs from the install digest for identical params", () => {
    expect(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE)).not.toBe(
      buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE),
    );
  });
});

describe("ModuleManager.encodeInstall (v0.20.2 layout)", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);

  it("0-sig path passes moduleInitData raw (sigsRequired==0 backward compat)", () => {
    const moduleInitData = "0xc0ffee" as Hex;
    const calldata = mm.encodeInstall({ account: ACCOUNT, moduleTypeId: 2, module: MODULE, moduleInitData });
    const { functionName, args } = decodeFunctionData({ abi: AA_ABI, data: calldata as Hex });
    expect(functionName).toBe("installModule");
    expect(args[0]).toBe(2n);
    expect((args[1] as string).toLowerCase()).toBe(MODULE);
    expect(args[2]).toBe(moduleInitData); // raw, not abi.encoded
  });

  it("sigs path encodes abi.encode(uint8[] signerIdxs, bytes[] sigs, bytes moduleInitData)", () => {
    const sigs = ["0x" + "ab".repeat(65), "0x" + "cd".repeat(65)] as Hex[];
    const signerIdxs = [0, 2];
    const moduleInitData = "0xbeef" as Hex;
    const calldata = mm.encodeInstall({ account: ACCOUNT, moduleTypeId: 1, module: MODULE, signerIdxs, guardianSigs: sigs, moduleInitData });
    const { args } = decodeFunctionData({ abi: AA_ABI, data: calldata as Hex });
    const [idxs, blobs, initData] = decodeAbiParameters(
      [{ type: "uint8[]" }, { type: "bytes[]" }, { type: "bytes" }],
      args[2] as Hex,
    );
    expect((idxs as readonly number[]).map(Number)).toEqual(signerIdxs);
    expect(blobs).toEqual(sigs);
    expect(initData).toBe(moduleInitData);
  });

  it("throws when signerIdxs is missing or length-mismatched against guardianSigs", () => {
    const sigs = ["0x" + "ab".repeat(65)] as string[];
    expect(() => mm.encodeInstall({ account: ACCOUNT, moduleTypeId: 1, module: MODULE, guardianSigs: sigs })).toThrow(/signerIdxs/);
    expect(() => mm.encodeInstall({ account: ACCOUNT, moduleTypeId: 1, module: MODULE, guardianSigs: sigs, signerIdxs: [0, 1] })).toThrow(/signerIdxs/);
  });
});

describe("ModuleManager.encodeUninstall (v0.20.2 layout)", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);

  it("always abi.encode(uint8[] signerIdxs, bytes[] sigs) — no raw passthrough, no deInit data", () => {
    const sigs = ["0x" + "ab".repeat(65), "0x" + "cd".repeat(65)] as Hex[];
    const signerIdxs = [1, 0];
    const calldata = mm.encodeUninstall({ account: ACCOUNT, moduleTypeId: 4, module: MODULE, signerIdxs, guardianSigs: sigs });
    const { functionName, args } = decodeFunctionData({ abi: AA_ABI, data: calldata as Hex });
    expect(functionName).toBe("uninstallModule");
    const [idxs, blobs] = decodeAbiParameters([{ type: "uint8[]" }, { type: "bytes[]" }], args[2] as Hex);
    expect((idxs as readonly number[]).map(Number)).toEqual(signerIdxs);
    expect(blobs).toEqual(sigs);
  });

  it("0-guardian account encodes empty arrays (still abi.encoded, contract decodes unconditionally)", () => {
    const calldata = mm.encodeUninstall({ account: ACCOUNT, moduleTypeId: 1, module: MODULE });
    const { args } = decodeFunctionData({ abi: AA_ABI, data: calldata as Hex });
    const [idxs, blobs] = decodeAbiParameters([{ type: "uint8[]" }, { type: "bytes[]" }], args[2] as Hex);
    expect(idxs).toEqual([]);
    expect(blobs).toEqual([]);
  });

  it("throws on length mismatch", () => {
    expect(() =>
      mm.encodeUninstall({ account: ACCOUNT, moduleTypeId: 1, module: MODULE, signerIdxs: [0], guardianSigs: [] }),
    ).toThrow(/equal length/);
  });
});

describe("ModuleManager.installHash / uninstallHash delegation", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);
  it("delegate to the standalone builders with the nonce", () => {
    expect(mm.installHash(ACCOUNT, 1, MODULE, NONCE)).toBe(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE));
    expect(mm.uninstallHash(ACCOUNT, 1, MODULE, NONCE)).toBe(buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE));
  });
});
