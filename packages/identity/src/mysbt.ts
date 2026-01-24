
import { type Address, type PublicClient } from 'viem';
import { MySBTABI } from '@aastar/core';

/**
 * Check if user holds MySBT token (identity verification).
 */
export async function checkMySBT(
    client: any,
    sbtAddress: Address,
    user: Address
): Promise<{ hasSBT: boolean; balance?: bigint }> {
    try {
        const balance = await client.readContract({
            address: sbtAddress,
            abi: MySBTABI,
            functionName: 'balanceOf',
            args: [user]
        });
        
        return { 
            hasSBT: (balance as bigint) > 0n,
            balance: balance as bigint
        };
    } catch (e) {
        console.warn('MySBT check failed:', e);
        return { hasSBT: false };
    }
}

/**
 * Fetch MySBT token ID for a specific user (if unique/SBT).
 * Note: Depends on whether the contract supports getTokenId or similar.
 */
export async function getMySBTId(
    client: any,
    sbtAddress: Address,
    user: Address
): Promise<bigint | null> {
    try {
        // Implementation depends on the specific contract. 
        // Most SBTs use ownerOf or similar if mapping is known.
        // For standard SBT balances, we usually just need hasSBT.
        return null;
    } catch (e) {
        return null;
    }
}
