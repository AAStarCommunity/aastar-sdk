import { type Address, type Hex, concat, pad, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

export interface SuperPaymasterConfig {
    paymasterAddress: Address;
    operatorAddress: Address;
    verificationGasLimit?: bigint; // Default 160000
    postOpGasLimit?: bigint;     // Default 10000
}

export const getPaymasterMiddleware = (config: SuperPaymasterConfig) => {
    const { paymasterAddress, operatorAddress } = config;
    const verificationGasLimit = config.verificationGasLimit || 160000n;
    const postOpGasLimit = config.postOpGasLimit || 10000n;

    const getPaymasterAndData = async (_userOp: any): Promise<{ paymasterAndData: Hex, preVerificationGas?: bigint, verificationGasLimit?: bigint, callGasLimit?: bigint }> => {
        // SuperPaymaster V3 Packed Format:
        // [0:20] Paymaster Address
        // [20:36] VerificationGasLimit (uint128)
        // [36:52] PostOpGasLimit (uint128)
        // [52:72] Operator Address
        
        const paymasterAndData = concat([
            paymasterAddress,
            pad(`0x${verificationGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            pad(`0x${postOpGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            operatorAddress
        ]);

        return {
            paymasterAndData,
            verificationGasLimit, // We can return these to override userOp if needed, but usually PM middleware just returns pmData
        };
    };

    return {
        getPaymasterAndData
    };
};

export const checkEligibility = async (account: Address, sbtAddress: Address, tokenAddress: Address, rpcUrl: string) => {
    const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    
    // Check SBT Balance
    const sbtBalance = await client.readContract({
        address: sbtAddress,
        abi: [{ type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'balanceOf',
        args: [account]
    }) as bigint;

    // Check Token Balance
    const tokenBalance = await client.readContract({
        address: tokenAddress,
        abi: [{ type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'balanceOf',
        args: [account]
    }) as bigint;

    return {
        hasSBT: sbtBalance > 0n,
        tokenBalance
    };
};
