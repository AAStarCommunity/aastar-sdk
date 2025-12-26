
export * from './mysbt.js';

import { createAAStarPublicClient, ReputationSystemV3ABI } from '@aastar/core';
import { type Address, type PublicClient } from 'viem';

export class ReputationClient {
    constructor(private client: PublicClient, private reputationAddress: Address) {}

    async computeScore(user: Address, communities: Address[], ruleIds: `0x${string}`[][], activities: bigint[][]): Promise<bigint> {
        return this.client.readContract({
            address: this.reputationAddress,
            abi: ReputationSystemV3ABI as any,
            functionName: 'computeScore',
            args: [user, communities, ruleIds, activities]
        }) as Promise<bigint>;
    }
}
