import { type Address, type Hash, type Hex, type PublicClient, parseEther, encodeFunctionData } from 'viem';
import { UserOperationBuilder } from './userOp.js';
import { EntryPointVersion } from '@aastar/core';

export enum UserOpScenarioType {
    NATIVE = 'NATIVE',             // Plain ERC-4337, user pays ETH
    GASLESS_V4 = 'GASLESS_V4',     // Standard PaymasterV4
    SUPER_BPNT = 'SUPER_BPNT',     // SuperPaymaster with bPNT internal payment
    SUPER_CPNT = 'SUPER_CPNT',     // SuperPaymaster with cPNT internal payment
    SUPER_CUSTOM = 'SUPER_CUSTOM'  // SuperPaymaster with custom token/operator
}

export interface ScenarioParams {
    sender: Address;
    ownerAccount: any; // Account object for signing
    recipient: Address;
    tokenAddress: Address;
    amount: bigint;
    entryPoint: Address;
    chainId: number;
    publicClient: PublicClient;
    paymaster?: Address;           // For PM_V4 or SuperPM
    operator?: Address;            // For SuperPM
    paymasterGasLimit?: bigint;
    paymasterPostOpGasLimit?: bigint;
    nonceKey?: bigint;
}

export class UserOpScenarioBuilder {
    /**
     * Builds a signed PackedUserOperation for a token transfer based on the specified scenario.
     */
    static async buildTransferScenario(
        type: UserOpScenarioType,
        params: ScenarioParams
    ): Promise<{ userOp: any, opHash: Hash }> {
        const { 
            sender, ownerAccount, recipient, tokenAddress, amount, 
            entryPoint, chainId, publicClient, paymaster, operator,
            paymasterGasLimit = 300000n,
            paymasterPostOpGasLimit = 50000n,
            nonceKey = 0n
        } = params;

        // 1. Build Token Transfer CallData
        const transferData = encodeFunctionData({
            abi: [{ name: 'transfer', type: 'function', inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] }],
            functionName: 'transfer',
            args: [recipient, amount]
        });

        // 2. Build AA Execute CallData (Assuming SimpleAccount execute)
        const callData = encodeFunctionData({
            abi: [{ name: 'execute', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }] }],
            functionName: 'execute',
            args: [tokenAddress, 0n, transferData]
        });

        // 3. Build Base UserOperation
        const userOp: any = {
            sender,
            nonce: await publicClient.readContract({
                address: entryPoint,
                abi: [{ name: 'getNonce', type: 'function', inputs: [{ type: 'address' }, { type: 'uint192' }], outputs: [{ type: 'uint256' }] }],
                functionName: 'getNonce',
                args: [sender, nonceKey]
            }),
            initCode: '0x' as Hex,
            callData,
            accountGasLimits: UserOperationBuilder.packAccountGasLimits(250000n, 150000n),
            preVerificationGas: 80000n,
            gasFees: UserOperationBuilder.packGasFees(2000000000n, 2000000000n), // 2 Gwei
            paymasterAndData: '0x' as Hex,
            signature: '0x' as Hex
        };

        // 4. Handle Paymaster and Data (PMD)
        if (type === UserOpScenarioType.NATIVE) {
            userOp.paymasterAndData = '0x';
        } else if (type === UserOpScenarioType.GASLESS_V4) {
             if (!paymaster) throw new Error('Paymaster address required for GASLESS_V4');
             if (!tokenAddress) throw new Error('Token address required for GASLESS_V4 (Deposit-Only model)');
             // PaymasterV4 Deposit-Only Model: includes payment token address
             userOp.paymasterAndData = UserOperationBuilder.packPaymasterV4DepositData(
                paymaster,
                paymasterGasLimit,
                paymasterPostOpGasLimit,
                tokenAddress // Payment token for Deposit-Only model
             );
        } else if (type.startsWith('SUPER_')) {
            if (!paymaster || !operator) throw new Error('Paymaster and Operator required for SuperPM scenarios');
            userOp.paymasterAndData = UserOperationBuilder.packPaymasterAndData(
                paymaster,
                paymasterGasLimit,
                paymasterPostOpGasLimit,
                operator
            );
        }

        // 5. Get Hash and Sign
        const opHash = await UserOperationBuilder.getUserOpHash({
            userOp,
            entryPoint,
            chainId,
            publicClient
        });

        const signature = await ownerAccount.signMessage({
            message: { raw: opHash }
        });
        userOp.signature = signature;

        // 6. JSON-RPC Hex-Encoding Compliance
        const jsonUserOp = UserOperationBuilder.jsonifyUserOp(userOp);

        return { userOp: jsonUserOp, opHash };
    }
}
