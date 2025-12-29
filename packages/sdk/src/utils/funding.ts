import { createPublicClient, createWalletClient, http, parseEther, erc20Abi, type PublicClient, type WalletClient, type Hex, type Address, type Chain } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

/**
 * 资金管理参数
 */
export interface FundingParams {
    /** RPC URL */
    rpcUrl: string;
    /** 链配置 */
    chain: Chain;
    /** 资金提供者私钥 */
    supplierKey: Hex;
    /** 目标地址 */
    targetAddress: Address;
}

/**
 * ETH 充值参数
 */
export interface FundETHParams extends FundingParams {
    /** 充值金额（ETH，如 '0.1'） */
    amount: string;
}

/**
 * ERC20 充值参数
 */
export interface FundTokenParams extends FundingParams {
    /** Token 合约地址 */
    tokenAddress: Address;
    /** 充值金额（Token，如 '100'） */
    amount: string;
}

/**
 * 智能充值参数
 */
export interface EnsureFundingParams extends FundingParams {
    /** 最小 ETH 余额阈值 */
    minETH?: string;
    /** 目标 ETH 充值金额 */
    targetETH?: string;
    /** Token 配置（可选） */
    token?: {
        address: Address;
        minBalance?: string;
        targetAmount?: string;
    };
}

/**
 * 充值结果
 */
export interface FundingResult {
    success: boolean;
    txHash?: Hex;
    error?: string;
}

/**
 * 资金管理器
 * 提供 ETH 和 ERC20 Token 的充值、验证等工具函数
 */
export class FundingManager {
    /**
     * 创建 PublicClient 和 WalletClient
     */
    private static createClients(params: FundingParams): {
        publicClient: PublicClient;
        walletClient: WalletClient;
        account: PrivateKeyAccount;
    } {
        const account = privateKeyToAccount(params.supplierKey);
        const transport = http(params.rpcUrl);
        
        const publicClient = createPublicClient({
            chain: params.chain,
            transport
        });

        const walletClient = createWalletClient({
            account,
            chain: params.chain,
            transport
        });

        return { publicClient, walletClient, account };
    }

    /**
     * 充值 ETH 到目标地址
     * @param params - 充值参数
     * @returns 充值结果
     */
    static async fundWithETH(params: FundETHParams): Promise<FundingResult> {
        try {
            const { publicClient, walletClient } = this.createClients(params);
            const amount = parseEther(params.amount);

            console.log(`💸 Funding ${params.targetAddress} with ${params.amount} ETH...`);
            
            const hash = await walletClient.sendTransaction({
                account: walletClient.account!,
                chain: params.chain, 
                to: params.targetAddress,
                value: amount
            });

            console.log(`   Transaction Sent: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ ETH Funded.`);

            return { success: true, txHash: hash };
        } catch (error) {
            console.error(`   ❌ ETH Funding Failed:`, error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * 充值 ERC20 Token 到目标地址
     * @param params - 充值参数
     * @returns 充值结果
     */
    static async fundWithToken(params: FundTokenParams): Promise<FundingResult> {
        try {
            const { publicClient, walletClient, account } = this.createClients(params);
            const amount = parseEther(params.amount);

            console.log(`💸 Funding ${params.targetAddress} with ${params.amount} tokens...`);

            const { request } = await publicClient.simulateContract({
                account,
                address: params.tokenAddress,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [params.targetAddress, amount]
            });

            const hash = await walletClient.writeContract(request);
            console.log(`   Transaction Sent: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ Token Funded.`);

            return { success: true, txHash: hash };
        } catch (error) {
            console.error(`   ❌ Token Funding Failed:`, error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * 检查 ETH 余额
     * @param params - 基础参数
     * @returns ETH 余额（wei）
     */
    static async getETHBalance(params: FundingParams): Promise<bigint> {
        const { publicClient } = this.createClients(params);
        return await publicClient.getBalance({ address: params.targetAddress });
    }

    /**
     * 检查 ERC20 Token 余额
     * @param params - 基础参数
     * @param tokenAddress - Token 合约地址
     * @returns Token 余额
     */
    static async getTokenBalance(params: FundingParams, tokenAddress: Address): Promise<bigint> {
        const { publicClient } = this.createClients(params);
        return await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [params.targetAddress]
        }) as bigint;
    }

    /**
     * 智能充值：检查余额，不足时自动充值
     * @param params - 充值参数
     * @returns 充值结果数组
     */
    static async ensureFunding(params: EnsureFundingParams): Promise<FundingResult[]> {
        const results: FundingResult[] = [];
        const { publicClient } = this.createClients(params);

        // 1. 检查并充值 ETH
        if (params.minETH && params.targetETH) {
            const ethBalance = await publicClient.getBalance({ address: params.targetAddress });
            const minETH = parseEther(params.minETH);
            const targetETH = parseEther(params.targetETH);

            if (ethBalance < minETH) {
                console.log(`⚠️  ETH balance (${Number(ethBalance) / 1e18}) below threshold (${params.minETH})`);
                const result = await this.fundWithETH({
                    ...params,
                    amount: params.targetETH
                });
                results.push(result);
            } else {
                console.log(`✅ Sufficient ETH: ${Number(ethBalance) / 1e18} ETH`);
                results.push({ success: true });
            }
        }

        // 2. 检查并充值 Token
        if (params.token) {
            const tokenBalance = await this.getTokenBalance(params, params.token.address);
            const minToken = params.token.minBalance ? parseEther(params.token.minBalance) : 0n;
            const targetToken = params.token.targetAmount ? parseEther(params.token.targetAmount) : 0n;

            if (tokenBalance < minToken && targetToken > 0n) {
                console.log(`⚠️  Token balance (${Number(tokenBalance) / 1e18}) below threshold (${params.token.minBalance})`);
                const result = await this.fundWithToken({
                    ...params,
                    tokenAddress: params.token.address,
                    amount: params.token.targetAmount!
                });
                results.push(result);
            } else {
                console.log(`✅ Sufficient Token: ${Number(tokenBalance) / 1e18}`);
                results.push({ success: true });
            }
        }

        return results;
    }

    /**
     * 批量充值 ETH
     * @param params - 基础参数
     * @param targets - 目标地址和金额数组
     * @returns 充值结果数组
     */
    static async batchFundETH(
        params: Omit<FundingParams, 'targetAddress'>,
        targets: Array<{ address: Address; amount: string }>
    ): Promise<FundingResult[]> {
        const results: FundingResult[] = [];
        
        for (const target of targets) {
            const result = await this.fundWithETH({
                ...params,
                targetAddress: target.address,
                amount: target.amount
            });
            results.push(result);
        }

        return results;
    }

    /**
     * 批量充值 Token
     * @param params - 基础参数
     * @param tokenAddress - Token 合约地址
     * @param targets - 目标地址和金额数组
     * @returns 充值结果数组
     */
    static async batchFundToken(
        params: Omit<FundingParams, 'targetAddress'>,
        tokenAddress: Address,
        targets: Array<{ address: Address; amount: string }>
    ): Promise<FundingResult[]> {
        const results: FundingResult[] = [];
        
        for (const target of targets) {
            const result = await this.fundWithToken({
                ...params,
                targetAddress: target.address,
                tokenAddress,
                amount: target.amount
            });
            results.push(result);
        }

        return results;
    }
}
