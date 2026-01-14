import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCommunityClient } from './community.js';
import { mainnet } from 'viem/chains';
import { http, type Address } from 'viem';

vi.mock('@aastar/core', async () => {
    const actual = await vi.importActual('@aastar/core');
    return {
        ...actual,
        registryActions: vi.fn(() => vi.fn(() => ({
            registerRoleSelf: vi.fn().mockResolvedValue('0xhash'),
            hasRole: vi.fn(),
            roleMetadata: vi.fn()
        }))),
        sbtActions: vi.fn(() => vi.fn(() => ({
            getUserSBT: vi.fn().mockResolvedValue(123n)
        }))),
        reputationActions: vi.fn(() => vi.fn(() => ({
            setReputationRule: vi.fn().mockResolvedValue('0xhash')
        }))),
    };
});

describe('CommunityClient', () => {
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

    it('should create community client', () => {
        const client = createCommunityClient({ chain: mainnet, transport: http() });
        expect(client.launch).toBeDefined();
    });

    describe('launch', () => {
        it('should launch community with token and governance', async () => {
            const client = createCommunityClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });
            
            // Mock base client methods
            (client as any).readContract = vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000');
            (client as any).simulateContract = vi.fn().mockResolvedValue({ request: {} });
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.launch({
                name: 'Test',
                tokenName: 'T',
                tokenSymbol: 'T',
                governance: { initialReputationRule: true }
            });

            expect(result.results.length).toBeGreaterThanOrEqual(2); 
            expect(client.writeContract).toHaveBeenCalled();
        });
    });

    describe('getCommunityInfo', () => {
        it('should return info for registered community', async () => {
            const client = createCommunityClient({ chain: mainnet, transport: http() });
            
            (client as any).readContract = vi.fn()
                .mockResolvedValueOnce(true) // hasRole
                .mockResolvedValueOnce('0xtoken') // getTokenAddress
                .mockResolvedValueOnce('0x'); // roleMetadata

            const info = await client.getCommunityInfo(MOCK_ADDR);
            expect(info.hasRole).toBe(true);
            expect(info.tokenAddress).toBe('0xtoken');
        });
    }); 
    
    describe('Launch', () => {
        it('should validate launch inputs', async () => {
             const communityClient = createCommunityClient({ chain: mainnet, transport: http(), account: { address: MOCK_ADDR } as any });
             
             await expect(communityClient.launch({
                 name: '',
                 tokenName: 'T',
                 tokenSymbol: 'T'
             })).rejects.toThrow('Community Name is required');
    
             await expect(communityClient.launch({
                 name: 'Test',
                 tokenName: '',
                 tokenSymbol: 'T'
             })).rejects.toThrow('Token Name is required');
             
             await expect(communityClient.launch({
                 name: 'Test',
                 tokenName: 'Test',
                 tokenSymbol: ''
             })).rejects.toThrow('Token Symbol is required');
        });
    
        it('should handle registration failure gracefully in launch', async () => {
             const communityClient = createCommunityClient({ chain: mainnet, transport: http(), account: { address: MOCK_ADDR } as any });
             
             // Mock writeContract failure (Already registered)
             (communityClient as any).writeContract = vi.fn().mockRejectedValueOnce(new Error('Already registered'));
             
             // Mock deployToken to succeed
             (communityClient as any).readContract = vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000');
             (communityClient as any).deployToken = vi.fn().mockResolvedValue('0xtoken');
             // Mock setGovernance
             (communityClient as any).setReputationRule = vi.fn().mockResolvedValue('0xrule');
             (communityClient as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

             await communityClient.launch({
                 name: 'Test',
                 tokenName: 'Test',
                 tokenSymbol: 'TST'
             });
             
             expect(true).toBe(true);
        });
    });
});
