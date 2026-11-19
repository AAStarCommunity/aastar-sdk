import { describe, expect, it } from 'vitest';
import { createPublicClient, custom, decodeEventLog, encodeAbiParameters, encodeEventTopics } from 'viem';
import { SuperPaymasterABI, SuperPaymasterV542ABI, SuperPaymasterV550ABI } from './index.js';

// The default ABI switched to 5.5.0 (SP 5.5.0 cutover). That is only safe for callers that still
// talk to — or decode history from — 5.4.2 if the 5.5.0 union is a strict superset apart from the
// functions 5.5.0 deliberately removed. A shared selector whose OUTPUTS changed would decode
// silently wrong (the guardianSlashCases lesson), so outputs are compared too.
const REMOVED_IN_550 = ['clearPendingDebt', 'dryRunValidation', 'pendingDebts', 'retryPendingDebt'].sort();
// rc.8 (SP #627) appended the caller to eight events, and a pause/unpause reason: same name, new topic0. A 5.4.2 log
// of these decodes only with SuperPaymasterV542ABI.
const EXTENDED_IN_RC8: Record<string, string[]> = {
    OperatorPaused: ['by', 'reason'], OperatorUnpaused: ['by', 'reason'], OperatorSlashed: ['by'], PriceModeChanged: ['by'],
    PriceUpdated: ['by'], ReputationUpdated: ['by'], SlashCancelled: ['by'], SlashQueued: ['by'],
};

const render = (t: any): string =>
    typeof t.type === 'string' && t.type.startsWith('tuple')
        ? `(${t.components.map(render).join(',')})${t.type.slice('tuple'.length)}`
        : t.type;
const key = (e: any) => `${e.type}:${e.name}(${(e.inputs ?? []).map((i: any) => render(i) + (i.indexed ? ' indexed' : '')).join(',')})`;
const outs = (e: any) => `(${(e.outputs ?? []).map(render).join(',')})`;
const entries = (abi: readonly any[], kinds: string[]) => abi.filter((e) => kinds.includes(e.type));

describe('SuperPaymaster default ABI = 5.5.0, compatible with 5.4.2', () => {
    it('the default export is exactly the eight changed 5.4.2 event forms, then the 5.5.0 union', () => {
        const n = SuperPaymasterABI.length - SuperPaymasterV550ABI.length;
        expect(SuperPaymasterABI.slice(n)).toEqual(SuperPaymasterV550ABI);
        const extra = SuperPaymasterABI.slice(0, n);
        expect(extra.map((e: any) => e.name).sort()).toEqual(Object.keys(EXTENDED_IN_RC8).sort());
        for (const e of extra) expect(SuperPaymasterV542ABI).toContainEqual(e);
    });

    it('a filter by eventName on the default ABI keeps the 5.4.2 topic for all eight (5.4.2 users unchanged); V550 gives rc.8', () => {
        for (const name of Object.keys(EXTENDED_IN_RC8)) {
            const def = encodeEventTopics({ abi: SuperPaymasterABI, eventName: name } as any)[0];
            expect(def, name).toBe(encodeEventTopics({ abi: SuperPaymasterV542ABI, eventName: name } as any)[0]);
            expect(encodeEventTopics({ abi: SuperPaymasterV550ABI, eventName: name } as any)[0], name).not.toBe(def);
        }
    });

    it('getContractEvents with the default ABI asks eth_getLogs for the 5.4.2 topic', async () => {
        const seen: any[] = [];
        const client = createPublicClient({ transport: custom({ async request({ method, params }: any) {
            if (method === 'eth_getLogs') { seen.push(params[0]); return []; }
            if (method === 'eth_blockNumber') return '0x10';
            throw new Error(method);
        } }) });
        await client.getContractEvents({ address: ('0x' + '11'.repeat(20)) as `0x${string}`, abi: SuperPaymasterABI as any, eventName: 'OperatorPaused', fromBlock: 1n, toBlock: 2n } as any);
        expect(seen[0].topics[0]).toBe(encodeEventTopics({ abi: SuperPaymasterV542ABI, eventName: 'OperatorPaused' } as any)[0]);
    });

    it('decodeEventLog with the default ABI decodes a 5.4.2 log and an rc.8 log of the same event', () => {
        const op = '0x' + '11'.repeat(20) as `0x${string}`, by = '0x' + '22'.repeat(20) as `0x${string}`;
        const old = { topics: encodeEventTopics({ abi: SuperPaymasterV542ABI, eventName: 'OperatorPaused', args: { operator: op } } as any), data: '0x' as `0x${string}` };
        const d1: any = decodeEventLog({ abi: SuperPaymasterABI, ...old } as any);
        expect(d1.eventName).toBe('OperatorPaused');
        expect(String(d1.args.operator).toLowerCase()).toBe(op);
        const nowTopics = encodeEventTopics({ abi: SuperPaymasterV550ABI, eventName: 'OperatorPaused', args: { operator: op, by } } as any);
        const d2: any = decodeEventLog({ abi: SuperPaymasterABI, topics: nowTopics, data: encodeAbiParameters([{ type: 'uint8' }], [3]) } as any);
        expect(String(d2.args.by).toLowerCase()).toBe(by);
        expect(Number(d2.args.reason)).toBe(3);
        expect(nowTopics[0]).not.toBe(old.topics[0]);
    });

    it('every 5.4.2 error, and every 5.4.2 event but the eight rc.8 extended, exists unchanged in 5.5.0', () => {
        const next = new Set(entries(SuperPaymasterV550ABI, ['event', 'error']).map(key));
        const missing = entries(SuperPaymasterV542ABI, ['event', 'error']).filter((e) => !next.has(key(e)));
        expect(missing.map((e: any) => `${e.type}:${e.name}`).sort()).toEqual(Object.keys(EXTENDED_IN_RC8).map((n) => `event:${n}`).sort());
    });

    it('each rc.8 extended event keeps the 5.4.2 inputs as a prefix and only appends the listed fields', () => {
        const old = new Map(entries(SuperPaymasterV542ABI, ['event']).map((e: any) => [e.name, e]));
        for (const [name, added] of Object.entries(EXTENDED_IN_RC8)) {
            const now: any = entries(SuperPaymasterV550ABI, ['event']).find((e: any) => e.name === name);
            const was: any = old.get(name);
            const sig = (i: any) => `${render(i)}${i.indexed ? ' indexed' : ''}`;
            expect(now.inputs.slice(0, was.inputs.length).map(sig), name).toEqual(was.inputs.map(sig));
            expect(now.inputs.slice(was.inputs.length).map((i: any) => i.name), name).toEqual(added);
        }
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
