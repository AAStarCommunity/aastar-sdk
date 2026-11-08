import { type Address, type Hex, concat, pad, toHex, encodeFunctionData, parseAbi } from 'viem';
import { type PublicClient } from '@aastar/core';
import { PaymasterClient, type GasEstimate } from './PaymasterClient';
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

        // 2-3. Estimation + Smart Buffer Strategy, run INSIDE submit (tuneEstimate): the estimation
        // request carries a real signature over the real nonce, so it must happen after submit has
        // reserved the SuperPaymaster 5.5.0 single-in-flight slot (PR #420 M3-b).
        //
        // SuperPaymaster validation common case is ~58k-66k, worst case (refresh) 115k; a nominal
        // 60k with efficiency 0.45 gives a 133k ceiling, which satisfies the bundler's 0.4
        // efficiency ratio (58/133 = 0.43) and execution (115 < 133). Account validation +
        // execution is ~35k → 77k limit. postOp calls burnFromWithOpHash (~40k) + storage writes:
        // +100k buffer, 200k floor.
        const tuneEstimate = (est: GasEstimate): Partial<GasEstimate> => {
            const tunedVGL = tuneGasLimit(est.verificationGasLimit, 35_000n, 0.45);
            const tunedPMVerificationGas = tuneGasLimit(est.paymasterVerificationGasLimit || 100000n, 60_000n, 0.45);
            const postOpBase = est.paymasterPostOpGasLimit + 100_000n;
            const tunedPostOp = postOpBase > 200_000n ? postOpBase : 200_000n;
            console.log(`[SuperPaymasterClient] 🔧 Tuned Limits: VGL=${tunedVGL}, PMVGL=${tunedPMVerificationGas}, PostOp=${tunedPostOp}`);
            return {
                verificationGasLimit: tunedVGL,
                paymasterVerificationGasLimit: tunedPMVerificationGas,
                paymasterPostOpGasLimit: tunedPostOp,
            };
        };

        // 4. Estimate (inside submit) and submit with tuned limits
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
                tuneEstimate,
                factory: config.factory,
                factoryData: config.factoryData
            }
        );
    }
}
