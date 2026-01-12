import { type Address, parseAbi } from 'viem';
import { type GaslessReadinessReport, type PaymasterV4MiddlewareConfig } from './PaymasterUtils';

/**
 * PaymasterOperator
 * Focus: Deployment, Configuration, Maintenance, Keeper Bots.
 */
export class PaymasterOperator {

    /**
     * Update the cached ETH/USD price from Chainlink Oracle.
     * Must be called if cachedPrice is 0 (uninitialized).
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

    static async ensurePriceInitialized(wallet: any, publicClient: any, address: Address): Promise<boolean> {
        const { price } = await this.getCachedPrice(publicClient, address);
        if (price === 0n) {
            await this.updatePrice(wallet, address);
            return true;
        }
        return false;
    }

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

    static async addDeposit(wallet: any, address: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: parseAbi(['function addDeposit() external payable']),
            functionName: 'addDeposit',
            value: amount,
            chain: wallet.chain
        } as any);
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
    
    // --- Diagnostics & Automation ---

    static async checkGaslessReadiness(
        publicClient: any,
        entryPoint: Address,
        paymasterAddress: Address,
        user: Address,
        token: Address
    ): Promise<GaslessReadinessReport> {
        const issues: string[] = [];
        
        // 1. EntryPoint Stake/Deposit
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
                tokenSupported: true,
                tokenPrice: tokenPrice,
                userTokenBalance: userTokenBal,
                userPaymasterDeposit: userPMDeposit
            }
        };
    }

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
            await publicClient.waitForTransactionReceipt({ hash });
            results.push({ step: 'Stake', hash, status: 'Confirmed' });
        }

        // 2. Deposit (EntryPoint)
        if (report.details.paymasterDeposit < (options.minDeposit || 100000000000000000n)) {
            const hash = await this.addDeposit(operatorWallet, paymasterAddress, options.minDeposit || 300000000000000000n);
            await publicClient.waitForTransactionReceipt({ hash });
            results.push({ step: 'Deposit', hash, status: 'Confirmed' });
        }

        // 3. Oracle Price
        if (report.details.ethUsdPrice === 0n) {
            const hash = await this.updatePrice(operatorWallet, paymasterAddress);
            await publicClient.waitForTransactionReceipt({ hash });
            results.push({ step: 'OraclePrice', hash, status: 'Confirmed' });
        }

        // 4. Token Support & Price
        if (report.details.tokenPrice === 0n) {
            try {
                const hash = await this.addGasToken(operatorWallet, paymasterAddress, token);
                await publicClient.waitForTransactionReceipt({ hash });
                results.push({ step: 'AddGasToken', hash, status: 'Confirmed' });
            } catch (e) {}

            if (options.tokenPriceUSD) {
                const hash = await this.setTokenPrice(operatorWallet, paymasterAddress, token, options.tokenPriceUSD);
                await publicClient.waitForTransactionReceipt({ hash });
                results.push({ step: 'TokenPrice', hash, status: 'Confirmed' });
            }
        }

        return results;
    }
}
