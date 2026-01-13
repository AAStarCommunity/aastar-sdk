import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type Chain, parseEther } from 'viem';
import { StateValidator } from './StateValidator.js';
import { sepolia } from 'viem/chains';

// Mock viem
vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(),
        http: vi.fn(),
    };
});

import { createPublicClient } from 'viem';

describe('StateValidator', () => {
    let mockClient: Partial<PublicClient>;
    const MOCK_USER: Address = '0x1234567890123456789012345678901234567890';
    const MOCK_RPC = 'https://mock.rpc';

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = {
            getBalance: vi.fn(),
            readContract: vi.fn(),
            getBytecode: vi.fn(),
        };
        (createPublicClient as any).mockReturnValue(mockClient);
    });

    describe('getAccountBalances', () => {
        it('should fetch balances for multiple accounts', async () => {
            (mockClient.getBalance as any).mockResolvedValue(parseEther('1.5'));
            (mockClient.readContract as any).mockResolvedValue(parseEther('1000'));

            const balances = await StateValidator.getAccountBalances({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                addresses: [MOCK_USER],
                gTokenAddress: '0xGTOKEN',
                aPNTsAddress: '0xAPNTS',
                xPNTsAddress: '0xXPNTS'
            });

            expect(balances).toHaveLength(1);
            expect(balances[0].eth).toBe(parseEther('1.5'));
            expect(balances[0].gToken).toBe(parseEther('1000'));
            expect(mockClient.getBalance).toHaveBeenCalledWith({ address: MOCK_USER });
        });
    });

    describe('validateRole', () => {
        it('should return valid if user has role', async () => {
            (mockClient.readContract as any).mockResolvedValue(true);

            const result = await StateValidator.validateRole({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                registryAddress: '0xREGISTRY',
                roleId: '0xROLE',
                userAddress: MOCK_USER
            });

            expect(result.valid).toBe(true);
            expect(result.message).toContain('has role');
        });

        it('should return invalid if user does not have role', async () => {
            (mockClient.readContract as any).mockResolvedValue(false);

            const result = await StateValidator.validateRole({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                registryAddress: '0xREGISTRY',
                roleId: '0xROLE',
                userAddress: MOCK_USER
            });

            expect(result.valid).toBe(false);
            expect(result.message).toContain('does NOT have role');
        });

        it('should handle errors', async () => {
            (mockClient.readContract as any).mockRejectedValue(new Error('Contract error'));

            const result = await StateValidator.validateRole({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                registryAddress: '0xREGISTRY',
                roleId: '0xROLE',
                userAddress: MOCK_USER
            });

            expect(result.valid).toBe(false);
            expect(result.message).toContain('validation failed');
        });
    });

    describe('validateETHBalance', () => {
        it('should validate sufficient balance', async () => {
            (mockClient.getBalance as any).mockResolvedValue(parseEther('1.0'));

            const result = await StateValidator.validateETHBalance({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                address: MOCK_USER,
                minBalance: '0.5'
            });

            expect(result.valid).toBe(true);
            expect(result.message).toContain('meets minimum');
        });

        it('should validate insufficient balance', async () => {
            (mockClient.getBalance as any).mockResolvedValue(parseEther('0.1'));

            const result = await StateValidator.validateETHBalance({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                address: MOCK_USER,
                minBalance: '0.5'
            });

            expect(result.valid).toBe(false);
            expect(result.message).toContain('below minimum');
        });
    });

    describe('validateTokenBalance', () => {
        it('should validate token balance', async () => {
            (mockClient.readContract as any).mockResolvedValue(parseEther('100'));

            const result = await StateValidator.validateTokenBalance({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                address: MOCK_USER,
                tokenAddress: '0xTOKEN',
                minBalance: '50'
            });

            expect(result.valid).toBe(true);
            expect(result.message).toContain('meets minimum');
        });
    });

    describe('validateDeployment', () => {
        it('should return valid if contract is deployed', async () => {
            (mockClient.getBytecode as any).mockResolvedValue('0x1234');

            const result = await StateValidator.validateDeployment({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                contractAddress: '0xCONTRACT'
            });

            expect(result.valid).toBe(true);
            expect(result.message).toContain('deployed at');
        });

        it('should return invalid if contract is not deployed', async () => {
            (mockClient.getBytecode as any).mockResolvedValue('0x');

            const result = await StateValidator.validateDeployment({
                rpcUrl: MOCK_RPC,
                chain: sepolia,
                contractAddress: '0xCONTRACT'
            });

            expect(result.valid).toBe(false);
            expect(result.message).toContain('No contract found');
        });
    });
});
