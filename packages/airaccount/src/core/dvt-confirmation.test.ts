import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDvtConfirmationStatus, pollDvtConfirmation } from './dvt-confirmation.js';

const NODE = 'https://dvt1.aastar.io';
const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`; // valid 0x+64hex userOpHash

afterEach(() => vi.unstubAllGlobals());

const okJson = (body: any) => vi.fn(async () => ({ ok: true, json: async () => body }));

describe('dvt out-of-band confirmation poll (#124 / #190 fixes)', () => {
  it('getDvtConfirmationStatus reads GET /signature/confirmation/:hash', async () => {
    const fetchMock = okJson({ status: 'pending', expiresAt: 123 });
    vi.stubGlobal('fetch', fetchMock);
    const s = await getDvtConfirmationStatus(NODE, HASH);
    expect(s).toEqual({ userOpHash: HASH, status: 'pending', expiresAt: 123 });
    expect(fetchMock.mock.calls[0][0]).toBe(`${NODE}/signature/confirmation/${HASH}`);
  });

  it('rejects an invalid userOpHash before hitting the network (#190 B — path injection)', async () => {
    const fetchMock = okJson({ status: 'pending', expiresAt: 1 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(getDvtConfirmationStatus(NODE, '0xabc' as any)).rejects.toThrow(/invalid userOpHash/);
    await expect(getDvtConfirmationStatus(NODE, '../../evil' as any)).rejects.toThrow(/invalid userOpHash/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a per-request timeout signal to fetch (#190 residual)', async () => {
    const fetchMock = okJson({ status: 'pending', expiresAt: 1 });
    vi.stubGlobal('fetch', fetchMock);
    await getDvtConfirmationStatus(NODE, HASH, undefined, 5000);
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.signal).toBeInstanceOf(AbortSignal); // a hung node read will abort, not stall the poll
  });

  it('keeps the per-request timeout even without AbortSignal.any (#195 A — old browsers)', async () => {
    const fetchMock = okJson({ status: 'pending', expiresAt: 1 });
    vi.stubGlobal('fetch', fetchMock);
    const orig = (AbortSignal as any).any;
    (AbortSignal as any).any = undefined; // simulate Safari <17.4 / Chrome <116
    try {
      await getDvtConfirmationStatus(NODE, HASH, new AbortController().signal, 5000);
      const init = fetchMock.mock.calls[0][1] as any;
      expect(init.signal).toBeInstanceOf(AbortSignal); // fallback still wires a (timeout-bearing) signal
    } finally {
      (AbortSignal as any).any = orig;
    }
  });

  it('throws on a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(getDvtConfirmationStatus(NODE, HASH)).rejects.toThrow(/500/);
  });

  it('polls until approved', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: n++ === 0 ? 'pending' : 'approved', expiresAt: 1 }) })));
    const seen: string[] = [];
    const final = await pollDvtConfirmation(NODE, HASH, { intervalMs: 1, onStatus: (s) => seen.push(s.status) });
    expect(final.status).toBe('approved');
    expect(seen).toEqual(['pending', 'approved']);
  });

  it('a transient error does NOT end the window — keeps polling (#190 A)', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      n++;
      if (n === 1) throw new Error('ECONNRESET'); // transient blip on the first read
      return { ok: true, json: async () => ({ status: 'approved', expiresAt: 1 }) };
    }));
    const errors: unknown[] = [];
    const final = await pollDvtConfirmation(NODE, HASH, { intervalMs: 1, onError: (e) => errors.push(e) });
    expect(final.status).toBe('approved'); // recovered after the blip
    expect(errors.length).toBe(1);
  });

  it('aborts promptly with an AbortError when the signal fires (#190 C)', async () => {
    vi.stubGlobal('fetch', okJson({ status: 'pending', expiresAt: 1 }));
    const ac = new AbortController();
    ac.abort();
    await expect(pollDvtConfirmation(NODE, HASH, { intervalMs: 1, signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('stops on a terminal expired', async () => {
    vi.stubGlobal('fetch', okJson({ status: 'expired', expiresAt: 0 }));
    const final = await pollDvtConfirmation(NODE, HASH, { intervalMs: 1 });
    expect(final.status).toBe('expired');
  });
});
