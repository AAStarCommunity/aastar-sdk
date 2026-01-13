import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEndUserClient } from './endUser.js';
import { createCommunityClient } from './community.js';
import { createOperatorClient } from './operator.js';
import { createAdminClient } from './admin.js';
import { type Chain, type Transport, type Account, type Address, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

describe('SDK L2 Clients', () => {
    let mockTransport: Transport;
    let mockChain: Chain;
    let mockAccount: Account;

    const MOCK_ADDR: Address = '0x1111111111111111111111111111111111111111';

    beforeEach(() => {
        mockTransport = vi.fn() as any;
        mockChain = mainnet;
        mockAccount = { address: MOCK_ADDR, type: 'json-rpc' } as Account;
    });

    describe('EndUserClient', () => {
        it('should create EndUserClient with extended actions', () => {
            const client = createEndUserClient({
                chain: mockChain,
                transport: mockTransport,
                account: mockAccount
            });
            expect(client.onboard).toBeDefined();
            expect(client.joinAndActivate).toBeDefined();
            expect(client.executeGasless).toBeDefined();
            // Core actions extension check
            expect(client.registerRoleSelf).toBeDefined();
        });

        it('should perform high-level onboarding (mocked)', async () => {
             const client = createEndUserClient({
                chain: mockChain,
                transport: mockTransport,
                account: mockAccount
            });
            // Mock internal call
            (client as any).joinAndActivate = vi.fn().mockResolvedValue({ hash: '0xhash', events: [], sbtId: 1n });
            const result = await client.onboard({ community: MOCK_ADDR, roleId: '0x1', roleData: '0x' });
            expect(result.sbtId).toBe(1n);
            expect(client.joinAndActivate).toHaveBeenCalled();
        });
    });

    describe('CommunityClient', () => {
        it('should create CommunityClient with business logic', () => {
            const client = createCommunityClient({
                chain: mockChain,
                transport: mockTransport,
                account: mockAccount
            });
            expect(client.launchCommunity).toBeDefined();
            expect(client.setupCommunityReputation).toBeDefined();
        });
    });

    describe('OperatorClient', () => {
        it('should create OperatorClient with staking logic', () => {
            const client = createOperatorClient({
                chain: mockChain,
                transport: mockTransport,
                account: mockAccount
            });
            expect(client.registerAsOperator).toBeDefined();
            expect(client.stakeAndActivate).toBeDefined();
        });
    });

    describe('AdminClient', () => {
        it('should create AdminClient with global management', () => {
            const client = createAdminClient({
                chain: mockChain,
                transport: mockTransport,
                account: mockAccount
            });
            expect(client.setGlobalProtocolFee).toBeDefined();
            expect(client.authorizeSlasher).toBeDefined();
        });
    });
});
