import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeContractError } from './decoder.js';
import * as viem from 'viem';

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        decodeErrorResult: vi.fn()
    };
});

describe('ErrorDecoder', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should extract data from viem error walk', () => {
        const mockError = {
            walk: (fn: any) => {
                const e = { data: '0x123' };
                return fn(e) ? e : null;
            }
        } as any;
        (viem.decodeErrorResult as any).mockReturnValue({
            errorName: 'Unauthorized',
            args: []
        });
        
        const result = decodeContractError(mockError);
        expect(result).toContain('Unauthorized');
    });

    it('should extract data from cause', () => {
        const mockError = {
            cause: { data: '0x123' }
        };
        (viem.decodeErrorResult as any).mockReturnValue({
            errorName: 'InsufficientBalance',
            args: [100n, 500n]
        });
        
        const result = decodeContractError(mockError);
        expect(result).toContain('InsufficientBalance');
        expect(result).toContain('Available 100, Required 500');
    });

    it('should handle specialized formatting for RoleNotConfigured', () => {
        (viem.decodeErrorResult as any).mockReturnValue({
            errorName: 'RoleNotConfigured',
            args: ['0x1', false]
        });
        
        const result = decodeContractError({ data: '0x123' });
        expect(result).toContain('Role 0x1 is INACTIVE');
    });

    it('should fallback to unknown error message if decoding fails', () => {
        (viem.decodeErrorResult as any).mockImplementation(() => { throw new Error('mismatch'); });
        
        const result = decodeContractError({ data: '0x1234567890' });
        expect(result).toContain('Unknown Error (data: 0x12345678...)');
    });

    it('should handle raw revert messages', () => {
        const result = decodeContractError({ message: 'execution reverted: CustomError' });
        expect(result).toBe('execution reverted: CustomError');
    });

    it('should return null for non-error input', () => {
        expect(decodeContractError(null)).toBeNull();
    });
});
