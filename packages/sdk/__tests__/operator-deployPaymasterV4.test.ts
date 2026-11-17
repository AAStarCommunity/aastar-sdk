import { describe, it, expect, vi } from 'vitest';
import { custom, decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionResult, type Abi, type Address, type Hash, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { PaymasterABI, PaymasterFactoryABI } from '@aastar/core';
import { createOperatorClient } from '../src/clients/operator';

const OPERATOR = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x8888888888888888888888888888888888888888' as Address;
const FACTORY = '0x7777777777777777777777777777777777777777' as Address;
const PM = '0x4444444444444444444444444444444444444444' as Address;
const TX = ('0x' + 'cd'.repeat(32)) as Hash;
const BLOCK_HASH = ('0x' + 'e1'.repeat(32)) as Hash;

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
        blockHash: BLOCK_HASH,
        logs: [{
            address: FACTORY,
            topics: encodeEventTopics({ abi: PaymasterFactoryABI, eventName: 'PaymasterDeployed', args: { operator: OPERATOR, paymaster: PM } }),
            data: encodeAbiParameters([{ type: 'string' }, { type: 'uint256' }], ['v4.1', 1n]),
        }],
    }));
    oc.getBlock = vi.fn(async ({ blockNumber }: any) => ({ number: blockNumber, hash: BLOCK_HASH }));
    // The check's reads are eth_calls pinned to the receipt's block hash; decode them and answer by function.
    oc.readContract = vi.fn(async ({ functionName }: any) => {
        if (functionName === 'getPaymasterByOperator') return PM;
        if (functionName === 'getOperatorByPaymaster') return OPERATOR;
        if (functionName === 'owner') return owner;
        throw new Error(`unexpected read ${functionName}`);
    });
    oc.request = vi.fn(async ({ method, params }: any) => {
        if (method !== 'eth_call') throw new Error(`unexpected RPC ${method}`);
        const [{ to, data }, block] = params;
        if (block?.blockHash !== BLOCK_HASH || block.requireCanonical !== true) throw new Error('read not pinned to the receipt block');
        const abi = (to.toLowerCase() === FACTORY.toLowerCase() ? PaymasterFactoryABI : PaymasterABI) as Abi;
        const { functionName, args } = decodeFunctionData({ abi, data: data as Hex });
        const value = await oc.readContract({ address: to, functionName, args });
        return encodeFunctionResult({ abi, functionName, result: value } as any);
    });
    return oc;
}

describe('createOperatorClient().deployPaymasterV4', () => {
    it('returns the deploy hash once the receipt, mapping and owner() name the account', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4()).resolves.toBe(TX);
        expect(oc.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
    });

    it('forwards confirmations to the receipt wait', async () => {
        const oc = operatorClient(OPERATOR);
        await oc.deployPaymasterV4({ confirmations: 5 });
        expect(oc.waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: TX, confirmations: 5 }));
    });

    it('throws when the deployed clone is owned by someone else', async () => {
        const oc = operatorClient(OTHER);
        await expect(oc.deployPaymasterV4()).rejects.toThrow(`owner() is ${OTHER}`);
    });
});
