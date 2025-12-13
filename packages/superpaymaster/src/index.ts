import { type Address, type Hex, concat, pad, createPublicClient, http, toHex } from 'viem';
import { sepolia } from 'viem/chains';

export interface SuperPaymasterConfig {
    paymasterAddress: Address;
    communityAddress: Address; // Was operatorAddress
    xPNTsAddress: Address;     // New field
    verificationGasLimit?: bigint; // Default 160000
    postOpGasLimit?: bigint;     // Default 10000
}

/**
 * Returns the construction of the paymasterAndData field for SuperPaymaster V3.
 * Format: [Paymaster (20)][VerifGas (16)][PostOpGas (16)][Community (20)][xPNTs (20)]
 */
export const getPaymasterAndData = (config: SuperPaymasterConfig): Hex => {
    const { paymasterAddress, communityAddress, xPNTsAddress } = config;
    const verificationGasLimit = config.verificationGasLimit || 160000n;
    const postOpGasLimit = config.postOpGasLimit || 10000n;

    // SuperPaymaster V3 Packed Format:
    // [0:20] Paymaster Address
    // [20:36] VerificationGasLimit (uint128)
    // [36:52] PostOpGasLimit (uint128)
    // [52:72] Community/Operator Address
    // [72:92] xPNTs/Token Address
    
    return concat([
        paymasterAddress,
        pad(toHex(verificationGasLimit), { dir: 'left', size: 16 }),
        pad(toHex(postOpGasLimit), { dir: 'left', size: 16 }),
        communityAddress,
        xPNTsAddress
    ]);
};

// Deprecated or alias helper if they still want the middleware object format?
// User asked for "getPaymasterAndData" to return the data directly in their example.
// But for "middleware" usage in viem smart accounts, one usually needs a function.
// I will export this helper.


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
