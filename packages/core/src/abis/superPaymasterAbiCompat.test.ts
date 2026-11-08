import { describe, expect, it } from 'vitest';
import { SuperPaymasterABI, SuperPaymasterV542ABI, SuperPaymasterV550ABI } from './index.js';

// The default ABI switched to 5.5.0 (SP 5.5.0 cutover). That is only safe for callers that still
// talk to — or decode history from — 5.4.2 if the 5.5.0 union is a strict superset apart from the
// functions 5.5.0 deliberately removed. A shared selector whose OUTPUTS changed would decode
// silently wrong (the guardianSlashCases lesson), so outputs are compared too.
const REMOVED_IN_550 = ['clearPendingDebt', 'dryRunValidation', 'pendingDebts', 'retryPendingDebt'].sort();

const render = (t: any): string =>
    typeof t.type === 'string' && t.type.startsWith('tuple')
        ? `(${t.components.map(render).join(',')})${t.type.slice('tuple'.length)}`
        : t.type;
const key = (e: any) => `${e.type}:${e.name}(${(e.inputs ?? []).map((i: any) => render(i) + (i.indexed ? ' indexed' : '')).join(',')})`;
const outs = (e: any) => `(${(e.outputs ?? []).map(render).join(',')})`;
const entries = (abi: readonly any[], kinds: string[]) => abi.filter((e) => kinds.includes(e.type));

describe('SuperPaymaster default ABI = 5.5.0, compatible with 5.4.2', () => {
    it('the default export IS the 5.5.0 union', () => {
        expect(SuperPaymasterABI).toBe(SuperPaymasterV550ABI);
    });

    it('every 5.4.2 event and error exists unchanged in 5.5.0', () => {
        const next = new Set(entries(SuperPaymasterV550ABI, ['event', 'error']).map(key));
        const missing = entries(SuperPaymasterV542ABI, ['event', 'error']).map(key).filter((k) => !next.has(k));
        expect(missing).toEqual([]);
    });

    it('5.4.2 functions missing from 5.5.0 are exactly the four removed ones', () => {
        const next = new Set(entries(SuperPaymasterV550ABI, ['function']).map((e: any) => e.name));
        const gone = [...new Set(entries(SuperPaymasterV542ABI, ['function']).map((e: any) => e.name))].filter((n) => !next.has(n)).sort();
        expect(gone).toEqual(REMOVED_IN_550);
    });

    it('no function present in both changed its outputs', () => {
        const next = new Map(entries(SuperPaymasterV550ABI, ['function']).map((e: any) => [key(e), outs(e)]));
        const changed = entries(SuperPaymasterV542ABI, ['function'])
            .filter((e: any) => next.has(key(e)) && next.get(key(e)) !== outs(e))
            .map((e: any) => `${key(e)} ${outs(e)} -> ${next.get(key(e))}`);
        expect(changed).toEqual([]);
    });
});
