import { type Address, type Hex, encodePacked } from 'viem';
import { createAAStarPublicClient, SHARED_CONFIG_MOCK } from '@aastar/core';

export interface SuperPaymasterConfig {
    paymasterAddress?: Address; // Optional, defaults to shared-config
    tokenAddress?: Address; // Optional, if paying with specific token
}

export const getPaymasterMiddleware = (config: SuperPaymasterConfig = {}) => {
    const paymasterAddress = config.paymasterAddress || SHARED_CONFIG_MOCK.contracts.superPaymaster as Address;
    
    // Asset-based Paymaster usually just needs the address. 
    // If token is specified, it might be encoded in paymasterAndData. 
    // For V1 MVP, assuming simple address concatenation.
    // Format: [Paymaster Address (20 bytes)] + [Unused/Data (0 bytes or Token Info)]
    
    const getPaymasterAndData = async (userOp: any): Promise<{ paymasterAndData: Hex, preVerificationGas?: bigint, verificationGasLimit?: bigint, callGasLimit?: bigint }> => {
        // In a real asset-based scenario, we might need to verify balances here or just construct the field.
        // Assuming no off-chain signature required (Mode: Asset).
        
        let paymasterAndData: Hex = paymasterAddress;
        
        if (config.tokenAddress) {
             // Example: If contracts expect token address appended
             paymasterAndData = encodePacked(['address', 'address'], [paymasterAddress, config.tokenAddress]);
        }

        return {
            paymasterAndData
        };
    };

    return {
        getPaymasterAndData
    };
};
