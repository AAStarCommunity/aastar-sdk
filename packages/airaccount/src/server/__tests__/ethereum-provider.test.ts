import { EthereumProvider } from "../providers/ethereum-provider";
import { EntryPointVersion } from "../constants/entrypoint";
import { SilentLogger } from "../interfaces/logger";
import { MemoryStorage } from "../adapters/memory-storage";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";
import { ServerConfig } from "../config";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const V06_EP = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const V07_EP = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const V06_FACTORY = "0x1111111111111111111111111111111111111111";
const V07_FACTORY = "0x2222222222222222222222222222222222222222";
const V06_VALIDATOR = "0x3333333333333333333333333333333333333333";
const V07_VALIDATOR = "0x4444444444444444444444444444444444444444";

function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    rpcUrl: "http://localhost:8545",
    bundlerRpcUrl: "http://localhost:4337",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: V06_EP,
        factoryAddress: V06_FACTORY,
        validatorAddress: V06_VALIDATOR,
      },
      v07: {
        entryPointAddress: V07_EP,
        factoryAddress: V07_FACTORY,
        validatorAddress: V07_VALIDATOR,
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner(PRIVATE_KEY),
    logger: new SilentLogger(),
    ...overrides,
  };
}

describe("EthereumProvider", () => {
  let provider: EthereumProvider;

  beforeEach(() => {
    provider = new EthereumProvider(makeConfig());
  });

  describe("getProvider / getBundlerProvider", () => {
    it("should return JsonRpcProvider instances", () => {
      expect(provider.getProvider()).toBeDefined();
      expect(provider.getBundlerProvider()).toBeDefined();
    });
  });

  describe("address lookups", () => {
    it("should return v0.6 entry point address", () => {
      expect(provider.getEntryPointAddress(EntryPointVersion.V0_6)).toBe(V06_EP);
    });

    it("should return v0.7 entry point address", () => {
      expect(provider.getEntryPointAddress(EntryPointVersion.V0_7)).toBe(V07_EP);
    });

    it("should return factory address for configured version", () => {
      expect(provider.getFactoryAddress(EntryPointVersion.V0_6)).toBe(V06_FACTORY);
      expect(provider.getFactoryAddress(EntryPointVersion.V0_7)).toBe(V07_FACTORY);
    });

    it("should return validator address for configured version", () => {
      expect(provider.getValidatorAddress(EntryPointVersion.V0_6)).toBe(V06_VALIDATOR);
      expect(provider.getValidatorAddress(EntryPointVersion.V0_7)).toBe(V07_VALIDATOR);
    });

    it("should throw for unconfigured version", () => {
      expect(() => provider.getEntryPointAddress(EntryPointVersion.V0_8)).toThrow(
        "EntryPoint version 0.8 is not configured"
      );
    });
  });

  describe("getDefaultVersion", () => {
    it("should default to V0_6 when not specified", () => {
      expect(provider.getDefaultVersion()).toBe(EntryPointVersion.V0_6);
    });

    it("should return V0_7 when configured", () => {
      const p = new EthereumProvider(makeConfig({ defaultVersion: "0.7" }));
      expect(p.getDefaultVersion()).toBe(EntryPointVersion.V0_7);
    });

    it("should return V0_8 when configured", () => {
      const p = new EthereumProvider(makeConfig({ defaultVersion: "0.8" }));
      expect(p.getDefaultVersion()).toBe(EntryPointVersion.V0_8);
    });
  });

  describe("contract factories", () => {
    it("should create entry point contract with correct address", () => {
      const contract = provider.getEntryPointContract(EntryPointVersion.V0_6);
      expect(contract.target).toBe(V06_EP);
    });

    it("should create factory contract with correct address", () => {
      const contract = provider.getFactoryContract(EntryPointVersion.V0_6);
      expect(contract.target).toBe(V06_FACTORY);
    });

    it("should create validator contract with correct address", () => {
      const contract = provider.getValidatorContract(EntryPointVersion.V0_6);
      expect(contract.target).toBe(V06_VALIDATOR);
    });

    it("should create account contract with given address", () => {
      const addr = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
      const contract = provider.getAccountContract(addr);
      expect(contract.target).toBe(addr);
    });
  });
});
