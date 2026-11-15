/**
 * Every write action exported by @aastar/core must at least encode: the function it names exists in the ABI it
 * passes, and viem can encode the arguments it builds. Inputs come from each action's declared parameter types
 * (see harness.ts); nothing about the action is mocked. Only the client is a recorder.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as actions from '../../packages/core/src/actions/index';
import { ADDR, MARKER, drive, encodeCaptured, synthesizeInputs, type MethodResult } from './harness';

const DIR = path.resolve(__dirname, '../../packages/core/src/actions');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => path.join(DIR, f));
const SIG65 = `0x${'11'.repeat(65)}`;

/** Writes whose synthesized inputs cannot pass the action's own checks. Valid-shaped inputs instead. */
const OVERRIDES: Record<string, Record<string, unknown[]>> = {
    dvtOperatorActions: {
        register: [{ blsSecretKey: `0x${'00'.repeat(31)}01` }],
        registerWithProof: [{ publicKey: `0x${'01'.repeat(128)}`, popPoint: `0x${'02'.repeat(256)}`, popSig: `0x${'03'.repeat(256)}` }],
    },
    airAccountExtensionActions: {
        addP256GuardianWithMixedSigs: [{ x: `0x${'aa'.repeat(32)}`, y: `0x${'bb'.repeat(32)}`, signerIdxs: [0, 1], sigs: [SIG65, SIG65] }],
        addGuardianWithMixedSigs: [{ guardian: ADDR, signerIdxs: [0, 1], sigs: [SIG65, SIG65] }],
        removeGuardianWithMixedSigs: [{ index: 1, signerIdxs: [0, 1], sigs: [SIG65, SIG65] }],
        modifyTierLimitsWithMixedGuardians: [{ tier1: 1n, tier2: 2n, deadline: 1n, signerIdxs: [0, 1], sigs: [SIG65, SIG65] }],
    },
};

/**
 * Known not to encode on this branch. Each entry must still fail: fixing one without removing it here is red too.
 * Tracked in docs/agent/followups.md (FU-106).
 */
export const KNOWN_UNENCODABLE: Record<string, string> = {
    'registryActions.setReputationSource': 'sends [source]; ABI is setReputationSource(address source, bool active)',
    'superPaymasterActions.updatePriceDVT': 'sends 3 args; SP 5.4.2 ABI adds uint8 chainlinkRecovered',
    'x402Actions.settleX402Payment': 'sends 8 args without maxFee; ABI takes (from,to,asset,amount,maxFee,validAfter,validBefore,salt,signature)',
    'x402Actions.settleX402PaymentDirect': 'sends 5 args; ABI takes (from,to,asset,amount,maxFee,validBefore,nonce,signature)',
};

/** Read-only methods that the neutral read value cannot drive. They are not writes (checked by source review). */
const UNDRIVEN_READS = new Set([
    'registryActions.userRoles', 'paymasterActions.validatePaymasterUserOp', 'paymasterFactoryActions.calculateAddress',
    'aggregatorActions.guardianSlashCase',
]);

const TYPE_ALIASES = ['DVTActions', 'SBTActions', 'XPNTsFactoryActions', 'XPNTsTokenActions', 'GTokenActions', 'BLSAlgorithmActions', 'X402Actions'];

async function scan(): Promise<MethodResult[]> {
    const factories = Object.keys(actions).filter((k) => k.endsWith('Actions') && typeof (actions as any)[k] === 'function');
    const inputs = synthesizeInputs(FILES, factories.map((k) => k[0]!.toUpperCase() + k.slice(1)).concat(TYPE_ALIASES));
    const out: MethodResult[] = [];
    for (const k of factories) {
        const t = [...inputs.keys()].find((name) => name.toLowerCase() === k.toLowerCase());
        if (!t) throw new Error(`no Actions type found for ${k}`);
        const make = (client: any) => k === 'gTokenAuthorizationActions' ? (actions as any)[k](client) : (actions as any)[k](ADDR)(client);
        out.push(...await drive(k, make, inputs.get(t)!, OVERRIDES[k]));
    }
    return out;
}

describe('harness self-check', () => {
    const abi = [{
        type: 'function', name: 'f', stateMutability: 'nonpayable', outputs: [],
        inputs: [{ name: 'a', type: 'address' }, { name: 'b', type: 'bytes4' }, { name: 'c', type: 'bytes' }],
    }] as const;
    it('resizes the marker only for bytesN and rejects it where an address is expected', () => {
        expect(encodeCaptured({ abi, functionName: 'f', args: [ADDR, MARKER, MARKER] })).toEqual({ ok: true });
        expect(encodeCaptured({ abi, functionName: 'f', args: [MARKER, MARKER, MARKER] }).ok).toBe(false);
        expect(encodeCaptured({ abi, functionName: 'f', args: [ADDR, MARKER] }).error).toMatch(/arity 2 vs 3/);
        expect(encodeCaptured({ abi, functionName: 'g', args: [] }).error).toMatch(/not in the ABI/);
    });
});

describe('every @aastar/core write action encodes against the ABI it sends (no mock of the action)', () => {
    it('scans all factories', async () => {
        const results = await scan();
        if (process.env.REPORT_OUT) fs.writeFileSync(process.env.REPORT_OUT, JSON.stringify(results, null, 1));
        const id = (r: MethodResult) => `${r.factory}.${r.method}`;
        const writes = results.filter((r) => r.outcome.kind === 'write');
        expect(writes.length).toBeGreaterThan(250);
        const failing = writes.filter((r) => r.outcome.kind === 'write' && r.outcome.calls.some((c) => !c.ok)).map(id).sort();
        expect(failing).toEqual(Object.keys(KNOWN_UNENCODABLE).sort());
        const undriven = results.filter((r) => r.outcome.kind === 'undriven').map(id).sort();
        expect(undriven).toEqual([...UNDRIVEN_READS].sort());
    }, 300_000);
});
