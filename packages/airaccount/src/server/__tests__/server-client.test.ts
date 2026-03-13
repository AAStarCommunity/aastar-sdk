// Mock @noble/curves before any imports so BLSManager doesn't fail to load
jest.mock("@noble/curves/bls12-381.js", () => ({
  bls12_381: {
    G2: { hashToCurve: jest.fn(), ProjectivePoint: { fromHex: jest.fn() } },
    getPublicKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    aggregateSignatures: jest.fn(),
    aggregatePublicKeys: jest.fn(),
  },
}));

import { YAAAServerClient } from "../server-client";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";
import { SilentLogger } from "../interfaces/logger";
import { ServerConfig } from "../config";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    rpcUrl: "http://localhost:8545",
    bundlerRpcUrl: "http://localhost:4337",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0x1111111111111111111111111111111111111111",
        validatorAddress: "0x2222222222222222222222222222222222222222",
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner(PRIVATE_KEY),
    logger: new SilentLogger(),
    ...overrides,
  };
}

describe("YAAAServerClient", () => {
  it("should construct successfully with valid config", () => {
    const client = new YAAAServerClient(makeConfig());
    expect(client).toBeDefined();
  });

  it("should expose all service properties", () => {
    const client = new YAAAServerClient(makeConfig());

    expect(client.ethereum).toBeDefined();
    expect(client.accounts).toBeDefined();
    expect(client.transfers).toBeDefined();
    expect(client.bls).toBeDefined();
    expect(client.paymaster).toBeDefined();
    expect(client.tokens).toBeDefined();
    expect(client.wallets).toBeDefined();
  });

  it("should throw on invalid config (missing rpcUrl)", () => {
    expect(() => new YAAAServerClient(makeConfig({ rpcUrl: "" }))).toThrow("rpcUrl is required");
  });

  it("should throw on invalid config (no entryPoints)", () => {
    expect(() => new YAAAServerClient(makeConfig({ entryPoints: {} }))).toThrow(
      "at least one entryPoint version must be configured"
    );
  });

  it("should throw on invalid config (missing storage)", () => {
    expect(() => new YAAAServerClient(makeConfig({ storage: undefined as any }))).toThrow(
      "storage adapter is required"
    );
  });

  it("should throw on invalid config (missing signer)", () => {
    expect(() => new YAAAServerClient(makeConfig({ signer: undefined as any }))).toThrow(
      "signer adapter is required"
    );
  });

  it("wallets should delegate to signer adapter", async () => {
    const client = new YAAAServerClient(makeConfig());
    const address = await client.wallets.getAddress("user-1");
    // LocalWalletSigner with the hardhat key should return the known address
    expect(address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("should accept multiple entryPoint versions", () => {
    const client = new YAAAServerClient(
      makeConfig({
        entryPoints: {
          v06: {
            entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            factoryAddress: "0x1111111111111111111111111111111111111111",
            validatorAddress: "0x2222222222222222222222222222222222222222",
          },
          v07: {
            entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
            factoryAddress: "0x3333333333333333333333333333333333333333",
            validatorAddress: "0x4444444444444444444444444444444444444444",
          },
        },
        defaultVersion: "0.7",
      })
    );

    expect(client.ethereum.getDefaultVersion()).toBe("0.7");
  });
});
