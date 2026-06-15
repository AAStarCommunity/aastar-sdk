
import { type Address, type PublicClient } from 'viem';
import { MySBTABI } from '@aastar/core';

/**
 * Check if user holds MySBT token (identity verification).
 *
 * Does NOT swallow read errors: `balanceOf` returns 0 for a non-holder, so any
 * thrown error is an RPC/transport/contract failure — masking it as
 * `{ hasSBT: false }` would turn a transient RPC blip into a false "no SBT" and
 * wrongly fail eligibility checks. The error propagates so the caller can retry
 * or surface "couldn't determine" rather than "no SBT".
 */
export async function checkMySBT(
    client: any,
    sbtAddress: Address,
    user: Address
): Promise<{ hasSBT: boolean; balance: bigint }> {
    const balance = await client.readContract({
        address: sbtAddress,
        abi: MySBTABI,
        functionName: 'balanceOf',
        args: [user]
    }) as bigint;

    return { hasSBT: balance > 0n, balance };
}

/**
 * Fetch MySBT token ID for a specific user.
 * MySBT exposes `getUserSBT(address) -> uint256` (alias of the `userToSBT`
 * mapping), which returns the user's tokenId or 0 when they hold no SBT.
 *
 * Returns the tokenId, or `null` ONLY for the genuine "no SBT" sentinel (id == 0).
 * Read errors are NOT swallowed (see {@link checkMySBT}): a transient RPC failure
 * must not be reported as "no SBT" (a false negative for eligibility). The error
 * propagates to the caller.
 */
export async function getMySBTId(
    client: any,
    sbtAddress: Address,
    user: Address
): Promise<bigint | null> {
    const tokenId = await client.readContract({
        address: sbtAddress,
        abi: MySBTABI,
        functionName: 'getUserSBT',
        args: [user]
    }) as bigint;

    // tokenId 0 is the contract's sentinel for "no SBT" (ids start at 1).
    return tokenId > 0n ? tokenId : null;
}
