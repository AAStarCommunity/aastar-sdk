/**
 * Golden-fixture test for the viem reimplementation in ./signatures.ts
 * (normalizeSignature / hashMessage / recoverAddress / verifyMessage /
 * buildAuthorizationHash / verifyAuthorization).
 *
 * Each locked value is a GOLDEN value: proven byte-equal to ethers v6
 * (ethers.Signature.from(...).serialized / ethers.hashMessage / ethers.recoverAddress /
 * ethers.verifyMessage / EIP-7702 RLP auth hash) AND accepted on-chain. The real
 * signatures were minted deterministically (RFC-6979) by ethers SigningKey/Wallet
 * over the fixed PK below, then captured before ethers was removed — see this
 * file's git history (former differential parity test).
 *
 * Focus: the 65-byte r(32)||s(32)||v(1) layout used by the KMS signer and the
 * EIP-7702 delegate service, where v is 27/28 (NOT yParity 0/1). Plus the
 * personal-message hashing / recovery helpers and the EIP-7702 RLP auth hash.
 */
import { describe, it, expect } from "vitest";
import type { Address, Hex } from "viem";
import {
  normalizeSignature,
  hashMessage,
  recoverAddress,
  verifyMessage,
  buildAuthorizationHash,
  verifyAuthorization,
} from "./signatures";

