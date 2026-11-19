import { type Address, type Hex, concat, pad, toHex, encodeFunctionData, parseAbi } from 'viem';
import { type PublicClient } from '@aastar/core';
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

        // 2-3. Estimation runs INSIDE submit, after it has reserved the SuperPaymaster 5.5.0 single-in-flight slot
        // (PR #420 M3-b). Limits are submit's: the bundler estimate × coefficient, with the contract's
        // minPostOpGas read from the chain (gasPolicy.ts); no SDK-side compression.

        // 4. Estimate (inside submit) and submit
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
                factory: config.factory,
                factoryData: config.factoryData
            }
        );
    }
}
