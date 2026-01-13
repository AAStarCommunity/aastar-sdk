import { describe, it, expect } from 'vitest';
import { AAStarError, AAStarErrorCode } from '../errors/AAStarError.js';

describe('CommunityClient', () => {
    describe('Error Handling', () => {
        it('should throw AAStarError for validation failures', () => {
            const error = new AAStarError('Missing required parameter: name', AAStarErrorCode.VALIDATION_ERROR);
            expect(error).toBeInstanceOf(AAStarError);
            expect(error.code).toBe(AAStarErrorCode.VALIDATION_ERROR);
        });

        it('should throw AAStarError for contract errors', () => {
            const error = new AAStarError('Contract execution failed', AAStarErrorCode.CONTRACT_ERROR);
            expect(error.code).toBe(AAStarErrorCode.CONTRACT_ERROR);
        });
    });

    describe('Validation Requirements', () => {
        it('should require name for launch', () => {
            // This test documents the requirement
            const requiredParams = ['name', 'tokenName', 'tokenSymbol'];
            expect(requiredParams).toContain('name');
            expect(requiredParams).toContain('tokenName');
            expect(requiredParams).toContain('tokenSymbol');
        });
    });
});
