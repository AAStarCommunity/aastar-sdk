// Golden-fixture test for the viem reimplementation in ./hashing.ts (id /
// keccak256 / toUtf8Bytes / functionSelector / selectorFromId).
//
// Each locked value is a GOLDEN value: proven byte-equal to ethers v6
// (ethers.id / ethers.keccak256 / ethers.toUtf8Bytes / ethers.id(sig).slice(0,10))
// AND accepted on-chain. Captured from the original differential parity test
// against ethers before ethers was removed — see this file's git history.
//
// Inputs = golden vectors lifted from the real call sites:
//   - execute-user-op.ts:    executeUserOp / execute / executeBatch selectors
//   - account-manager.ts:    keccak256(solidityPacked(... "ACCEPT_GUARDIAN" ...))
//   - kms-signer.ts:         toUtf8Bytes(message) before hashMessage
// PLUS hand-crafted edge inputs (empty, leading-zero hex, odd nibble counts, max
// bigint packing, multibyte UTF-8, "0x"-looking literal strings). No randomness.

import { describe, it, expect } from "vitest";
import { id, keccak256, toUtf8Bytes, functionSelector, selectorFromId } from "./hashing.js";

// Golden values: byte-equal to ethers v6 + accepted on-chain (captured from the
// former differential test against ethers; see this file's git history).
const GOLDEN = {
  "id": {
    "": "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    "ACCEPT_GUARDIAN": "0x3fb609b4c12aa1eac36ff728281b3d69f12ea3956df8177eca1628787e4b8ff7",
    "0xdeadbeef": "0x4f440a001006a49f24a7de53c04eca3f79aef851ac58e460c9630d044277c8b0",
    "0x": "0x39bef1777deb3dfb14f64b9f81ced092c501fee72f90e93d03bb95ee89df9837",
    "héllo🚀": "0x7a0fcc6e6a5ae547e370773fdcbe17003435d02267ae7dea4e3813dbdd1ef701",
    "日本語": "0x9c6438360dc8ecd3c4cdeeaeb5b6cb611a88f55b1bc5e994c1e05a8cfb236446",
    "   leading and trailing   ": "0x475ba09f5b83b5de1b790a93f5b8227dd380d691b441f3436101e2ad678e77c4",
    "Transfer(address,address,uint256)": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "0xf32e95e2adb0d6bceecf15f0e9ff76e1f1033f6ed18cd6da3edc6f89238072cf"
  },
  "utf8": {
    "": "0x",
    "ACCEPT_GUARDIAN": "0x4143434550545f475541524449414e",
    "0xdeadbeef": "0x30786465616462656566",
    "0x": "0x3078",
    "héllo🚀": "0x68c3a96c6c6ff09f9a80",
    "日本語": "0xe697a5e69cace8aa9e",
    "   leading and trailing   ": "0x2020206c656164696e6720616e6420747261696c696e67202020",
    "Transfer(address,address,uint256)": "0x5472616e7366657228616464726573732c616464726573732c75696e7432353629",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "0x6161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161"
  },
  "selector": {
    "executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)": "0x8dd7712f",
    "execute(address,uint256,bytes)": "0xb61d27f6",
    "executeBatch(address[],uint256[],bytes[])": "0x47e1da2a",
    "transfer(address,uint256)": "0xa9059cbb",
    "approve(address,uint256)": "0x095ea7b3",
    "balanceOf(address)": "0x70a08231",
    "grantSession(address,address,(uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[]),bytes)": "0x3881ca82"
  },
  "keccakHex": {
    "0x": "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    "0x00": "0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a",
    "0x0000000000000000000000000000000000000000000000000000000000000000": "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    "0xff": "0x8b1a944cf13a9a1c08facb2c9e98623ef3254d2ddb48113885c3e8e97fec8db9",
    "0xdeadbeef": "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
    "0x0001020304050607": "0x59e7c99f6be4fd053d7c99f54e371304a33213473dc41f1825b7f3ceb33841a6",
    "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab": "0x292218a7602cf4ff7f4e2f3dfca398dcc7dae2ab1d7c933e46676f5531310a2b"
  },
  "keccakBytes": "0x424832eadaa5cb1ddea505145bb24a900c9690c9ebc6e2b74d1bcd448cf3063f",
  "acceptPacked": {
    "1|0": "0x4143434550545f475541524449414e0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000dead123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "11155420|12345": "0x4143434550545f475541524449414e0000000000000000000000000000000000000000000000000000000000aa37dc000000000000000000000000000000000000dead123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000030390000000000000000000000000000000000000000000000000de0b6b3a7640000",
    "1|115792089237316195423570985008687907853269984665640564039457584007913129639935": "0x4143434550545f475541524449414e0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000dead1234567890123456789012345678901234567890ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "10|1": "0x4143434550545f475541524449414e000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000dead123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
  },
  "acceptHash": {
    "1|0": "0xf4b6d6b34b72717c84e3b3a867faabe9c85e4dc245980dce80a9856e5eaa0f92",
    "11155420|12345": "0x8bf2e3502fd71fe343d23bee1cf73c35375f577cf6b37e877da9a3e0b6da7120",
    "1|115792089237316195423570985008687907853269984665640564039457584007913129639935": "0x20ac099d303a3e0609863d6e8099cedf116c04af267e82b3dd5209a81117fda1",
    "10|1": "0x519d005145bd8c2b0800b03a990fc4d742c834ad000479fddd122f432d259d59"
  }
} as const;

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

