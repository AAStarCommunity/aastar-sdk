import { describe, it, expect } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  keccak256,
  type Hex,
} from "viem";
import { parseAbi } from "viem";
import {
  buildInstallModuleHash,
  buildUninstallModuleHash,
  buildSetModuleTimelockHash,
  buildInstallModuleP256Challenge,
  buildUninstallModuleP256Challenge,
  buildSetModuleTimelockP256Challenge,
  ModuleManager,
} from "../services/module-manager";

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

const TIMELOCK = 86400n;
const GOLDEN_SET_TIMELOCK_DIGEST = "0xeff729034f4b600f0a6ee427b3440bb73cf2b19ff95d8a1e1216b7e2284e4be7";
const GOLDEN_INSTALL_P256_CHALLENGE = "0x539e2ecaa7b1f31607e88051427563fddd90fbc8e33fc767f3c6e2c5d4d35ac2";
const GOLDEN_UNINSTALL_P256_CHALLENGE = "0xb8f27c074aaa2e92e8b05dd95fdaa5f49d8b165ffed2ae099850cf44b812f1f4";

describe("buildSetModuleTimelockHash (weakening, v0.20.2)", () => {
  it("matches opData = abi.encode(newTimelock, nonce), opLabel SET_MODULE_TIMELOCK (byte-exact)", () => {
    const opData = encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [TIMELOCK, NONCE]);
    const got = buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE);
    expect(got).toBe(expectedDigest("SET_MODULE_TIMELOCK", opData));
    expect(got).toBe(GOLDEN_SET_TIMELOCK_DIGEST);
  });
  it("varies with newTimelock and nonce", () => {
    expect(buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE)).not.toBe(
      buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK + 1n, NONCE),
    );
    expect(buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE)).not.toBe(
      buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE + 1n),
    );
  });
});

describe("P-256 guardian challenges (v0.20.2 _p256GuardianChallenge)", () => {
  it("install/uninstall challenges are byte-exact and fold the P256_GUARDIAN domain", () => {
    expect(buildInstallModuleP256Challenge(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0xdeadbeef")).toBe(
      GOLDEN_INSTALL_P256_CHALLENGE,
    );
    expect(buildUninstallModuleP256Challenge(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE)).toBe(
      GOLDEN_UNINSTALL_P256_CHALLENGE,
    );
  });
  it("differ from the ECDSA digest for identical params (extra P256_GUARDIAN domain string)", () => {
    expect(buildInstallModuleP256Challenge(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0xdeadbeef")).not.toBe(
      buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE, "0xdeadbeef"),
    );
    expect(buildSetModuleTimelockP256Challenge(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE)).not.toBe(
      buildSetModuleTimelockHash(CHAIN_ID, ACCOUNT, TIMELOCK, NONCE),
    );
  });
});

describe("ModuleManager.encodeProposeModuleInstall", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);
  const PROPOSE_ABI = parseAbi([
    "function proposeModuleInstall(uint256 moduleTypeId, address module, bytes initData)",
  ]);

  it("uses the SAME initData encoding as installModule (only the selector differs)", () => {
    const args = { account: ACCOUNT, moduleTypeId: 1 as const, module: MODULE, signerIdxs: [0], guardianSigs: ["0x" + "ab".repeat(65)], moduleInitData: "0xbeef" as Hex };
    const install = mm.encodeInstall(args);
    const propose = mm.encodeProposeModuleInstall(args);
    expect(propose).not.toBe(install); // different 4-byte selector
    expect(propose.slice(10)).toBe(install.slice(10)); // identical encoded args
    const { functionName } = decodeFunctionData({ abi: PROPOSE_ABI, data: propose as Hex });
    expect(functionName).toBe("proposeModuleInstall");
  });
});

describe("ModuleManager.encodeSetModuleTimelockGuardianSigs", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);
  it("abi.encode(uint8[] signerIdxs, bytes[] sigs) — decode-roundtrips", () => {
    const sigs = ["0x" + "ab".repeat(65), "0x" + "cd".repeat(65)] as Hex[];
    const encoded = mm.encodeSetModuleTimelockGuardianSigs([0, 1], sigs);
    const [idxs, blobs] = decodeAbiParameters([{ type: "uint8[]" }, { type: "bytes[]" }], encoded);
    expect((idxs as readonly number[]).map(Number)).toEqual([0, 1]);
    expect(blobs).toEqual(sigs);
  });
  it("throws on length mismatch", () => {
    expect(() => mm.encodeSetModuleTimelockGuardianSigs([0], [])).toThrow(/equal length/);
  });
});

describe("ModuleManager.installHash / uninstallHash delegation", () => {
  const mm = new ModuleManager({} as never, CHAIN_ID);
  it("delegate to the standalone builders with the nonce", () => {
    expect(mm.installHash(ACCOUNT, 1, MODULE, NONCE)).toBe(buildInstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE));
    expect(mm.uninstallHash(ACCOUNT, 1, MODULE, NONCE)).toBe(buildUninstallModuleHash(CHAIN_ID, ACCOUNT, 1, MODULE, NONCE));
  });
});
