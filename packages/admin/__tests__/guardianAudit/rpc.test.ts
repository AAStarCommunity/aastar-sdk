import { describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import { header, pagedLogs, rawGetLogs, receiptPayloadTooLarge, responseLimits, snapshotReceipts, type RawRpc } from '../../src/guardianAudit/rpc';

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
        const root = `0x${'22'.repeat(32)}`;
        const bloom = `0x${'cd'.repeat(256)}`;
        const node = rpc(() => ({ number: '0x10', hash: good, parentHash: parent, receiptsRoot: root, logsBloom: bloom }));
        const h = await header(node, 16);
        expect(h).toEqual({ number: 16, hash: good, parentHash: parent, receiptsRoot: root, logsBloom: bloom });
        expect(node.calls[0]).toEqual(['eth_getBlockByNumber', ['0x10', false]]);

        const short = rpc(() => ({ number: '0x1', hash: good, parentHash: parent, receiptsRoot: root, logsBloom: '0xabcd' }));
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
        await expect(header(rpc(() => ({ number: '0x1', hash: parent, parentHash: parent })), 1)).rejects.toThrow(/malformed block header/);
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
        const secret = new Error('https://user:pw@disk.example/down');
        secret.cause = new Error('cause-secret');
        await expect(pagedLogs(rpc(() => { throw secret; }), ADDR, 3, 3, 4)).rejects.toSatisfy((error: Error) => {
            expect(error).not.toBe(secret);
            expect(error.message).toBe('stub: request failed');
            expect(error.cause).toBeUndefined();
            expect(String(error)).not.toMatch(/down|user:pw|disk\.example/);
            return true;
        });
    });

    it('stops a page of one block once the running log total exceeds the cap', async () => {
        const perBlock = 5;
        let calls = 0;
        const node = rpc(() => {
            calls += 1;
            return Array.from({ length: perBlock }, () => ({ address: ADDR }));
        });
        await expect(pagedLogs(node, ADDR, 0, responseLimits.ancestry, 1)).rejects.toThrow(/^stub: response too large$/);
        expect(calls).toBe(Math.floor(responseLimits.logs / perBlock) + 1);
        expect(calls).toBeLessThan(responseLimits.ancestry + 1);
    });

    it('rejects a zero page and inverted bounds before any request', async () => {
        const node = rpc(() => []);
        await expect(pagedLogs(node, ADDR, 1, 4, 0)).rejects.toThrow(/page must be >= 1/);
        await expect(pagedLogs(node, ADDR, 4, 1, 2)).rejects.toThrow(/from must be <= to/);
        await expect(pagedLogs(node, ADDR, -1, 1, 2)).rejects.toThrow(/from must be >= 0/);
        await expect(pagedLogs(node, ADDR, 1, Number.NaN, 2)).rejects.toThrow(/to must be >= 0/);
        expect(node.calls).toHaveLength(0);
    });

    it('rejects an inverted raw range and a provider error without forwarding it', async () => {
        const node = rpc(() => []);
        await expect(rawGetLogs(node, { address: ADDR, fromBlock: 4, toBlock: 1 })).rejects.toThrow(/from must be <= to/);
        await expect(rawGetLogs(node, { address: 'https://user:pw@disk.example' as Address, fromBlock: 1, toBlock: 1 })).rejects.toThrow(/^invalid address$/);
        expect(node.calls).toHaveLength(0);
        const secret = new Error('https://user:pw@disk.example/down');
        secret.cause = new Error('cause-secret');
        await expect(header({ name: 'stub', request: async () => { throw secret; } }, 1)).rejects.toSatisfy((error: Error) => {
            expect(error.message).toBe('stub: request failed');
            expect(error.cause).toBeUndefined();
            expect(String(error)).not.toMatch(/down|user:pw|disk\.example/);
            return true;
        });
        await expect(header({ name: 'https://user:pw@disk.example', request: async () => ({}) }, 1)).rejects.toThrow(/^provider name is not a safe label$/);
    });

    it('copies deposit quantities and drops the receipt list when one is not a quantity', () => {
        const kept = snapshotReceipts([{
            type: '0x7e', status: '0x1', logs: [],
            depositNonce: '0x10', depositReceiptVersion: 1,
        }]);
        expect(kept?.[0]).toMatchObject({ depositNonce: '0x10', depositReceiptVersion: '0x1' });
        const plain = snapshotReceipts([{ type: '0x2', logs: [] }])?.[0] as Record<string, unknown>;
        expect(plain).not.toHaveProperty('depositNonce');
        expect(plain).not.toHaveProperty('depositReceiptVersion');
        expect(snapshotReceipts([{ logs: [], depositNonce: `0x${'ab'.repeat(20)}` }])).toBeNull();
    });

    it('reports the provider label captured before the request, after the name changes', async () => {
        const secret = 'https://user:pw@example.test';
        const make = (): RawRpc => {
            const node: RawRpc = {
                name: 'safe',
                async request() {
                    node.name = secret;
                    throw new Error(secret);
                },
            };
            return node;
        };
        const calls = [
            () => header(make(), 1),
            () => rawGetLogs(make(), { address: ADDR, fromBlock: 1, toBlock: 1 }),
            () => pagedLogs(make(), ADDR, 1, 1, 1),
        ];
        for (const call of calls) {
            await expect(call()).rejects.toSatisfy((error: Error) => {
                expect(error.message).toBe('safe: request failed');
                expect(String(error)).not.toMatch(/user:pw|example\.test/);
                return true;
            });
        }
    });
});

describe('receiptPayloadTooLarge checks array counts before reading elements (Codex verify on #445 G3) (unit, not acceptance)', () => {
    /** An array of `length` whose elements throw if read. */
    const untouchable = (length: number) => {
        const a: unknown[] = [];
        a.length = length;
        Object.defineProperty(a, 0, { get() { throw new Error('element read'); } });
        return a;
    };
    it('too many logs in one receipt', () => {
        expect(receiptPayloadTooLarge([{ logs: untouchable(responseLimits.logsPerReceipt + 1) }])).toBe(true);
    });
    it('too many logs across receipts', () => {
        const per = responseLimits.logsPerReceipt;
        const receipts = Array.from({ length: Math.ceil(responseLimits.logs / per) }, () => ({ logs: new Array(per).fill(null) }));
        receipts.push({ logs: untouchable(per) });
        expect(receiptPayloadTooLarge(receipts)).toBe(true);
    });
    it('too many topics in one log', () => {
        expect(receiptPayloadTooLarge([{ logs: [{ data: '0x', topics: untouchable(responseLimits.topics + 1) }] }])).toBe(true);
    });
    it('too many receipts', () => {
        expect(receiptPayloadTooLarge(untouchable(responseLimits.receipts + 1))).toBe(true);
    });
});
