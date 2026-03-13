import axios from "axios";
import { ethers } from "ethers";
import { KmsManager, KmsSigner, LegacyPasskeyAssertion } from "../services/kms-signer";
import { SilentLogger } from "../interfaces/logger";

// Mock axios.create to return an object with mock post/get methods
const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock("axios", () => ({
  ...jest.requireActual("axios"),
  create: jest.fn(() => ({
    post: mockPost,
    get: mockGet,
  })),
}));

const ENDPOINT = "https://kms.test.example";
const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const API_KEY = "test-api-key";

const FAKE_SIG_HEX =
  "1b" +
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const MOCK_ASSERTION: LegacyPasskeyAssertion = {
  AuthenticatorData: "0xaabbcc",
  ClientDataHash: "0xddeeff",
  Signature: "0x112233",
};

// ── KmsManager ────────────────────────────────────────────────────────

describe("KmsManager", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isKmsEnabled", () => {
    it("returns false when kmsEnabled is not set", () => {
      expect(new KmsManager({}).isKmsEnabled()).toBe(false);
    });

    it("returns false when kmsEnabled is false", () => {
      expect(new KmsManager({ kmsEnabled: false }).isKmsEnabled()).toBe(false);
    });

    it("returns true when kmsEnabled is true", () => {
      expect(new KmsManager({ kmsEnabled: true }).isKmsEnabled()).toBe(true);
    });
  });

  describe("constructor", () => {
    it("creates axios instance with apiKey header when provided", () => {
      new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        kmsApiKey: API_KEY,
        logger: new SilentLogger(),
      });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: ENDPOINT,
          headers: expect.objectContaining({
            "x-api-key": API_KEY,
          }),
        })
      );
    });

    it("does not add apiKey header when not provided", () => {
      new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });

      const callArgs = (axios.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.headers).not.toHaveProperty("x-api-key");
    });
  });

  describe("createKey", () => {
    it("throws when KMS is not enabled", async () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: false });
      await expect(m.createKey("desc", "0xpubkey")).rejects.toThrow("KMS service is not enabled");
    });

    it("POSTs to /CreateKey with x-amz-target header and PasskeyPublicKey", async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          KeyMetadata: { KeyId: "key-abc" },
          Status: "deriving",
        },
      });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.createKey("my-key", "0xpubkey123");

      expect(mockPost).toHaveBeenCalledWith(
        "/CreateKey",
        {
          Description: "my-key",
          KeyUsage: "SIGN_VERIFY",
          KeySpec: "ECC_SECG_P256K1",
          Origin: "EXTERNAL_KMS",
          PasskeyPublicKey: "0xpubkey123",
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-amz-target": "TrentService.CreateKey",
          }),
        })
      );
      expect(result.KeyMetadata.KeyId).toBe("key-abc");
    });
  });

  describe("signHash", () => {
    it("throws when KMS is not enabled", async () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT });
      await expect(m.signHash("0xhash", MOCK_ASSERTION, { Address: ADDRESS })).rejects.toThrow(
        "KMS service is not enabled"
      );
    });

    it("adds 0x prefix to hash that lacks it", async () => {
      mockPost.mockResolvedValueOnce({ data: { Signature: "aabbcc" } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      await m.signHash("noprefixhash", MOCK_ASSERTION, { Address: ADDRESS });

      expect(mockPost).toHaveBeenCalledWith(
        "/SignHash",
        expect.objectContaining({
          Hash: "0xnoprefixhash",
          Address: ADDRESS,
          Passkey: MOCK_ASSERTION,
        }),
        expect.any(Object)
      );
    });

    it("preserves existing 0x prefix on hash", async () => {
      mockPost.mockResolvedValueOnce({ data: { Signature: "ddeeff" } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      await m.signHash("0xalreadyprefixed", MOCK_ASSERTION, { Address: ADDRESS });

      expect(mockPost).toHaveBeenCalledWith(
        "/SignHash",
        expect.objectContaining({ Hash: "0xalreadyprefixed" }),
        expect.any(Object)
      );
    });

    it("supports KeyId target", async () => {
      mockPost.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      await m.signHash("0xhash", MOCK_ASSERTION, { KeyId: "key-1" });

      expect(mockPost).toHaveBeenCalledWith(
        "/SignHash",
        expect.objectContaining({ KeyId: "key-1" }),
        expect.any(Object)
      );
    });
  });

  describe("WebAuthn methods", () => {
    it("beginRegistration POSTs to /BeginRegistration", async () => {
      mockPost.mockResolvedValueOnce({
        data: { ChallengeId: "ch-1", Options: {} },
      });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.beginRegistration({ UserName: "test@test.com" });

      expect(mockPost).toHaveBeenCalledWith("/BeginRegistration", {
        UserName: "test@test.com",
      });
      expect(result.ChallengeId).toBe("ch-1");
    });

    it("beginAuthentication POSTs to /BeginAuthentication", async () => {
      mockPost.mockResolvedValueOnce({
        data: { ChallengeId: "ch-2", Options: {} },
      });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.beginAuthentication({ Address: ADDRESS });

      expect(mockPost).toHaveBeenCalledWith("/BeginAuthentication", {
        Address: ADDRESS,
      });
      expect(result.ChallengeId).toBe("ch-2");
    });
  });

  describe("getKeyStatus", () => {
    it("GETs /KeyStatus with KeyId query param", async () => {
      mockGet.mockResolvedValueOnce({
        data: { KeyId: "key-1", Status: "ready", Address: ADDRESS },
      });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.getKeyStatus("key-1");

      expect(mockGet).toHaveBeenCalledWith("/KeyStatus", {
        params: { KeyId: "key-1" },
      });
      expect(result.Status).toBe("ready");
      expect(result.Address).toBe(ADDRESS);
    });
  });

  describe("createKmsSigner", () => {
    it("throws when KMS is not enabled", () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT });
      expect(() =>
        m.createKmsSigner("key-1", ADDRESS, () => Promise.resolve(MOCK_ASSERTION))
      ).toThrow("KMS service is not enabled");
    });

    it("returns a KmsSigner instance", () => {
      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const s = m.createKmsSigner("key-1", ADDRESS, () => Promise.resolve(MOCK_ASSERTION));
      expect(s).toBeInstanceOf(KmsSigner);
    });
  });
});

