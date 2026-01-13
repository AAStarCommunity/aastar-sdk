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

    it('should extract data from nested object structure', () => {
        // Case A: { data: { data: "0x..." } }
        const errorA = { data: { data: '0xA1' } };
        (viem.decodeErrorResult as any).mockReturnValue({ errorName: 'TestA', args: [] });
        expect(decodeContractError(errorA)).toContain('TestA');

        // Case B: { data: { object: "0x..." } }
        const errorB = { data: { object: '0xB1' } };
        (viem.decodeErrorResult as any).mockReturnValue({ errorName: 'TestB', args: [] });
        expect(decodeContractError(errorB)).toContain('TestB');
    });

    it('should format all known error types', () => {
        const testCases = [
            { name: 'RoleAlreadyGranted', args: ['0xRole', '0xUser'], expected: 'User 0xUser already has role 0xRole' },
            { name: 'InsufficientStake', args: [100n, 200n], expected: 'Provided 100, Required 200' },
            { name: 'InvalidParameter', args: ['BadInput'], expected: 'InvalidParameter: BadInput' },
            { name: 'RoleNotGranted', args: ['0xRole', '0xUser'], expected: 'User 0xUser does not have role 0xRole' },
            { name: 'UnknownCustom', args: [123n], expected: 'UnknownCustom: ["123"]' }
        ];

        for (const { name, args, expected } of testCases) {
            (viem.decodeErrorResult as any).mockReturnValue({ errorName: name, args });
            const result = decodeContractError({ data: '0x1' });
            expect(result).toContain(expected);
        }
    });

    it('should handle non-string unknown data', () => {
        (viem.decodeErrorResult as any).mockImplementation(() => { throw new Error('fail'); });
        const result = decodeContractError({ data: { complex: true } });
        expect(result).toContain('non-string data');
    });
});
