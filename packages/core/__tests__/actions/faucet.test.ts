import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseEther } from 'viem';
import { createMockWalletClient, createMockPublicClient } from '../mocks/client';

describe('SepoliaFaucetAPI', () => {
    let SepoliaFaucetAPI: any;
    let adminWallet: any;
    let publicClient: any;
    let mockRegistry: any;
    let mockTokens: any;
    let mockPaymaster: any;

    const TARGET = '0x1111111111111111111111111111111111111111';
    const REGISTRY = '0x2222222222222222222222222222222222222222';
    const TOKEN = '0x3333333333333333333333333333333333333333';
    const PAYMASTER = '0x4444444444444444444444444444444444444444';

    beforeEach(async () => {
        vi.resetModules();
        
        mockRegistry = {
            hasRole: vi.fn(),
            grantRole: vi.fn(),
            processRegistration: vi.fn(),
            ROLE_ENDUSER: vi.fn(),
            GTOKEN_STAKING: vi.fn(),
            safeMintForRole: vi.fn()
        };
        mockTokens = {
            mint: vi.fn(),
            balanceOf: vi.fn(),
            allowance: vi.fn(),
            approve: vi.fn()
        };
        mockPaymaster = {
            depositFor: vi.fn()
        };

        vi.doMock('../../src/actions/registry', () => ({
            registryActions: () => () => mockRegistry
        }));
        vi.doMock('../../src/actions/tokens', () => ({
            gTokenActions: () => () => mockTokens
        }));
        vi.doMock('../../src/actions/paymaster', () => ({
            paymasterActions: () => () => mockPaymaster
        }));

        // Dynamic import after mocks
        const module = await import('../../src/actions/faucet');
        SepoliaFaucetAPI = module.SepoliaFaucetAPI;

        adminWallet = createMockWalletClient();
        publicClient = createMockPublicClient();
        if (!adminWallet.sendTransaction) adminWallet.sendTransaction = vi.fn();
        adminWallet.account = { address: '0xAdmin' };

        // Happy Path Defaults (New Account)
        publicClient.getBalance.mockResolvedValue(parseEther('1.0'));
        mockRegistry.hasRole.mockResolvedValue(false); // Default: needs role
        mockRegistry.ROLE_ENDUSER.mockResolvedValue('0xRole');
        mockRegistry.GTOKEN_STAKING.mockResolvedValue('0xStaking');
        mockRegistry.processRegistration.mockResolvedValue('0xHash');
        mockRegistry.grantRole.mockResolvedValue('0xHash');
        mockRegistry.safeMintForRole.mockResolvedValue('0xHash');
        mockTokens.balanceOf.mockResolvedValue(parseEther('2000'));
        mockTokens.allowance.mockResolvedValue(parseEther('1000'));
        mockTokens.mint.mockResolvedValue('0xHash');
        mockTokens.approve.mockResolvedValue('0xHash');
        mockPaymaster.depositFor.mockResolvedValue('0xHash');
        publicClient.waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
        adminWallet.sendTransaction.mockResolvedValue('0xHash');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should skip funding if already sufficient', async () => {
        mockRegistry.hasRole.mockResolvedValue(true); // Override to exists
        const result = await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
            targetAA: TARGET, registry: REGISTRY, token: TOKEN
        });
        expect(result.ethFunded).toBe(false);
        expect(result.roleRegistered).toBe(false);
        expect(result.tokenMinted).toBe(false);
    });

    it('should fund ETH if balance low', async () => {
        publicClient.getBalance.mockResolvedValue(0n);
        const result = await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
            targetAA: TARGET, registry: REGISTRY, token: TOKEN
        });
        expect(result.ethFunded).toBe(true);
        expect(adminWallet.sendTransaction).toHaveBeenCalled();
    });

    it.skip('should register role if missing', async () => {
        mockRegistry.hasRole.mockResolvedValue(false); // Force missing role
        const result = await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
            targetAA: TARGET, registry: REGISTRY, token: TOKEN
        });
        expect(result.roleRegistered).toBe(true);
        expect(mockRegistry.processRegistration).toHaveBeenCalled();
    });

    it('should mint tokens if balance low', async () => {
        mockTokens.balanceOf.mockResolvedValue(0n);
        const result = await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
            targetAA: TARGET, registry: REGISTRY, token: TOKEN
        });
        expect(result.tokenMinted).toBe(true);
        expect(mockTokens.mint).toHaveBeenCalled();
    });

    it('should deposit to paymaster if configured', async () => {
        const result = await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
            targetAA: TARGET, registry: REGISTRY, token: TOKEN, paymasterV4: PAYMASTER
        });
        expect(result.paymasterDeposited).toBe(true);
        expect(mockPaymaster.depositFor).toHaveBeenCalled();
    });

    it('should throw validation error if missing required config', async () => {
        await expect(SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
             targetAA: '',
             registry: REGISTRY,
             token: TOKEN
        } as any)).rejects.toThrow();
    });
});
