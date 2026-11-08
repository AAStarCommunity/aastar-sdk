import { describe, expect, it } from 'vitest';
import { createPublicClient, custom, encodeFunctionResult, toFunctionSelector, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { SuperPaymasterV542ABI } from '../abis/index.js';
import { superPaymasterActions } from './superPaymaster.js';

// The default SuperPaymasterABI is 5.5.0, which no longer has dryRunValidation / pendingDebts.
// These reads must still ENCODE against a 5.4.2 deployment — a mocked readContract would hide a
// missing ABI entry, so this goes through a real viem client and inspects the calldata it sends.
const SP = '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9' as Address;
const T = '0x3333333333333333333333333333333333333333' as Address;
const U = '0x5555555555555555555555555555555555555555' as Address;

function client(answer: (fn: string) => Hex) {
    const sent: Hex[] = [];
    const c = createPublicClient({
        chain: sepolia,
        transport: custom({
            request: async ({ method, params }: any) => {
                if (method !== 'eth_call') throw Object.assign(new Error(`unexpected ${method}`), { code: -32601 });
                const data = (params[0].data ?? params[0].input) as Hex;
                sent.push(data);
                return answer(data.slice(0, 10));
            },
        }, { retryCount: 0 }),
    });
    return { c, sent };
}

const userOp = {
    sender: U, nonce: 0n, initCode: '0x' as Hex, callData: '0x' as Hex,
    accountGasLimits: ('0x' + '00'.repeat(32)) as Hex, preVerificationGas: 0n,
    gasFees: ('0x' + '00'.repeat(32)) as Hex, paymasterAndData: '0x' as Hex, signature: '0x' as Hex,
};

describe('5.4.2-only SuperPaymaster reads still encode after the default ABI moved to 5.5.0', () => {
    it('dryRunValidation', async () => {
        const sel = toFunctionSelector((SuperPaymasterV542ABI as any[]).find((e) => e.name === 'dryRunValidation'));
        const { c, sent } = client(() => encodeFunctionResult({ abi: SuperPaymasterV542ABI as any, functionName: 'dryRunValidation', result: [true, '0x' + '00'.repeat(32)] as any }));
        const r = await superPaymasterActions(SP)(c as any).dryRunValidation({ userOp, maxCost: 1n });
        expect(sent[0].slice(0, 10)).toBe(sel);
        expect(r.ok).toBe(true);
    });

    it('pendingDebts', async () => {
        const sel = toFunctionSelector('function pendingDebts(address,address)');
        const { c, sent } = client(() => encodeFunctionResult({ abi: SuperPaymasterV542ABI as any, functionName: 'pendingDebts', result: 7n }));
        expect(await superPaymasterActions(SP)(c as any).pendingDebts({ token: T, user: U })).toBe(7n);
        expect(sent[0].slice(0, 10)).toBe(sel);
    });
});
