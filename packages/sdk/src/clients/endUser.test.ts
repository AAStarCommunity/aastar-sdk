import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEndUserClient } from './endUser.js';
import { mainnet } from 'viem/chains';
import { http, type Address, type Hex } from 'viem';

vi.mock('@aastar/core', async () => {
    const actual = await vi.importActual('@aastar/core');
    return {
        ...actual,
        registryActions: vi.fn(() => vi.fn(() => ({
            registerRoleSelf: vi.fn().mockResolvedValue('0xhash')
        }))),
        sbtActions: vi.fn(() => vi.fn(() => ({
            getUserSBT: vi.fn().mockResolvedValue(123n)
        }))),
        superPaymasterActions: vi.fn(() => vi.fn(() => ({
            getAvailableCredit: vi.fn().mockResolvedValue(1000n)
        }))),
        paymasterV4Actions: vi.fn(() => vi.fn(() => ({
            // pmv4
        }))),
    };
});

describe('EndUserClient', () => {
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
    const MOCK_COMMUNITY = '0x1111111111111111111111111111111111111111' as Address;

    it('should create end user client', () => {
        const client = createEndUserClient({ chain: mainnet, transport: http() });
        expect(client.joinAndActivate).toBeDefined();
    });

    describe('joinAndActivate', () => {
        it('should join community and fetch SBT', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });

            (client as any).readContract = vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.joinAndActivate({ community: MOCK_COMMUNITY, roleId: '0x1' });
            expect(result.sbtId).toBe(123n);
        });
    });

    describe('executeGasless', () => {
        it('should execute gasless transaction', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsignature') } as any 
            });

            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xaa', isDeployed: true });
            (client as any).readContract = vi.fn().mockResolvedValue(0n); // nonce or userOpHash
            (client as any).getBytecode = vi.fn().mockResolvedValue('0x123');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.executeGasless({
                target: MOCK_COMMUNITY,
                data: '0x',
                operator: MOCK_COMMUNITY
            });

            expect(result.hash).toBe('0xhash');
        });
    });
    describe('executeGaslessBatch', () => {
        it('should execute gasless batch', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsignature') } as any 
            });

            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xaa', isDeployed: true });
            (client as any).readContract = vi.fn().mockResolvedValue(0n);
            (client as any).getBytecode = vi.fn().mockResolvedValue('0x123');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.executeGaslessBatch({
                targets: [MOCK_COMMUNITY],
                datas: ['0x'],
                operator: MOCK_COMMUNITY
            });

            expect(result.hash).toBe('0xhash');
        });
    });

    describe('Requirements and Credits', () => {
        it('should call onboard (alias for joinAndActivate)', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });
            client.joinAndActivate = vi.fn().mockResolvedValue({ hash: '0xhash', events: [], sbtId: 1n });
            
            const result = await client.onboard({ community: MOCK_COMMUNITY, roleId: '0x1', roleData: '0x' });
            expect(result.sbtId).toBe(1n);
        });

        it('should check join requirements', async () => {
             const client = createEndUserClient({ chain: mainnet, transport: http() });
             // Mock balance return for GToken balance check >= 0.44 GT
             (client as any).readContract = vi.fn().mockResolvedValue(1000000000000000000n);
             
             const result = await client.checkJoinRequirements(MOCK_ADDR);
             expect(result.hasEnoughGToken).toBe(true);
        });

        it('should get available credit', async () => {
             const client = createEndUserClient({ chain: mainnet, transport: http() });
             // getAvailableCredit is part of SuperPaymasterActions which is extended in client
             const result = await client.getAvailableCredit({ user: MOCK_ADDR, operator: MOCK_COMMUNITY });
             expect(result).toBe(1000n);
        });
    });
});
