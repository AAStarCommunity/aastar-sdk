import { describe, expect, it } from 'vitest';
import { bloomOf, mayContain, mayContainAddress, mayHaveLog } from '../../src/guardianAudit/bloom';

const ADDR = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TOPIC = `0x${'ab'.repeat(32)}`;
const OTHER_TOPIC = `0x${'ef'.repeat(32)}`;
const ZERO = `0x${'00'.repeat(256)}`;
const FULL = `0x${'ff'.repeat(256)}`;
// Frozen from bloomOf([{ address: ADDR, topics: [TOPIC] }]). A bit-order change fails this.
const FROZEN =
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000080000000000000100000000000000000000';

describe('guardian-audit bloom (unit, not acceptance)', () => {
    it('builds the yellow-paper bloom and probes an address', () => {
        const bloom = bloomOf([{ address: ADDR, topics: [TOPIC] }]);
        expect(bloom).toBe(FROZEN);
        expect(mayContainAddress(bloom, ADDR)).toBe(true);
        expect(mayContainAddress(bloom, OTHER)).toBe(false);
        expect(mayContainAddress(ZERO, ADDR)).toBe(false);
        expect(mayContainAddress(FULL, ADDR)).toBe(true);
    });

    it('returns null for an unreadable bloom and never calls that absence', () => {
        expect(mayContainAddress(null, ADDR)).toBeNull();
        expect(mayContainAddress(undefined, ADDR)).toBeNull();
        expect(mayContainAddress('0x1234', ADDR)).toBeNull();
        expect(mayContainAddress(`0x${'00'.repeat(32)}`, ADDR)).toBeNull();
        expect(mayContain('0xzz', TOPIC as `0x${string}`)).toBe(true);
        expect(mayContain(`0x${'00'.repeat(32)}`, TOPIC as `0x${string}`)).toBe(true);
    });

    it('mayHaveLog requires the address and one topic', () => {
        const bloom = bloomOf([{ address: ADDR, topics: [TOPIC] }]);
        expect(mayHaveLog(bloom, ADDR, [TOPIC])).toBe(true);
        expect(mayHaveLog(bloom, ADDR, [OTHER_TOPIC])).toBe(false);
        expect(mayHaveLog(bloom, OTHER, [TOPIC])).toBe(false);
        expect(mayHaveLog(null, ADDR, [TOPIC])).toBeNull();
    });
});
