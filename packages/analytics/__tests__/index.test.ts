
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { AnalyticsClient } from '../src/index';

describe('AnalyticsClient', () => {
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http()
    });

    it('should be instantiated correctly', () => {
        const client = new AnalyticsClient(publicClient);
        expect(client).toBeInstanceOf(AnalyticsClient);
    });

    it('should accept custom addresses', () => {
        const addresses = {
            gtoken: '0x1234567890123456789012345678901234567890' as `0x${string}`,
            registry: '0x0987654321098765432109876543210987654321' as `0x${string}`
        };
        const client = new AnalyticsClient(publicClient, addresses);
        expect(client).toBeInstanceOf(AnalyticsClient);
    });
});
