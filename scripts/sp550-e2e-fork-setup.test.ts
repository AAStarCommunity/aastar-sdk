import { describe, it, expect } from 'vitest';
import { forkSetup, type ForkSetupInput } from './sp550-e2e-fork-setup.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;

/** A mocked chain: records every RPC request; reads answer from `state`. Nothing here can write. */
function chain(o: { client?: string; code?: string; predicted?: `0x${string}`; hasRole?: boolean; balance?: bigint; mode?: number } = {}) {
    const requests: string[] = [];
    const pub: any = {
        chain: undefined,
        request: async ({ method }: { method: string }) => { requests.push(method); return method === 'web3_clientVersion' ? (o.client ?? 'anvil/v1.7.1') : null; },
        getCode: async () => o.code ?? '0x6080',
        readContract: async ({ functionName }: { functionName: string }) => {
            switch (functionName) {
                case 'communityOwner': return A(0xc0);
                case 'getAddress': return o.predicted ?? A(0xacc);
                case 'hasRole': return o.hasRole ?? true;
                case 'balanceOf': return o.balance ?? 1n;
                case 'renewalMode': return o.mode ?? 0;
            }
            throw new Error(`unexpected read ${functionName}`);
        },
        waitForTransactionReceipt: async () => { throw new Error('no transaction may be sent in these tests'); },
    };
    const input: ForkSetupInput = {
        pub, rpcUrl: 'http://127.0.0.1:1', registry: A(0x1e), token: A(0x70), account: A(0xacc), owner: A(0x0e),
        roleEnduser: ('0x' + '11'.repeat(32)) as `0x${string}`, modeSpK: 0, simpleAccountFactory: A(0xfac), log: () => {},
    };
    return { input, requests };
}

describe('--fork-setup refuses before impersonating anything', () => {
    it('a node that is not anvil is refused (it would otherwise impersonate on a real chain)', async () => {
        const { input, requests } = chain({ client: 'Geth/v1.14.0' });
        await expect(forkSetup(input)).rejects.toThrow(/needs anvil; this RPC is "Geth\/v1\.14\.0"/);
        expect(requests).toEqual(['web3_clientVersion']);
    });
    it('an undeployed account whose factory prediction differs from the configured account is refused', async () => {
        const { input, requests } = chain({ code: '0x', predicted: A(0xbad) });
        await expect(forkSetup(input)).rejects.toThrow(/predicts 0x0000000000000000000000000000000000000BaD .*not the configured account/i);
        expect(requests).not.toContain('anvil_impersonateAccount');
    });
    it('an undeployed account with no factory given is refused', async () => {
        const { input } = chain({ code: '0x' });
        await expect(forkSetup({ ...input, simpleAccountFactory: undefined })).rejects.toThrow(/has no code and no simpleAccountFactory/);
    });
    it('a user already in the step-3 state needs no transaction at all', async () => {
        const { input, requests } = chain();
        await forkSetup(input);
        expect(requests.filter((m) => m === 'anvil_impersonateAccount')).toEqual([]);
    });
});
