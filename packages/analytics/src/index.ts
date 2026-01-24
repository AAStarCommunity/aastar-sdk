import { Address, Hash, zeroAddress, parseAbiItem, Log, parseAbi } from 'viem';
import { type PublicClient } from '@aastar/core';

/**
 * Analytics client for monitoring and statistics
 * 
 * @roleRequired None (public query APIs)
 * @description Dashboard and monitoring tools
 * 
 * ## No Permission Required - All Public Queries
 * 
 * ## Typical Users:
 * - Dashboard Developers
 * - Community Analytics
 * - Investors & Researchers
 */
export class AnalyticsClient {
    /** @internal */
    private publicClient: PublicClient;
    /** @internal */
    private gtokenAddress?: Address;
    /** @internal */
    private registryAddress?: Address;

    constructor(
        /** @internal */
        publicClient: PublicClient,
        addresses?: {
            gtoken?: Address;
            registry?: Address;
        }
    ) {
        this.publicClient = publicClient;
        this.gtokenAddress = addresses?.gtoken;
        this.registryAddress = addresses?.registry;
    }

    /**
     * Get complete supply metrics
     * @roleRequired None (public view)
     */
    async getSupplyMetrics(): Promise<{
        cap: bigint;
        totalSupply: bigint;
        totalLifetimeBurned: bigint;
        remainingMintable: bigint;
        deflationRate: number;
    }> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        const gtokenAddress = this.gtokenAddress || CORE_ADDRESSES.gToken;

        const [cap, totalSupply, remainingMintable] = await Promise.all([
            this.publicClient.readContract({
                address: gtokenAddress,
                abi: parseAbi(['function cap() view returns (uint256)']),
                functionName: 'cap'
            }) as Promise<bigint>,
            this.publicClient.readContract({
                address: gtokenAddress,
                abi: parseAbi(['function totalSupply() view returns (uint256)']),
                functionName: 'totalSupply'
            }) as Promise<bigint>,
            this.publicClient.readContract({
                address: gtokenAddress,
                abi: parseAbi(['function remainingMintableSupply() view returns (uint256)']),
                functionName: 'remainingMintableSupply'
            }) as Promise<bigint>
        ]);

        let totalLifetimeBurned = 0n;
        try {
            totalLifetimeBurned = await this.publicClient.readContract({
                address: gtokenAddress,
                abi: parseAbi(['function totalLifetimeBurned() view returns (uint256)']),
                functionName: 'totalLifetimeBurned'
            }) as bigint;
        } catch {
            totalLifetimeBurned = cap - totalSupply - remainingMintable;
        }

        const deflationRate = Number(totalLifetimeBurned * 10000n / cap) / 100;

        return { cap, totalSupply, totalLifetimeBurned, remainingMintable, deflationRate };
    }

    /**
     * Subscribe to real-time burn events
     * @roleRequired None (public events)
     */
    subscribeToBurnEvents(callback: (event: {
        from: Address;
        amount: bigint;
        blockNumber: number;
        timestamp: number;
    }) => void): () => void {
        const { CORE_ADDRESSES } = require('@aastar/core');
        const gtokenAddress = this.gtokenAddress || CORE_ADDRESSES.gToken;

        const unwatch = this.publicClient.watchEvent({
            address: gtokenAddress,
            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
            onLogs: async (logs) => {
                for (const log of logs) {
                    if (log.args && (log.args as any).to === zeroAddress) {
                        const block = await this.publicClient.getBlock({ blockNumber: log.blockNumber! });
                        callback({
                            from: (log.args as any).from,
                            amount: (log.args as any).value,
                            blockNumber: Number(log.blockNumber),
                            timestamp: Number(block.timestamp)
                        });
                    }
                }
            }
        });

        return unwatch;
    }

    /**
     * Get role entrance cost breakdown
     * @roleRequired None (public view)
     */
    async getRoleEntranceCost(roleId: Hash): Promise<{
        minStake: bigint;
        entryBurn: bigint;
        totalRequired: bigint;
        exitFee: { percent: number; minFee: bigint };
    }> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        const registryAddress = this.registryAddress || CORE_ADDRESSES.registry;

        const config = await this.publicClient.readContract({
            address: registryAddress,
            abi: parseAbi(['function getRoleConfig(bytes32) view returns ((uint256 minStake, uint256 entryBurn, uint8 slashThreshold, uint8 slashBase, uint8 slashIncrement, uint8 slashMax, uint256 exitFeePercent, uint256 minExitFee, bool isActive, string description))']),
            functionName: 'getRoleConfig',
            args: [roleId]
        }) as any;

        return {
            minStake: config.minStake,
            entryBurn: config.entryBurn,
            totalRequired: config.minStake + config.entryBurn,
            exitFee: {
                percent: Number(config.exitFeePercent) / 100,
                minFee: config.minExitFee
            }
        };
    }
}
