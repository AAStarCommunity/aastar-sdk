// Differential parity test: ethers (reference, inline) vs the viem reimplementation
// in ./hashing.ts. For the SAME inputs we compute the reference via the ethers API
// directly and assert byte-for-byte equality with the viem output.
//
// Inputs = golden vectors lifted from the real call sites:
//   - execute-user-op.ts:    executeUserOp / execute / executeBatch selectors
//   - account-manager.ts:    keccak256(solidityPacked(... "ACCEPT_GUARDIAN" ...))
//   - kms-signer.ts:         toUtf8Bytes(message) before hashMessage
// PLUS hand-crafted edge inputs (empty, leading-zero hex, odd nibble counts, max
// bigint packing, multibyte UTF-8, "0x"-looking literal strings). No randomness.

import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { id, keccak256, toUtf8Bytes, functionSelector, selectorFromId } from "./hashing.js";

const toHex = (u: Uint8Array) => "0x" + Buffer.from(u).toString("hex");

// Golden signatures from execute-user-op.ts + general selector cases.
const SIGNATURES: string[] = [
  "executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)",
  "execute(address,uint256,bytes)",
  "executeBatch(address[],uint256[],bytes[])",
  "transfer(address,uint256)",
  "approve(address,uint256)",
  "balanceOf(address)",
  "grantSession(address,address,(uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[]),bytes)",
];

// Arbitrary strings for id()/toUtf8Bytes() — incl. the "0x"-looking trap.
const STRINGS: string[] = [
  "",
  "ACCEPT_GUARDIAN",
  "0xdeadbeef", // MUST be treated as literal UTF-8 text, not hex bytes
  "0x", // bare prefix, still UTF-8
  "héllo🚀", // multibyte / surrogate pair
  "日本語",
  "   leading and trailing   ",
  "Transfer(address,address,uint256)", // event-topic style usage
  "a".repeat(257), // long string crossing buffer boundaries
];

describe("hashing parity: ethers.id vs viem id()", () => {
  for (const s of STRINGS) {
    it(`id(${JSON.stringify(s)})`, () => {
      expect(id(s)).toBe(ethers.id(s));
    });
  }
});

describe("hashing parity: ethers.toUtf8Bytes vs viem toUtf8Bytes()", () => {
  for (const s of STRINGS) {
    it(`toUtf8Bytes(${JSON.stringify(s)})`, () => {
      const ref = ethers.toUtf8Bytes(s);
      const got = toUtf8Bytes(s);
      expect(toHex(got)).toBe(toHex(ref));
    });
  }
});

describe("hashing parity: function selectors (id-slice and toFunctionSelector)", () => {
  for (const sig of SIGNATURES) {
    it(`selector(${sig.slice(0, 24)}...)`, () => {
      const ref = ethers.id(sig).slice(0, 10);
      expect(selectorFromId(sig)).toBe(ref);
      expect(functionSelector(sig)).toBe(ref);
    });
  }
});

describe("hashing parity: ethers.keccak256 vs viem keccak256() on hex bytes", () => {
  // Edge hex vectors: empty, single zero byte, leading zeros, full 32-byte, odd-length-safe.
  const HEX_VECTORS: `0x${string}`[] = [
    "0x",
    "0x00",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0xff",
    "0xdeadbeef",
    "0x0001020304050607",
    ("0x" + "ab".repeat(96)) as `0x${string}`, // 96-byte blob
  ];
  for (const h of HEX_VECTORS) {
    it(`keccak256(${h.length > 20 ? h.slice(0, 18) + "..." : h})`, () => {
      expect(keccak256(h)).toBe(ethers.keccak256(h));
    });
  }

  it("keccak256 of a Uint8Array input matches", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(keccak256(bytes)).toBe(ethers.keccak256(bytes));
  });
});

describe("hashing parity: real call-site composite (account-manager buildGuardianAcceptanceHash)", () => {
  // keccak256(solidityPacked(["string","uint256","address","address","uint256","uint256"],
  //   ["ACCEPT_GUARDIAN", chainId, factory, owner, salt, dailyLimit]))
  // solidityPacked is an encoding concern (different group); we only use it inline to
  // produce realistic input bytes, then assert the keccak256 step is identical.
  const owner = "0x1234567890123456789012345678901234567890";
  const factory = "0x000000000000000000000000000000000000dEaD";
  const cases: Array<[number, bigint, bigint]> = [
    [1, 0n, 0n],
    [11155420, 12345n, 1000000000000000000n],
    [1, 2n ** 256n - 1n, 2n ** 256n - 1n], // max uint256 packing
    [10, 1n, 0n],
  ];
  for (const [chainId, salt, dailyLimit] of cases) {
    it(`acceptanceHash(chain=${chainId}, salt=${salt})`, () => {
      const packed = ethers.solidityPacked(
        ["string", "uint256", "address", "address", "uint256", "uint256"],
        ["ACCEPT_GUARDIAN", chainId, factory, owner, salt, dailyLimit]
      ) as `0x${string}`;
      const ref = ethers.keccak256(packed);
      expect(keccak256(packed)).toBe(ref);
    });
  }
});
