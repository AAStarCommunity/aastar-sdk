/**
 * Differential parity test: ethers (reference) vs the viem reimplementation in
 * ./signatures.ts. For the SAME inputs we compute the result via the ethers API
 * inline AND via the viem module, then assert byte-for-byte equality.
 *
 * Focus: the 65-byte r(32)||s(32)||v(1) layout used by the KMS signer and the
 * EIP-7702 delegate service, where v is 27/28 (NOT yParity 0/1). Plus the
 * personal-message hashing / recovery helpers and the EIP-7702 RLP auth hash.
 */
import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import type { Address, Hex } from "viem";
import {
  normalizeSignature,
  hashMessage,
  recoverAddress,
  verifyMessage,
  buildAuthorizationHash,
  verifyAuthorization,
} from "./signatures";

// Golden constants taken from the real call sites.
// eip7702-delegate-service.ts: AIR_ACCOUNT_DELEGATE_ADDRESS (Sepolia singleton).
const DELEGATE_ADDRESS: Address = "0x8603AAF6C3f07fdae810B323c95a198D796EC52E";

// Deterministic signer (no randomness). Used to mint real recoverable sigs.
const PK: Hex = `0x${"ab".repeat(32)}`;
const wallet = new ethers.Wallet(PK);
const signingKey = new ethers.SigningKey(PK);

// Hand-crafted 32-byte digests: zero, max, leading-zero, mid-pattern.
const DIGESTS: Hex[] = [
  `0x${"00".repeat(32)}`,
  `0x${"ff".repeat(32)}`,
  `0x${"00".repeat(31)}01`,
  `0x${"de".repeat(32)}`,
  ethers.keccak256(ethers.toUtf8Bytes("airaccount-kms-golden")) as Hex,
];

