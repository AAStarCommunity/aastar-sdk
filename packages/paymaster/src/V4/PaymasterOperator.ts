import { type Address, parseAbi } from 'viem';
import { PaymasterABI } from '@aastar/core';
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

    /**
     * ## The five methods that used to live here, and what was wrong with them
     *
     * Each passed a **raw human-readable string array** as `abi:` — `['function addGasToken(...)']`
     * — which viem does not accept. Measured: `encodeFunctionData` throws
     * `Cannot use 'in' operator to search for 'name' in function addGasToken(address token)`,
     * so these threw locally and never reached a node.
     *
     * Three of the five also named functions that **do not exist on the deployed contract**.
     * Probed against the implementation behind the aPNTs PaymasterV4 proxy
     * (EIP-1167 → `0xc0f968625e3ac0a2ad7f107cd5857425f672d268`, 10493 bytes), Sepolia block 11639724:
     *
     * ```
     * addGasToken(address)                  ❌      setServiceFeeRate(uint256)     ✅
     * removeGasToken(address)               ❌      setMaxGasCostCap(uint256)      ✅
     * withdrawPNT(address,address,uint256)  ❌      setTokenPrice(address,uint256) ✅
     *                                              removeToken(address)           ✅
     *                                              withdrawTo(address,uint256)    ✅
     * ```
     *
     * (The ✅ column is the positive control: the same probe on the same bytecode finds real
     * selectors, so the ❌ column is a fact about those names and not a broken instrument. An
     * earlier run of this probe against the PROXY address returned ❌ for everything — a 45-byte
     * EIP-1167 stub contains no selectors at all. That reading looked exactly like a discovery.)
     *
     * The two that exist are restored below against `PaymasterABI` from `@aastar/core`. The three
     * that do not are kept as **throwing shims** rather than deleted: a caller upgrading past this
     * change gets a message naming the replacement, instead of viem's `'in' operator` error —
     * which is what they were already getting, just without an explanation.
     *
     * `addGasToken` and `withdrawPNT` cannot be forwarded automatically, and that is the part worth
     * noticing: **their parameter lists were wrong too.** Registering a gas token needs a price,
     * and `withdrawTo(to, amount)` takes no token at all. The signatures were invented alongside
     * the names.
     *
     * `setTokenPrice` — the real way to register a gas token — **was already here all along**,
     * correct and using `parseAbi`, twenty lines above `addGasToken`. So the broken method was not
     * filling a gap; it was a second, fictional spelling of a capability the class already had.
     */
    static async removeToken(wallet: any, address: Address, token: Address) {
        return wallet.writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeToken',
            args: [token],
            chain: wallet.chain,
        } as any);
    }

    static async withdrawTo(wallet: any, address: Address, to: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            chain: wallet.chain,
        } as any);
    }

    /** @deprecated Not a function on PaymasterV4. Use {@link setTokenPrice}. */
    static async addGasToken(_wallet: any, _address: Address, _token: Address): Promise<never> {
        throw new Error(
            'PaymasterOperator.addGasToken: `addGasToken(address)` is on no deployed PaymasterV4 ' +
            '(verified against implementation 0xc0f968625e3ac0a2ad7f107cd5857425f672d268). ' +
            'Registering a gas token also needs a price — use setTokenPrice(wallet, paymaster, token, price).',
        );
    }

    /** @deprecated Wrong name. Use {@link removeToken}. */
    static async removeGasToken(_wallet: any, _address: Address, _token: Address): Promise<never> {
        throw new Error(
            'PaymasterOperator.removeGasToken: the contract function is `removeToken(address)`. ' +
            'Use removeToken(wallet, paymaster, token).',
        );
    }

    static async setServiceFeeRate(wallet: any, address: Address, rate: bigint) {
        return wallet.writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setServiceFeeRate',
            args: [rate],
            chain: wallet.chain,
        } as any);
    }

    static async setMaxGasCostCap(wallet: any, address: Address, cap: bigint) {
        return wallet.writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setMaxGasCostCap',
            args: [cap],
            chain: wallet.chain,
        } as any);
    }

    /** @deprecated Wrong name AND wrong parameters. Use {@link withdrawTo}. */
    static async withdrawPNT(
        _wallet: any, _address: Address, _to: Address, _token: Address, _amount: bigint,
    ): Promise<never> {
        throw new Error(
            'PaymasterOperator.withdrawPNT: `withdrawPNT` is on no deployed PaymasterV4, and the ' +
            'real entry point takes no token argument. Use withdrawTo(wallet, paymaster, to, amount).',
        );
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

        if (depositInfo[2] < 50000000000000000n) issues.push('Paymaster stake in EntryPoint is less than 0.05 ETH');
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
        if (report.details.paymasterStake < (options.minStake || 50000000000000000n)) {
            const hash = await this.addStake(operatorWallet, paymasterAddress, options.minStake || 50000000000000000n, 86400);
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
            // An `addGasToken(...)` call used to sit here inside `try { } catch (e) {}`. It threw
            // every single time — viem rejects the raw string array it passed as `abi:` — and the
            // empty catch swallowed it, so `results` simply never gained an 'AddGasToken' entry.
            //
            // **An always-throwing call inside an empty catch is indistinguishable from a call that
            // succeeded but produced nothing**, and the working code was already on the next line:
            // `setTokenPrice` is how a gas token is registered, it was correct, and it ran.
            if (options.tokenPriceUSD) {
                const hash = await this.setTokenPrice(operatorWallet, paymasterAddress, token, options.tokenPriceUSD);
                await publicClient.waitForTransactionReceipt({ hash });
                results.push({ step: 'TokenPrice', hash, status: 'Confirmed' });
            }
        }

        return results;
    }
}
