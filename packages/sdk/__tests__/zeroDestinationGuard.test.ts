import { describe, it, expect, vi } from 'vitest';
import { custom, zeroAddress, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { ZeroAddressDestinationError } from '@aastar/core';
import { createOperatorClient, createAdminClient, createEndUserClient, createCommunityClient } from '../src/index.js';

// anvil's public default mnemonic: a throwaway local signer, never funded anywhere.
const MNEMONIC = 'test test test test test test test test test test test junk';

/** A transport that answers the reads a local-account send needs and records every method it is asked for. */
function recording() {
    const methods: string[] = [];
    const transport = custom({
        async request({ method }: { method: string }) {
            methods.push(method);
            switch (method) {
                case 'eth_chainId': return '0x' + sepolia.id.toString(16);
                case 'eth_getTransactionCount': return '0x0';
                case 'eth_estimateGas': return '0x5208';
                case 'eth_maxPriorityFeePerGas': return '0x1';
                case 'eth_gasPrice': return '0x1';
                case 'eth_getBlockByNumber': return { baseFeePerGas: '0x1', number: '0x1', hash: '0x' + '11'.repeat(32), timestamp: '0x1' };
                case 'eth_sendRawTransaction': return '0x' + '22'.repeat(32);
                default: throw new Error(`unexpected ${method}`);
            }
        },
    });
    return { methods, transport };
}

const SENDS = ['eth_sendRawTransaction', 'eth_sendTransaction', 'eth_signTransaction'];

describe('client writes to a zero-address book entry are refused before signing (Codex r3 H1 on sepolia-rc8)', () => {
    it('OperatorClient.addDeposit with value, paymasterV4 declared absent (zero): ZeroAddressDestinationError, nothing signed or sent', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const sign = vi.spyOn(account, 'signTransaction');
        const client = createOperatorClient({ chain: sepolia, transport, account, addresses: { paymasterV4: zeroAddress } as Record<string, Address> });
        // The action wraps it (AAStarError), keeping the named error as its cause.
        const err: any = await (client as any).addDeposit({ value: 10n ** 18n, account }).catch((e: unknown) => e);
        expect(err instanceof ZeroAddressDestinationError || err?.cause instanceof ZeroAddressDestinationError).toBe(true);
        expect(sign).not.toHaveBeenCalled();
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });

    it('the same call to a deployed address goes through to the signer and the node (the guard is not a blanket refusal)', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client = createOperatorClient({ chain: sepolia, transport, account, addresses: { paymasterV4: '0x4444444444444444444444444444444444444444' } as Record<string, Address> });
        await (client as any).addDeposit({ value: 1n, account }).catch(() => undefined);
        expect(methods).toContain('eth_sendRawTransaction');
    });

    it.each([
        ['operator', createOperatorClient],
        ['admin', createAdminClient],
        ['endUser', createEndUserClient],
        ['community', createCommunityClient],
    ] as const)('%s client: writeContract / sendTransaction to address zero are refused', async (_n, make) => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client = (make as any)({ chain: sepolia, transport, account });
        await expect(client.writeContract({ address: zeroAddress, abi: [{ type: 'function', name: 'f', inputs: [], outputs: [], stateMutability: 'payable' }], functionName: 'f', value: 1n, account, chain: sepolia }))
            .rejects.toThrow(ZeroAddressDestinationError);
        await expect(client.sendTransaction({ to: zeroAddress, value: 1n, account, chain: sepolia })).rejects.toThrow(ZeroAddressDestinationError);
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });
});

describe('the inner call target and the admin DVT / BLS bindings (Codex r4 H2 / M4)', () => {
    it('EndUserClient.executeGasless with target = address zero: refused before the account is touched or anything signed', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const signMsg = vi.spyOn(account, 'signMessage');
        const client = createEndUserClient({ chain: sepolia, transport, account });
        await expect((client as any).executeGasless({ target: zeroAddress, data: '0x', value: 1n, operator: '0x4444444444444444444444444444444444444444' }))
            .rejects.toThrow(ZeroAddressDestinationError);
        expect(signMsg).not.toHaveBeenCalled();
        expect(methods).toEqual([]); // not even a read: the check is first
    });

    it('AdminClient binds dvtActions to the resolved dvtValidator (not a placeholder): the write goes to the selected pin', async () => {
        const { transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const dvt = '0x5555555555555555555555555555555555555555' as Address;
        const client: any = createAdminClient({ chain: sepolia, transport, account, addresses: { dvtValidator: dvt, blsAggregator: '0x6666666666666666666666666666666666666666' } as Record<string, Address> });
        const sent: string[] = [];
        const orig = client.writeContract;
        client.writeContract = (args: any) => { sent.push(args.address); return orig(args); };
        const err: any = await client.addValidator({ v: '0x7777777777777777777777777777777777777777', account }).catch((e: unknown) => e);
        expect(sent).toEqual([dvt]);
        expect(err instanceof ZeroAddressDestinationError || err?.cause instanceof ZeroAddressDestinationError).toBe(false);
    });
});

describe('batch and account-execution paths (Codex r6 M3 / H4)', () => {
    it('sendCalls with a zero destination: refused before any wallet request', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        await expect(client.sendCalls({ account, chain: sepolia, calls: [{ to: '0x1111111111111111111111111111111111111111', value: 0n }, { to: zeroAddress, value: 1n }] }))
            .rejects.toThrow(ZeroAddressDestinationError);
        expect(methods).toEqual([]);
    });

    it('account execute / executeBatch with a zero inner target: refused before signing (the outer call goes to the account)', async () => {
        const { accountActions } = await import('@aastar/core');
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createEndUserClient({ chain: sepolia, transport, account });
        const acct = accountActions('0x1111111111111111111111111111111111111111')(client);
        const named = (e: any) => e instanceof ZeroAddressDestinationError || e?.cause instanceof ZeroAddressDestinationError;
        expect(named(await acct.execute({ dest: zeroAddress, value: 1n, func: '0x', account }).catch((e: unknown) => e))).toBe(true);
        expect(named(await acct.executeBatch({ dest: ['0x2222222222222222222222222222222222222222', zeroAddress], value: [0n, 1n], func: ['0x', '0x'], account }).catch((e: unknown) => e))).toBe(true);
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });
});
