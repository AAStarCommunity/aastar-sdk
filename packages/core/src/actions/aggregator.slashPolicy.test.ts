import { describe, it, expect } from 'vitest';
import { aggregatorActions, SlashLevel } from './aggregator.js';

const ADDR = '0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13';

// Minimal mock PublicClient that records every readContract call and returns a
// caller-supplied value. Lets us assert the exact functionName/args the SDK sends
// on-chain (a real contract-coupled read must not silently drift from the ABI).
function mockClient(returns: (params: any) => unknown) {
    const calls: any[] = [];
    const client = {
        readContract: async (params: any) => {
            calls.push(params);
            return returns(params);
        },
    };
    return { client: client as any, calls };
}

describe('aggregatorActions slash-policy governance reads (CC-13 batch A)', () => {
    it('slashPolicyAdmin() reads the ABI-confirmed getter with no args', async () => {
        const admin = '0xb5600060e6de5E11D3636731964218E53caadf0E';
        const { client, calls } = mockClient(() => admin);
        const res = await aggregatorActions(ADDR)(client).slashPolicyAdmin();
        expect(res).toBe(admin);
        expect(calls[0].functionName).toBe('slashPolicyAdmin');
        expect(calls[0].address).toBe(ADDR);
        expect(calls[0].args).toEqual([]);
    });

    it('getSlashThreshold passes the numeric level and coerces uint8 → number', async () => {
        const { client, calls } = mockClient(() => 3);
        const res = await aggregatorActions(ADDR)(client).getSlashThreshold({ slashLevel: SlashLevel.MINOR });
        expect(res).toBe(3);
        expect(typeof res).toBe('number');
        expect(calls[0].functionName).toBe('slashThresholds');
        expect(calls[0].args).toEqual([1]); // MINOR === 1
    });

    it('getSlashThreshold accepts WARNING (level 0) without tripping the required-param guard', async () => {
        const { client, calls } = mockClient(() => 2);
        const res = await aggregatorActions(ADDR)(client).getSlashThreshold({ slashLevel: SlashLevel.WARNING });
        expect(res).toBe(2);
        expect(calls[0].args).toEqual([0]);
    });

    it('getSlashThresholds() reads all three levels (0/1/2) and labels them', async () => {
        const table: Record<number, number> = { 0: 2, 1: 3, 2: 3 };
        const { client, calls } = mockClient((p) => table[p.args[0]]);
        const res = await aggregatorActions(ADDR)(client).getSlashThresholds();
        expect(res).toEqual({ warning: 2, minor: 3, major: 3 });
        expect(calls.map((c) => c.args[0]).sort()).toEqual([0, 1, 2]);
        expect(calls.every((c) => c.functionName === 'slashThresholds')).toBe(true);
    });

    it('SlashLevel enum matches the on-chain uint8 mapping', () => {
        expect(SlashLevel.WARNING).toBe(0);
        expect(SlashLevel.MINOR).toBe(1);
        expect(SlashLevel.MAJOR).toBe(2);
    });
});
