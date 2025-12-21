import { type Address, type Hex, concat, pad, createPublicClient, http, toHex, isAddress } from 'viem';
import { type Chain, sepolia } from 'viem/chains';

export interface SuperPaymasterConfig {
    paymasterAddress: Address;
    communityAddress: Address; // Was operatorAddress
    xPNTsAddress: Address;     // New field
    verificationGasLimit?: bigint; // Default 160000
    postOpGasLimit?: bigint;     // Default 10000
}

const MAX_UINT128 = 2n ** 128n - 1n;

/**
 * Validates that a value is within the uint128 range.
 */
function validateUint128(name: string, value: bigint) {
    if (value < 0n || value > MAX_UINT128) {
        throw new Error(`SuperPaymaster: ${name} must be between 0 and uint128.max (2^128-1). Received: ${value}`);
    }
}

/**
 * Returns the construction of the paymasterAndData field for SuperPaymaster V3.
 * Format: [Paymaster (20)][VerifGas (16)][PostOpGas (16)][Community (20)][xPNTs (20)]
 */
export const getPaymasterAndData = (config: SuperPaymasterConfig): Hex => {
    const { paymasterAddress, communityAddress, xPNTsAddress } = config;
    
    // Runtime address validation
    if (!isAddress(paymasterAddress)) throw new Error(`Invalid paymasterAddress: ${paymasterAddress}`);
    if (!isAddress(communityAddress)) throw new Error(`Invalid communityAddress: ${communityAddress}`);
    if (!isAddress(xPNTsAddress)) throw new Error(`Invalid xPNTsAddress: ${xPNTsAddress}`);

    const verificationGasLimit = config.verificationGasLimit || 160000n;
    const postOpGasLimit = config.postOpGasLimit || 10000n;

    // Range validation for gas limits
    validateUint128('verificationGasLimit', verificationGasLimit);
    validateUint128('postOpGasLimit', postOpGasLimit);

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

/**
 * Checks if an account is eligible for sponsorship by verifying SBT and Token balances.
 * 
 * @param account User account address
 * @param sbtAddress SBT (Social Badge Token) address
 * @param tokenAddress Token address to check balance
 * @param rpcUrl RPC URL for the chain
 * @param chain Optional chain configuration (defaults to sepolia)
 */
export const checkEligibility = async (
    account: Address, 
    sbtAddress: Address, 
    tokenAddress: Address, 
    rpcUrl: string,
    chain: Chain = sepolia
) => {
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    
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
