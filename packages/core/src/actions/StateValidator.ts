import { createPublicClient, http, type PublicClient, type Hex, type Address, type Chain, erc20Abi, formatEther } from 'viem';

/**
 * Interface definitions
 */
export interface ValidationParams {
    rpcUrl: string;
    chain: Chain;
}

export interface RoleValidationParams extends ValidationParams {
    registryAddress: Address;
    roleId: Hex;
    userAddress: Address;
}

export interface BalanceValidationParams extends ValidationParams {
    address: Address;
    minBalance?: string;
}

export interface TokenBalanceValidationParams extends BalanceValidationParams {
    tokenAddress: Address;
}

export interface DeploymentValidationParams extends ValidationParams {
    contractAddress: Address;
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
    data?: any;
}

export interface AccountBalance {
    address: Address;
    eth: bigint;
    gToken: bigint;
    aPNTs: bigint;
    xPNTs: bigint;
}

export class StateValidator {
    /**
     * Create PublicClient helper
     */
    private static createClient(params: ValidationParams): PublicClient {
        return createPublicClient({
            chain: params.chain,
            transport: http(params.rpcUrl)
        });
    }

    /**
     * Batch fetch balances for multiple accounts
     */
    static async getAccountBalances(params: {
        rpcUrl: string;
        chain: Chain;
        addresses: Address[];
        gTokenAddress?: Address;
        aPNTsAddress?: Address;
        xPNTsAddress?: Address;
    }): Promise<AccountBalance[]> {
        const client = this.createClient({ rpcUrl: params.rpcUrl, chain: params.chain });

        const results = await Promise.all(
            params.addresses.map(async (address) => {
                const [eth, gToken, aPNTs, xPNTs] = await Promise.all([
                    client.getBalance({ address }),
                    params.gTokenAddress
                        ? client.readContract({
                              address: params.gTokenAddress,
                              abi: erc20Abi,
                              functionName: 'balanceOf',
                              args: [address]
                          }) as Promise<bigint>
                        : Promise.resolve(0n),
                    params.aPNTsAddress
                        ? client.readContract({
                              address: params.aPNTsAddress,
                              abi: erc20Abi,
                              functionName: 'balanceOf',
                              args: [address]
                          }) as Promise<bigint>
                        : Promise.resolve(0n),
                    params.xPNTsAddress
                        ? client.readContract({
                              address: params.xPNTsAddress,
                              abi: erc20Abi,
                              functionName: 'balanceOf',
                              args: [address]
                          }) as Promise<bigint>
                        : Promise.resolve(0n)
                ]);

                return {
                    address,
                    eth,
                    gToken,
                    aPNTs,
                    xPNTs
                };
            })
        );

        return results;
    }

    /**
     * Role Validation
     */
    static async validateRole(params: RoleValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            
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
     * ETH Balance Validation
     */
    static async validateETHBalance(params: BalanceValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            const balance = await client.getBalance({ address: params.address });
            const balanceETH = Number(formatEther(balance));

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
     * Token Balance Validation
     */
    static async validateTokenBalance(params: TokenBalanceValidationParams): Promise<ValidationResult> {
        try {
            const client = this.createClient(params);
            
            const balance = await client.readContract({
                address: params.tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [params.address]
            }) as bigint;

            const balanceToken = Number(formatEther(balance));

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
     * Deployment Validation
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
}
