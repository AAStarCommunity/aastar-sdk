import { describe, it, expect } from 'vitest';
import { AAStarError, AAStarErrorCode } from './AAStarError.js';

describe('AAStarError', () => {
    describe('Error Creation', () => {
        it('should create VALIDATION_ERROR', () => {
            const error = new AAStarError('Invalid address format', AAStarErrorCode.VALIDATION_ERROR);
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AAStarError);
            expect(error.code).toBe(AAStarErrorCode.VALIDATION_ERROR);
            expect(error.message).toContain('Invalid address format');
            expect(error.name).toBe('AAStarError');
        });

        it('should create CONTRACT_ERROR', () => {
            const error = new AAStarError('Execution reverted', AAStarErrorCode.CONTRACT_ERROR);
            
            expect(error.code).toBe(AAStarErrorCode.CONTRACT_ERROR);
            expect(error.message).toContain('Execution reverted');
        });

        it('should create NETWORK_ERROR', () => {
            const error = new AAStarError('Network timeout', AAStarErrorCode.NETWORK_ERROR);
            
            expect(error.code).toBe(AAStarErrorCode.NETWORK_ERROR);
            expect(error.message).toContain('Network timeout');
        });

        it('should create CONFIGURATION_ERROR', () => {
            const error = new AAStarError('Missing RPC URL', AAStarErrorCode.CONFIGURATION_ERROR);
            
            expect(error.code).toBe(AAStarErrorCode.CONFIGURATION_ERROR);
            expect(error.message).toContain('Missing RPC URL');
        });

        it('should create UNKNOWN_ERROR', () => {
            const error = new AAStarError('Unexpected error');
            
            expect(error.code).toBe(AAStarErrorCode.UNKNOWN_ERROR);
        });
    });

    describe('Error Properties', () => {
        it('should have correct error name', () => {
            const error = new AAStarError('Test error', AAStarErrorCode.VALIDATION_ERROR);
            expect(error.name).toBe('AAStarError');
        });

        it('should maintain stack trace', () => {
            const error = new AAStarError('Test error', AAStarErrorCode.CONTRACT_ERROR);
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('AAStarError');
        });

        it('should preserve original message', () => {
            const originalMessage = 'Detailed error description';
            const error = new AAStarError(originalMessage, AAStarErrorCode.NETWORK_ERROR);
            expect(error.message).toBe(originalMessage);
        });
    });

    describe('Error Codes Enumeration', () => {
        it('should have all expected error codes', () => {
            expect(AAStarErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(AAStarErrorCode.CONTRACT_ERROR).toBe('CONTRACT_ERROR');
            expect(AAStarErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
            expect(AAStarErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
            expect(AAStarErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
        });
    });

    describe('instanceof checks', () => {
        it('should be instance of Error', () => {
            const error = new AAStarError('Test', AAStarErrorCode.VALIDATION_ERROR);
            expect(error instanceof Error).toBe(true);
        });

        it('should be instance of AAStarError', () => {
            const error = new AAStarError('Test', AAStarErrorCode.CONTRACT_ERROR);
            expect(error instanceof AAStarError).toBe(true);
        });

        it('should differentiate from standard Error', () => {
            const aastarError = new AAStarError('Test', AAStarErrorCode.VALIDATION_ERROR);
            const standardError = new Error('Test');
            
            expect(aastarError instanceof AAStarError).toBe(true);
            expect(standardError instanceof AAStarError).toBe(false);
        });
    });
});
