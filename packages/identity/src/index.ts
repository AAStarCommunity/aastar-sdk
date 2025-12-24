
import { createAAStarPublicClient } from '@aastar/core';
import { type Address, type PublicClient, parseAbi } from 'viem';

const REPUTATION_ABI = parseAbi([
    'function computeScore(address, address[], bytes32[][], uint256[][]) view returns (uint256)',
    'function syncToRegistry(address, address[], bytes32[][], uint256[][], uint256)'
]);

export class ReputationClient {
    constructor(private client: PublicClient, private reputationAddress: Address) {}

    async computeScore(user: Address, communities: Address[], ruleIds: `0x${string}`[][], activities: bigint[][]): Promise<bigint> {
        return this.client.readContract({
            address: this.reputationAddress,
            abi: REPUTATION_ABI,
            functionName: 'computeScore',
            args: [user, communities, ruleIds, activities]
        });
    }
}
