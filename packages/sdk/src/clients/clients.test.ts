import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEndUserClient } from './endUser.js';
import { createCommunityClient } from './community.js';
import { createOperatorClient } from './operator.js';
import { createAdminClient } from './admin.js';
import { type Chain, type Transport, type Account, type Address, parseEther, http } from 'viem';
import { mainnet } from 'viem/chains';

describe('SDK L2 Clients', () => {
    let mockTransport: Transport;
    let mockChain: Chain;
    let mockAccount: Account;

    const MOCK_ADDR: Address = '0x1111111111111111111111111111111111111111';

    beforeEach(() => {
        mockTransport = http('http://localhost:8545');
        mockChain = mainnet;
        mockAccount = { 
            address: MOCK_ADDR, 
            type: 'json-rpc',
            signMessage: vi.fn().mockResolvedValue('0xsignature')
        } as any;
    });

    describe('EndUserClient', () => {
        let client: any;
        beforeEach(() => {
            client = createEndUserClient({ chain: mockChain, transport: mockTransport, account: mockAccount });
            client.readContract = vi.fn();
            client.writeContract = vi.fn().mockResolvedValue('0xhash');
            client.waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });
            client.getBytecode = vi.fn().mockResolvedValue('0x123');
        });

        it('should create EndUserClient', () => {
            expect(client.onboard).toBeDefined();
        });

        it('should create smart account', async () => {
             client.readContract.mockResolvedValue(MOCK_ADDR);
             const result = await client.createSmartAccount({ owner: MOCK_ADDR });
             expect(result.accountAddress).toBe(MOCK_ADDR);
             expect(result.initCode).toBeDefined();
        });

        it('should execute gasless transaction', async () => {
             client.readContract.mockResolvedValue(0n); // nonce
             client.readContract.mockResolvedValueOnce(0n).mockResolvedValueOnce('0xhash'); // nonce, userOpHash
             client.createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: MOCK_ADDR, initCode: '0x' });
             
             const result = await client.executeGasless({
                 target: MOCK_ADDR,
                 data: '0x',
                 operator: MOCK_ADDR
             });
             expect(result.hash).toBe('0xhash');
        });
    });

    describe('CommunityClient', () => {
        it('should launch community', async () => {
            const client = createCommunityClient({ chain: mockChain, transport: mockTransport, account: mockAccount });
            client.writeContract = vi.fn().mockResolvedValue('0xhash');
            client.simulateContract = vi.fn().mockResolvedValue({ request: {} });
            client.waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });
            client.readContract = vi.fn().mockResolvedValue(MOCK_ADDR);

            const result = await client.launch({
                name: 'Test',
                tokenName: 'TT',
                tokenSymbol: 'TT'
            });
            expect(result.tokenAddress).toBe(MOCK_ADDR);
            expect(result.results.length).toBeGreaterThan(0);
        });
    });

    describe('OperatorClient', () => {
        it('should setup operator', async () => {
            const client = createOperatorClient({ chain: mockChain, transport: mockTransport, account: mockAccount });
            client.readContract = vi.fn().mockResolvedValue(['', 0n]); // roleConfig
            client.writeContract = vi.fn().mockResolvedValue('0xhash');
            client.waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });
            client.registryHasRole = vi.fn().mockResolvedValue(false);

            const result = await client.setup({
                stakeAmount: 100n,
                depositAmount: 100n,
                roleId: '0x1'
            });
            expect(result.txs.length).toBeGreaterThan(0);
        });
    });

    describe('AdminClient', () => {
        it('should have namespaces', () => {
            const client = createAdminClient({ chain: mockChain, transport: mockTransport, account: mockAccount });
            expect(client.system).toBeDefined();
            expect(client.finance).toBeDefined();
            expect(client.operators).toBeDefined();
        });
    });
});
