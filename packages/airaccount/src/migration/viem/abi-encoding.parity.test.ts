/**
 * Differential parity test: ethers (reference) vs viem reimplementation of the
 * ABI-encoding helpers. For each fixed/edge input we compute the reference via
 * the ethers API inline AND via our viem module, then assert byte-for-byte
 * equality.
 *
 * Inputs combine GOLDEN vectors lifted from the real call sites
 * (userop.builder.ts, force-exit-service.ts, bls.manager.ts, oapd.ts,
 * module-manager.ts, account-manager.ts) PLUS hand-crafted edge cases
 * (zero, max uint, odd-length bytes, leading-zero hex, large bigints, empty
 * arrays). No randomness.
 */
import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { encodeAbiParams, decodeAbiParams, solidityPacked } from "./abi-encoding";

// ── Shared golden constants ─────────────────────────────────────────────
const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // anvil[0] (checksummed)
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"; // EntryPoint v0.7
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const B32_A = "0x" + "ab".repeat(32);
const B32_ZERO = "0x" + "00".repeat(32);
const B32_MAX = "0x" + "ff".repeat(32);
const MAX_UINT256 = (1n << 256n) - 1n;

const refEncode = (types: string[], values: unknown[]): string =>
  ethers.AbiCoder.defaultAbiCoder().encode(types, values);

describe("abi encoding parity: encodeAbiParams vs ethers defaultAbiCoder.encode", () => {
  type Case = { name: string; types: string[]; values: unknown[] };
  const cases: Case[] = [
    // ── GOLDEN: userop.builder.ts getUserOpHash inner encode ──
    {
      name: "golden: userOp packed fields (8-tuple)",
      types: [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "bytes32",
        "uint256",
        "bytes32",
        "bytes32",
      ],
      values: [
        ADDR_B,
        42n,
        ethers.keccak256("0x"),
        ethers.keccak256("0xdeadbeef"),
        "0x" + "11".repeat(32),
        21000n,
        "0x" + "22".repeat(32),
        ethers.keccak256("0x"),
      ],
    },
    // ── GOLDEN: userop.builder.ts getUserOpHash outer encode ──
    {
      name: "golden: outer hash encode (bytes32,address,uint256)",
      types: ["bytes32", "address", "uint256"],
      values: [ethers.keccak256("0xbeef"), ENTRYPOINT, 11155420n],
    },
    // ── GOLDEN: force-exit-service.ts encodeOnInstall ──
    { name: "golden: force-exit uint8 OPTIMISM", types: ["uint8"], values: [1] },
    { name: "golden: force-exit uint8 ARBITRUM", types: ["uint8"], values: [2] },
    // ── GOLDEN: test fixtures (ethereum-provider-rpc / recovery) ──
    { name: "golden: uint256 = 5", types: ["uint256"], values: [5n] },
    { name: "golden: uint256 = 0", types: ["uint256"], values: [0n] },
    { name: "golden: single address", types: ["address"], values: [ADDR_B] },
    { name: "golden: single bytes32", types: ["bytes32"], values: [B32_A] },
    // ── EDGE cases ──
    { name: "edge: zero address", types: ["address"], values: [ZERO_ADDR] },
    { name: "edge: max uint256", types: ["uint256"], values: [MAX_UINT256] },
    { name: "edge: uint8 max (255)", types: ["uint8"], values: [255] },
    { name: "edge: bytes32 zero", types: ["bytes32"], values: [B32_ZERO] },
    { name: "edge: bytes32 max", types: ["bytes32"], values: [B32_MAX] },
    { name: "edge: number vs bigint (uint256 = 7)", types: ["uint256"], values: [7] },
    { name: "edge: empty dynamic bytes", types: ["bytes"], values: ["0x"] },
    { name: "edge: odd-ish dynamic bytes (3 bytes)", types: ["bytes"], values: ["0xabcdef"] },
    {
      name: "edge: dynamic bytes 33 bytes (crosses word boundary)",
      types: ["bytes"],
      values: ["0x" + "5a".repeat(33)],
    },
    { name: "edge: leading-zero dynamic bytes", types: ["bytes"], values: ["0x0001"] },
    { name: "edge: string utf8", types: ["string"], values: ["INSTALL_MODULE"] },
    { name: "edge: empty string", types: ["string"], values: [""] },
    {
      name: "edge: dynamic uint256[] empty",
      types: ["uint256[]"],
      values: [[]],
    },
    {
      name: "edge: dynamic uint256[] with zero/max",
      types: ["uint256[]"],
      values: [[0n, 1n, MAX_UINT256]],
    },
    {
      name: "edge: bytes32[] (nodeIds shape)",
      types: ["bytes32[]"],
      values: [[B32_A, B32_ZERO, B32_MAX]],
    },
    {
      name: "edge: mixed dynamic+static (string,uint256,address,bytes)",
      types: ["string", "uint256", "address", "bytes"],
      values: ["ACCEPT_GUARDIAN", 12345678901234567890n, ADDR_A, "0xc0ffee"],
    },
    {
      name: "edge: tuple (address,uint256)",
      types: ["(address,uint256)"],
      values: [[ADDR_B, 99n]],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const expected = refEncode(c.types, c.values);
      const actual = encodeAbiParams(c.types, c.values);
      expect(actual).toBe(expected);
    });
  }
});

