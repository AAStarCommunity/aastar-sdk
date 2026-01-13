import { describe, it, expect, vi } from 'vitest';
import { UserOperationBuilder } from './userOp.js';
import { type Address, type Hex, createPublicClient, http, concat } from 'viem';

describe('UserOperationBuilder', () => {
    const MOCK_ADDR = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_PM = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_TOKEN = '0x3333333333333333333333333333333333333333' as Address;

    describe('Gas Packing', () => {
        it('should pack account gas limits', () => {
            const packed = UserOperationBuilder.packAccountGasLimits(100000n, 200000n);
            expect(packed).toBeDefined();
            expect(packed.length).toBeGreaterThan(2);
        });

        it('should pack gas fees', () => {
            const packed = UserOperationBuilder.packGasFees(1000000000n, 2000000000n);
            expect(packed).toBeDefined();
            expect(packed.length).toBeGreaterThan(2);
        });

        it('should pack paymaster and data', () => {
            const packed = UserOperationBuilder.packPaymasterAndData(
                MOCK_PM,
                250000n,
                50000n,
                '0x1234' as Hex
            );
            expect(packed).toBeDefined();
            expect(packed.startsWith(MOCK_PM.toLowerCase())).toBe(true);
        });

        it('should pack PaymasterV4 deposit data', () => {
            const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);
            const validAfter = BigInt(Math.floor(Date.now() / 1000));
            
            const packed = UserOperationBuilder.packPaymasterV4DepositData(
                MOCK_PM,
                250000n,
                50000n,
                MOCK_TOKEN,
                validUntil,
                validAfter
            );
            expect(packed).toBeDefined();
            expect(packed.length).toBeGreaterThan(100);
        });
    });


    describe('UserOp Formatting', () => {
        it('should jsonify UserOp', () => {
            const userOp = {
                sender: MOCK_ADDR,
                nonce: 0n,
                initCode: '0x' as Hex,
                callData: '0x' as Hex,
                accountGasLimits: UserOperationBuilder.packAccountGasLimits(100000n, 200000n),
                preVerificationGas: 50000n,
                gasFees: UserOperationBuilder.packGasFees(1000000000n, 2000000000n),
                paymasterAndData: '0x' as Hex,
                signature: '0x' as Hex
            };

            const jsonified = UserOperationBuilder.jsonifyUserOp(userOp);
            expect(jsonified).toBeDefined();
            expect(jsonified.sender).toBe(MOCK_ADDR);
        });

        it('should convert to Alchemy format', () => {
            const userOp = {
                sender: MOCK_ADDR,
                nonce: '0x0' as Hex,
                initCode: '0x' as Hex,
                callData: '0x' as Hex,
                accountGasLimits: UserOperationBuilder.packAccountGasLimits(100000n, 200000n),
                preVerificationGas: '0xc350' as Hex,
                gasFees: UserOperationBuilder.packGasFees(1000000000n, 2000000000n),
                paymasterAndData: '0x' as Hex, // no paymaster
                signature: '0x' as Hex
            };

            const alchemy = UserOperationBuilder.toAlchemyUserOperation(userOp);
            expect(alchemy).toBeDefined();
            expect(alchemy.sender).toBe(MOCK_ADDR);
            expect(alchemy.verificationGasLimit).toBeDefined();
            expect(alchemy.callGasLimit).toBeDefined();
        });

        it('should unpack paymaster and data (full v0.7 format)', () => {
            const pmData = UserOperationBuilder.packPaymasterAndData(
                MOCK_PM,
                300000n,
                100000n,
                '0x12345678' as Hex
            );
            
             const userOp = {
                sender: MOCK_ADDR,
                nonce: '0x0' as Hex,
                initCode: '0x' as Hex,
                callData: '0x' as Hex,
                accountGasLimits: '0x' as Hex,
                preVerificationGas: '0x0' as Hex,
                gasFees: '0x' as Hex,
                paymasterAndData: pmData,
                signature: '0x' as Hex
            };

            const alchemy = UserOperationBuilder.toAlchemyUserOperation(userOp);
            expect(alchemy.paymaster).toBe(MOCK_PM);
            expect(alchemy.paymasterVerificationGasLimit).toBeDefined();
            expect(alchemy.paymasterPostOpGasLimit).toBeDefined();
            expect(alchemy.paymasterData).toBe('0x12345678');
        });

        it('should unpack paymaster and data (legacy format fallback)', () => {
             // Not enough bytes for Gas Limits, treated as paymaster + data
             const legacyPmData = concat([MOCK_PM, '0xabcdef' as Hex]) as Hex;
             
            const userOp = {
                sender: MOCK_ADDR,
                nonce: '0x0' as Hex,
                initCode: '0x' as Hex,
                callData: '0x' as Hex,
                accountGasLimits: '0x' as Hex,
                preVerificationGas: '0x0' as Hex,
                gasFees: '0x' as Hex,
                paymasterAndData: legacyPmData,
                signature: '0x' as Hex
            };

            const alchemy = UserOperationBuilder.toAlchemyUserOperation(userOp);
            expect(alchemy.paymaster).toBe(MOCK_PM);
            expect(alchemy.paymasterData).toBe('0xabcdef');
            expect(alchemy.paymasterVerificationGasLimit).toBeDefined(); // defaults
        });

        it('should unpack initCode into factory and factoryData', () => {
            const factory = MOCK_ADDR;
            const factoryData = '0xdeadbeef' as Hex;
            const initCode = concat([factory, factoryData]) as Hex;

            const userOp = {
                sender: MOCK_ADDR,
                nonce: '0x0' as Hex,
                initCode: initCode,
                callData: '0x' as Hex,
                accountGasLimits: '0x' as Hex,
                preVerificationGas: '0x0' as Hex,
                gasFees: '0x' as Hex,
                paymasterAndData: '0x' as Hex,
                signature: '0x' as Hex
            };

            const alchemy = UserOperationBuilder.toAlchemyUserOperation(userOp);
            expect(alchemy.factory.toLowerCase()).toBe(factory.toLowerCase());
            expect(alchemy.factoryData).toBe(factoryData);
        });
        it('should jsonify various types', () => {
             const userOp = {
                sender: MOCK_ADDR,
                nonce: 123, // number
                initCode: '0x' as Hex,
                callData: '0x' as Hex,
                accountGasLimits: '0x' as Hex,
                preVerificationGas: '0x10' as Hex, // string
                gasFees: '0x' as Hex,
                paymasterAndData: '0x' as Hex,
                signature: '0x' as Hex
            };
            const json = UserOperationBuilder.jsonifyUserOp(userOp);
            expect(json.nonce).toBe('0x7b');
            expect(json.preVerificationGas).toBe('0x10');
        });

        it('should handle leading zeros in string quantities for Alchemy', () => {
            const userOp = {
                sender: MOCK_ADDR,
                nonce: '0x0001', // leading zeros
                preVerificationGas: '0x0', // valid zero
                // ... others
            };
             const json = UserOperationBuilder.jsonifyUserOp(userOp);
             expect(json.nonce).toBe('0x1'); // compact
             expect(json.preVerificationGas).toBe('0x0');
        });
    });
});
