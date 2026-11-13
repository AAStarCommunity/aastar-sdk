import { describe, expect, it } from 'vitest';
import { hexToBytes, keccak256, type Hex } from 'viem';
import { EMPTY_RECEIPTS_ROOT, receiptsRootFromRpc, trieRoot } from '../../src/guardianAudit/trie';
import fixture from './fixtures/sepolia-block-receipts.json';
import fixture135 from './fixtures/sepolia-receipts-135.json';
import fixtureFailed from './fixtures/sepolia-receipts-failed.json';
import opSepolia from './fixtures/op-sepolia-block-receipts.json';
import opMainnet from './fixtures/op-mainnet-block-receipts.json';
import opPreCanyon from './fixtures/op-mainnet-110000000-pre-canyon-receipts.json';

/** Independent RLP + Merkle Patricia encoder. It does not call trie.ts. */
function rlp(item: Uint8Array | Uint8Array[]): Uint8Array {
    if (item instanceof Uint8Array) {
        if (item.length === 1 && item[0]! < 0x80) return item;
        return headed(0x80, item);
    }
    return headed(0xc0, concatBytes(item));
}

function headed(base: number, body: Uint8Array): Uint8Array {
    if (body.length < 56) return concatBytes([Uint8Array.of(base + body.length), body]);
    const len = minimal(BigInt(body.length));
    return concatBytes([Uint8Array.of(base + 55 + len.length), len, body]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

function minimal(n: bigint): Uint8Array {
    if (n === 0n) return new Uint8Array();
    let hex = n.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    return hexToBytes(`0x${hex}` as Hex);
}

function nibbles(bytes: Uint8Array): number[] {
    const out: number[] = [];
    for (const b of bytes) out.push(b >> 4, b & 0xf);
    return out;
}

function prefix(path: number[], leaf: boolean): Uint8Array {
    const odd = path.length % 2;
    const flag = (leaf ? 2 : 0) + odd;
    const out: number[] = [];
    let i = 0;
    if (odd) { out.push((flag << 4) | path[0]!); i = 1; }
    else out.push(flag << 4);
    for (; i < path.length; i += 2) out.push((path[i]! << 4) | path[i + 1]!);
    return Uint8Array.from(out);
}

type Leaf = { k: 'leaf'; path: number[]; val: Uint8Array };
type Ext = { k: 'ext'; path: number[]; down: Trie };
type Br = { k: 'br'; slot: (Trie | null)[]; val: Uint8Array | null };
type Trie = Leaf | Ext | Br;

function blank(): Br {
    return { k: 'br', slot: Array.from({ length: 16 }, () => null), val: null };
}

function share(a: number[], b: number[]): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}

function plant(node: Br, path: number[], val: Uint8Array): void {
    if (path.length === 0) { node.val = val; return; }
    node.slot[path[0]!] = { k: 'leaf', path: path.slice(1), val };
}

function put(node: Trie | null, path: number[], val: Uint8Array): Trie {
    if (!node) return { k: 'leaf', path, val };
    if (node.k === 'leaf') {
        const n = share(node.path, path);
        const br = blank();
        plant(br, node.path.slice(n), node.val);
        plant(br, path.slice(n), val);
        return n === 0 ? br : { k: 'ext', path: path.slice(0, n), down: br };
    }
    if (node.k === 'ext') {
        const n = share(node.path, path);
        if (n === node.path.length) return { k: 'ext', path: node.path, down: put(node.down, path.slice(n), val) };
        const br = blank();
        const rest = node.path.slice(n);
        br.slot[rest[0]!] = rest.length === 1 ? node.down : { k: 'ext', path: rest.slice(1), down: node.down };
        const added = path.slice(n);
        if (added.length === 0) br.val = val;
        else br.slot[added[0]!] = put(null, added.slice(1), val);
        return n === 0 ? br : { k: 'ext', path: path.slice(0, n), down: br };
    }
    const slot = node.slot.slice();
    if (path.length === 0) return { k: 'br', slot, val };
    slot[path[0]!] = put(slot[path[0]!] ?? null, path.slice(1), val);
    return { k: 'br', slot, val: node.val };
}

function link(encoded: Uint8Array): Uint8Array {
    return encoded.length < 32 ? encoded : rlp(hexToBytes(keccak256(encoded)));
}

function pack(node: Trie): Uint8Array {
    if (node.k === 'leaf') return rlp([rlp(prefix(node.path, true)), rlp(node.val)]);
    if (node.k === 'ext') return rlp([rlp(prefix(node.path, false)), link(pack(node.down))]);
    const slots = node.slot.map((child) => child ? link(pack(child)) : rlp(new Uint8Array()));
    slots.push(node.val ? rlp(node.val) : rlp(new Uint8Array()));
    return rlp(slots);
}

function referenceRoot(raw: { type?: string; status: string; cumulativeGasUsed: string; logsBloom: string; transactionIndex: string; logs: { address: string; topics: string[]; data: string }[] }[]): Hex {
    let node: Trie | null = null;
    for (const receipt of raw) {
        const index = Number(receipt.transactionIndex);
        const type = receipt.type === undefined ? 0 : Number(receipt.type);
        const logs = receipt.logs.map((log) => rlp([
            rlp(hexToBytes(log.address as Hex)),
            rlp(log.topics.map((topic) => rlp(hexToBytes(topic as Hex)))),
            rlp(hexToBytes(log.data as Hex)),
        ]));
        const body = rlp([
            rlp(receipt.status === '0x1' ? Uint8Array.of(1) : new Uint8Array()),
            rlp(minimal(BigInt(receipt.cumulativeGasUsed))),
            rlp(hexToBytes(receipt.logsBloom as Hex)),
            rlp(logs),
        ]);
        const value = type === 0 ? body : concatBytes([Uint8Array.of(type), body]);
        node = put(node, nibbles(rlp(minimal(BigInt(index)))), value);
    }
    if (!node) return keccak256(hexToBytes('0x80'));
    return keccak256(pack(node));
}

const ZERO_BLOOM = `0x${'00'.repeat(256)}`;
const WORD = `0x${'ab'.repeat(32)}`;

function receipt(index: number, over: { type?: string; status?: string; data?: string } = {}) {
    return {
        type: over.type ?? '0x2',
        status: over.status ?? '0x1',
        cumulativeGasUsed: `0x${index.toString(16)}`,
        logsBloom: ZERO_BLOOM,
        transactionIndex: `0x${index.toString(16)}`,
        logs: over.data === undefined ? [] : [{ address: WORD, topics: [WORD], data: over.data }],
    };
}

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

    it('matches an independent encoder on legacy, failed, and 128-key receipts', () => {
        const legacy = [receipt(0, { type: '0x0', data: '0x01' })];
        const failed = [receipt(0, { status: '0x0', data: '0x' })];
        const boundary = Array.from({ length: 129 }, (_, index) => receipt(index));
        for (const vector of [legacy, failed, boundary]) {
            expect(receiptsRootFromRpc(vector)).toBe(referenceRoot(vector));
        }
        expect(receiptsRootFromRpc(legacy)).not.toBe(receiptsRootFromRpc(failed));
        expect(receiptsRootFromRpc(boundary)).not.toBe(EMPTY_RECEIPTS_ROOT);
    });

    it('rejects oversized receipt arrays before visiting elements', () => {
        const receipts: unknown[] = [];
        receipts.length = 4_294_967_295;
        let visited = false;
        Object.defineProperty(receipts, 0, {
            get() { visited = true; throw new Error('visited'); },
        });
        expect(receiptsRootFromRpc(receipts)).toBeNull();
        expect(visited).toBe(false);
    });

    it('rejects an unbounded pair list before reading an element', () => {
        const pairs: { key: Uint8Array; value: Uint8Array }[] = [];
        pairs.length = 4_294_967_295;
        let visited = false;
        Object.defineProperty(pairs, 0, {
            get() { visited = true; throw new Error('visited'); },
        });
        expect(trieRoot(pairs)).toBeNull();
        expect(visited).toBe(false);
        const overCap: { key: Uint8Array; value: Uint8Array }[] = [];
        overCap.length = 100_001;
        Object.defineProperty(overCap, 0, {
            get() { visited = true; throw new Error('visited'); },
        });
        expect(trieRoot(overCap)).toBeNull();
        expect(visited).toBe(false);
    });

    it('rejects a key or value past the byte cap, and a non-byte pair', () => {
        expect(trieRoot([])).toBe(EMPTY_RECEIPTS_ROOT);
        const key = new Uint8Array(64);
        const value = new Uint8Array(1);
        expect(trieRoot([{ key, value }])).toMatch(/^0x[0-9a-f]{64}$/);
        expect(trieRoot([{ key: new Uint8Array(65), value }])).toBeNull();
        expect(trieRoot([{ key, value: new Uint8Array(1_048_577) }])).toBeNull();
        expect(trieRoot([{ key: '0x01' as unknown as Uint8Array, value }])).toBeNull();
        expect(trieRoot(null as unknown as { key: Uint8Array; value: Uint8Array }[])).toBeNull();
    });

    it('rejects two receipts that share a transactionIndex', () => {
        expect(receiptsRootFromRpc([receipt(0, { data: '0x01' }), receipt(0, { data: '0x02' })])).toBeNull();
        expect(receiptsRootFromRpc([receipt(0), receipt(1)])).not.toBeNull();
    });

    it('encodes a pre-Canyon deposit nonce only when a version is present', () => {
        const bloom = `0x${'00'.repeat(256)}`;
        const base = {
            type: '0x7e', status: '0x1', cumulativeGasUsed: '0x1', logsBloom: bloom,
            transactionIndex: '0x0', logs: [],
        };
        const nonceOnly = { ...base, depositNonce: '0x10' };
        const versioned = { ...base, depositNonce: '0x10', depositReceiptVersion: '0x1' };
        expect(receiptsRootFromRpc([nonceOnly])).toBe(receiptsRootFromRpc([base]));
        expect(receiptsRootFromRpc([versioned])).not.toBe(receiptsRootFromRpc([base]));
    });
});

