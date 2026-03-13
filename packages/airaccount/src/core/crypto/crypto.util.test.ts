import { CryptoUtil } from "./crypto.util";

const SECRET = "super-secret-key-32-chars-padded!!";

describe("CryptoUtil", () => {
  describe("encrypt / decrypt roundtrip", () => {
    it("decrypts what was encrypted", () => {
      const plaintext = "hello world";
      const encrypted = CryptoUtil.encrypt(plaintext, SECRET);
      expect(CryptoUtil.decrypt(encrypted, SECRET)).toBe(plaintext);
    });

    it("handles private key format", () => {
      const pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      expect(CryptoUtil.decrypt(CryptoUtil.encrypt(pk, SECRET), SECRET)).toBe(pk);
    });

    it("handles unicode and special characters", () => {
      const text = "こんにちは 🔐 café";
      expect(CryptoUtil.decrypt(CryptoUtil.encrypt(text, SECRET), SECRET)).toBe(text);
    });

    it("handles empty string", () => {
      expect(CryptoUtil.decrypt(CryptoUtil.encrypt("", SECRET), SECRET)).toBe("");
    });

    it("handles long strings", () => {
      const long = "x".repeat(10_000);
      expect(CryptoUtil.decrypt(CryptoUtil.encrypt(long, SECRET), SECRET)).toBe(long);
    });

    it("produces different ciphertext each time due to random IV", () => {
      const enc1 = CryptoUtil.encrypt("same", SECRET);
      const enc2 = CryptoUtil.encrypt("same", SECRET);
      expect(enc1).not.toBe(enc2);
    });

    it("encrypted output has three colon-separated parts", () => {
      const parts = CryptoUtil.encrypt("test", SECRET).split(":");
      expect(parts).toHaveLength(3);
    });
  });

  describe("decrypt error handling", () => {
    it("throws on data with fewer than 3 parts", () => {
      expect(() => CryptoUtil.decrypt("onlyone", SECRET)).toThrow("Decryption failed");
    });

    it("throws on data with two parts", () => {
      expect(() => CryptoUtil.decrypt("a:b", SECRET)).toThrow("Decryption failed");
    });

    it("throws on data with four parts", () => {
      expect(() => CryptoUtil.decrypt("a:b:c:d", SECRET)).toThrow("Decryption failed");
    });

    it("throws with wrong secret key", () => {
      const encrypted = CryptoUtil.encrypt("secret data", SECRET);
      expect(() => CryptoUtil.decrypt(encrypted, "wrong-key")).toThrow("Decryption failed");
    });

    it("throws on tampered ciphertext", () => {
      const parts = CryptoUtil.encrypt("data", SECRET).split(":");
      parts[2] = "deadbeef";
      expect(() => CryptoUtil.decrypt(parts.join(":"), SECRET)).toThrow("Decryption failed");
    });

    it("throws on tampered auth tag", () => {
      const parts = CryptoUtil.encrypt("data", SECRET).split(":");
      parts[1] = "0".repeat(32);
      expect(() => CryptoUtil.decrypt(parts.join(":"), SECRET)).toThrow("Decryption failed");
    });
  });

  describe("generateSecretKey", () => {
    it("returns a 64-char lowercase hex string (32 bytes)", () => {
      expect(CryptoUtil.generateSecretKey()).toMatch(/^[0-9a-f]{64}$/);
    });

    it("generates unique keys each time", () => {
      const keys = Array.from({ length: 5 }, () => CryptoUtil.generateSecretKey());
      const unique = new Set(keys);
      expect(unique.size).toBe(5);
    });

    it("generated key can be used for encrypt/decrypt", () => {
      const key = CryptoUtil.generateSecretKey();
      const plaintext = "secret payload";
      expect(CryptoUtil.decrypt(CryptoUtil.encrypt(plaintext, key), key)).toBe(plaintext);
    });
  });
});
