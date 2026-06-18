/**
 * Golden-fixture test for the viem ABI-encoding helpers (encodeAbiParams /
 * decodeAbiParams / solidityPacked) in ./abi-encoding.ts.
 *
 * Each locked value below is a GOLDEN value: proven byte-equal to ethers v6's
 * AbiCoder.defaultAbiCoder().encode / .decode / solidityPacked AND accepted
 * on-chain. They were captured from the original differential parity test
 * (ethers reference) before ethers was removed — see git history of this file.
 *
 * Inputs combine GOLDEN vectors lifted from the real call sites
 * (userop.builder.ts, force-exit-service.ts, bls.manager.ts, oapd.ts,
 * module-manager.ts, account-manager.ts) PLUS hand-crafted edge cases
 * (zero, max uint, odd-length bytes, leading-zero hex, large bigints, empty
 * arrays). No randomness.
 */
import { describe, it, expect } from "vitest";
import { encodeAbiParams, decodeAbiParams, solidityPacked } from "./abi-encoding";

// Golden values: byte-equal to ethers v6 + accepted on-chain (captured from the
// former differential test against ethers; see this file's git history).
const GOLDEN = {
  "K_0x": "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  "K_DEADBEEF": "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
  "K_BEEF": "0x50cc9609ed13c878caf0b7ac27b34f56c318680963224914c6ea863d460f8a7f",
  "encode": {
    "golden: userOp packed fields (8-tuple)": "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000002ac5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470d4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000052082222222222222222222222222222222222222222222222222222222222222222c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    "golden: outer hash encode (bytes32,address,uint256)": "0x50cc9609ed13c878caf0b7ac27b34f56c318680963224914c6ea863d460f8a7f0000000000000000000000000000000071727de22e5e9d8baf0edac6f37da0320000000000000000000000000000000000000000000000000000000000aa37dc",
    "golden: force-exit uint8 OPTIMISM": "0x0000000000000000000000000000000000000000000000000000000000000001",
    "golden: force-exit uint8 ARBITRUM": "0x0000000000000000000000000000000000000000000000000000000000000002",
    "golden: uint256 = 5": "0x0000000000000000000000000000000000000000000000000000000000000005",
    "golden: uint256 = 0": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "golden: single address": "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "golden: single bytes32": "0xabababababababababababababababababababababababababababababababab",
    "edge: zero address": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "edge: max uint256": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: uint8 max (255)": "0x00000000000000000000000000000000000000000000000000000000000000ff",
    "edge: bytes32 zero": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "edge: bytes32 max": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: number vs bigint (uint256 = 7)": "0x0000000000000000000000000000000000000000000000000000000000000007",
    "edge: empty dynamic bytes": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
    "edge: odd-ish dynamic bytes (3 bytes)": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003abcdef0000000000000000000000000000000000000000000000000000000000",
    "edge: dynamic bytes 33 bytes (crosses word boundary)": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000215a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a00000000000000000000000000000000000000000000000000000000000000",
    "edge: leading-zero dynamic bytes": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020001000000000000000000000000000000000000000000000000000000000000",
    "edge: string utf8": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e494e5354414c4c5f4d4f44554c45000000000000000000000000000000000000",
    "edge: empty string": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
    "edge: dynamic uint256[] empty": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
    "edge: dynamic uint256[] with zero/max": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: bytes32[] (nodeIds shape)": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003abababababababababababababababababababababababababababababababab0000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: mixed dynamic+static (string,uint256,address,bytes)": "0x0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000ab54a98ceb1f0ad2000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000f4143434550545f475541524449414e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c0ffee0000000000000000000000000000000000000000000000000000000000",
    "edge: tuple (address,uint256)": "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb922660000000000000000000000000000000000000000000000000000000000000063"
  },
  "decodeData": {
    "golden: uint256 (recovery idx decode)": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "golden: uint256 = 5": "0x0000000000000000000000000000000000000000000000000000000000000005",
    "golden: address": "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "golden: bytes32": "0xabababababababababababababababababababababababababababababababab",
    "edge: max uint256": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: zero address": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "edge: multi (address,uint256,bytes)": "0x0000000000000000000000001111111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004deadbeef00000000000000000000000000000000000000000000000000000000",
    "edge: dynamic bytes empty": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
    "edge: string": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e494e5354414c4c5f4d4f44554c45000000000000000000000000000000000000"
  },
  "packed": {
    "golden: bls nodeIdsLength (uint256)": "0x0000000000000000000000000000000000000000000000000000000000000003",
    "golden: bls nodeIdsBytes (bytes32 x3)": "0xabababababababababababababababababababababababababababababababab0000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "golden: bls packSignature (6 x bytes)": "0x01aabbccddeeff1234",
    "golden: cumulative T2 (bytes1 + bytes...)": "0x0411111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111aabbcc",
    "golden: oapd salt (address,string)": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb922666d792d646170702d6964",
    "golden: install module hash preimage": "0x494e5354414c4c5f4d4f44554c450000000000000000000000000000000000000000000000000000000000aa37dc11111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000001f39fd6e51aad88f6f4ce6ab8827279cfffb92266c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    "golden: uninstall module hash preimage": "0x554e494e5354414c4c5f4d4f44554c450000000000000000000000000000000000000000000000000000000000aa37dc11111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000002f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "golden: guardian acceptance hash preimage": "0x4143434550545f475541524449414e0000000000000000000000000000000000000000000000000000000000007a691111111111111111111111111111111111111111f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    "edge: uint256 zero packed": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "edge: uint256 max packed": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "edge: empty string packed": "0x",
    "edge: empty bytes packed": "0x",
    "edge: address+empty string (leading-zero addr)": "0x0000000000000000000000000000000000000000",
    "edge: bytes1 0x00 (leading zero byte)": "0x00ff",
    "edge: zero-length bytes32 list (only length)": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "edge: uint8 + uint16 + uint32 mixed widths": "0xffffffffffffff",
    "edge: string with multibyte utf8": "0x68c3a96c6c6f2de4b896e7958c"
  }
} as const;

