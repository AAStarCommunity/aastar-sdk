import { type Address, concat, pad, toHex } from 'viem';

export type PaymasterV4MiddlewareConfig = {
    paymasterAddress: Address;
    gasToken: Address;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
};

const DEFAULT_VERIFICATION_GAS_V4 = 100000n;
const DEFAULT_POSTOP_GAS_V4 = 50000n;

/**
 * Constructs the middleware for Paymaster V4.
 * Returns the `paymasterAndData` hex string.
 */
export function getPaymasterV4Middleware(config: PaymasterV4MiddlewareConfig) {
    return {
        sponsorUserOperation: async (args: { userOperation: any }) => {
            const verGas = config.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_V4;
            const postGas = config.postOpGasLimit ?? DEFAULT_POSTOP_GAS_V4;

            // Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Token(20)]
            const paymasterAndData = concat([
                config.paymasterAddress,
                pad(toHex(verGas), { size: 16 }),
                pad(toHex(postGas), { size: 16 }),
                config.gasToken
            ]);

            return {
                paymasterAndData,
                verificationGasLimit: verGas,
                preVerificationGas: args.userOperation.preVerificationGas
            };
        }
    };
}

/**
 * Admin Client for Paymaster V4
 */
export class PaymasterV4Client {
    static async addGasToken(wallet: any, address: Address, token: Address) {
        return wallet.writeContract({
            address,
            abi: ['function addGasToken(address token)'],
            functionName: 'addGasToken',
            args: [token],
            chain: wallet.chain
        } as any);
    }

    static async removeGasToken(wallet: any, address: Address, token: Address) {
        return wallet.writeContract({
            address,
            abi: ['function removeGasToken(address token)'],
            functionName: 'removeGasToken',
            args: [token],
            chain: wallet.chain
        } as any);
    }

    static async addSBT(wallet: any, address: Address, sbt: Address) {
        return wallet.writeContract({
            address,
            abi: ['function addSBT(address sbt)'],
            functionName: 'addSBT',
            args: [sbt],
            chain: wallet.chain
        } as any);
    }

    static async addSBTWithActivity(wallet: any, address: Address, sbt: Address) {
        return wallet.writeContract({
            address,
            abi: ['function addSBTWithActivity(address sbt)'],
            functionName: 'addSBTWithActivity',
            args: [sbt],
            chain: wallet.chain
        } as any);
    }

    static async removeSBT(wallet: any, address: Address, sbt: Address) {
        return wallet.writeContract({
            address,
            abi: ['function removeSBT(address sbt)'],
            functionName: 'removeSBT',
            args: [sbt],
            chain: wallet.chain
        } as any);
    }

    static async setServiceFeeRate(wallet: any, address: Address, rate: bigint) {
        return wallet.writeContract({
            address,
            abi: ['function setServiceFeeRate(uint256 rate)'],
            functionName: 'setServiceFeeRate',
            args: [rate],
            chain: wallet.chain
        } as any);
    }

    static async setMaxGasCostCap(wallet: any, address: Address, cap: bigint) {
        return wallet.writeContract({
            address,
            abi: ['function setMaxGasCostCap(uint256 cap)'],
            functionName: 'setMaxGasCostCap',
            args: [cap],
            chain: wallet.chain
        } as any);
    }

