import { describe, it, expect, beforeEach } from "vitest";
// eslint-disable-next-line no-restricted-imports
import { parseAbi, decodeFunctionData, parseUnits, type Abi } from "viem";
import { TokenService } from "../services/token-service";
import { EthereumProvider } from "../providers/ethereum-provider";

const TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]) as Abi;

describe("TokenService", () => {
  describe("generateTransferCalldata", () => {
    let tokenService: TokenService;

    beforeEach(() => {
      // generateTransferCalldata makes no RPC calls; a stub EthereumProvider is enough.
      const mockProvider = {
        getProvider: () => ({}),
      } as unknown as EthereumProvider;
      tokenService = new TokenService(mockProvider);
    });

    it("should generate valid ERC20 transfer calldata", () => {
      const to = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
      const calldata = tokenService.generateTransferCalldata(to, "100", 18);

      // Should start with the transfer function selector: 0xa9059cbb
      expect(calldata.startsWith("0xa9059cbb")).toBe(true);
      // Should be 4 bytes selector + 32 bytes address + 32 bytes amount = 68 bytes = 136 hex chars + 0x prefix
      expect(calldata.length).toBe(2 + 8 + 64 + 64); // 138
    });

    it("should encode the correct amount for 6 decimal tokens", () => {
      const to = "0x1234567890123456789012345678901234567890";
      const calldata = tokenService.generateTransferCalldata(to, "1.5", 6);

      // 1.5 USDC = 1_500_000 (6 decimals) = 0x16e360
      const { args } = decodeFunctionData({
        abi: TRANSFER_ABI,
        data: calldata as `0x${string}`,
      });
      const decoded = args as readonly unknown[];
      expect((decoded[0] as string).toLowerCase()).toBe(to.toLowerCase());
      expect(decoded[1]).toBe(parseUnits("1.5", 6));
    });

    it("should encode whole amounts correctly", () => {
      const to = "0x1234567890123456789012345678901234567890";
      const calldata = tokenService.generateTransferCalldata(to, "1000", 18);

      const { args } = decodeFunctionData({
        abi: TRANSFER_ABI,
        data: calldata as `0x${string}`,
      });
      const decoded = args as readonly unknown[];
      expect(decoded[1]).toBe(parseUnits("1000", 18));
    });
  });
});
