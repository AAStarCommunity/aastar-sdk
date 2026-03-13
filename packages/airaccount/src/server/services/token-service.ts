import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { ERC20_ABI } from "../constants/entrypoint";

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
    const provider = this.ethereum.getProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);

    return {
      address: tokenAddress.toLowerCase(),
      name,
      symbol,
      decimals: Number(decimals),
    };
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    const provider = this.ethereum.getProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    try {
      const balance = await contract.balanceOf(walletAddress);
      return balance.toString();
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
    const formattedBalance = ethers.formatUnits(rawBalance, tokenInfo.decimals);
    return { token: tokenInfo, balance: rawBalance, formattedBalance };
  }

  generateTransferCalldata(to: string, amount: string, decimals: number): string {
    const contract = new ethers.Contract(ethers.ZeroAddress, ERC20_ABI);
    const parsedAmount = ethers.parseUnits(amount, decimals);
    return contract.interface.encodeFunctionData("transfer", [to, parsedAmount]);
  }

  async validateToken(tokenAddress: string): Promise<{
    isValid: boolean;
    token?: TokenInfo;
    error?: string;
  }> {
    try {
      const provider = this.ethereum.getProvider();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [name, symbol, decimals] = (await Promise.race([
        Promise.all([contract.name(), contract.symbol(), contract.decimals()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000)),
      ])) as [string, string, bigint];

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
