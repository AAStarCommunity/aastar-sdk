import { createPublicClient, http, type PublicClient, type Hex, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * 验证参数基础接口
 */
export interface ValidationParams {
    /** RPC URL */
    rpcUrl: string;
    /** 链配置 */
    chain: Chain;
}

/**
 * 角色验证参数
 */
export interface RoleValidationParams extends ValidationParams {
    /** Registry 合约地址 */
    registryAddress: Address;
    /** 角色 ID */
    roleId: Hex;
    /** 用户地址 */
    userAddress: Address;
}

/**
 * 余额验证参数
 */
export interface BalanceValidationParams extends ValidationParams {
    /** 账户地址 */
    address: Address;
    /** 最小余额阈值（ETH，如 '0.01'） */
    minBalance?: string;
}

/**
 * Token 余额验证参数
 */
export interface TokenBalanceValidationParams extends BalanceValidationParams {
    /** Token 合约地址 */
    tokenAddress: Address;
}

/**
 * 合约部署验证参数
 */
export interface DeploymentValidationParams extends ValidationParams {
    /** 合约地址 */
    contractAddress: Address;
}

/**
 * 验证结果
 */
export interface ValidationResult {
    valid: boolean;
    message?: string;
    data?: any;
}

/**
 * 状态验证器
 * 提供角色、余额、合约部署等状态验证工具
 */
export class StateValidator {
    /**
     * 创建 PublicClient
     */
    private static createClient(params: ValidationParams): PublicClient {
        return createPublicClient({
            chain: params.chain,
            transport: http(params.rpcUrl)
        });
    }

    /**
     * 验证用户是否拥有指定角色
     * @param params - 角色验证参数
     * @returns 验证结果
     */
    static async validateRole(params: RoleValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            
            // Registry ABI - hasRole function
            const hasRole = await client.readContract({
                address: params.registryAddress,
                abi: [{
                    name: 'hasRole',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [
                        { name: 'roleId', type: 'bytes32' },
                        { name: 'user', type: 'address' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'hasRole',
                args: [params.roleId, params.userAddress]
            }) as boolean;

            return {
                valid: hasRole,
                message: hasRole 
                    ? `✅ User ${params.userAddress} has role ${params.roleId}`
                    : `❌ User ${params.userAddress} does NOT have role ${params.roleId}`,
                data: { hasRole }
            };
        } catch (error) {
            return {
                valid: false,
                message: `❌ Role validation failed: ${(error as Error).message}`,
                data: { error }
            };
        }
    }

    /**
     * 验证 ETH 余额是否满足最小阈值
     * @param params - 余额验证参数
     * @returns 验证结果
     */
    static async validateETHBalance(params: BalanceValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            const balance = await client.getBalance({ address: params.address });
            const balanceETH = Number(balance) / 1e18;

            if (params.minBalance) {
                const minBalanceWei = BigInt(Math.floor(parseFloat(params.minBalance) * 1e18));
                const sufficient = balance >= minBalanceWei;

                return {
                    valid: sufficient,
                    message: sufficient
                        ? `✅ ETH balance (${balanceETH.toFixed(4)}) meets minimum (${params.minBalance})`
                        : `❌ ETH balance (${balanceETH.toFixed(4)}) below minimum (${params.minBalance})`,
                    data: { balance, balanceETH, minBalance: params.minBalance }
                };
            }

            return {
                valid: true,
                message: `ℹ️  ETH balance: ${balanceETH.toFixed(4)} ETH`,
                data: { balance, balanceETH }
            };
        } catch (error) {
            return {
                valid: false,
                message: `❌ ETH balance validation failed: ${(error as Error).message}`,
                data: { error }
            };
        }
    }

    /**
     * 验证 ERC20 Token 余额是否满足最小阈值
     * @param params - Token 余额验证参数
     * @returns 验证结果
     */
    static async validateTokenBalance(params: TokenBalanceValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            
            const balance = await client.readContract({
                address: params.tokenAddress,
                abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [params.address]
            }) as bigint;

            const balanceToken = Number(balance) / 1e18;

            if (params.minBalance) {
                const minBalanceWei = BigInt(Math.floor(parseFloat(params.minBalance) * 1e18));
                const sufficient = balance >= minBalanceWei;

                return {
                    valid: sufficient,
                    message: sufficient
                        ? `✅ Token balance (${balanceToken.toFixed(4)}) meets minimum (${params.minBalance})`
                        : `❌ Token balance (${balanceToken.toFixed(4)}) below minimum (${params.minBalance})`,
                    data: { balance, balanceToken, minBalance: params.minBalance }
                };
            }

            return {
                valid: true,
                message: `ℹ️  Token balance: ${balanceToken.toFixed(4)}`,
                data: { balance, balanceToken }
            };
        } catch (error) {
            return {
                valid: false,
                message: `❌ Token balance validation failed: ${(error as Error).message}`,
                data: { error }
            };
        }
    }

    /**
     * 验证合约是否已部署
     * @param params - 合约部署验证参数
     * @returns 验证结果
     */
    static async validateDeployment(params: DeploymentValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            const code = await client.getBytecode({ address: params.contractAddress });
            const isDeployed = code !== undefined && code !== '0x';

            return {
                valid: isDeployed,
                message: isDeployed
                    ? `✅ Contract deployed at ${params.contractAddress}`
                    : `❌ No contract found at ${params.contractAddress}`,
                data: { code, isDeployed }
            };
        } catch (error) {
            return {
                valid: false,
                message: `❌ Deployment validation failed: ${(error as Error).message}`,
                data: { error }
            };
        }
    }

    /**
     * 批量验证多个角色
     * @param params - 基础验证参数
     * @param registryAddress - Registry 合约地址
     * @param checks - 角色检查数组
     * @returns 验证结果数组
     */
    static async batchValidateRoles(
        params: ValidationParams,
        registryAddress: Address,
        checks: Array<{ roleId: Hex; userAddress: Address; label?: string }>
    ): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];

        for (const check of checks) {
            const result = await this.validateRole({
                ...params,
                registryAddress,
                roleId: check.roleId,
                userAddress: check.userAddress
            });

            if (check.label) {
                result.message = `[${check.label}] ${result.message}`;
            }

            results.push(result);
        }

        return results;
    }

    /**
     * 打印验证结果
     * @param results - 验证结果数组
     */
    static printResults(results: ValidationResult[]): void {
        console.log('\n📋 Validation Results:');
        console.log('─'.repeat(80));
        results.forEach((r, i) => {
            console.log(`${i + 1}. ${r.message}`);
        });
        console.log('─'.repeat(80));
        
        const passed = results.filter(r => r.valid).length;
        const total = results.length;
        console.log(`\n✅ Passed: ${passed}/${total}`);
        
        if (passed < total) {
            console.log(`❌ Failed: ${total - passed}/${total}`);
        }
    }
}