    static async withdrawPNT(wallet: any, address: Address, to: Address, token: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: ['function withdrawPNT(address to, address token, uint256 amount)'],
            functionName: 'withdrawPNT',
            args: [to, token, amount],
            chain: wallet.chain
        } as any);
    }

    // ============ Price Management APIs (L1/L2 Level) ============
    // NOTE: Only owner/operator can call write functions

    /**
     * Update the cached ETH/USD price from Chainlink Oracle.
     * Must be called if cachedPrice is 0 (uninitialized).
     * @param wallet - Wallet client with write capability (owner/operator)
     * @param address - Paymaster contract address
     */
    static async updatePrice(wallet: any, address: Address) {
        return wallet.writeContract({
            address,
            abi: ['function updatePrice() external'],
            functionName: 'updatePrice',
            chain: wallet.chain
        } as any);
    }

    /**
     * Set the token price (in 8 decimals, e.g., 1e8 = $1 USD).
     * @param wallet - Wallet client with write capability (owner/operator)
     * @param address - Paymaster contract address
     * @param token - ERC20 token address
     * @param priceUSD - Price in 8 decimals (e.g., 100000000 = $1)
     */
    static async setTokenPrice(wallet: any, address: Address, token: Address, priceUSD: bigint) {
        return wallet.writeContract({
            address,
            abi: ['function setTokenPrice(address token, uint256 price) external'],
            functionName: 'setTokenPrice',
            args: [token, priceUSD],
            chain: wallet.chain
        } as any);
    }

    /**
     * Get the cached ETH/USD price.
     * @param publicClient - Viem public client
     * @param address - Paymaster contract address
     * @returns { price: bigint, updatedAt: bigint }
     */
    static async getCachedPrice(publicClient: any, address: Address): Promise<{ price: bigint; updatedAt: bigint }> {
        const result = await publicClient.readContract({
            address,
            abi: [{
                name: 'cachedPrice',
                type: 'function',
                inputs: [],
                outputs: [
                    { name: 'price', type: 'uint208' },
                    { name: 'updatedAt', type: 'uint48' }
                ],
                stateMutability: 'view'
            }],
            functionName: 'cachedPrice'
        });
        return { price: result[0], updatedAt: result[1] };
    }

    /**
     * Get the token price for a specific token.
     * @param publicClient - Viem public client
     * @param address - Paymaster contract address
     * @param token - ERC20 token address
     * @returns Token price in 8 decimals
     */
    static async getTokenPrice(publicClient: any, address: Address, token: Address): Promise<bigint> {
        return publicClient.readContract({
            address,
            abi: [{
                name: 'tokenPrices',
                type: 'function',
                inputs: [{ name: 'token', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'tokenPrices',
            args: [token]
        });
    }

    /**
     * Ensure price cache is initialized. Calls updatePrice() if cache is 0.
     * Convenience method for initialization scripts.
     * @param wallet - Wallet client with write capability (owner/operator)
     * @param publicClient - Viem public client
     * @param address - Paymaster contract address
     * @returns boolean - true if updatePrice was called, false if already initialized
     */
    static async ensurePriceInitialized(wallet: any, publicClient: any, address: Address): Promise<boolean> {
        const { price } = await this.getCachedPrice(publicClient, address);
        if (price === 0n) {
            await this.updatePrice(wallet, address);
            return true;
        }
        return false;
    }

    // ============ UserOp Helper APIs (For Gasless Transactions) ============

    /**
     * Build paymasterAndData for gasless UserOperation.
     * Layout: [Paymaster(20)] [VerificationGasLimit(16)] [PostOpGasLimit(16)] [Token(20)] [ValidUntil(6)] [ValidAfter(6)]
     * @param paymasterAddress - Paymaster contract address
     * @param token - Gas token address (e.g., bPNTs)
     * @param validityWindow - Optional validity window in seconds (default 3600 = 1 hour)
     * @param verificationGasLimit - Optional verification gas limit (default 60000)
     * @param postOpGasLimit - Optional postOp gas limit (default 50000)
     */
    static buildPaymasterData(
        paymasterAddress: Address,
        token: Address,
        options?: {
            validityWindow?: number;
            verificationGasLimit?: bigint;
            postOpGasLimit?: bigint;
        }
    ): `0x${string}` {
        const validityWindow = options?.validityWindow ?? 3600;
        const verGas = options?.verificationGasLimit ?? 60000n;
        const postGas = options?.postOpGasLimit ?? 50000n;
        
        const now = Math.floor(Date.now() / 1000);
        const validUntil = now + validityWindow;
        const validAfter = now - 100; // 100 seconds grace period

        return concat([
            paymasterAddress,
            pad(toHex(verGas), { size: 16 }),
            pad(toHex(postGas), { size: 16 }),
            token,
            pad(toHex(validUntil), { size: 6 }),
            pad(toHex(validAfter), { size: 6 })
        ]);
    }

    /**
     * Get user's deposited balance on the Paymaster.
     * @param publicClient - Viem public client
     * @param address - Paymaster contract address
     * @param user - User address (AA account or EOA)
     * @param token - Token address
     * @returns Deposited balance in token units (wei)
     */
    static async getDepositedBalance(publicClient: any, address: Address, user: Address, token: Address): Promise<bigint> {
        return publicClient.readContract({
            address,
            abi: [{
                name: 'balances',
                type: 'function',
                inputs: [
                    { name: 'user', type: 'address' },
                    { name: 'token', type: 'address' }
                ],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'balances',
            args: [user, token]
        });
    }

    /**
     * Deposit tokens to Paymaster for a user (enables gasless transactions).
     * @param wallet - Wallet client with write capability
     * @param address - Paymaster contract address
     * @param user - User address to deposit for
     * @param token - Token address
     * @param amount - Amount to deposit (in token wei)
     */
    static async depositFor(wallet: any, address: Address, user: Address, token: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: ['function depositFor(address user, address token, uint256 amount) external'],
            functionName: 'depositFor',
            args: [user, token, amount],
            chain: wallet.chain
        } as any);
    }
}
