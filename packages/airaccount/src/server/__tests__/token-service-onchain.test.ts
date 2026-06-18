/**
 * Tests for TokenService on-chain query methods.
 *
 * TokenService now reads via a viem PublicClient (client.readContract). We mock
 * EthereumProvider.getProvider() to return a stub client whose readContract
 * dispatches by function name to per-method vi.fns (so tests can override them).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseEther } from "viem";
import { TokenService } from "../services/token-service";

const TOKEN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const mockFns = {
  name: vi.fn(),
  symbol: vi.fn(),
  decimals: vi.fn(),
  balanceOf: vi.fn(),
};

/** Stub EthereumProvider whose getProvider() yields a viem client backed by mockFns. */
function makeEthereumStub() {
  const client = {
    readContract: vi.fn().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async ({ functionName }: any) => {
        switch (functionName) {
          case "name":
            return mockFns.name();
          case "symbol":
            return mockFns.symbol();
          case "decimals":
            return mockFns.decimals();
          case "balanceOf":
            return mockFns.balanceOf();
          default:
            throw new Error(`unexpected read: ${functionName}`);
        }
      }
    ),
  };
  return { getProvider: vi.fn().mockReturnValue(client) };
}

describe("TokenService — on-chain queries", () => {
  let service: TokenService;

  beforeEach(() => {
    // Reset all mocks to default return values
    mockFns.name.mockReset().mockResolvedValue("USD Coin");
    mockFns.symbol.mockReset().mockResolvedValue("USDC");
    mockFns.decimals.mockReset().mockResolvedValue(6n);
    mockFns.balanceOf.mockReset().mockResolvedValue(5_000_000n);

    service = new TokenService(makeEthereumStub() as any);
  });

  // ── getTokenInfo ────────────────────────────────────────────────

  describe("getTokenInfo", () => {
    it("returns name, symbol, decimals and lowercased address", async () => {
      const info = await service.getTokenInfo(TOKEN_ADDRESS);
      expect(info.name).toBe("USD Coin");
      expect(info.symbol).toBe("USDC");
      expect(info.decimals).toBe(6);
      expect(info.address).toBe(TOKEN_ADDRESS.toLowerCase());
    });

    it("lowercases mixed-case token address", async () => {
      const mixed = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
      const info = await service.getTokenInfo(mixed);
      expect(info.address).toBe(mixed.toLowerCase());
    });

    it("calls name(), symbol(), decimals() on the contract", async () => {
      await service.getTokenInfo(TOKEN_ADDRESS);
      expect(mockFns.name).toHaveBeenCalled();
      expect(mockFns.symbol).toHaveBeenCalled();
      expect(mockFns.decimals).toHaveBeenCalled();
    });

    it("converts bigint decimals to number", async () => {
      mockFns.decimals.mockResolvedValue(18n);
      const info = await service.getTokenInfo(TOKEN_ADDRESS);
      expect(info.decimals).toBe(18);
      expect(typeof info.decimals).toBe("number");
    });
  });

  // ── getTokenBalance ─────────────────────────────────────────────

  describe("getTokenBalance", () => {
    it("returns raw balance as string", async () => {
      const balance = await service.getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);
      expect(balance).toBe("5000000");
    });

    it('returns "0" when balanceOf throws', async () => {
      mockFns.balanceOf.mockRejectedValueOnce(new Error("call revert"));
      expect(await service.getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).toBe("0");
    });

    it("handles zero balance", async () => {
      mockFns.balanceOf.mockResolvedValueOnce(0n);
      expect(await service.getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).toBe("0");
    });

    it("handles large balances", async () => {
      const large = BigInt("1000000000000000000000");
      mockFns.balanceOf.mockResolvedValueOnce(large);
      expect(await service.getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).toBe(large.toString());
    });
  });

  // ── getFormattedTokenBalance ────────────────────────────────────

  describe("getFormattedTokenBalance", () => {
    it("returns token info, raw balance, and human-readable formatted balance", async () => {
      const result = await service.getFormattedTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);
      expect(result.token.symbol).toBe("USDC");
      expect(result.token.decimals).toBe(6);
      expect(result.balance).toBe("5000000");
      // viem's formatUnits drops the trailing ".0" that ethers emitted ("5.0").
      expect(result.formattedBalance).toBe("5");
    });

    it("formats 18-decimal token balance correctly", async () => {
      mockFns.decimals.mockResolvedValue(18n);
      mockFns.balanceOf.mockResolvedValue(parseEther("1.5"));
      const result = await service.getFormattedTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);
      expect(result.formattedBalance).toBe("1.5");
    });

    it("shows zero balance when balanceOf fails", async () => {
      mockFns.balanceOf.mockRejectedValueOnce(new Error("revert"));
      const result = await service.getFormattedTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);
      expect(result.balance).toBe("0");
    });
  });

  // ── validateToken ───────────────────────────────────────────────

  describe("validateToken", () => {
    it("returns isValid: true with token info for a valid ERC20", async () => {
      const result = await service.validateToken(TOKEN_ADDRESS);
      expect(result.isValid).toBe(true);
      expect(result.token?.symbol).toBe("USDC");
      expect(result.token?.name).toBe("USD Coin");
      expect(result.error).toBeUndefined();
    });

    it("returns isValid: false with error message when contract call fails", async () => {
      mockFns.name.mockRejectedValueOnce(new Error("Not a token contract"));
      const result = await service.validateToken("0xNotAToken");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Not a token contract");
      expect(result.token).toBeUndefined();
    });

    it("returns isValid: false with fallback message for non-Error throws", async () => {
      mockFns.name.mockRejectedValueOnce("some string error");
      const result = await service.validateToken("0xBad");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid ERC20 token");
    });

    it("lowercases address in returned token info", async () => {
      const mixed = "0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";
      const result = await service.validateToken(mixed);
      expect(result.token?.address).toBe(mixed.toLowerCase());
    });
  });

  // ── generateTransferCalldata (edge cases) ───────────────────────

  describe("generateTransferCalldata — edge cases", () => {
    it("encodes a fractional amount for 6-decimal tokens", () => {
      const calldata = service.generateTransferCalldata(WALLET_ADDRESS, "1.5", 6);
      expect(calldata).toMatch(/^0x/);
      // 1.5 USDC = 1_500_000 raw; verify it appears in calldata
      expect(calldata).toContain(1_500_000n.toString(16).padStart(64, "0"));
    });

    it("encodes zero amount without throwing", () => {
      const calldata = service.generateTransferCalldata(WALLET_ADDRESS, "0", 18);
      expect(calldata).toMatch(/^0x/);
    });

    it("produces a different calldata for different recipients", () => {
      const RECIPIENT2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const c1 = service.generateTransferCalldata(WALLET_ADDRESS, "1.0", 18);
      const c2 = service.generateTransferCalldata(RECIPIENT2, "1.0", 18);
      expect(c1).not.toBe(c2);
    });
  });
});
