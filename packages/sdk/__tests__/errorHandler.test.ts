import { describe, expect, it } from 'vitest';
import { handleContractError } from '../src/utils/errorHandler';

const ascii32 = (s: string) => `0x${Buffer.from(s).toString('hex').padEnd(64, '0')}`;
const fail = (errorName: string, args: unknown[]) => ({ message: 'reverted', data: { errorName, args } });

describe('handleContractError: rc.8 BLSAggregator-4.14.0 error ABI', () => {
    it('InvalidParameter reads the string form and the bytes32 form', () => {
        expect(handleContractError(fail('InvalidParameter', ['slashLevel']), {}).message).toMatch(/Invalid parameter: slashLevel\./);
        expect(handleContractError(fail('InvalidParameter', [ascii32('slashLevel')]), {}).message).toMatch(/Invalid parameter: slashLevel\./);
        // Not printable ASCII: keep the hex rather than print control bytes.
        const raw = `0x01${'00'.repeat(31)}`;
        expect(handleContractError(fail('InvalidParameter', [raw]), {}).message).toContain(raw);
        expect(handleContractError(fail('InvalidParameter', [`0x${'00'.repeat(32)}`]), {}).message).toContain(`0x${'00'.repeat(32)}`);
        expect(handleContractError(fail('InvalidParameter', []), {}).message).toMatch(/Invalid parameter: unknown\./);
    });

    it('InvalidThreshold has its own message', () => {
        expect(handleContractError(fail('InvalidThreshold', []), {}).message).toMatch(/Invalid threshold: it must be at least the minimum threshold/);
    });
});
