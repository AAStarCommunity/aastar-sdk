import { type Address, type Hex, concat, pad, toHex, encodeFunctionData, parseAbi } from 'viem';
import { PaymasterClient } from './PaymasterClient';
import { buildSuperPaymasterData, formatUserOpV07, getUserOpHashV07 } from './PaymasterUtils';

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
        
        let vgl = est.verificationGasLimit;
        
        // Safety Floor: If estimate is suspiciously low (e.g. < 50k), bump it for PM logic
        // But if we bump it too high, we hit "Efficiency too low".
        // Let's trust the bundler's estimate but add a fixed safety pad for dynamic storage
        const SAFETY_PAD = 80000n; 
        const tunedVGL = vgl + SAFETY_PAD;

        // CRITICAL FIX: Set paymasterVerificationGasLimit for optimal efficiency
        // Bundler requires efficiency ratio >= 0.4 (actual_gas_used / gas_limit >= 0.4)
        // SuperPaymaster validatePaymasterUserOp uses ~110-120k gas (measured)
        // Test results:
        //   - Base 300k +  200k buffer (500k total) → efficiency 0.238 ❌
        //   - Base 300k + 20k buffer (320k total) → efficiency 0.347 ❌
        //   - Base 300k (no buffer) → efficiency 0.366❌
        // Analysis: actual_gas ~110k, need limit <= 275k for 0.4 ratio
        // Strategy: Use 87% of bundler's estimate (bundler over-estimates for safety)
        const bundlerEstimate = est.paymasterVerificationGasLimit || 100000n;
        const tunedPMVerificationGas = (bundlerEstimate * 87n) / 100n; // 87% = 261k, ratio ~0.42 ✅

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
