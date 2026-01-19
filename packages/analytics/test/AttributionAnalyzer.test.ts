import { describe, it, expect } from 'vitest';
import { AttributionAnalyzer } from '../src/analyzers/AttributionAnalyzer';
import type { CostBreakdown } from '../src/core/CostCalculator';

describe('AttributionAnalyzer', () => {
    const analyzer = new AttributionAnalyzer();
    const ethPrice = 3000;

    it('should simulate L2 costs with dynamic calldata pricing', () => {
        const mockBreakdown: CostBreakdown = {
            intrinsic: {
                gasUsed: 200000n,
                aPNTsConsumed: 0n,
                overheadGas: 0n,
                efficiency: 1
            },
            economic: {
                l1EthCost: 200000n * 1000000000n, // 0.0002 ETH (1 Gwei gas price)
                l1UsdCost: 0.60, // $0.60
                protocolUsdRevenue: 0.70,
                protocolUsdProfit: 0.10,
                protocolUsdSubsidy: 0
            },
            meta: {
                txHash: '0x',
                blockNumber: 1n,
                timestamp: 1n,
                mode: 'v4'
            }
        };

        const sim = analyzer.simulateL2Cost(mockBreakdown, ethPrice);

        // 1. L2 Execution: 200k gas * 0.001 Gwei = 0.0000002 ETH = $0.0006
        expect(sim.totalL2Usd).toBeGreaterThan(0);
        expect(sim.totalL2Usd).toBeLessThan(0.01); // Should be very cheap
        
        // 2. Savings Ratio
        // $0.60 / ~$0.001 should be around 600x
        expect(sim.savingsRatio).toBeGreaterThan(50);
    });
});
