/**
 * Tests for EthereumProvider RPC methods (getBalance, getNonce, getUserOpHash,
 * estimateUserOperationGas, sendUserOperation, waitForUserOp, getUserOperationGasPrice).
 *
 * Strategy: construct a real EthereumProvider, then replace the private
 * `provider` and `bundlerProvider` fields with jest mocks.
 */
import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { EntryPointVersion } from "../constants/entrypoint";
import { ERC4337Utils } from "../../core/erc4337/utils";
import { SilentLogger } from "../interfaces/logger";
import type { ServerConfig } from "../config";
import type { UserOperation } from "../../core/types";

const CHAIN_CONFIG: ServerConfig = {
  rpcUrl: "http://localhost:8545",
  bundlerRpcUrl: "http://localhost:4337",
  chainId: 11155111,
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
  storage: null as any,
  signer: null as any,
  logger: new SilentLogger(),
};

const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** Injects mock providers into the private fields of EthereumProvider. */
function injectMocks(ep: EthereumProvider) {
  const mockProvider = {
    getBalance: jest.fn(),
    getCode: jest.fn(),
    getFeeData: jest.fn(),
    send: jest.fn(),
    // Contract method stubs (used indirectly via getEntryPointContract)
    call: jest.fn(),
  };

  const mockBundler = {
    send: jest.fn(),
  };

  (ep as any).provider = mockProvider;
  (ep as any).bundlerProvider = mockBundler;

  return { mockProvider, mockBundler };
}