// ── Shared golden constants ─────────────────────────────────────────────
const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // anvil[0] (checksummed)
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"; // EntryPoint v0.7
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const B32_A = "0x" + "ab".repeat(32);
const B32_ZERO = "0x" + "00".repeat(32);
const B32_MAX = "0x" + "ff".repeat(32);
const MAX_UINT256 = (1n << 256n) - 1n;

// keccak256 hashes used as encode inputs (golden literals, byte-equal to ethers).
const K_0x = GOLDEN.K_0x;
const K_DEADBEEF = GOLDEN.K_DEADBEEF;
const K_BEEF = GOLDEN.K_BEEF;

describe("abi encoding (golden): encodeAbiParams matches locked ethers output", () => {
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
        K_0x,
        K_DEADBEEF,
        "0x" + "11".repeat(32),
        21000n,
        "0x" + "22".repeat(32),
        K_0x,
      ],
    },
    // ── GOLDEN: userop.builder.ts getUserOpHash outer encode ──
    {
      name: "golden: outer hash encode (bytes32,address,uint256)",
      types: ["bytes32", "address", "uint256"],
      values: [K_BEEF, ENTRYPOINT, 11155420n],
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
      const expected = (GOLDEN.encode as Record<string, string>)[c.name];
      expect(expected).toBeTypeOf("string");
      expect(encodeAbiParams(c.types, c.values)).toBe(expected);
    });
  }
});

describe("abi decoding (golden): decodeAbiParams round-trips locked payloads", () => {
  // Each `data` is the golden ethers-encoded payload for the case values;
  // we decode with viem and assert the values round-trip element-by-element.
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
      const data = (GOLDEN.decodeData as Record<string, string>)[c.name] as `0x${string}`;
      expect(data).toBeTypeOf("string");
      const viemDecoded = decodeAbiParams(c.types, data);
      expect(viemDecoded.length).toBe(c.types.length);
      for (let i = 0; i < c.types.length; i++) {
        expect(norm(viemDecoded[i])).toEqual(norm(c.values[i]));
      }
    });
  }
});

describe("solidityPacked (golden): matches locked ethers.solidityPacked output", () => {
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
      values: ["INSTALL_MODULE", 11155420n, ADDR_A, 1n, ADDR_B, K_0x],
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
      const expected = (GOLDEN.packed as Record<string, string>)[c.name];
      expect(expected).toBeTypeOf("string");
      expect(solidityPacked(c.types, c.values)).toBe(expected);
    });
  }
});
