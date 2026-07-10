import { describe, expect, it, vi } from 'vitest';
import { keccak256, toHex } from 'viem';
import { buildDvtPop, dvtNodeId, dvtPopPoint } from '@aastar/core';
import { kmsPopSigner } from './kmsPopSigner.js';

// A deterministic golden PoP from a fixed BLS key — the KMS /pop response must byte-match this shape.
const SK = toHex(12345678901234567890n, { size: 32 });
const golden = buildDvtPop(SK);

const mkFetch = (body: unknown, ok = true, status = 200) =>
    vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

describe('dvtPopPoint / dvtNodeId', () => {
    it('dvtPopPoint recomputes the same popPoint buildDvtPop produced, with no secret key', () => {
        expect(dvtPopPoint(golden.publicKey).toLowerCase()).toBe(golden.popPoint.toLowerCase());
    });
    it('dvtNodeId == keccak256(publicKey) == buildDvtPop nodeId', () => {
        expect(dvtNodeId(golden.publicKey)).toBe(keccak256(golden.publicKey));
        expect(dvtNodeId(golden.publicKey)).toBe(golden.nodeId);
    });
});

describe('kmsPopSigner', () => {
    it('returns a verified DvtPop with a locally-derived nodeId', async () => {
        const fetchImpl = mkFetch({ publicKey: golden.publicKey, popPoint: golden.popPoint, popSig: golden.popSig });
        const pop = await kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', fetchImpl })();
        expect(pop.publicKey.toLowerCase()).toBe(golden.publicKey.toLowerCase());
        expect(pop.popSig.toLowerCase()).toBe(golden.popSig.toLowerCase());
        expect(pop.nodeId).toBe(golden.nodeId);
        expect(fetchImpl).toHaveBeenCalledOnce();
        // POSTs to <url>/pop with the node_id body
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://board:3100/pop');
        expect(JSON.parse(init.body as string)).toEqual({ node_id: 'n1' });
    });

    it('rejects a popPoint that is not hashToCurve(publicKey, BLS_POP_DST)', async () => {
        const last = golden.popPoint.slice(-1);
        const tampered = golden.popPoint.slice(0, -1) + (last === '0' ? '1' : '0');
        const fetchImpl = mkFetch({ publicKey: golden.publicKey, popPoint: tampered, popSig: golden.popSig });
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', fetchImpl })()).rejects.toThrow(
            /popPoint != hashToCurve/,
        );
    });

    it('throws on an HTTP error from KMS', async () => {
        const fetchImpl = mkFetch({}, false, 503);
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', fetchImpl })()).rejects.toThrow(/HTTP 503/);
    });

    it('throws on an incomplete /pop response', async () => {
        const fetchImpl = mkFetch({ publicKey: golden.publicKey });
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', fetchImpl })()).rejects.toThrow(/missing/);
    });

    it('requires a url and a nodeId or publicKey', () => {
        expect(() => kmsPopSigner({ url: '', nodeId: 'n1' })).toThrow(/url is required/);
        expect(() => kmsPopSigner({ url: 'http://board:3100' })).toThrow(/nodeId or publicKey/);
    });

    it('sends X-Signer-Token when provided', async () => {
        const fetchImpl = mkFetch({ publicKey: golden.publicKey, popPoint: golden.popPoint, popSig: golden.popSig });
        await kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', token: 'tok', fetchImpl })();
        const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.headers).toMatchObject({ 'X-Signer-Token': 'tok' });
    });
});
