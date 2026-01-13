import { describe, it, expect } from 'vitest';
import { type Address } from 'viem';
import { AAStarError, AAStarErrorCode } from '../errors/AAStarError.js';
import { validateAddress, validateHex } from '@aastar/core';

describe('EndUserClient Validation', () => {
    describe('Input Validation', () => {
        it('should validate address format', () => {
            const validAddress: Address = '0x1234567890123456789012345678901234567890';
            expect(() => validateAddress(validAddress)).not.toThrow();

            expect(() => validateAddress('invalid' as Address)).toThrow();
            expect(() => validateAddress('0xinvalid' as Address)).toThrow();
        });

        it('should validate hex format', () => {
            const validHex = '0x1234567890abcdef';
            expect(() => validateHex(validHex as `0x${string}`)).not.toThrow();

            expect(() => validateHex('invalid' as `0x${string}`)).toThrow();
        });
    });

    describe('AAStarError Usage', () => {
        it('should create VALIDATION_ERROR', () => {
            const error = new AAStarError('Invalid input', AAStarErrorCode.VALIDATION_ERROR);
            expect(error.code).toBe(AAStarErrorCode.VALIDATION_ERROR);
            expect(error.message).toContain('Invalid input');
        });

        it('should create CONTRACT_ERROR', () => {
            const error = new AAStarError('Contract reverted', AAStarErrorCode.CONTRACT_ERROR);
            expect(error.code).toBe(AAStarErrorCode.CONTRACT_ERROR);
        });

        it('should create CONFIGURATION_ERROR', () => {
            const error = new AAStarError('Missing config', AAStarErrorCode.CONFIGURATION_ERROR);
            expect(error.code).toBe(AAStarErrorCode.CONFIGURATION_ERROR);
        });
    });
});
