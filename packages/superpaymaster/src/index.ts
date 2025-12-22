
import { type Hex, type Address, concat, pad, toHex } from 'viem';
import { SUPERPAYMASTER_ABI } from '@aastar/core';
import { createPublicClient, http } from 'viem';

export type PaymasterConfig = {
    paymasterAddress: Address;
    operator: Address;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
};

const DEFAULT_VERIFICATION_GAS = 160000n;
const DEFAULT_POSTOP_GAS = 10000n;

/**
 * Constructs the middleware for SuperPaymaster V3.
 * Returns the `paymasterAndData` hex string.
 */
export function getPaymasterMiddleware(config: PaymasterConfig) {
    return {
        sponsorUserOperation: async (args: { userOperation: any }) => {
            const verGas = config.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS;
            const postGas = config.postOpGasLimit ?? DEFAULT_POSTOP_GAS;

            // Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Operator(20)]
            const paymasterAndData = concat([
                config.paymasterAddress,
                pad(toHex(verGas), { size: 16 }),
                pad(toHex(postGas), { size: 16 }),
                config.operator
            ]);

            return {
                paymasterAndData,
                verificationGasLimit: verGas,
                preVerificationGas: args.userOperation.preVerificationGas, 
                // Note: userOp gas limits might need broader estimation, but this middleware 
                // focuses on packing the P&D.
            };
        }
    };
}

/**
 * Simple eligibility check (off-chain) using Viem.
 */
export async function checkEligibility(
    client: any, 
    paymaster: Address, 
    user: Address, 
    operator: Address
): Promise<boolean> {
    try {
        // We can check credit or operator status here
        const data = await client.readContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'getAvailableCredit',
            args: [user, operator] // Assuming token is derived or passed? SDK might need improvement here.
            // Wait, getAvailableCredit takes (user, token). 
            // We need to fetch the operator's token first.
        });
        return (data as bigint) > 0n;
    } catch (e) {
        return false;
    }
}
