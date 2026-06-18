// eslint-disable-next-line no-restricted-imports
import { parseAbi, formatUnits, parseUnits, encodeFunctionData } from "viem";
import { EthereumProvider } from "../providers/ethereum-provider";
import { ERC20_ABI } from "../constants/entrypoint";

// ERC20_ABI is a local human-readable `string[]` of signatures (not available in
// @aastar/core), so parseAbi is required to feed it to viem read/encode helpers.
const ERC20_ABI_PARSED = parseAbi(ERC20_ABI);

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  formattedBalance: string;
}

/**
 * Token service — extracted from NestJS TokenService.
 * Only on-chain queries and calldata generation (no preset token list).
 */
export class TokenService {
  constructor(private readonly ethereum: EthereumProvider) {}

  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const client = this.ethereum.getProvider();
    const address = tokenAddress as `0x${string}`;

    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "name" }),
      client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "symbol" }),
      client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "decimals" }),
    ]);

    return {
      address: tokenAddress.toLowerCase(),
      name: name as string,
      symbol: symbol as string,
      decimals: Number(decimals),
    };
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    const client = this.ethereum.getProvider();

    try {
      const balance = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI_PARSED,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      });
      return (balance as bigint).toString();
    } catch {
      return "0";
    }
  }

  async getFormattedTokenBalance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<TokenBalance> {
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    const rawBalance = await this.getTokenBalance(tokenAddress, walletAddress);
    const formattedBalance = formatUnits(BigInt(rawBalance), tokenInfo.decimals);
    return { token: tokenInfo, balance: rawBalance, formattedBalance };
  }

  generateTransferCalldata(to: string, amount: string, decimals: number): string {
    // Calldata encoding does not depend on a contract address (the old ethers
    // call site passed ethers.ZeroAddress only to instantiate ethers.Contract).
    const parsedAmount = parseUnits(amount, decimals);
    return encodeFunctionData({
      abi: ERC20_ABI_PARSED,
      functionName: "transfer",
      args: [to as `0x${string}`, parsedAmount],
    });
  }

  async validateToken(tokenAddress: string): Promise<{
    isValid: boolean;
    token?: TokenInfo;
    error?: string;
  }> {
    try {
      const client = this.ethereum.getProvider();
      const address = tokenAddress as `0x${string}`;

      const [name, symbol, decimals] = (await Promise.race([
        Promise.all([
          client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "name" }),
          client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "symbol" }),
          client.readContract({ address, abi: ERC20_ABI_PARSED, functionName: "decimals" }),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000)),
      ])) as [string, string, number];

      return {
        isValid: true,
        token: {
          address: tokenAddress.toLowerCase(),
          name,
          symbol,
          decimals: Number(decimals),
        },
      };
    } catch (error: unknown) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid ERC20 token",
      };
    }
  }
}
