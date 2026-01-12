import { type Address, concat, pad, toHex, keccak256, encodeAbiParameters, parseAbi } from 'viem';

export type PaymasterV4MiddlewareConfig = {
    paymasterAddress: Address;
    gasToken: Address;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
};

export type GaslessReadinessReport = {
    isReady: boolean;
    issues: string[];
    details: {
        paymasterStake: bigint;
        paymasterDeposit: bigint;
        ethUsdPrice: bigint;
        tokenSupported: boolean;
        tokenPrice: bigint;
        userTokenBalance: bigint;
        userPaymasterDeposit: bigint;
    };
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
    /**
     * Comprehensive check to verify if a gasless transaction is likely to succeed.
     */
    static async checkGaslessReadiness(
        publicClient: any,
        entryPoint: Address,
        paymasterAddress: Address,
        user: Address,
        token: Address
    ): Promise<GaslessReadinessReport> {
        const issues: string[] = [];
        
        // 1. EntryPoint Stake/Deposit (using v0.7 getDepositInfo)
        const depositInfo = await publicClient.readContract({
            address: entryPoint,
            abi: parseAbi(['function getDepositInfo(address account) external view returns (uint256 deposit, bool staked, uint256 stake, uint32 unstakeDelaySec, uint48 withdrawTime)']),
            functionName: 'getDepositInfo',
            args: [paymasterAddress]
        });

        if (depositInfo[2] < 100000000000000000n) issues.push('Paymaster stake in EntryPoint is less than 0.1 ETH');
        if (depositInfo[3] < 86400) issues.push('Paymaster unstake delay is less than 1 day');
        if (depositInfo[0] < 100000000000000000n) issues.push('Paymaster deposit in EntryPoint is less than 0.1 ETH');

        // 2. Oracle Price
        const ethPrice = await publicClient.readContract({
            address: paymasterAddress,
            abi: parseAbi(['function cachedPrice() external view returns (uint208 price, uint48 updatedAt)']),
            functionName: 'cachedPrice'
        }).catch(() => [0n, 0n] as const);

        if (ethPrice[0] === 0n) issues.push('Paymaster ETH/USD price not initialized');

        // 3. Token Support & Price
        const [tokenPrice, userTokenBal, userPMDeposit] = await Promise.all([
            this.getTokenPrice(publicClient, paymasterAddress, token),
            publicClient.readContract({
                address: token,
                abi: parseAbi(['function balanceOf(address account) external view returns (uint256)']),
                functionName: 'balanceOf',
                args: [user]
            }),
            this.getDepositedBalance(publicClient, paymasterAddress, user, token)
        ]);

        if (tokenPrice === 0n) issues.push('Token price not set in Paymaster');
        if (userPMDeposit === 0n) issues.push('User has no deposit in Paymaster');

        return {
            isReady: issues.length === 0,
            issues,
            details: {
                paymasterStake: depositInfo[2],
                paymasterDeposit: depositInfo[0],
                ethUsdPrice: ethPrice.price,
                tokenSupported: true, // If getTokenPrice didn't revert, it's supported
                tokenPrice: tokenPrice,
                userTokenBalance: userTokenBal,
                userPaymasterDeposit: userPMDeposit
            }
        };
    }

    /**
     * Automated preparation of the Paymaster environment.
     * Performs missing stake, deposit, and price initialization steps.
     */
    static async prepareGaslessEnvironment(
        operatorWallet: any,
        publicClient: any,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        options: {
            minStake?: bigint;
            minDeposit?: bigint;
            tokenPriceUSD?: bigint;
        } = {}
    ) {
        const report = await this.checkGaslessReadiness(publicClient, entryPoint, paymasterAddress, operatorWallet.account.address, token);
        const results: { step: string, hash?: string, status: string }[] = [];

        // 1. Stake
        if (report.details.paymasterStake < (options.minStake || 100000000000000000n)) {
            const hash = await this.addStake(operatorWallet, paymasterAddress, options.minStake || 200000000000000000n, 86400);
            results.push({ step: 'Stake', hash, status: 'Sent' });
        }

        // 2. Deposit (EntryPoint)
        if (report.details.paymasterDeposit < (options.minDeposit || 100000000000000000n)) {
            const hash = await this.addDeposit(operatorWallet, paymasterAddress, options.minDeposit || 300000000000000000n);
            results.push({ step: 'Deposit', hash, status: 'Sent' });
        }

        // 3. Oracle Price
        if (report.details.ethUsdPrice === 0n) {
            const hash = await this.updatePrice(operatorWallet, paymasterAddress);
            results.push({ step: 'OraclePrice', hash, status: 'Sent' });
        }

        // 4. Token Support & Price
        if (report.details.tokenPrice === 0n) {
            // Try to add token if it might not be supported
            try {
                const hash = await this.addGasToken(operatorWallet, paymasterAddress, token);
                results.push({ step: 'AddGasToken', hash, status: 'Sent' });
            } catch (e) {
                // Ignore if already added
            }

            if (options.tokenPriceUSD) {
                const hash = await this.setTokenPrice(operatorWallet, paymasterAddress, token, options.tokenPriceUSD);
                results.push({ step: 'TokenPrice', hash, status: 'Sent' });
            }
        }

        return results;
    }
    
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
            abi: parseAbi(['function updatePrice() external']),
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
            abi: parseAbi(['function setTokenPrice(address token, uint256 price) external']),
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
            abi: parseAbi(['function depositFor(address user, address token, uint256 amount) external']),
            functionName: 'depositFor',
            args: [user, token, amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * Add ETH stake to EntryPoint for this Paymaster.
     * Required for storage access (e.g. checking user token balance).
     */
    static async addStake(wallet: any, address: Address, amount: bigint, unstakeDelaySec: number) {
        return wallet.writeContract({
            address,
            abi: parseAbi(['function addStake(uint32 unstakeDelaySec) external payable']),
            functionName: 'addStake',
            args: [unstakeDelaySec],
            value: amount,
            chain: wallet.chain
        } as any);
    }

    /**
     * Add ETH deposit to EntryPoint for this Paymaster.
     * This ETH is used to pay for the gas of sponsored UserOperations.
     */
    static async addDeposit(wallet: any, address: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: parseAbi(['function addDeposit() external payable']),
            functionName: 'addDeposit',
            value: amount,
            chain: wallet.chain
        } as any);
    }

    /**
     * Submit a gasless UserOperation using Paymaster V4.
     * This method handles building paymasterData, signing, and submitting to the bundler.
     * Note: This requires the AA account to already have a deposit in the Paymaster.
     * @param client - Viem public client
     * @param account - The owner EOA account object (for signing)
     * @param aaAddress - The AA wallet address
     * @param entryPoint - EntryPoint address
     * @param paymasterAddress - Paymaster V4 address
     * @param token - Gas token address (e.g., bPNTs)
     * @param bundlerUrl - Bundler RPC URL
     * @param callData - The callData for the UserOp
     * @param options - Optional UserOp parameters
     * @returns UserOperation hash
     */
    static async submitGaslessUserOperation(
        client: any,
        account: any,
        aaAddress: Address,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        bundlerUrl: string,
        callData: `0x${string}`,
        options?: {
            validityWindow?: number;
            verificationGasLimit?: bigint;
            callGasLimit?: bigint;
            preVerificationGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
        }
    ): Promise<`0x${string}`> {
        // 1. Get Nonce
        const nonce = await client.readContract({
            address: aaAddress,
            abi: [{ name: 'getNonce', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'getNonce'
        });

        // 2. Build paymasterAndData
        const paymasterAndData = this.buildPaymasterData(paymasterAddress, token, {
            validityWindow: options?.validityWindow,
            verificationGasLimit: options?.verificationGasLimit
        });

        // 3. Construct UserOp
        const userOp = {
            sender: aaAddress,
            nonce: BigInt(nonce),
            initCode: '0x' as `0x${string}`,
            callData,
            accountGasLimits: concat([
                pad(toHex(options?.verificationGasLimit ?? 80000n), { size: 16 }), // Verification
                pad(toHex(options?.callGasLimit ?? 300000n), { size: 16 })       // Call
            ]),
            preVerificationGas: options?.preVerificationGas ?? 50000n,
            gasFees: concat([
                pad(toHex(options?.maxPriorityFeePerGas ?? 100000000n), { size: 16 }),
                pad(toHex(options?.maxFeePerGas ?? 2000000000n), { size: 16 })
            ]),
            paymasterAndData,
            signature: '0x' as `0x${string}`
        };

        // 4. Calculate Hash (Simplified v0.7 format)
        // [sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData]
        const hashedUserOp = keccak256(encodeAbiParameters(
            ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'].map(t => ({ type: t } as any)),
            [
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees,
                keccak256(userOp.paymasterAndData)
            ]
        ));
        const userOpHash = keccak256(encodeAbiParameters(
            ['bytes32', 'address', 'uint256'].map(t => ({ type: t } as any)),
            [hashedUserOp, entryPoint, BigInt(client.chain.id)]
        ));

        // 5. Sign
        const signature = await account.signMessage({ message: { raw: userOpHash } });
        userOp.signature = signature;

        // 6. Submit to Bundler
        const response = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [this.toAlchemyFormat(userOp), entryPoint]
            }, (_, v) => typeof v === 'bigint' ? '0x' + v.toString(16) : v)
        });

        const result = await response.json();
        if (result.error) throw new Error(`Bundler Error: ${JSON.stringify(result.error)}`);
        return result.result;
    }

    /**
     * Internal helper to format UserOp for Alchemy/Standard Bundlers (v0.7 Decomposed)
     */
    private static toAlchemyFormat(userOp: any) {
        const result: any = {
            sender: userOp.sender,
            nonce: toHex(userOp.nonce),
            callData: userOp.callData,
            preVerificationGas: toHex(userOp.preVerificationGas),
            signature: userOp.signature,
            initCode: userOp.initCode
        };

        // Extract Factory/FactoryData if present
        if (userOp.initCode && userOp.initCode !== '0x') {
            result.factory = userOp.initCode.slice(0, 42);
            result.factoryData = '0x' + userOp.initCode.slice(42);
        }

        // Unpack accountGasLimits: [verificationGasLimit(16)][callGasLimit(16)]
        if (userOp.accountGasLimits && userOp.accountGasLimits !== '0x') {
            const packed = userOp.accountGasLimits.replace('0x', '').padStart(64, '0');
            result.verificationGasLimit = '0x' + BigInt('0x' + packed.slice(0, 32)).toString(16);
            result.callGasLimit = '0x' + BigInt('0x' + packed.slice(32, 64)).toString(16);
        }

        // Unpack gasFees: [maxPriorityFee(16)][maxFee(16)]
        if (userOp.gasFees && userOp.gasFees !== '0x') {
            const packed = userOp.gasFees.replace('0x', '').padStart(64, '0');
            result.maxPriorityFeePerGas = '0x' + BigInt('0x' + packed.slice(0, 32)).toString(16);
            result.maxFeePerGas = '0x' + BigInt('0x' + packed.slice(32, 64)).toString(16);
        }

        // Unpack paymasterAndData: [paymaster(20)][verificationGas(16)][postOpGas(16)][paymasterData]
        if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
            const packed = userOp.paymasterAndData.replace('0x', '');
            if (packed.length >= 104) {
                result.paymaster = '0x' + packed.slice(0, 40);
                result.paymasterVerificationGasLimit = '0x' + BigInt('0x' + packed.slice(40, 72)).toString(16);
                result.paymasterPostOpGasLimit = '0x' + BigInt('0x' + packed.slice(72, 104)).toString(16);
                result.paymasterData = '0x' + packed.slice(104);
            }
        }

        return result;
    }
}


