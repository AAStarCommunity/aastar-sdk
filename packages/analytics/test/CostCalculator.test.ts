import { describe, it, expect } from 'vitest';
import { CostCalculator, UnverifiedSponsoredEventsError } from '../src/core/CostCalculator';
import type { OnChainData } from '../src/core/DataCollector';
import { parseEther } from 'viem';

describe('CostCalculator', () => {
    // Mock Prices: ETH = $3000, aPNTs = $0.02
    const calculator = new CostCalculator(3000, 0.02);

    it('should calculate SuperPaymaster (V3) costs correctly', () => {
        const mockData: OnChainData = {
            txHash: '0x123',
            gasUsed: 100000n,
            effectiveGasPrice: parseEther('0.000000001'), // 1 Gwei
            blockNumber: 1n,
            blockTimestamp: 1000n,
            paymasterEvents: [
                {
                    type: 'TransactionSponsored',
                    operator: '0x1111111111111111111111111111111111111111',
                    user: '0xUser',
                    apntsConsumed: 1000000000000000000n, // 1 aPNTs (18 decimals)
                    xpntsCharged: 0n,
                    logIndex: 0,
                }
            ],
            pricedSponsored: {
                logIndex: 0,
                operator: '0x1111111111111111111111111111111111111111',
            },
            // Layer 1 Cost = 100k gas * 1 gwei = 0.0001 ETH ($0.30)
        };

        const result = calculator.calculate(mockData);

        expect(result.meta.mode).toBe('super');
        
        // Revenue: 1 aPNTs * $0.02 = $0.02
        expect(result.economic.protocolUsdRevenue).toBeCloseTo(0.02);
        
        // Cost: 0.0001 ETH * $3000 = $0.30
        expect(result.economic.l1UsdCost).toBeCloseTo(0.30);
        
        // Profit: $0.02 - $0.30 = -$0.28
        expect(result.economic.protocolUsdProfit).toBeCloseTo(-0.28);
    });

    it('should calculate Paymaster V4 costs correctly (Token)', () => {
        const mockData: OnChainData = {
            txHash: '0x456',
            gasUsed: 100000n,
            effectiveGasPrice: parseEther('0.000000001'), // 1 Gwei
            blockNumber: 1n,
            blockTimestamp: 1000n,
            paymasterEvents: [
                {
                    type: 'PostOpProcessed',
                    user: '0xUser',
                    token: '0xToken',
                    tokenCost: 1000000000000000000n, // 1 Unit ($1 assumed for non-ETH)
                    actualGasCostWei: parseEther('0.0001'),
                    protocolRevenue: 0n
                }
            ]
        };

        const result = calculator.calculate(mockData);

        expect(result.meta.mode).toBe('v4');
        
        // Revenue: 1 Unit * $1 (implicit assumption for general tokens in V4 logic)
        // Wait, current logic for V4 non-ETH is formatUnits(tokenCost, 18). 
        // If 1 unit = 1e18 wei, then revenue is 1.0
        expect(result.economic.protocolUsdRevenue).toBeCloseTo(1.0);
        
        // Cost: $0.30
        expect(result.economic.l1UsdCost).toBeCloseTo(0.30);
        
        // Profit: $0.70
        expect(result.economic.protocolUsdProfit).toBeCloseTo(0.70);
    });

    it('uses the priced TransactionSponsored event when an impostor log precedes it', () => {
        const impostor = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const trusted = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        const mockData = {
            txHash: '0x789',
            gasUsed: 100000n,
            effectiveGasPrice: parseEther('0.000000001'),
            blockNumber: 1n,
            blockTimestamp: 1000n,
            paymasterEvents: [
                {
                    type: 'TransactionSponsored' as const,
                    operator: impostor,
                    user: '0xUser',
                    apntsConsumed: 9_000000000000000000n,
                    xpntsCharged: 0n,
                    logIndex: 0,
                },
                {
                    type: 'TransactionSponsored' as const,
                    operator: trusted,
                    user: '0xUser',
                    apntsConsumed: 1_000000000000000000n,
                    xpntsCharged: 0n,
                    logIndex: 1,
                },
            ],
            pricedSponsored: { logIndex: 1, operator: trusted },
        };

        const result = calculator.calculate(mockData as OnChainData);

        expect(result.meta.mode).toBe('super');
        expect(result.economic.protocolUsdRevenue).toBeCloseTo(0.02);
    });

    function legacySponsoredFixture(): OnChainData {
        return {
            txHash: '0xabc',
            gasUsed: 100000n,
            effectiveGasPrice: parseEther('0.000000001'),
            blockNumber: 1n,
            blockTimestamp: 1000n,
            status: 'success',
            receipt: {} as OnChainData['receipt'],
            paymasterEvents: [
                {
                    type: 'TransactionSponsored',
                    operator: '0x1111111111111111111111111111111111111111',
                    user: '0xUser',
                    apntsConsumed: 1000000000000000000n,
                    xpntsCharged: 0n,
                },
            ],
        };
    }

    it('throws when TransactionSponsored events have no pricedSponsored', () => {
        const mockData = legacySponsoredFixture();

        expect(() => calculator.calculate(mockData)).toThrow(UnverifiedSponsoredEventsError);
        expect(() => calculator.calculate(mockData)).toThrow(/without emitter verification/);
        expect(() => calculator.calculate(mockData)).toThrow(/Re-collect with DataCollector/);
    });

    it('prices the first TransactionSponsored event when trustUnverifiedSponsoredEvents is set', () => {
        const result = calculator.calculate(legacySponsoredFixture(), { trustUnverifiedSponsoredEvents: true });

        expect(result.meta.mode).toBe('super');
        expect(result.economic.protocolUsdRevenue).toBeCloseTo(0.02);
    });
});