// Golden values: byte-equal to ethers v6 + accepted on-chain (captured from the
// former differential test against ethers; see this file's git history).
const GOLDEN = {
  "walletAddress": "0xe239cdc5fbe977a8a141B72194D3CF8c41bC5BC6",
  "digest4": "0xc28c30426a8a22b3ac758805507d04993e34aa5af65b990a296b4bdebbbdc7cc",
  "digestSig": {
    "0x0000000000000000000000000000000000000000000000000000000000000000": "0xa98426c6c39022d20caaaedb43bf53a3b940ba53c1af52bad08a930bbafc43244cfa98f6f040ef7f1e2faf61f75d56bb76cd4f6fb255b26ebc0b646d85e95bed1b",
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff": "0x4817a09ac943d8da05f0a98cbfb92fe4cff45dc0408f930b7ac7ce2e0a1df14e498edd8228d92b0f90ef4a68c85d97a3cfabdffa6a4b87f0b139509fa70a0c5c1c",
    "0x0000000000000000000000000000000000000000000000000000000000000001": "0x9fe0b86405ee0b04e681006185513fe908843b64ed6321971eb5af8bfb7980cc463c5329fdfa99228f180bdb5cc6254aa3e402b520d4c5317362d8d5cf666a6c1c",
    "0xdededededededededededededededededededededededededededededededede": "0x5d9dd5528a87b340d30f3cbbcf0b17e2eeb3e76061aaa0ab73ecd4bcf32db8e12b7fb549e9ab1ee4b8348b93666b4590ec2f6473da55c480e9ca358a6e040e7f1b",
    "0xc28c30426a8a22b3ac758805507d04993e34aa5af65b990a296b4bdebbbdc7cc": "0xfbfc99536129cea162f1cefd12b2a1fea7e3ae3acbca76d84e85bf02cc1b47724d7124352b536a8a79ec23fa9e94db8326c7a9d2ab001b236506590d74709b151b"
  },
  "digestNorm": {
    "0x0000000000000000000000000000000000000000000000000000000000000000": "0xa98426c6c39022d20caaaedb43bf53a3b940ba53c1af52bad08a930bbafc43244cfa98f6f040ef7f1e2faf61f75d56bb76cd4f6fb255b26ebc0b646d85e95bed1b",
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff": "0x4817a09ac943d8da05f0a98cbfb92fe4cff45dc0408f930b7ac7ce2e0a1df14e498edd8228d92b0f90ef4a68c85d97a3cfabdffa6a4b87f0b139509fa70a0c5c1c",
    "0x0000000000000000000000000000000000000000000000000000000000000001": "0x9fe0b86405ee0b04e681006185513fe908843b64ed6321971eb5af8bfb7980cc463c5329fdfa99228f180bdb5cc6254aa3e402b520d4c5317362d8d5cf666a6c1c",
    "0xdededededededededededededededededededededededededededededededede": "0x5d9dd5528a87b340d30f3cbbcf0b17e2eeb3e76061aaa0ab73ecd4bcf32db8e12b7fb549e9ab1ee4b8348b93666b4590ec2f6473da55c480e9ca358a6e040e7f1b",
    "0xc28c30426a8a22b3ac758805507d04993e34aa5af65b990a296b4bdebbbdc7cc": "0xfbfc99536129cea162f1cefd12b2a1fea7e3ae3acbca76d84e85bf02cc1b47724d7124352b536a8a79ec23fa9e94db8326c7a9d2ab001b236506590d74709b151b"
  },
  "crafted": {
    "1b": "0x111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222221b",
    "1c": "0x111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222221c",
    "00": "0x111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222221b",
    "01": "0x111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222221c"
  },
  "hashMsgStr": {
    "": "0x5f35dce98ba4fba25530a026ed80b2cecdaa31091ba4958b99b52ea1d068adad",
    "a": "0x34f291c0b5f0c13c8f43e9d37c04094c22234da43f4040adb36654c98235b4b3",
    "hello": "0x50b2c43fd39106bafbba0da34fc430e1f91e3c96ea2acee2bc34119f92b37750",
    "0x1234": "0x088c70f4a0e94d341cd3100ca998ff87d69afc9d638ca43483f3cccafec99e93",
    "unicode é中🍄": "0xca76d5833c5d156c6c19ddc4168a5cf9e3f47637faee3f47cd65b50746998275",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx": "0xdfc7e3b24dc44f6913925edd512a923e1a2577f38a28d18497de001f60516da7"
  },
  "hashMsgBytes": [
    "0x5f35dce98ba4fba25530a026ed80b2cecdaa31091ba4958b99b52ea1d068adad",
    "0xde4cdc789ddc73a0a79bd8cf489c37d5254a1e14a0fb771ce4e77c0206c3d0e1",
    "0x0be7deb6e7a189a6b66096dd0abc8ec63a7c7f59b2b0eebe395d60778a337908",
    "0x390608d8b7e6fbb70966a16fdec33f7cc2aa4a84711d3cf77f2d4b491209e6b5"
  ],
  "vmStrSig": {
    "": "0x9ef325bbd8e150ca8ec989b534c7046740dde519f4ec46c89705f3d3c31913613b23746fe270f594cc7f92ba6dd170387fbd8316e37fc6ee2876c8ce198d48e81b",
    "hello": "0xc7fe3bb105e378d907b37d6cba544a324250967a0b5b5f46ff37c8e00709b2da4259fd6b8a4a2bf918655ef618715c3c028ca8d0acf2587c625728caa1bb96541c",
    "0xdeadbeef": "0x41abe7fd2f3d28460cd9f89b53c9d01d5717e6ec055d9e5adc040c1bc56ae366579f6148909fc9067b7ad55c8f4cec422b7f1d27c63dd50b89f779b9ad77ca871c",
    "unicode é中🍄": "0x2d539434f43a826e129a0f130412ccb83f748fc128cb8055529e24c31b0e717a124f2ba67d8626a95544d076641586cf518c353d5c94d2480676e0805d7aef691b"
  },
  "vmBytesSig": [
    "0x261c6315274891a2ee001f5e08745b13a35b5705fccbc7bb44595347a0b8a26d055a27277c511500d705c845a814316f2f9cc8af7b328bf40ce42d9f21f12fce1c",
    "0x10a35f0104a37a3adfa805f378c70fa1dc91f58df686305a3cbcaf2bdc0f381f144e87fdc433e1160e60f172b656ae90a012630ee60b5d24766f7d17ac4479f21c"
  ],
  "authHash": {
    "11155111|5": "0x0f44a03067fcc991c66d2451a30027892833d64c124e26b50ec77d2997fb9e38",
    "0|0": "0x5188c5e85d518ec3529ced89c8ccbe72f50f16a32295546a02467a40d6255c8b",
    "1|0": "0xe5b6b005eb15835cbe3b1a4817d8c0c39f6a865c59019432c1004bda6912e283",
    "0|1": "0xa383dd8628446cd438916dea00b2dd0684da4c77ec041c12704c43f9c312db70",
    "255|255": "0xdabf529fc893c67dca883a8eea69955e1ae94c60d43588d066f427a9a1287e2a",
    "256|256": "0x8f00add9ab74027af9bd7eeedd1458642f87d250c5bc443144f81879a972b5e9",
    "15|15": "0x6aa7424fd94ca94d1651d0ebbce5d1eab3566b8c2e9da3493d73d2c003442c26",
    "11155111|18446744073709551615": "0x690ad077cd9c23e43d3c0db0f86fb79a06feb40b6fe5c642e43c323436d54f51"
  },
  "vaSig": {
    "11155111|5": "0x3feafde30a97498bab5769a51e3d6fc4e7f08678ca7515722fdac8ae246280390e4b8aa37525cc5e9bd92f26547a42a74dd2ef7eb830d7a0fb237cdd21f972251c",
    "1|0": "0x3021c1efc497217d8bedd33f488e87eb6742026f331fd2d741e8ec1fa355fea6610ead8fd47c4d17d65879a16af788d8059656c6f5874bc42ecdc24637f654721b",
    "0|0": "0xfe06abae68a2da0f5d8a657e41a80285757862e846d0128e1aab565420ec77fa705946028ced0d1c04d0523f13743715ec9733d233bd910a3aeb98a10977ffa31c"
  }
} as const;