describe("EthereumProvider — RPC methods", () => {
  let ep: EthereumProvider;
  let mockProvider: ReturnType<typeof injectMocks>["mockProvider"];
  let mockBundler: ReturnType<typeof injectMocks>["mockBundler"];

  beforeEach(() => {
    ep = new EthereumProvider(CHAIN_CONFIG);
    ({ mockProvider, mockBundler } = injectMocks(ep));
  });

  // ── getBalance ───────────────────────────────────────────────────

  describe("getBalance", () => {
    it("returns balance formatted as ether string", async () => {
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther("1.5"));

      const balance = await ep.getBalance(ACCOUNT);
      expect(balance).toBe("1.5");
      expect(mockProvider.getBalance).toHaveBeenCalledWith(ACCOUNT);
    });

    it('returns "0.0" for zero balance', async () => {
      mockProvider.getBalance.mockResolvedValue(0n);
      expect(await ep.getBalance(ACCOUNT)).toBe("0.0");
    });

    it("handles large balances without precision loss", async () => {
      const wei = ethers.parseEther("10000.123456789012345678");
      mockProvider.getBalance.mockResolvedValue(wei);
      const balance = await ep.getBalance(ACCOUNT);
      expect(balance).toContain("10000");
    });
  });

  // ── getNonce ─────────────────────────────────────────────────────

  describe("getNonce", () => {
    it("calls the EntryPoint contract getNonce and returns bigint", async () => {
      // Mock the contract call at the provider level
      mockProvider.call = jest.fn().mockResolvedValue(
        // ABI-encode uint256(5) as the return value
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [5n])
      );

      const nonce = await ep.getNonce(ACCOUNT, 0, EntryPointVersion.V0_6);
      expect(nonce).toBe(5n);
    });

    it("uses EntryPoint V0_6 by default", async () => {
      mockProvider.call = jest
        .fn()
        .mockResolvedValue(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [0n]));

      await ep.getNonce(ACCOUNT);
      // The call should hit the V0_6 entry point address
      const callArg = mockProvider.call.mock.calls[0][0];
      expect(callArg.to?.toLowerCase()).toBe(
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()
      );
    });
  });

  // ── getUserOpHash ─────────────────────────────────────────────────

  describe("getUserOpHash", () => {
    const EXPECTED_HASH = "0x" + "ab".repeat(32);

    it("calls the V0_6 EntryPoint getUserOpHash for v0.6", async () => {
      mockProvider.call = jest
        .fn()
        .mockResolvedValue(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [EXPECTED_HASH]));

      const op: UserOperation = {
        sender: ACCOUNT,
        nonce: 0n,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 100_000n,
        verificationGasLimit: 100_000n,
        preVerificationGas: 21_000n,
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        paymasterAndData: "0x",
        signature: "0x",
      };

      const hash = await ep.getUserOpHash(op, EntryPointVersion.V0_6);
      expect(hash).toBe(EXPECTED_HASH);
    });

    it("uses packed format for V0_7", async () => {
      mockProvider.call = jest
        .fn()
        .mockResolvedValue(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [EXPECTED_HASH]));

      const packed = ERC4337Utils.packUserOperation({
        sender: ACCOUNT,
        nonce: 0n,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 100_000n,
        verificationGasLimit: 100_000n,
        preVerificationGas: 21_000n,
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        paymasterAndData: "0x",
        signature: "0x",
      });

      const hash = await ep.getUserOpHash(packed, EntryPointVersion.V0_7);
      expect(hash).toBe(EXPECTED_HASH);
      // V0_7 entry point should be called
      const callArg = mockProvider.call.mock.calls[0][0];
      expect(callArg.to?.toLowerCase()).toBe(
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase()
      );
    });
  });

  // ── estimateUserOperationGas ──────────────────────────────────────

  describe("estimateUserOperationGas", () => {
    it("returns gas estimate from bundler", async () => {
      const estimate = {
        callGasLimit: "0x249f0",
        verificationGasLimit: "0xf4240",
        preVerificationGas: "0x11170",
      };
      mockBundler.send.mockResolvedValueOnce(estimate);

      const result = await ep.estimateUserOperationGas({}, EntryPointVersion.V0_6);
      expect(result).toEqual(estimate);
      expect(mockBundler.send).toHaveBeenCalledWith("eth_estimateUserOperationGas", [
        expect.any(Object),
        expect.any(String),
      ]);
    });

    it("returns default fallback values when bundler call fails", async () => {
      mockBundler.send.mockRejectedValueOnce(new Error("bundler unavailable"));

      const result = await ep.estimateUserOperationGas({});
      expect(result.callGasLimit).toBe("0x249f0");
      expect(result.verificationGasLimit).toBe("0xf4240");
      expect(result.preVerificationGas).toBe("0x11170");
    });
  });

  // ── sendUserOperation ─────────────────────────────────────────────

  describe("sendUserOperation", () => {
    it("sends to bundler and returns userOpHash", async () => {
      const userOpHash = "0x" + "aa".repeat(32);
      mockBundler.send.mockResolvedValueOnce(userOpHash);

      const result = await ep.sendUserOperation({}, EntryPointVersion.V0_6);
      expect(result).toBe(userOpHash);
      expect(mockBundler.send).toHaveBeenCalledWith("eth_sendUserOperation", [
        expect.any(Object),
        expect.any(String),
      ]);
    });
  });

  // ── waitForUserOp ─────────────────────────────────────────────────

  describe("waitForUserOp", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("resolves with txHash when receipt is available immediately", async () => {
      const txHash = "0x" + "bb".repeat(32);
      mockBundler.send.mockResolvedValue({ transactionHash: txHash });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("resolves with txHash from nested receipt.transactionHash", async () => {
      const txHash = "0x" + "cc".repeat(32);
      mockBundler.send.mockResolvedValue({ receipt: { transactionHash: txHash } });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("retries when receipt is null and eventually resolves", async () => {
      const txHash = "0x" + "dd".repeat(32);
      mockBundler.send
        .mockResolvedValueOnce(null) // attempt 1: not ready
        .mockResolvedValueOnce(null) // attempt 2: not ready
        .mockResolvedValueOnce({ transactionHash: txHash }); // attempt 3: ready

      const promise = ep.waitForUserOp("0xUserOpHash", 10);
      // Advance timers for each poll interval (2000ms each)
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("throws timeout error after maxAttempts", async () => {
      mockBundler.send.mockResolvedValue(null); // always null

      // Attach .rejects BEFORE advancing timers to avoid unhandled-rejection warning
      const assertion = expect(ep.waitForUserOp("0xUserOpHash", 2)).rejects.toThrow(
        "UserOp timeout: 0xUserOpHash"
      );
      await jest.runAllTimersAsync();
      await assertion;
    });

    it("continues polling when receipt fetch throws", async () => {
      const txHash = "0x" + "ee".repeat(32);
      mockBundler.send
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ transactionHash: txHash });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });
  });

  // ── getUserOperationGasPrice ──────────────────────────────────────

  describe("getUserOperationGasPrice", () => {
    it("returns gas price from Pimlico endpoint", async () => {
      mockBundler.send.mockResolvedValueOnce({
        fast: {
          maxFeePerGas: "0x77359400", // 2 gwei
          maxPriorityFeePerGas: "0x3b9aca00", // 1 gwei
        },
      });

      const result = await ep.getUserOperationGasPrice();
      expect(result.maxFeePerGas).toBe("0x77359400");
      expect(result.maxPriorityFeePerGas).toBe("0x3b9aca00");
    });

    it("falls back to provider getFeeData when Pimlico fails", async () => {
      mockBundler.send.mockRejectedValueOnce(new Error("pimlico unavailable"));
      mockProvider.getFeeData.mockResolvedValueOnce({
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      });

      const result = await ep.getUserOperationGasPrice();
      expect(result.maxFeePerGas).toMatch(/^0x/);
      expect(result.maxPriorityFeePerGas).toMatch(/^0x/);
    });

    it("falls back to hardcoded defaults when both Pimlico and getFeeData fail", async () => {
      mockBundler.send.mockRejectedValueOnce(new Error("pimlico unavailable"));
      mockProvider.getFeeData.mockRejectedValueOnce(new Error("RPC error"));

      const result = await ep.getUserOperationGasPrice();
      // 3 gwei default maxFeePerGas
      expect(BigInt(result.maxFeePerGas)).toBe(ethers.parseUnits("3", "gwei"));
      // 1 gwei default maxPriorityFeePerGas
      expect(BigInt(result.maxPriorityFeePerGas)).toBe(ethers.parseUnits("1", "gwei"));
    });
  });
});