describe("abi decoding parity: decodeAbiParams vs ethers defaultAbiCoder.decode", () => {
  // Build encoded payloads with ethers, decode both ways, compare values.
  type Case = { name: string; types: string[]; values: unknown[] };
  const cases: Case[] = [
    { name: "golden: uint256 (recovery idx decode)", types: ["uint256"], values: [0n] },
    { name: "golden: uint256 = 5", types: ["uint256"], values: [5n] },
    { name: "golden: address", types: ["address"], values: [ADDR_B] },
    { name: "golden: bytes32", types: ["bytes32"], values: [B32_A] },
    { name: "edge: max uint256", types: ["uint256"], values: [MAX_UINT256] },
    { name: "edge: zero address", types: ["address"], values: [ZERO_ADDR] },
    {
      name: "edge: multi (address,uint256,bytes)",
      types: ["address", "uint256", "bytes"],
      values: [ADDR_A, 42n, "0xdeadbeef"],
    },
    { name: "edge: dynamic bytes empty", types: ["bytes"], values: ["0x"] },
    { name: "edge: string", types: ["string"], values: ["INSTALL_MODULE"] },
  ];

  const norm = (v: unknown): unknown =>
    typeof v === "bigint"
      ? `bigint:${v.toString()}`
      : typeof v === "string"
        ? v.toLowerCase()
        : v;

  for (const c of cases) {
    it(c.name, () => {
      const data = refEncode(c.types, c.values) as `0x${string}`;
      const refDecoded = ethers.AbiCoder.defaultAbiCoder().decode(c.types, data);
      const viemDecoded = decodeAbiParams(c.types, data);

      // Compare element-by-element (ethers Result is array-like).
      expect(viemDecoded.length).toBe(c.types.length);
      for (let i = 0; i < c.types.length; i++) {
        expect(norm(viemDecoded[i])).toEqual(norm(refDecoded[i]));
      }
    });
  }
});

describe("solidityPacked parity: solidityPacked vs ethers.solidityPacked", () => {
  type Case = { name: string; types: string[]; values: unknown[] };
  const cases: Case[] = [
    // ── GOLDEN: bls.manager.ts packSignature ──
    { name: "golden: bls nodeIdsLength (uint256)", types: ["uint256"], values: [3] },
    {
      name: "golden: bls nodeIdsBytes (bytes32 x3)",
      types: ["bytes32", "bytes32", "bytes32"],
      values: [B32_A, B32_ZERO, B32_MAX],
    },
    {
      name: "golden: bls packSignature (6 x bytes)",
      types: ["bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
      values: ["0x01", "0x", "0xaabb", "0xccdd", "0xeeff", "0x1234"],
    },
    // ── GOLDEN: bls.manager.ts packCumulativeT2Signature (bytes1 algId) ──
    {
      name: "golden: cumulative T2 (bytes1 + bytes...)",
      types: ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
      values: ["0x04", "0x" + "11".repeat(64), "0x", "0x", "0xaa", "0xbb", "0xcc"],
    },
    // ── GOLDEN: oapd.ts computeOapdSalt ──
    {
      name: "golden: oapd salt (address,string)",
      types: ["address", "string"],
      values: [ADDR_B, "my-dapp-id"],
    },
    // ── GOLDEN: module-manager.ts buildInstallModuleHash ──
    {
      name: "golden: install module hash preimage",
      types: ["string", "uint256", "address", "uint256", "address", "bytes32"],
      values: ["INSTALL_MODULE", 11155420n, ADDR_A, 1n, ADDR_B, ethers.keccak256("0x")],
    },
    // ── GOLDEN: module-manager.ts buildUninstallModuleHash ──
    {
      name: "golden: uninstall module hash preimage",
      types: ["string", "uint256", "address", "uint256", "address"],
      values: ["UNINSTALL_MODULE", 11155420n, ADDR_A, 2n, ADDR_B],
    },
    // ── GOLDEN: account-manager.ts buildGuardianAcceptanceHash ──
    {
      name: "golden: guardian acceptance hash preimage",
      types: ["string", "uint256", "address", "address", "uint256", "uint256"],
      values: ["ACCEPT_GUARDIAN", 31337n, ADDR_A, ADDR_B, 123n, 1000000000000000000n],
    },
    // ── EDGE cases ──
    { name: "edge: uint256 zero packed", types: ["uint256"], values: [0] },
    { name: "edge: uint256 max packed", types: ["uint256"], values: [MAX_UINT256] },
    { name: "edge: empty string packed", types: ["string"], values: [""] },
    { name: "edge: empty bytes packed", types: ["bytes"], values: ["0x"] },
    {
      name: "edge: address+empty string (leading-zero addr)",
      types: ["address", "string"],
      values: [ZERO_ADDR, ""],
    },
    {
      name: "edge: bytes1 0x00 (leading zero byte)",
      types: ["bytes1", "bytes"],
      values: ["0x00", "0xff"],
    },
    {
      name: "edge: zero-length bytes32 list (only length)",
      types: ["uint256"],
      values: [0],
    },
    {
      name: "edge: uint8 + uint16 + uint32 mixed widths",
      types: ["uint8", "uint16", "uint32"],
      values: [255, 65535, 4294967295],
    },
    {
      name: "edge: string with multibyte utf8",
      types: ["string"],
      values: ["héllo-世界"],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const expected = ethers.solidityPacked(c.types, c.values);
      const actual = solidityPacked(c.types, c.values);
      expect(actual).toBe(expected);
    });
  }
});
