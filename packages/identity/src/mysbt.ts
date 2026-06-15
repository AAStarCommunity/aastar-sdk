
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
 * Fetch MySBT token ID for a specific user.
 * MySBT exposes `getUserSBT(address) -> uint256` (alias of the `userToSBT`
 * mapping), which returns the user's tokenId or 0 when they hold no SBT.
 * Returns the tokenId, or null if the user has no SBT (id == 0) or on error.
 */
export async function getMySBTId(
    client: any,
    sbtAddress: Address,
    user: Address
): Promise<bigint | null> {
    try {
        const tokenId = await client.readContract({
            address: sbtAddress,
            abi: MySBTABI,
            functionName: 'getUserSBT',
            args: [user]
        });

        const id = tokenId as bigint;
        // tokenId 0 is the contract's sentinel for "no SBT" (ids start at 1).
        return id > 0n ? id : null;
    } catch (e) {
        return null;
    }
}
