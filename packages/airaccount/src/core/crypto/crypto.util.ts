import * as crypto from "crypto";

export class CryptoUtil {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  static encrypt(text: string, secretKey: string): string {
    try {
      const key = crypto.scryptSync(secretKey, "salt", CryptoUtil.KEY_LENGTH);
      const iv = crypto.randomBytes(CryptoUtil.IV_LENGTH);

      const cipher = crypto.createCipheriv(CryptoUtil.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Combine iv + authTag + encrypted data
      return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
    } catch (error: any) {
      throw new Error("Encryption failed: " + error.message);
    }
  }

  static decrypt(encryptedData: string, secretKey: string): string {
    try {
      const key = crypto.scryptSync(secretKey, "salt", CryptoUtil.KEY_LENGTH);
      const parts = encryptedData.split(":");

      if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(CryptoUtil.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error: any) {
      throw new Error("Decryption failed: " + error.message);
    }
  }

  static generateSecretKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
