import { describe, it, expect, vi } from 'vitest';
import { UserOperationBuilder } from './userOp.js';
import { type Address, type PublicClient, type Hex } from 'viem';

describe('UserOperationBuilder', () => {
    const MOCK_ADDR: Address = '0x1111111111111111111111111111111111111111';

    it('should pack account gas limits', () => {
        const packed = UserOperationBuilder.packAccountGasLimits(100n, 200n);
        expect(packed.length).toBe(66); // 0x + 32 bytes (64 chars)
        expect(packed).toContain('00000000000000000000000000000064'); // 100
        expect(packed).toContain('000000000000000000000000000000c8'); // 200
    });

    it('should pack gas fees', () => {
        const packed = UserOperationBuilder.packGasFees(10n, 20n);
        expect(packed.length).toBe(66);
    });

    it('should pack paymaster and data', () => {
        const packed = UserOperationBuilder.packPaymasterAndData(MOCK_ADDR, 1000n, 2000n, '0xabcd');
        expect(packed).toContain(MOCK_ADDR.slice(2).toLowerCase());
        expect(packed).toContain('abcd');
    });

    it('should pack paymaster V4 deposit data', () => {
        const packed = UserOperationBuilder.packPaymasterV4DepositData(MOCK_ADDR, 100n, 200n, MOCK_ADDR, 300n, 400n);
        expect(packed.length).toBe(2 + 20*2 + 16*2 + 16*2 + 20*2 + 6*2 + 6*2);
    });

    it('should transform to Alchemy user operation', () => {
        const userOp = {
            sender: MOCK_ADDR,
            nonce: 1n,
            initCode: MOCK_ADDR + 'abcd',
            callData: '0x123',
            accountGasLimits: UserOperationBuilder.packAccountGasLimits(100n, 200n),
            preVerificationGas: 300n,
            gasFees: UserOperationBuilder.packGasFees(10n, 20n),
            paymasterAndData: UserOperationBuilder.packPaymasterAndData(MOCK_ADDR, 1000n, 2000n, '0xdead'),
            signature: '0x'
        };

        const alchemyOp = UserOperationBuilder.toAlchemyUserOperation(userOp);
        expect(alchemyOp.sender).toBe(MOCK_ADDR);
        expect(alchemyOp.verificationGasLimit).toBe('0x64');
        expect(alchemyOp.callGasLimit).toBe('0xc8');
        expect(alchemyOp.maxPriorityFeePerGas).toBe('0xa');
        expect(alchemyOp.maxFeePerGas).toBe('0x14');
        expect(alchemyOp.factory).toBe(MOCK_ADDR);
        expect(alchemyOp.paymaster).toBe(MOCK_ADDR);
        expect(alchemyOp.paymasterVerificationGasLimit).toBe('0x3e8');
    });

    it('should get user op hash', async () => {
        const mockPublicClient = {
            readContract: vi.fn().mockResolvedValue('0xhash')
        } as any;
        const hash = await UserOperationBuilder.getUserOpHash({
            userOp: {} as any,
            entryPoint: MOCK_ADDR,
            chainId: 1,
            publicClient: mockPublicClient
        });
        expect(hash).toBe('0xhash');
    });
});