describe('real Sepolia receipt tries (unit, not acceptance)', () => {
    it.each([
        ['135 receipts: crosses the 0x80 index-key boundary', fixture135],
        ['a block with a failed (status 0x0) receipt', fixtureFailed],
    ])('%s rebuilds to the header receiptsRoot', (_n, f: any) => {
        if (f === fixture135) expect(f.receipts.length).toBeGreaterThan(128);
        else expect(f.receipts.some((r: any) => r.status === '0x0')).toBe(true);
        expect(receiptsRootFromRpc(f.receipts)).toBe(f.header.receiptsRoot);
    });

    it('matches the OP Sepolia receiptsRoot for a type 0x7e deposit receipt', () => {
        const deposit = opSepolia.receipts.find((item: { type: string }) => item.type === '0x7e');
        expect(deposit?.depositNonce).toBeTruthy();
        expect(deposit?.depositReceiptVersion).toBeTruthy();
        expect(opSepolia.receipts.some((item: { type: string }) => item.type === '0x2')).toBe(true);
        expect(receiptsRootFromRpc(opSepolia.receipts)).toBe(opSepolia.header.receiptsRoot);
    });
});

describe('real OP Mainnet receipt trie (DSR: mainnet is the deploy target) (unit, not acceptance)', () => {
    it('a block whose deposit (0x7e) receipt carries depositNonce and depositReceiptVersion rebuilds to its receiptsRoot', () => {
        const deposit = opMainnet.receipts.find((item: { type: string }) => item.type === '0x7e') as Record<string, unknown> | undefined;
        expect(deposit?.depositNonce).toBeDefined();
        expect(deposit?.depositReceiptVersion).toBeDefined();
        expect(opMainnet.receipts.length).toBeGreaterThan(2);
        expect(receiptsRootFromRpc(opMainnet.receipts)).toBe(opMainnet.header.receiptsRoot);
    });

    it('rebuilds pre-Canyon OP Mainnet block 110000000, whose deposit receipt has a nonce and no version', () => {
        const deposit = opPreCanyon.receipts.find((item: { type: string }) => item.type === '0x7e') as Record<string, unknown>;
        expect(deposit.depositNonce).toBeDefined();
        expect(deposit.depositReceiptVersion).toBeUndefined();
        expect(opPreCanyon.receipts.some((item: { type: string }) => item.type === '0x0')).toBe(true);
        expect(opPreCanyon.receipts.some((item: { type: string }) => item.type === '0x2')).toBe(true);
        expect(receiptsRootFromRpc(opPreCanyon.receipts)).toBe(opPreCanyon.header.receiptsRoot);
    });
});

describe('receiptsRootFromRpc refuses an over-budget block itself (#445 N3) (unit, not acceptance)', () => {
    it('a block whose receipts exceed the per-block byte budget returns null before encoding', () => {
        // 40 receipts x 900 KiB of log data = ~35 MiB > the 32 MiB block budget, while each receipt stays under
        // its own 1 MiB cap. A control block of the same receipts below the block budget must still produce a root,
        // so a null here is the block budget and not some other rejection.
        const base: any = fixture.receipts.find((r: any) => Array.isArray(r.logs) && r.logs.length > 0);
        // Each log's data stays under the 64 KiB per-string cap; 15 logs make ~960 KiB per receipt.
        const data = '0x' + 'ab'.repeat(64 * 1024 - 64);
        const make = (n: number) => Array.from({ length: n }, (_, i) => ({
            ...base, transactionIndex: '0x' + i.toString(16),
            logs: Array.from({ length: 15 }, (_, j) => ({ ...base.logs[0], data, topics: [], logIndex: '0x' + (i * 15 + j).toString(16) })),
        }));
        expect(receiptsRootFromRpc(make(30))).toMatch(/^0x[0-9a-f]{64}$/);
        expect(receiptsRootFromRpc(make(40))).toBeNull();
    });
});
