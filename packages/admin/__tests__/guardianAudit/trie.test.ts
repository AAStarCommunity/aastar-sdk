import { describe, expect, it } from 'vitest';
import { EMPTY_RECEIPTS_ROOT, receiptsRootFromRpc } from '../../src/guardianAudit/trie';
import fixture from './fixtures/sepolia-block-receipts.json';

describe('guardian-audit receipts trie (unit, not acceptance)', () => {
    it('matches the Sepolia receiptsRoot and changes when a log byte changes', () => {
        expect(receiptsRootFromRpc(fixture.receipts)).toBe(fixture.header.receiptsRoot);
        expect(receiptsRootFromRpc([])).toBe(EMPTY_RECEIPTS_ROOT);

        const mutated = structuredClone(fixture.receipts);
        const data = mutated[0]?.logs[0]?.data ?? '0x';
        mutated[0]!.logs[0]!.data = data === '0x' || data.length < 3
            ? '0x01'
            : `${data.slice(0, -1)}${data.slice(-1).toLowerCase() === 'a' ? 'b' : 'a'}`;
        expect(receiptsRootFromRpc(mutated)).not.toBe(fixture.header.receiptsRoot);
    });
});