// ── KmsSigner ─────────────────────────────────────────────────────────

describe("KmsSigner", () => {
  let manager: KmsManager;
  let signer: KmsSigner;

  beforeEach(() => {
    mockPost.mockReset();
    manager = new KmsManager({
      kmsEndpoint: ENDPOINT,
      kmsEnabled: true,
      logger: new SilentLogger(),
    });
    signer = manager.createKmsSigner("key-1", ADDRESS, () => Promise.resolve(MOCK_ASSERTION));
  });

  it("getAddress returns the KMS-managed address", async () => {
    expect(await signer.getAddress()).toBe(ADDRESS);
  });

  it("signMessage calls signHash with EIP-191 message hash and assertion", async () => {
    mockPost.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

    const result = await signer.signMessage("hello");
    expect(result).toBe("0x" + FAKE_SIG_HEX);

    expect(mockPost).toHaveBeenCalledWith(
      "/SignHash",
      expect.objectContaining({
        Address: ADDRESS,
        Hash: expect.stringMatching(/^0x[0-9a-f]{64}$/i),
        Passkey: MOCK_ASSERTION,
      }),
      expect.any(Object)
    );
  });

  it("signMessage handles Uint8Array input", async () => {
    mockPost.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });
    const bytes = new TextEncoder().encode("hello");
    const result = await signer.signMessage(bytes);
    expect(result).toBe("0x" + FAKE_SIG_HEX);
  });

  it("signTypedData calls signHash with typed data hash", async () => {
    mockPost.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

    const domain = { name: "TestApp", version: "1", chainId: 1 };
    const types = { Message: [{ name: "content", type: "string" }] };
    const value = { content: "hello" };

    const result = await signer.signTypedData(domain, types, value);
    expect(result).toBe("0x" + FAKE_SIG_HEX);
    expect(mockPost).toHaveBeenCalledWith(
      "/SignHash",
      expect.objectContaining({
        Address: ADDRESS,
        Passkey: MOCK_ASSERTION,
      }),
      expect.any(Object)
    );
  });

  it("signTransaction throws without provider", async () => {
    await expect(signer.signTransaction({ to: ADDRESS, value: 0n })).rejects.toThrow(
      "Provider is required"
    );
  });

  it("connect returns a new KmsSigner with the given provider", () => {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const connected = signer.connect(provider);

    expect(connected).toBeInstanceOf(KmsSigner);
    expect(connected).not.toBe(signer);
    expect(connected.provider).toBe(provider);
  });
});
