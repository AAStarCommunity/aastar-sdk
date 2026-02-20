import { type Address, type Hex, concat, pad, toHex, encodeFunctionData, parseAbi } from 'viem';
import { type PublicClient } from '@aastar/core';
import { PaymasterClient } from './PaymasterClient';
import { buildSuperPaymasterData, formatUserOpV07, getUserOpHashV07, tuneGasLimit } from './PaymasterUtils';

export type GaslessTransactionConfig = {
    token: Address;
    recipient: Address;
    amount: bigint;
    operator: Address;
    paymasterAddress: Address;
    factory?: Address;
    factoryData?: Hex;
};

/**
 * SuperPaymasterClient
 * High-level API for SuperPaymaster operations, including dynamic gas estimation.
 */
export class SuperPaymasterClient {
    /**
     * @private
     * Static utility class, should not be instantiated.
     */
    private constructor() {}


    /**
     * Submit a gasless transaction using SuperPaymaster.
     * Automatically handles gas estimation with a smart efficiency buffer.
     */
    static async submitGaslessTransaction(
        client: any,
        wallet: any,
        aaAddress: Address,
        entryPoint: Address,
        bundlerUrl: string,
        config: GaslessTransactionConfig
    ): Promise<Hex> {
        
        // 1. Prepare Calldata (Standard ERC20 Transfer)
        const callData = encodeFunctionData({
            abi: parseAbi(['function execute(address dest, uint256 value, bytes func) external']),
            functionName: 'execute',
            args: [
                config.token,
                0n,
                encodeFunctionData({
                    abi: parseAbi(['function transfer(address to, uint256 amount) external returns (bool)']),
                    functionName: 'transfer',
                    args: [config.recipient, config.amount]
                })
            ]
        });

        // 2. Initial Gas Estimation (Bundler Query)
        console.log(`[SuperPaymasterClient] 🎯 Target Info:`);
        console.log(`   - Paymaster: ${config.paymasterAddress}`);
        console.log(`   - Token: ${config.token}`);
        console.log(`   - Operator: ${config.operator}`);

        console.log('[SuperPaymasterClient] ☁️  Estimating Gas usage...');
        const est = await PaymasterClient.estimateUserOperationGas(
            client,
            wallet,
            aaAddress,
            entryPoint,
            config.paymasterAddress,
            config.token,
            bundlerUrl,
            callData,
            { 
                operator: config.operator,
                factory: config.factory,
                factoryData: config.factoryData
            }
        );

        console.log('[SuperPaymasterClient] ☁️  Bundler Estimates:', est);

        // 3. Apply Smart Buffer Strategy
        // We need to ensure:
        // A. verificationGasLimit >= est.verificationGasLimit (Bundler's minimum)
        // B. verificationGasLimit >= SuperPaymaster's Actual Usage (~80k-100k)
        // C. verificationGasLimit / PreVerificationGas > 0.4 (Efficiency Ratio) PRE-CHECK
        //    Actually, the Bundler checks: (gas limits) / (actual gas used) > efficiency.
        //    So we must NOT set limits WAY higher than actual usage. 
        //    Best strategy: Use Bundler's Estimate + Small Buffer (e.g. 10-20k).
        
        // SuperPaymaster Logic Cost: ~80,000 to 120,000 gas depending on cold storage
        // Bundler Estimate usually returns the *actual execution path* gas.
        


        // CRITICAL FIX: Set paymasterVerificationGasLimit for optimal efficiency
        // Bundler requires efficiency ratio >= 0.4 (actual_gas_used / gas_limit >= 0.4)
        // SuperPaymaster validatePaymasterUserOp uses ~110-120k gas (measured)
        // Analysis (Jan 19 Update-Final-Final):
        //   Instead of fixed percentage, use "Dynamic Nominal Gas Tuning".
        //   SuperPaymaster validation common case is ~58k-66k. Worst case (refresh) 115k.
        //   Setting nominal benchmark to 60k gives Ceiling = 60k / 0.45 = 133,333.
        //   This satisfies 0.4 efficiency (58/133=0.43) AND execution (115 < 133).
        
        // 1. Tune Account Verification Gas Limit (VGL)
        // Bundler might return huge VGL (e.g. 250k) which kills efficiency if usage is low.
        // We need to clamp VGL down closer to actual usage.
        // Let's assume standard account validation + execution is ~35k.
        // Target: 35k / 0.45 = 77k Limit.
        const tunedVGL = tuneGasLimit(est.verificationGasLimit, 35_000n, 0.45);

        // 2. Tune Paymaster Verification Gas Limit (PMVGL)
        // Ensure bundler estimate is respected as floor for PMVGL
        const bundlerEstimateVGL = est.paymasterVerificationGasLimit || 100000n;
        const tunedPMVerificationGas = tuneGasLimit(bundlerEstimateVGL, 60_000n, 0.45);

        // Same for PostOp
        const tunedPostOp = est.paymasterPostOpGasLimit + 10000n;

        console.log(`[SuperPaymasterClient] 🔧 Tuned Limits: VGL=${tunedVGL}, PMVGL=${tunedPMVerificationGas}, PostOp=${tunedPostOp}`);

        // 4. Submit with Tuned Limits
        return PaymasterClient.submitGaslessUserOperation(
            client,
            wallet,
            aaAddress,
            entryPoint,
            config.paymasterAddress,
            config.token,
            bundlerUrl,
            callData,
            {
                operator: config.operator,
                verificationGasLimit: tunedVGL,
                callGasLimit: est.callGasLimit, 
                preVerificationGas: est.preVerificationGas,
                paymasterVerificationGasLimit: tunedPMVerificationGas, // EXPLICIT PM LIMIT
                paymasterPostOpGasLimit: tunedPostOp,
                autoEstimate: false, // We did it ourselves
                factory: config.factory,
                factoryData: config.factoryData
            }
        );
    }
}
