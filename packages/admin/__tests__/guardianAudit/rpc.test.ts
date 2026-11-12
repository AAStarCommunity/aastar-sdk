import { describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import { header, pagedLogs, rawGetLogs, type RawRpc } from '../../src/guardianAudit/rpc';

const ADDR = '0x1111111111111111111111111111111111111111' as Address;

function rpc(answer: (method: string, params: unknown[]) => unknown): RawRpc & { calls: unknown[][] } {
    const calls: unknown[][] = [];
    return {
        name: 'stub',
        calls,
        async request({ method, params = [] }) {
            calls.push([method, params]);
            return answer(method, params);
        },
    };
}

describe('guardian-audit transport (unit, not acceptance)', () => {
    it('reads a header and nulls a bloom that is not 256 bytes', async () => {
        const good = `0x${'ab'.repeat(32)}`;
        const parent = `0x${'11'.repeat(32)}`;
        const bloom = `0x${'cd'.repeat(256)}`;
        const node = rpc(() => ({ number: '0x10', hash: good, parentHash: parent, logsBloom: bloom }));
        const h = await header(node, 16);
        expect(h).toEqual({ number: 16, hash: good, parentHash: parent, logsBloom: bloom });
        expect(node.calls[0]).toEqual(['eth_getBlockByNumber', ['0x10', false]]);

        const short = rpc(() => ({ number: '0x1', hash: good, parentHash: parent, logsBloom: '0xabcd' }));
        expect((await header(short, 'finalized')).logsBloom).toBeNull();
        expect(short.calls[0][1]).toEqual(['finalized', false]);
    });

    it('refuses a null header, a bad hash, a bad height, and the wrong height', async () => {
        await expect(header(rpc(() => null), 1)).rejects.toThrow(/unavailable/);
        await expect(header(rpc(() => ({ number: '0x1', hash: '0xabc' })), 1)).rejects.toThrow(/malformed block header/);
        await expect(header(rpc(() => ({ number: 'nope', hash: `0x${'11'.repeat(32)}` })), 1)).rejects.toThrow(/malformed block header/);
        await expect(header(rpc(() => ({ number: '0x2', hash: `0x${'11'.repeat(32)}` })), 1)).rejects.toThrow(/another height/);
        const parent = `0x${'11'.repeat(32)}`;
        await expect(header(rpc(() => ({ number: '0x1', hash: parent })), 1)).rejects.toThrow(/malformed block header/);
        await expect(header(rpc(() => ({ number: '0x1', hash: parent, parentHash: '0xabc' })), 1)).rejects.toThrow(/malformed block header/);
    });

    it('getLogs is address-only and rejects a non-array', async () => {
        const node = rpc(() => []);
        await rawGetLogs(node, { address: ADDR, fromBlock: 1, toBlock: 2 });
        expect(node.calls[0][1]).toEqual([{ address: ADDR, fromBlock: '0x1', toBlock: '0x2' }]);
        expect(node.calls[0][1][0]).not.toHaveProperty('topics');
        await rawGetLogs(node, { address: ADDR, blockHash: `0x${'aa'.repeat(32)}` as Hex });
        expect(node.calls[1][1][0]).toEqual({ address: ADDR, blockHash: `0x${'aa'.repeat(32)}` });
        await expect(rawGetLogs(rpc(() => ({ logs: [] })), { address: ADDR, fromBlock: 1, toBlock: 1 })).rejects.toThrow(/not an array/);
    });

    it('halves a failing page down to one block, then rethrows', async () => {
        const seen: string[] = [];
        const node = rpc((_method, params) => {
            const f = params[0] as { fromBlock: string; toBlock: string };
            const from = Number.parseInt(f.fromBlock, 16);
            const to = Number.parseInt(f.toBlock, 16);
            seen.push(`${from}-${to}`);
            if (to - from + 1 > 1) throw new Error('too wide');
            return [{ logIndex: f.fromBlock }];
        });
        const logs = await pagedLogs(node, ADDR, 1, 4, 4);
        expect(logs).toHaveLength(4);
        expect(seen).toContain('1-1');
        expect(seen[0]).toBe('1-4');
        await expect(pagedLogs(rpc(() => { throw new Error('down'); }), ADDR, 3, 3, 4)).rejects.toThrow(/down/);
    });
});
