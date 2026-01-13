import { describe, it, expect } from 'vitest';
import { handleContractError } from './errorHandler.js';

describe('ErrorHandler', () => {
    const MOCK_CTX = {
        operation: 'test operation',
        roleId: '0xRole' as const,
        account: '0xUser'
    };

    it('should enhance known contract errors', () => {
        const error = new Error('Execution reverted: Error: RoleNotGranted(0xabc, 0xdef)');
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('does not have role');
        expect(enhanced.message).toContain('Please register for this role first');
    });

    it('should use context if args missing', () => {
        const error = new Error('Execution reverted: Error: RoleNotGranted()');
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('0xUser does not have role 0xRole');
    });

    it('should extract error from message if data.errorName is missing', () => {
        // Simulate an error where data.errorName is missing but message contains relevant info
        const error = {
            message: 'Error: Registry: Role "0xRole" is not configured in the Registry'
        };
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('is not configured in the Registry');
    });

    it('should handle all known contract errors', () => {
        const errors = [
            { name: 'RoleNotGranted', args: ['0xRole', '0xUser'], match: 'does not have role' },
            { name: 'InsufficientBalance', args: [], match: 'Insufficient balance' },
            { name: 'InvalidParameter', args: ['BadParam'], match: 'Invalid parameter' },
            { name: 'Unauthorized', args: [], match: 'Unauthorized operation' },
            { name: 'OwnableUnauthorizedAccount', args: ['0xUser'], match: 'not authorized' },
            { name: 'RoleNotConfigured', args: ['0xRole'], match: 'not configured' }
        ];

        for (const { name, args, match } of errors) {
            const error = {
                data: { errorName: name, args },
                message: `Error: ${name}(...`
            };
            const enhanced = handleContractError(error, MOCK_CTX);
            expect(enhanced.message).toContain(match);
        }
    });

    it('should fallback to stringify matching', () => {
        // The implementation checks if JSON.stringify(error) includes known keys
        const weirdError = {
            inner: 'RoleNotConfigured'
        };
        const enhanced = handleContractError(weirdError, MOCK_CTX);
        expect(enhanced.message).toContain('not configured');
    });

    it('should fallback for unknown error', () => {
        const error = new Error('Random connection failed');
        const enhanced = handleContractError(error, MOCK_CTX);
        expect(enhanced.message).toContain('Random connection failed');
    });

    it('should handle empty error object', () => {
        const enhanced = handleContractError({}, MOCK_CTX);
        expect(enhanced.message).toBe('Failed to test operation: Unknown error');
    });

    it('should prioritize args over context for RoleAlreadyGranted', () => {
        const enhanced = handleContractError({
            data: { errorName: 'RoleAlreadyGranted', args: ['0xArgRole', '0xArgUser'] }
        }, MOCK_CTX);
        expect(enhanced.message).toContain('Account 0xArgUser already has this role (0xArgRole)');
    });

    it('should use context if args missing for RoleAlreadyGranted', () => {
        const enhanced = handleContractError({
            data: { errorName: 'RoleAlreadyGranted', args: [] }
        }, MOCK_CTX);
        expect(enhanced.message).toContain(`Account ${MOCK_CTX.account} already has this role (${MOCK_CTX.roleId})`);
    });

    it('should prioritize args for InsufficientStake', () => {
        const enhanced = handleContractError({
            data: { errorName: 'InsufficientStake', args: [100n, 200n] }
        }, MOCK_CTX);
        expect(enhanced.message).toContain('Required: 100');
        expect(enhanced.message).toContain('Actual: 200');
    });

    it('should handle missing args for InsufficientStake', () => {
        const enhanced = handleContractError({
            data: { errorName: 'InsufficientStake', args: [] } // Missing args
        }, MOCK_CTX);
        expect(enhanced.message).toContain('Insufficient stake for this operation.');
        expect(enhanced.message).not.toContain('Required:');
    });
});