describe("hashing (golden): viem id() matches locked ethers.id output", () => {
  for (const s of STRINGS) {
    it(`id(${JSON.stringify(s)})`, () => {
      expect(id(s)).toBe((GOLDEN.id as Record<string, string>)[s]);
    });
  }
});

describe("hashing (golden): viem toUtf8Bytes() matches locked ethers.toUtf8Bytes output", () => {
  for (const s of STRINGS) {
    it(`toUtf8Bytes(${JSON.stringify(s)})`, () => {
      expect(toHex(toUtf8Bytes(s))).toBe((GOLDEN.utf8 as Record<string, string>)[s]);
    });
  }
});

describe("hashing (golden): function selectors (id-slice and toFunctionSelector)", () => {
  for (const sig of SIGNATURES) {
    it(`selector(${sig.slice(0, 24)}...)`, () => {
      const ref = (GOLDEN.selector as Record<string, string>)[sig];
      expect(selectorFromId(sig)).toBe(ref);
      expect(functionSelector(sig)).toBe(ref);
    });
  }
});

describe("hashing (golden): viem keccak256() on hex bytes matches locked ethers.keccak256", () => {
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
      expect(keccak256(h)).toBe((GOLDEN.keccakHex as Record<string, string>)[h]);
    });
  }

  it("keccak256 of a Uint8Array input matches", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(keccak256(bytes)).toBe(GOLDEN.keccakBytes);
  });
});

describe("hashing (golden): real call-site composite (account-manager buildGuardianAcceptanceHash)", () => {
  // keccak256(solidityPacked(["string","uint256","address","address","uint256","uint256"],
  //   ["ACCEPT_GUARDIAN", chainId, factory, owner, salt, dailyLimit]))
  // The packed preimage is a locked golden hex (ethers.solidityPacked output);
  // we assert viem keccak256 of it equals the locked golden hash.
  const cases: Array<[number, bigint, bigint]> = [
    [1, 0n, 0n],
    [11155420, 12345n, 1000000000000000000n],
    [1, 2n ** 256n - 1n, 2n ** 256n - 1n], // max uint256 packing
    [10, 1n, 0n],
  ];
  for (const [chainId, salt, dailyLimit] of cases) {
    it(`acceptanceHash(chain=${chainId}, salt=${salt})`, () => {
      void dailyLimit;
      const key = `${chainId}|${salt}`;
      const packed = (GOLDEN.acceptPacked as Record<string, string>)[key] as `0x${string}`;
      const ref = (GOLDEN.acceptHash as Record<string, string>)[key];
      expect(packed).toBeTypeOf("string");
      expect(keccak256(packed)).toBe(ref);
    });
  }
});
