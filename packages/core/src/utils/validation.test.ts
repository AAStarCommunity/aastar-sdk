
import { describe, it, expect } from 'vitest';
import { validateAddress, validateAmount, validateHex, AAStarValidationError } from './validation.js';

describe('Validation Utils', () => {
    describe('validateAddress', () => {
        it('should pass for valid Ethereum addresses', () => {
            const validAddr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
            expect(validateAddress(validAddr)).toBe(validAddr);
        });

        it('should throw for invalid addresses', () => {
            expect(() => validateAddress('0xInvalid')).toThrow(AAStarValidationError);
        });

        it('should checksum address', () => {
            const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
            const checksummed = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
            expect(validateAddress(lower)).toBe(checksummed);
        });
    });

    describe('validateAmount', () => {
        it('should pass for positive amounts', () => {
            expect(validateAmount(100n)).toBe(100n);
        });

        it('should throw for negative amounts', () => {
            expect(() => validateAmount(-1n)).toThrow(AAStarValidationError);
        });

        it('should throw if exceeds max', () => {
            expect(() => validateAmount(100n, 'Test', 0n, 50n)).toThrow(AAStarValidationError);
        });
    });

    describe('validateHex', () => {
        it('should pass for valid hex strings', () => {
            expect(validateHex('0x1234')).toBe('0x1234');
        });

        it('should throw if missing 0x prefix', () => {
            expect(() => validateHex('1234')).toThrow(AAStarValidationError);
        });

        it('should throw for non-hex characters', () => {
            expect(() => validateHex('0xZZZZ')).toThrow(AAStarValidationError);
        });
    });
});
