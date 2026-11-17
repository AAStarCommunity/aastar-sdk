import { describe, it, expect, vi } from 'vitest';
import { custom, encodeAbiParameters, encodeEventTopics, type Address, type Hash } from 'viem';
import { sepolia } from 'viem/chains';
import { PaymasterFactoryABI } from '@aastar/core';
import { createOperatorClient } from '../src/clients/operator';

const OPERATOR = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x8888888888888888888888888888888888888888' as Address;
const FACTORY = '0x7777777777777777777777777777777777777777' as Address;
const PM = '0x4444444444444444444444444444444444444444' as Address;
const TX = ('0x' + 'cd'.repeat(32)) as Hash;

// No request may reach the network: every chain call below is stubbed on the client itself.
const transport = custom({ request: async ({ method }) => { throw new Error(`unexpected RPC ${method}`); } });

function operatorClient(owner: Address) {
    const oc: any = createOperatorClient({
        chain: sepolia,
        transport,
        account: { address: OPERATOR, type: 'json-rpc' } as any,
        addresses: { paymasterFactory: FACTORY },
    });
    oc.writeContract = vi.fn(async () => TX);
    oc.waitForTransactionReceipt = vi.fn(async () => ({
        status: 'success',
        blockNumber: 100n,
        logs: [{
            address: FACTORY,
            topics: encodeEventTopics({ abi: PaymasterFactoryABI, eventName: 'PaymasterDeployed', args: { operator: OPERATOR, paymaster: PM } }),
            data: encodeAbiParameters([{ type: 'string' }, { type: 'uint256' }], ['v4.1', 1n]),
        }],
    }));
    oc.readContract = vi.fn(async ({ functionName }: any) => {
        if (functionName === 'getPaymasterByOperator') return PM;
        if (functionName === 'getOperatorByPaymaster') return OPERATOR;
        if (functionName === 'owner') return owner;
        throw new Error(`unexpected read ${functionName}`);
    });
    return oc;
}

describe('createOperatorClient().deployPaymasterV4', () => {
    it('returns the deploy hash once the receipt, mapping and owner() name the account', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4()).resolves.toBe(TX);
        expect(oc.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
    });

    it('throws when the deployed clone is owned by someone else', async () => {
        const oc = operatorClient(OTHER);
        await expect(oc.deployPaymasterV4()).rejects.toThrow(`owner() is ${OTHER}`);
    });
});
