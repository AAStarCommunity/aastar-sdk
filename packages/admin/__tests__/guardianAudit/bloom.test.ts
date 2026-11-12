import { describe, expect, it } from 'vitest';
import { bloomOf, mayContain, mayContainAddress, mayHaveLog } from '../../src/guardianAudit/bloom';
import fixture from './fixtures/sepolia-block-bloom.json';

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
    it('keeps a frozen vector of this bloom implementation', () => {
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

    it('matches an independently fetched Sepolia logsBloom', () => {
        const logs = fixture.logs.map((log) => ({ address: log.address, topics: log.topics }));
        const rebuilt = bloomOf(logs);
        expect(rebuilt).toBe(fixture.logsBloom);
        for (const log of logs) {
            expect(mayContain(fixture.logsBloom, log.address as `0x${string}`)).toBe(true);
            for (const topic of log.topics) expect(mayContain(fixture.logsBloom, topic as `0x${string}`)).toBe(true);
        }
        const present = new Set(logs.map((log) => log.address.toLowerCase()));
        const absent = [
            '0x0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000003',
        ] as const;
        for (const extra of absent) {
            expect(present.has(extra)).toBe(false);
            const onFixture = mayContain(fixture.logsBloom, extra);
            expect(onFixture).toBe(mayContain(rebuilt, extra));
            expect(mayContainAddress(fixture.logsBloom, extra)).toBe(onFixture);
        }
    });

    it('mayHaveLog requires the address and one topic', () => {
        const bloom = bloomOf([{ address: ADDR, topics: [TOPIC] }]);
        expect(mayHaveLog(bloom, ADDR, [TOPIC])).toBe(true);
        expect(mayHaveLog(bloom, ADDR, [OTHER_TOPIC])).toBe(false);
        expect(mayHaveLog(bloom, OTHER, [TOPIC])).toBe(false);
        expect(mayHaveLog(null, ADDR, [TOPIC])).toBeNull();
    });
});
