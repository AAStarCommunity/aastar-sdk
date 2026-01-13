import { describe, it, expect } from 'vitest';
import { handleContractError, createErrorContext } from './errorHandler.js';

describe('ErrorHandler', () => {
    const MOCK_CTX = createErrorContext('test operation', { account: '0x123', roleId: '0xabc' });

    it('should handle RoleAlreadyGranted error', () => {
        const error = {
            data: { errorName: 'RoleAlreadyGranted', args: ['0xabc', '0x123'] }
        };
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('already has this role');
        expect(enhanced.message).toContain('0x123');
    });

    it('should handle InsufficientStake error', () => {
        const error = {
            data: { errorName: 'InsufficientStake', args: [100n, 50n] }
        };
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('Insufficient stake');
        expect(enhanced.message).toContain('Required: 100');
        expect(enhanced.message).toContain('Actual: 50');
    });

    it('should handle OwnableUnauthorizedAccount error', () => {
        const error = {
            data: { errorName: 'OwnableUnauthorizedAccount', args: ['0x123'] }
        };
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('Only the contract owner can do this');
    });

    it('should extract error from message if data.errorName is missing', () => {
        const error = new Error('Execution reverted: Error: RoleNotConfigured(0xabc)');
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('is not configured in the Registry');
    });

    it('should fallback for unknown error', () => {
        const error = new Error('Random connection failed');
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('Random connection failed');
        expect(enhanced.message).toContain('Failed to test operation');
    });

    it('should handle empty error object', () => {
        const enhanced = handleContractError({}, MOCK_CTX);
        expect(enhanced.message).toContain('Unknown error');
    });
});
