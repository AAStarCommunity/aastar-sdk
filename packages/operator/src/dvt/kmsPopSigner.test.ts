import { describe, expect, it, vi } from 'vitest';
import { keccak256, toHex } from 'viem';
import { buildDvtPop, dvtNodeId, dvtPopPoint, verifyDvtPop } from '@aastar/core';
import { kmsPopSigner } from './kmsPopSigner.js';

// Two deterministic golden PoPs from fixed BLS keys: `victim` is the node the operator wants; `attacker`
// is a self-consistent tuple for a DIFFERENT key (models a compromised KMS / MITM substitution attempt).
const victim = buildDvtPop(toHex(12345678901234567890n, { size: 32 }));
const attacker = buildDvtPop(toHex(98765432109876543210n, { size: 32 }));

const mkFetch = (body: unknown, ok = true, status = 200) =>
    vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

describe('dvtPopPoint / dvtNodeId', () => {
    it('dvtPopPoint recomputes the same popPoint buildDvtPop produced, with no secret key', () => {
        expect(dvtPopPoint(victim.publicKey).toLowerCase()).toBe(victim.popPoint.toLowerCase());
    });
    it('dvtNodeId == keccak256(publicKey) == buildDvtPop nodeId', () => {
        expect(dvtNodeId(victim.publicKey)).toBe(keccak256(victim.publicKey));
        expect(dvtNodeId(victim.publicKey)).toBe(victim.nodeId);
    });
});

describe('verifyDvtPop', () => {
    it('accepts a valid PoP tuple (pairing holds, no secret key needed)', () => {
        expect(() => verifyDvtPop(victim)).not.toThrow();
    });
    it('rejects a popSig that is not sk·popPoint for the publicKey', () => {
        // victim's key + popPoint, but the attacker's popSig → pairing fails.
        expect(() => verifyDvtPop({ publicKey: victim.publicKey, popPoint: victim.popPoint, popSig: attacker.popSig }))
            .toThrow(/pairing check failed/);
    });
    it('rejects an off-curve / malformed G2 point', () => {
        const bad = ('0x' + '11'.repeat(256)) as `0x${string}`;
        expect(() => verifyDvtPop({ publicKey: victim.publicKey, popPoint: bad, popSig: victim.popSig })).toThrow();
    });
});

describe('kmsPopSigner', () => {
    it('returns a verified DvtPop with a locally-derived nodeId (by nodeId)', async () => {
        const fetchImpl = mkFetch({ publicKey: victim.publicKey, popPoint: victim.popPoint, popSig: victim.popSig });
        const pop = await kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, fetchImpl })();
        expect(pop.publicKey.toLowerCase()).toBe(victim.publicKey.toLowerCase());
        expect(pop.popSig.toLowerCase()).toBe(victim.popSig.toLowerCase());
        expect(pop.nodeId).toBe(victim.nodeId);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://board:3100/pop');
        expect(JSON.parse(init.body as string)).toEqual({ node_id: 'n1' });
    });

    it('by publicKey: pins the key and accepts a matching response', async () => {
        const fetchImpl = mkFetch({ publicKey: victim.publicKey, popPoint: victim.popPoint, popSig: victim.popSig });
        const pop = await kmsPopSigner({ url: 'http://board:3100', publicKey: victim.publicKey, fetchImpl })();
        expect(pop.nodeId).toBe(victim.nodeId);
        const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(JSON.parse(init.body as string)).toEqual({ publicKey: victim.publicKey });
    });

    it('SECURITY: rejects a substituted key — pinned victim key, KMS returns a self-consistent attacker tuple', async () => {
        // The attacker tuple is internally valid (its popSig = sk·popPoint, pairing passes) — the ONLY thing
        // that stops registration of the wrong node is pinning the expected publicKey.
        const fetchImpl = mkFetch({ publicKey: attacker.publicKey, popPoint: attacker.popPoint, popSig: attacker.popSig });
        await expect(kmsPopSigner({ url: 'http://board:3100', publicKey: victim.publicKey, fetchImpl })()).rejects.toThrow(
            /different publicKey than the one pinned/,
        );
    });

    it('rejects a popPoint that is not hashToCurve(publicKey, BLS_POP_DST)', async () => {
        const last = victim.popPoint.slice(-1);
        const tampered = victim.popPoint.slice(0, -1) + (last === '0' ? '1' : '0');
        const fetchImpl = mkFetch({ publicKey: victim.publicKey, popPoint: tampered, popSig: victim.popSig });
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, fetchImpl })()).rejects.toThrow(
            /popPoint != hashToCurve/,
        );
    });

    it('rejects a bad popSig via the pairing check (before any stake)', async () => {
        // victim key + victim popPoint (passes the popPoint convention check) but attacker's popSig.
        const fetchImpl = mkFetch({ publicKey: victim.publicKey, popPoint: victim.popPoint, popSig: attacker.popSig });
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, fetchImpl })()).rejects.toThrow(
            /pairing check failed/,
        );
    });

    it('throws on an HTTP error from KMS', async () => {
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, fetchImpl: mkFetch({}, false, 503) })())
            .rejects.toThrow(/HTTP 503/);
    });

    it('throws on an incomplete /pop response', async () => {
        await expect(kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, fetchImpl: mkFetch({ publicKey: victim.publicKey }) })())
            .rejects.toThrow(/missing/);
    });

    it('requires a url and a nodeId or publicKey', () => {
        expect(() => kmsPopSigner({ url: '', nodeId: 'n1', allowUnpinnedKmsKey: true })).toThrow(/url is required/);
        expect(() => kmsPopSigner({ url: 'http://board:3100' })).toThrow(/nodeId and\/or publicKey/);
    });

    it('SECURITY: nodeId-only without a pinned publicKey is refused unless explicitly opted in', () => {
        // Default (safe): addressing by nodeId with no expected key throws rather than trusting the KMS.
        expect(() => kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1' })).toThrow(/allowUnpinnedKmsKey/);
        // Explicit opt-in is allowed (only for a KMS you fully control).
        expect(() => kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true })).not.toThrow();
    });

    it('sends X-Signer-Token when provided', async () => {
        const fetchImpl = mkFetch({ publicKey: victim.publicKey, popPoint: victim.popPoint, popSig: victim.popSig });
        await kmsPopSigner({ url: 'http://board:3100', nodeId: 'n1', allowUnpinnedKmsKey: true, token: 'tok', fetchImpl })();
        const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.headers).toMatchObject({ 'X-Signer-Token': 'tok' });
    });
});
