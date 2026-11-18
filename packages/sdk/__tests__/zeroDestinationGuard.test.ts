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
