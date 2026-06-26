import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDvtConfirmationStatus, pollDvtConfirmation } from './dvt-confirmation.js';

const NODE = 'https://dvt1.aastar.io';
const HASH = '0xabc';

afterEach(() => vi.unstubAllGlobals());

const okJson = (body: any) => vi.fn(async () => ({ ok: true, json: async () => body }));

describe('dvt out-of-band confirmation poll (#124)', () => {
  it('getDvtConfirmationStatus reads GET /signature/confirmation/:hash', async () => {
    const fetchMock = okJson({ status: 'pending', expiresAt: 123 });
    vi.stubGlobal('fetch', fetchMock);
    const s = await getDvtConfirmationStatus(NODE, HASH);
    expect(s).toEqual({ userOpHash: HASH, status: 'pending', expiresAt: 123 });
    expect(fetchMock.mock.calls[0][0]).toBe(`${NODE}/signature/confirmation/${HASH}`);
  });

  it('throws on a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(getDvtConfirmationStatus(NODE, HASH)).rejects.toThrow(/500/);
  });

  it('polls until approved (re-submit then)', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: n++ === 0 ? 'pending' : 'approved', expiresAt: 1 }) })));
    const seen: string[] = [];
    const final = await pollDvtConfirmation(NODE, HASH, { intervalMs: 1, onStatus: (s) => seen.push(s.status) });
    expect(final.status).toBe('approved');
    expect(seen).toEqual(['pending', 'approved']);
  });

  it('stops on a terminal expired without re-submit', async () => {
    vi.stubGlobal('fetch', okJson({ status: 'expired', expiresAt: 0 }));
    const final = await pollDvtConfirmation(NODE, HASH, { intervalMs: 1 });
    expect(final.status).toBe('expired');
  });
});
