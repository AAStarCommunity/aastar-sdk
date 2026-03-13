import { validateConfig, ServerConfig } from "../config";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeValidConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    rpcUrl: "https://rpc.example.com",
    bundlerRpcUrl: "https://bundler.example.com",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0x1234567890123456789012345678901234567890",
        validatorAddress: "0xaabbccddee112233445566778899001122334455",
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner(PRIVATE_KEY),
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("should pass with a valid config", () => {
    expect(() => validateConfig(makeValidConfig())).not.toThrow();
  });

  it("should throw if rpcUrl is missing", () => {
    expect(() => validateConfig(makeValidConfig({ rpcUrl: "" }))).toThrow("rpcUrl is required");
  });

  it("should throw if bundlerRpcUrl is missing", () => {
    expect(() => validateConfig(makeValidConfig({ bundlerRpcUrl: "" }))).toThrow(
      "bundlerRpcUrl is required"
    );
  });

  it("should throw if chainId is missing", () => {
    expect(() => validateConfig(makeValidConfig({ chainId: 0 }))).toThrow("chainId is required");
  });

  it("should throw if no entryPoint version is configured", () => {
    expect(() => validateConfig(makeValidConfig({ entryPoints: {} }))).toThrow(
      "at least one entryPoint version must be configured"
    );
  });

  it("should throw if entryPoint is missing entryPointAddress", () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          entryPoints: {
            v06: {
              entryPointAddress: "",
              factoryAddress: "0x1234567890123456789012345678901234567890",
              validatorAddress: "0xaabbccddee112233445566778899001122334455",
            },
          },
        })
      )
    ).toThrow("entryPoints.v06.entryPointAddress is required");
  });

  it("should throw if entryPoint is missing factoryAddress", () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          entryPoints: {
            v07: {
              entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
              factoryAddress: "",
              validatorAddress: "0xaabbccddee112233445566778899001122334455",
            },
          },
        })
      )
    ).toThrow("entryPoints.v07.factoryAddress is required");
  });

  it("should throw if entryPoint is missing validatorAddress", () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          entryPoints: {
            v08: {
              entryPointAddress: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
              factoryAddress: "0x1234567890123456789012345678901234567890",
              validatorAddress: "",
            },
          },
        })
      )
    ).toThrow("entryPoints.v08.validatorAddress is required");
  });

  it("should throw if storage is missing", () => {
    expect(() => validateConfig(makeValidConfig({ storage: undefined as any }))).toThrow(
      "storage adapter is required"
    );
  });

  it("should throw if signer is missing", () => {
    expect(() => validateConfig(makeValidConfig({ signer: undefined as any }))).toThrow(
      "signer adapter is required"
    );
  });

  it("should accept multiple entryPoint versions", () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
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
        })
      )
    ).not.toThrow();
  });
});
