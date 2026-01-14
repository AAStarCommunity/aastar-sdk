import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account, parseEther } from 'viem';
import { xPNTsFactoryActions, paymasterFactoryActions } from './factory.js';

describe('Factory Actions', () => {
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_FACTORY: Address = '0x1111111111111111111111111111111111111111';
    const MOCK_COMMUNITY: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_USER: Address = '0x3333333333333333333333333333333333333333';

    beforeEach(() => {
        mockAccount = {
            address: MOCK_USER,
            type: 'json-rpc'
        } as Account;

        mockPublicClient = {
            readContract: vi.fn(),
        };

        mockWalletClient = {
            writeContract: vi.fn(),
            account: mockAccount,
        };
    });

    describe('xPNTsFactoryActions', () => {
        it('should create token', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
            const result = await actions.createToken({
                name: 'Test',
                symbol: 'TST',
                community: MOCK_COMMUNITY,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'deployxPNTsToken',
                })
            );
        });

        it('should get token address', async () => {
            const mockToken: Address = '0xTOKEN';
            (mockPublicClient.readContract as any).mockResolvedValue(mockToken);

            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.getTokenAddress({ community: MOCK_COMMUNITY });

            expect(result).toBe(mockToken);
        });

        it('should predict address', async () => {
            const mockToken: Address = '0xPREDICTED';
            (mockPublicClient.readContract as any).mockResolvedValue(mockToken);

            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.predictAddress({ community: MOCK_COMMUNITY, salt: 1234n });

            expect(result).toBe(mockToken);
        });

        it('should check if token is deployed', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.isTokenDeployed({ community: MOCK_COMMUNITY });

            expect(result).toBe(true);
        });


        it('should handle predictions and economics', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(100n) // predictDepositAmount
                .mockResolvedValueOnce([1n, 2n, 3n]) // getPredictionParams
                .mockResolvedValueOnce(50n); // getAPNTsPrice
            
            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await actions.predictDepositAmount({ community: MOCK_COMMUNITY, userCount: 10n })).toBe(100n);
            expect(await actions.getPredictionParams({ community: MOCK_COMMUNITY })).toEqual([1n, 2n, 3n]);
            expect(await actions.getAPNTsPrice()).toBe(50n);
        });

        it('should manage configuration', async () => {
             const txHash = '0xhash';
             (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
             const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
             
             expect(await actions.setIndustryMultiplier({ industry: 'tech', multiplier: 2n, account: mockAccount })).toBe(txHash);
             expect(await actions.setSuperPaymasterAddress({ superPaymaster: MOCK_USER, account: mockAccount })).toBe(txHash);
             expect(await actions.updateAPNTsPrice({ newPrice: 100n, account: mockAccount })).toBe(txHash);
        });
        
        it('should view config', async () => {
             (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(123n) // industryMultipliers
                .mockResolvedValueOnce(MOCK_USER); // SUPER_PAYMASTER
             const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
             expect(await actions.industryMultipliers({ industry: 'tech' })).toBe(123n);
             expect(await actions.SUPER_PAYMASTER()).toBe(MOCK_USER);
        });
    });

    describe('paymasterFactoryActions', () => {
        it('should deploy for community', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
            const result = await actions.deployForCommunity({ community: MOCK_COMMUNITY, account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should query tokens and stats', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_COMMUNITY) // getCommunityByToken
                .mockResolvedValueOnce(['0xT1']) // getAllTokens
                .mockResolvedValueOnce(1n) // getTokenCount
                .mockResolvedValueOnce('0xT1'); // deployedTokens
            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await actions.getCommunityByToken({ token: '0xT' })).toBe(MOCK_COMMUNITY);
            expect(await actions.getAllTokens()).toEqual(['0xT1']);
            expect(await actions.getTokenCount()).toBe(1n);
            expect(await actions.deployedTokens({ index: 0n })).toBe('0xT1');
        });

        it('should manage implementation and configuration', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
            
            expect(await actions.setImplementation({ impl: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.setRegistry({ registry: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.setSuperPaymaster({ paymaster: MOCK_USER, account: mockAccount })).toBe(txHash);
            
            const pClient = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await pClient.getImplementation()).toBe(MOCK_USER);
            expect(await pClient.REGISTRY()).toBe(MOCK_USER);
            expect(await pClient.SUPER_PAYMASTER()).toBe(MOCK_USER);
        });

        it('should handle ownership and version', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = xPNTsFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await actions.owner()).toBe(MOCK_USER);
            
            (mockPublicClient.readContract as any).mockResolvedValue('v1');
            expect(await actions.version()).toBe('v1');
        });
    });

    describe('paymasterFactoryActions', () => {
        it('should deploy paymaster', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
            const result = await actions.deployPaymaster({
                owner: MOCK_USER,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should get paymaster by operator', async () => {
            const mockPM: Address = '0xPAYMASTER';
            (mockPublicClient.readContract as any).mockResolvedValue(mockPM);

            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.getPaymaster({ owner: MOCK_USER });

            expect(result).toBe(mockPM);
        });

        it('should get all paymasters', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(2n) // count
                .mockResolvedValueOnce(['0xPM1', '0xPM2']); // list

            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.getAllPaymasters();

            expect(result).toEqual(['0xPM1', '0xPM2']);
        });

        it('should manage implementation and registry', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
            
            expect(await actions.setImplementationV4({ impl: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.setRegistry({ registry: MOCK_USER, account: mockAccount })).toBe(txHash);
            
            const pClient = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await pClient.getImplementationV4()).toBe(MOCK_USER);
            expect(await pClient.REGISTRY()).toBe(MOCK_USER);
            expect(await pClient.ENTRY_POINT()).toBe(MOCK_USER);
        });

        it('should check if paymaster is deployed', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            const result = await actions.isPaymasterDeployed({ owner: MOCK_USER });

            expect(result).toBe(true);
        });

        it('should get versions and ownership', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('v1');
            const actions = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
            expect(await actions.version()).toBe('v1');
            expect(await actions.defaultVersion()).toBe('v1');
            
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            expect(await actions.owner()).toBe(MOCK_USER);
        });

        it('should handle implementations list', async () => {
             (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(true) // implementations
                .mockResolvedValueOnce(['0xI1']) // getPaymasterList
                .mockResolvedValueOnce(5n); // totalDeployed
             const actions = paymasterFactoryActions(MOCK_FACTORY)(mockPublicClient as PublicClient);
             expect(await actions.implementations({ version: 'v1' })).toBe(true);
             expect(await actions.getPaymasterList({ offset: 0n, limit: 10n })).toEqual(['0xI1']);
             expect(await actions.totalDeployed()).toBe(5n);
        });

        it('should manage implementations', async () => {
             const txHash = '0xhash';
             (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
             const actions = paymasterFactoryActions(MOCK_FACTORY)(mockWalletClient as WalletClient);
             
             expect(await actions.addImplementation({ version: 'v2', implementation: MOCK_USER, account: mockAccount })).toBe(txHash);
             expect(await actions.setDefaultVersion({ version: 'v2', account: mockAccount })).toBe(txHash);
        });
    });
});
