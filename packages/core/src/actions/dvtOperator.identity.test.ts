/**
 * The validator-identity getters (T1.2.2 · gap G14).
 *
 * All three were in the ABI and wrapped by nothing, so every caller that needed them either
 * hand-rolled an inline ABI (`dvt3-register.ts:91` reads `registry()` that way) or read them through
 * ethers in a sibling repo. That is not a style problem: a caller writing its own ABI fragment is a
 * second, unversioned copy of the interface, and it drifts silently.
 */
import { describe, expect, it } from 'vitest';
import { dvtOperatorActions } from './dvtOperator.js';
import { CANONICAL_ADDRESSES } from '../addresses.js';

// Read the canonical pin rather than a literal — a hardcoded address survives a canonical bump
// silently, which is the exact failure this whole feature is about.
const ADDR = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm as `0x${string}`;

function mockClient(returns: (params: any) => unknown) {
    const calls: any[] = [];
    return {
        client: { readContract: async (p: any) => { calls.push(p); return returns(p); } } as any,
        calls,
    };
}

function assertAbiFn(abi: any[], name: string, inputTypes: string[], outputTypes: string[]) {
    const entry = abi.find((e) => e?.type === 'function' && e?.name === name);
    expect(entry, `ABI missing function ${name}`).toBeTruthy();
    expect((entry.inputs ?? []).map((i: any) => i.type)).toEqual(inputTypes);
    expect((entry.outputs ?? []).map((o: any) => o.type)).toEqual(outputTypes);
}

describe('dvtOperatorActions validator identity (G14)', () => {
    it('owner() targets the validator and reads the ABI-confirmed getter', async () => {
        const owner = '0xb5600060e6de5E11D3636731964218E53caadf0E';
        const { client, calls } = mockClient(() => owner);
        expect(await dvtOperatorActions(ADDR)(client).owner()).toBe(owner);
        expect(calls[0].address).toBe(ADDR);
        expect(calls[0].functionName).toBe('owner');
        assertAbiFn(calls[0].abi, 'owner', [], ['address']);
    });

    it('registry() reads the validator’s linked Registry', async () => {
        const reg = '0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71';
        const { client, calls } = mockClient(() => reg);
        expect(await dvtOperatorActions(ADDR)(client).registry()).toBe(reg);
        expect(calls[0].functionName).toBe('registry');
        assertAbiFn(calls[0].abi, 'registry', [], ['address']);
    });

    it('roleDvt() reads the role id from chain rather than re-deriving it', async () => {
        // The point of reading it: an off-chain `keccak256("ROLE_DVT")` is a guess about how the
        // contract computes the id. If the contract ever changes that derivation, a local constant
        // keeps returning the old id and every stake check silently asks about the wrong role.
        const role = `0x${'ab'.repeat(32)}`;
        const { client, calls } = mockClient(() => role);
        expect(await dvtOperatorActions(ADDR)(client).roleDvt()).toBe(role);
        expect(calls[0].functionName).toBe('ROLE_DVT');
        assertAbiFn(calls[0].abi, 'ROLE_DVT', [], ['bytes32']);
    });

    it('the three do NOT share a function name — a copy-paste swap would be invisible on chain', async () => {
        // owner()/registry() both return an address with no arguments, so swapping their wrappers
        // produces a plausible value and no error anywhere. Pin the mapping.
        const seen: string[] = [];
        const { client } = mockClient((p) => { seen.push(p.functionName); return '0x0000000000000000000000000000000000000001'; });
        const a = dvtOperatorActions(ADDR)(client);
        await a.owner();
        await a.registry();
        expect(seen).toEqual(['owner', 'registry']);
    });
});
