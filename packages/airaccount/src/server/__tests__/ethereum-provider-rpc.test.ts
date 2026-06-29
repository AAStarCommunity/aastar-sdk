/**
 * Tests for EthereumProvider RPC methods (getBalance, getNonce, getUserOpHash,
 * estimateUserOperationGas, sendUserOperation, waitForUserOp, getUserOperationGasPrice).
 *
 * Strategy: construct a real EthereumProvider, then replace the private viem
 * `provider` and `bundlerProvider` clients with mocks. The main client exposes
 * getBalance/readContract/estimateFeesPerGas; the bundler client exposes request.
 */
import { parseEther, parseUnits } from "viem";
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

/** Injects viem-shaped mock clients into the private fields of EthereumProvider. */
function injectMocks(ep: EthereumProvider) {
  const mockProvider = {
    getBalance: vi.fn(),
    getCode: vi.fn(),
    readContract: vi.fn(),
    estimateFeesPerGas: vi.fn(),
    request: vi.fn(),
  };

  const mockBundler = {
    request: vi.fn(),
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
      mockProvider.getBalance.mockResolvedValue(parseEther("1.5"));

      const balance = await ep.getBalance(ACCOUNT);
      expect(balance).toBe("1.5");
      expect(mockProvider.getBalance).toHaveBeenCalledWith({ address: ACCOUNT });
    });

    it('returns "0" for zero balance', async () => {
      mockProvider.getBalance.mockResolvedValue(0n);
      // viem's formatEther drops the trailing ".0" that ethers emitted.
      expect(await ep.getBalance(ACCOUNT)).toBe("0");
    });

    it("handles large balances without precision loss", async () => {
      const wei = parseEther("10000.123456789012345678");
      mockProvider.getBalance.mockResolvedValue(wei);
      const balance = await ep.getBalance(ACCOUNT);
      expect(balance).toContain("10000");
    });
  });

  // ── getNonce ─────────────────────────────────────────────────────

  describe("getNonce", () => {
    it("calls the EntryPoint contract getNonce and returns bigint", async () => {
      // viem readContract returns the already-decoded uint256.
      mockProvider.readContract.mockResolvedValue(5n);

      const nonce = await ep.getNonce(ACCOUNT, 0, EntryPointVersion.V0_6);
      expect(nonce).toBe(5n);
    });

    it("uses EntryPoint V0_6 by default", async () => {
      mockProvider.readContract.mockResolvedValue(0n);

      await ep.getNonce(ACCOUNT);
      // The read should target the V0_6 entry point address.
      const callArg = mockProvider.readContract.mock.calls[0][0];
      expect(callArg.address?.toLowerCase()).toBe(
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()
      );
      expect(callArg.functionName).toBe("getNonce");
    });
  });

  // ── getUserOpHash ─────────────────────────────────────────────────

  describe("getUserOpHash", () => {
    const EXPECTED_HASH = "0x" + "ab".repeat(32);

    it("calls the V0_6 EntryPoint getUserOpHash for v0.6", async () => {
      mockProvider.readContract.mockResolvedValue(EXPECTED_HASH);

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
      mockProvider.readContract.mockResolvedValue(EXPECTED_HASH);

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
      // V0_7 entry point should be targeted.
      const callArg = mockProvider.readContract.mock.calls[0][0];
      expect(callArg.address?.toLowerCase()).toBe(
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase()
      );
    });
  });

  // ── estimateUserOperationGas ──────────────────────────────────────

  describe("estimateUserOperationGas", () => {
    it("applies the default 10% safety buffer to the bundler estimate", async () => {
      const estimate = {
        callGasLimit: "0x249f0", // 150000
        verificationGasLimit: "0xf4240", // 1000000
        preVerificationGas: "0x11170", // 70000
      };
      mockBundler.request.mockResolvedValueOnce(estimate);

      const result = await ep.estimateUserOperationGas({}, EntryPointVersion.V0_6);
      // callGasLimit / verificationGasLimit buffered by 10%, preVerificationGas untouched.
      expect(BigInt(result.callGasLimit)).toBe(165000n);
      expect(BigInt(result.verificationGasLimit)).toBe(1100000n);
      expect(BigInt(result.preVerificationGas)).toBe(70000n);
      expect(mockBundler.request).toHaveBeenCalledWith({
        method: "eth_estimateUserOperationGas",
        params: [expect.any(Object), expect.any(String)],
      });
    });

    it("honors a custom gasEstimateBufferPercent (0 = raw passthrough)", async () => {
      const epNoBuffer = new EthereumProvider({ ...CHAIN_CONFIG, gasEstimateBufferPercent: 0 });
      const { mockBundler: mb } = injectMocks(epNoBuffer);
      const estimate = {
        callGasLimit: "0x249f0",
        verificationGasLimit: "0xf4240",
        preVerificationGas: "0x11170",
      };
      mb.request.mockResolvedValueOnce(estimate);

      const result = await epNoBuffer.estimateUserOperationGas({});
      expect(result).toEqual(estimate);
    });

    it("rounds a fractional gasEstimateBufferPercent to the nearest integer", async () => {
      const epFrac = new EthereumProvider({ ...CHAIN_CONFIG, gasEstimateBufferPercent: 10.7 });
      const { mockBundler: mb } = injectMocks(epFrac);
      mb.request.mockResolvedValueOnce({
        callGasLimit: "0x2710", // 10000
        verificationGasLimit: "0x2710", // 10000
        preVerificationGas: "0x2710", // 10000
      });

      const result = await epFrac.estimateUserOperationGas({});
      // 10.7 → 11% → 10000 * 1.11 = 11100 (not 11000 from a floor to 10).
      expect(BigInt(result.callGasLimit)).toBe(11100n);
      expect(BigInt(result.preVerificationGas)).toBe(10000n);
    });

    it("logs a warning (not silent) and falls back to static limits when the bundler fails", async () => {
      const warn = vi.spyOn(CHAIN_CONFIG.logger!, "warn");
      mockBundler.request.mockRejectedValueOnce(new Error("bundler 401"));

      const result = await ep.estimateUserOperationGas({});
      expect(result.callGasLimit).toBe("0x249f0");
      expect(result.verificationGasLimit).toBe("0x3d0900"); // 4M default fallback for factory deploy + BLS
      expect(result.preVerificationGas).toBe("0x11170");
      // The real cause must be surfaced, not swallowed.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("bundler 401"));
      warn.mockRestore();
    });

    it("uses configurable fallback gas limits when provided", async () => {
      const epCustom = new EthereumProvider({
        ...CHAIN_CONFIG,
        fallbackGasLimits: { verificationGasLimit: "0x186a0" }, // 100000
      });
      const { mockBundler: mb } = injectMocks(epCustom);
      mb.request.mockRejectedValueOnce(new Error("down"));

      const result = await epCustom.estimateUserOperationGas({});
      expect(result.verificationGasLimit).toBe("0x186a0");
      expect(result.callGasLimit).toBe("0x249f0"); // unset → default
    });
  });

  // ── sendUserOperation ─────────────────────────────────────────────

  describe("sendUserOperation", () => {
    it("sends to bundler and returns userOpHash", async () => {
      const userOpHash = "0x" + "aa".repeat(32);
      mockBundler.request.mockResolvedValueOnce(userOpHash);

      const result = await ep.sendUserOperation({}, EntryPointVersion.V0_6);
      expect(result).toBe(userOpHash);
      expect(mockBundler.request).toHaveBeenCalledWith({
        method: "eth_sendUserOperation",
        params: [expect.any(Object), expect.any(String)],
      });
    });
  });

  // ── waitForUserOp ─────────────────────────────────────────────────

  describe("waitForUserOp", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("resolves with txHash when receipt is available immediately", async () => {
      const txHash = "0x" + "bb".repeat(32);
      mockBundler.request.mockResolvedValue({ transactionHash: txHash });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("resolves with txHash from nested receipt.transactionHash", async () => {
      const txHash = "0x" + "cc".repeat(32);
      mockBundler.request.mockResolvedValue({ receipt: { transactionHash: txHash } });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("retries when receipt is null and eventually resolves", async () => {
      const txHash = "0x" + "dd".repeat(32);
      mockBundler.request
        .mockResolvedValueOnce(null) // attempt 1: not ready
        .mockResolvedValueOnce(null) // attempt 2: not ready
        .mockResolvedValueOnce({ transactionHash: txHash }); // attempt 3: ready

      const promise = ep.waitForUserOp("0xUserOpHash", 10);
      // Advance timers for each poll interval (2000ms each)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });

    it("throws timeout error after maxAttempts", async () => {
      mockBundler.request.mockResolvedValue(null); // always null

      // Attach .rejects BEFORE advancing timers to avoid unhandled-rejection warning
      const assertion = expect(ep.waitForUserOp("0xUserOpHash", 2)).rejects.toThrow(
        "UserOp timeout: 0xUserOpHash"
      );
      await vi.runAllTimersAsync();
      await assertion;
    });

    it("continues polling when receipt fetch throws", async () => {
      const txHash = "0x" + "ee".repeat(32);
      mockBundler.request
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ transactionHash: txHash });

      const promise = ep.waitForUserOp("0xUserOpHash", 5);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe(txHash);
    });
  });

  // ── getUserOperationGasPrice ──────────────────────────────────────

  describe("getUserOperationGasPrice", () => {
    it("returns gas price from Pimlico endpoint", async () => {
      mockBundler.request.mockResolvedValueOnce({
        fast: {
          maxFeePerGas: "0x77359400", // 2 gwei
          maxPriorityFeePerGas: "0x3b9aca00", // 1 gwei
        },
      });

      const result = await ep.getUserOperationGasPrice();
      expect(result.maxFeePerGas).toBe("0x77359400");
      expect(result.maxPriorityFeePerGas).toBe("0x3b9aca00");
    });

    it("falls back to provider estimateFeesPerGas when Pimlico fails", async () => {
      mockBundler.request.mockRejectedValueOnce(new Error("pimlico unavailable"));
      mockProvider.estimateFeesPerGas.mockResolvedValueOnce({
        maxFeePerGas: parseUnits("20", 9),
        maxPriorityFeePerGas: parseUnits("2", 9),
      });

      const result = await ep.getUserOperationGasPrice();
      expect(result.maxFeePerGas).toMatch(/^0x/);
      expect(result.maxPriorityFeePerGas).toMatch(/^0x/);
    });

    it("falls back to hardcoded defaults when both Pimlico and estimateFeesPerGas fail", async () => {
      mockBundler.request.mockRejectedValueOnce(new Error("pimlico unavailable"));
      mockProvider.estimateFeesPerGas.mockRejectedValueOnce(new Error("RPC error"));

      const result = await ep.getUserOperationGasPrice();
      // 3 gwei default maxFeePerGas
      expect(BigInt(result.maxFeePerGas)).toBe(parseUnits("3", 9));
      // 1 gwei default maxPriorityFeePerGas
      expect(BigInt(result.maxPriorityFeePerGas)).toBe(parseUnits("1", 9));
    });
  });
});