// Golden constants taken from the real call sites.
// eip7702-delegate-service.ts: AIR_ACCOUNT_DELEGATE_ADDRESS (Sepolia singleton).
const DELEGATE_ADDRESS: Address = "0x8603AAF6C3f07fdae810B323c95a198D796EC52E";

// Deterministic signer address (derived from PK 0xab*32) — used as the expected
// recovered/verified EOA. The matching signatures are locked in GOLDEN.
const WALLET_ADDRESS = GOLDEN.walletAddress as Address;

// Hand-crafted 32-byte digests: zero, max, leading-zero, mid-pattern, + a real
// keccak digest (the last entry is keccak256(toUtf8Bytes("airaccount-kms-golden"))).
const DIGESTS: Hex[] = [
  `0x${"00".repeat(32)}`,
  `0x${"ff".repeat(32)}`,
  `0x${"00".repeat(31)}01`,
  `0x${"de".repeat(32)}`,
  GOLDEN.digest4 as Hex,
];

describe("signature normalization (golden vs locked ethers output)", () => {
  // ── 65-byte r||s||v normalization (KMS + EIP-7702 layout) ──────────
  describe("normalizeSignature — 65-byte r||s||v with v=27/28", () => {
    // Real signatures over each digest (locked; minted by ethers SigningKey,
    // 65-byte serialized with v already 27/28 — the KMS wire form).
    for (const digest of DIGESTS) {
      it(`real sig over digest ${digest.slice(0, 10)}…`, () => {
        const sig65 = (GOLDEN.digestSig as Record<string, string>)[digest] as Hex;
        const expected = (GOLDEN.digestNorm as Record<string, string>)[digest];
        const viemOut = normalizeSignature(sig65);
        expect(viemOut).toBe(expected);
        // Hard invariants: 65 bytes, last byte is 27/28, not 0/1.
        expect(viemOut.length).toBe(132); // 0x + 130 hex
        expect(["1b", "1c"]).toContain(viemOut.slice(-2));
      });
    }

    // Hand-crafted edge inputs: same r/s, final byte = 27/28/0/1. viem must
    // normalize the trailing byte to 27/28 to match the locked ethers output.
    const r = "11".repeat(32);
    const s = "22".repeat(32);
    const vBytes: Array<[string, string]> = [
      ["1b", "v=27"],
      ["1c", "v=28"],
      ["00", "yParity=0 -> 27"],
      ["01", "yParity=1 -> 28"],
    ];
    for (const [vb, label] of vBytes) {
      it(`crafted sig (${label})`, () => {
        const sig65 = `0x${r}${s}${vb}` as Hex;
        const expected = (GOLDEN.crafted as Record<string, string>)[vb];
        const viemOut = normalizeSignature(sig65);
        expect(viemOut).toBe(expected);
        expect(viemOut.length).toBe(132);
      });
    }

    // ── DISCREPANCY (documented): non-canonical (high) s ─────────────
    // ethers enforced EIP-2 low-s canonicality: Signature.from(...).serialized
    // THREW "non-canonical s" for any s > N/2. viem's parseSignature /
    // serializeSignature does NOT enforce low-s and round-trips a range-valid
    // high-s signature. This edge does not occur on the KMS / EIP-7702 paths
    // (real signers always produce canonical low-s), but it is a true behavioral
    // divergence in the helpers, locked here as viem's accepted behavior.
    it("non-canonical high-s: viem accepts and preserves bytes (DISCREPANCY)", () => {
      // secp256k1 order N; s = N-1 is in-range (< N) but non-canonical (> N/2).
      const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
      const highS = (N - 1n).toString(16).padStart(64, "0");
      const sig65 = `0x${"01".repeat(32)}${highS}1c` as Hex;

      // viem: succeeds, producing the 65-byte r||s||v form with v preserved.
      const viemOut = normalizeSignature(sig65);
      expect(viemOut.length).toBe(132);
      expect(viemOut).toBe(sig65); // bytes preserved unchanged (incl. high s)
      expect(viemOut.slice(-2)).toBe("1c");
    });
  });

  // ── hashMessage (golden) ──────────────────────────────────────────
  describe("hashMessage", () => {
    const stringMessages = ["", "a", "hello", "0x1234", "unicode é中🍄", "x".repeat(257)];
    for (const msg of stringMessages) {
      it(`string ${JSON.stringify(msg).slice(0, 24)}`, () => {
        expect(hashMessage(msg)).toBe((GOLDEN.hashMsgStr as Record<string, string>)[msg]);
      });
    }

    const byteMessages: Uint8Array[] = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([0, 1, 2, 255]),
      new Uint8Array(Array.from({ length: 64 }, (_, i) => i)),
    ];
    for (const [i, bytes] of byteMessages.entries()) {
      it(`bytes #${i} (len ${bytes.length})`, () => {
        expect(hashMessage(bytes)).toBe(GOLDEN.hashMsgBytes[i]);
      });
    }
  });

  // ── recoverAddress (golden) ───────────────────────────────────────
  describe("recoverAddress", () => {
    for (const digest of DIGESTS) {
      it(`recover from digest ${digest.slice(0, 10)}…`, async () => {
        const sig65 = (GOLDEN.digestSig as Record<string, string>)[digest] as Hex;
        const viemOut = await recoverAddress(digest, sig65);
        // Recovers the locked signer for every digest.
        expect(viemOut).toBe(WALLET_ADDRESS);
      });
    }
  });

  // ── verifyMessage (golden; viem is async) ─────────────────────────
  describe("verifyMessage", () => {
    const stringMessages = ["", "hello", "0xdeadbeef", "unicode é中🍄"];
    for (const msg of stringMessages) {
      it(`string ${JSON.stringify(msg)}`, async () => {
        const sig = (GOLDEN.vmStrSig as Record<string, string>)[msg] as Hex;
        const viemOut = await verifyMessage(msg, sig);
        expect(viemOut).toBe(WALLET_ADDRESS);
      });
    }

    const byteMessages: Uint8Array[] = [
      new Uint8Array([0, 1, 2, 255]),
      new Uint8Array(Array.from({ length: 32 }, (_, i) => 255 - i)),
    ];
    for (const [i, bytes] of byteMessages.entries()) {
      it(`bytes #${i}`, async () => {
        const sig = GOLDEN.vmBytesSig[i] as Hex;
        const viemOut = await verifyMessage(bytes, sig);
        expect(viemOut).toBe(WALLET_ADDRESS);
      });
    }
  });

  // ── EIP-7702 buildAuthorizationHash (golden) ──────────────────────
  describe("buildAuthorizationHash", () => {
    const cases: Array<[number, bigint]> = [
      [11155111, 5n], // Sepolia, typical nonce
      [0, 0n], // both zero -> empty RLP byte strings
      [1, 0n], // mainnet, nonce 0
      [0, 1n], // chain 0, nonce 1
      [255, 255n], // single-byte boundary
      [256, 256n], // two-byte boundary (leading-zero minimal encoding)
      [15, 15n], // odd-nibble values
      [11155111, 18446744073709551615n], // u64 max nonce
    ];
    for (const [chainId, nonce] of cases) {
      it(`chainId=${chainId} nonce=${nonce}`, () => {
        const expected = (GOLDEN.authHash as Record<string, string>)[`${chainId}|${nonce}`];
        expect(expected).toBeTypeOf("string");
        expect(buildAuthorizationHash(chainId, nonce, DELEGATE_ADDRESS)).toBe(expected);
      });
    }
  });

  // ── EIP-7702 verifyAuthorization (golden) ─────────────────────────
  describe("verifyAuthorization", () => {
    const cases: Array<[number, bigint]> = [
      [11155111, 5n],
      [1, 0n],
      [0, 0n],
    ];
    for (const [chainId, nonce] of cases) {
      it(`valid sig accepted; wrong eoa rejected (chainId=${chainId} nonce=${nonce})`, async () => {
        const sig65 = (GOLDEN.vaSig as Record<string, string>)[`${chainId}|${nonce}`] as Hex;

        const viemValid = await verifyAuthorization(
          WALLET_ADDRESS,
          chainId,
          nonce,
          sig65,
          DELEGATE_ADDRESS
        );
        expect(viemValid).toBe(true);

        // Wrong EOA must be rejected.
        const wrongEoa = "0x000000000000000000000000000000000000dEaD" as Address;
        const viemWrong = await verifyAuthorization(
          wrongEoa,
          chainId,
          nonce,
          sig65,
          DELEGATE_ADDRESS
        );
        expect(viemWrong).toBe(false);
      });
    }
  });
});