describe("signature normalization parity (ethers vs viem)", () => {
  // ── 65-byte r||s||v normalization (KMS + EIP-7702 layout) ──────────
  describe("normalizeSignature — 65-byte r||s||v with v=27/28", () => {
    // Real signatures over each digest produced by ethers SigningKey, which
    // yields a 65-byte serialized sig with v already 27/28 (the KMS wire form).
    for (const digest of DIGESTS) {
      it(`real sig over digest ${digest.slice(0, 10)}…`, () => {
        const sig = signingKey.sign(digest);
        const sig65 = sig.serialized as Hex; // r||s||v, v=27/28
        const ethersOut = ethers.Signature.from(sig65).serialized;
        const viemOut = normalizeSignature(sig65);
        expect(viemOut).toBe(ethersOut);
        // Hard invariants: 65 bytes, last byte is 27/28, not 0/1.
        expect(viemOut.length).toBe(132); // 0x + 130 hex
        expect(["1b", "1c"]).toContain(viemOut.slice(-2));
      });
    }

    // Hand-crafted edge inputs: same r/s, final byte = 27/28/0/1. ethers and
    // viem must BOTH normalize the trailing byte to 27/28 identically.
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
        const ethersOut = ethers.Signature.from(sig65).serialized;
        const viemOut = normalizeSignature(sig65);
        expect(viemOut).toBe(ethersOut);
        expect(viemOut.length).toBe(132);
      });
    }

    // ── DISCREPANCY_FOUND: non-canonical (high) s ────────────────────
    // ethers enforces EIP-2 low-s canonicality: Signature.from(...).serialized
    // THROWS "non-canonical s" for any s > N/2. viem's parseSignature /
    // serializeSignature does NOT enforce low-s and will happily round-trip a
    // range-valid high-s signature. This edge does not occur on the KMS /
    // EIP-7702 paths (the TEE and real signers always produce canonical low-s
    // signatures), but it is a true behavioral divergence in the helpers.
    //
    // We do NOT change the viem code to mimic ethers here — we document the
    // reference (ethers) behavior and assert viem's divergence.
    it("non-canonical high-s: ethers throws, viem accepts (DISCREPANCY)", () => {
      // secp256k1 order N; s = N-1 is in-range (< N) but non-canonical (> N/2).
      const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
      const highS = (N - 1n).toString(16).padStart(64, "0");
      const sig65 = `0x${"01".repeat(32)}${highS}1c` as Hex;

      // ethers reference: rejects non-canonical s.
      expect(() => ethers.Signature.from(sig65).serialized).toThrow(/non-canonical s/);

      // viem: succeeds, producing the 65-byte r||s||v form with v preserved.
      const viemOut = normalizeSignature(sig65);
      expect(viemOut.length).toBe(132);
      expect(viemOut).toBe(sig65); // bytes preserved unchanged (incl. high s)
      expect(viemOut.slice(-2)).toBe("1c");
    });
  });

  // ── ethers.hashMessage parity ─────────────────────────────────────
  describe("hashMessage", () => {
    const stringMessages = ["", "a", "hello", "0x1234", "unicode é中🍄", "x".repeat(257)];
    for (const msg of stringMessages) {
      it(`string ${JSON.stringify(msg).slice(0, 24)}`, () => {
        expect(hashMessage(msg)).toBe(ethers.hashMessage(msg));
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
        expect(hashMessage(bytes)).toBe(ethers.hashMessage(bytes));
      });
    }
  });

  // ── recoverAddress parity ─────────────────────────────────────────
  describe("recoverAddress", () => {
    for (const digest of DIGESTS) {
      it(`recover from digest ${digest.slice(0, 10)}…`, async () => {
        const sig65 = signingKey.sign(digest).serialized as Hex;
        const ethersOut = ethers.recoverAddress(digest, sig65);
        const viemOut = await recoverAddress(digest, sig65);
        expect(viemOut).toBe(ethersOut);
        // Sanity: recovers the signer.
        expect(viemOut).toBe(wallet.address);
      });
    }
  });

  // ── verifyMessage parity (viem is async) ──────────────────────────
  describe("verifyMessage", () => {
    const stringMessages = ["", "hello", "0xdeadbeef", "unicode é中🍄"];
    for (const msg of stringMessages) {
      it(`string ${JSON.stringify(msg)}`, async () => {
        const sig = await wallet.signMessage(msg);
        const ethersOut = ethers.verifyMessage(msg, sig);
        const viemOut = await verifyMessage(msg, sig as Hex);
        expect(viemOut).toBe(ethersOut);
        expect(viemOut).toBe(wallet.address);
      });
    }

    const byteMessages: Uint8Array[] = [
      new Uint8Array([0, 1, 2, 255]),
      new Uint8Array(Array.from({ length: 32 }, (_, i) => 255 - i)),
    ];
    for (const [i, bytes] of byteMessages.entries()) {
      it(`bytes #${i}`, async () => {
        const sig = await wallet.signMessage(bytes);
        const ethersOut = ethers.verifyMessage(bytes, sig);
        const viemOut = await verifyMessage(bytes, sig as Hex);
        expect(viemOut).toBe(ethersOut);
      });
    }
  });

  // ── EIP-7702 buildAuthorizationHash parity ────────────────────────
  describe("buildAuthorizationHash", () => {
    const ethersBuild = (chainId: number, nonce: bigint): string => {
      const encoded = ethers.encodeRlp([
        chainId === 0 ? "0x" : ethers.toBeHex(chainId),
        DELEGATE_ADDRESS,
        nonce === 0n ? "0x" : ethers.toBeHex(nonce),
      ]);
      return ethers.keccak256(ethers.concat(["0x05", encoded]));
    };

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
        const ethersOut = ethersBuild(chainId, nonce);
        const viemOut = buildAuthorizationHash(chainId, nonce, DELEGATE_ADDRESS);
        expect(viemOut).toBe(ethersOut);
      });
    }
  });

  // ── EIP-7702 verifyAuthorization parity ───────────────────────────
  describe("verifyAuthorization", () => {
    const ethersBuild = (chainId: number, nonce: bigint): string => {
      const encoded = ethers.encodeRlp([
        chainId === 0 ? "0x" : ethers.toBeHex(chainId),
        DELEGATE_ADDRESS,
        nonce === 0n ? "0x" : ethers.toBeHex(nonce),
      ]);
      return ethers.keccak256(ethers.concat(["0x05", encoded]));
    };

    const cases: Array<[number, bigint]> = [
      [11155111, 5n],
      [1, 0n],
      [0, 0n],
    ];
    for (const [chainId, nonce] of cases) {
      it(`valid sig accepted; wrong eoa rejected (chainId=${chainId} nonce=${nonce})`, async () => {
        const hash = ethersBuild(chainId, nonce);
        const sig65 = signingKey.sign(hash).serialized as Hex;

        const ethersValid =
          ethers.recoverAddress(hash, sig65).toLowerCase() === wallet.address.toLowerCase();
        const viemValid = await verifyAuthorization(
          wallet.address as Address,
          chainId,
          nonce,
          sig65,
          DELEGATE_ADDRESS
        );
        expect(viemValid).toBe(ethersValid);
        expect(viemValid).toBe(true);

        // Wrong EOA must be rejected by both.
        const wrongEoa = "0x000000000000000000000000000000000000dEaD" as Address;
        const ethersWrong =
          ethers.recoverAddress(hash, sig65).toLowerCase() === wrongEoa.toLowerCase();
        const viemWrong = await verifyAuthorization(
          wrongEoa,
          chainId,
          nonce,
          sig65,
          DELEGATE_ADDRESS
        );
        expect(viemWrong).toBe(ethersWrong);
        expect(viemWrong).toBe(false);
      });
    }
  });
});
