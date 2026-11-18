import { describe, it, expect, vi } from 'vitest';
import { custom, decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionData, encodeFunctionResult, type Abi, type Address, type Hash, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { PaymasterABI, PaymasterFactoryABI } from '@aastar/core';
import { createOperatorClient } from '../src/clients/operator';

const OPERATOR = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x8888888888888888888888888888888888888888' as Address;
const FACTORY = '0x7777777777777777777777777777777777777777' as Address;
const PM = '0x4444444444444444444444444444444444444444' as Address;
const TX = ('0x' + 'cd'.repeat(32)) as Hash;
const BLOCK_HASH = ('0x' + 'e1'.repeat(32)) as Hash;
const FEED = '0x694AA1769357215DE4FAC081bf1f309aDC325306' as Address; // Sepolia ETH/USD (the client is on Sepolia)
const NO_CODE_FEED = '0x13e3Ee699D1909E989722E753853AE30b17e08c5' as Address; // OP Mainnet's feed: no code on Sepolia here
const NOW = BigInt(Math.floor(Date.now() / 1000));
const AGG = [
    { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
    { type: 'function', name: 'description', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
    { type: 'function', name: 'latestRoundData', inputs: [], outputs: [{ type: 'uint80' }, { type: 'int256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint80' }], stateMutability: 'view' },
] as const;
const initFor = (feed: Address, staleness = 3600n) => encodeFunctionData({
    abi: PaymasterABI, functionName: 'initialize',
    args: [OPERATOR, OPERATOR, OPERATOR, feed, 200n, 10n ** 17n, staleness],
});

// No request may reach the network: every chain call below is stubbed on the client itself.
const transport = custom({ request: async ({ method }) => { throw new Error(`unexpected RPC ${method}`); } });

function operatorClient(owner: Address) {
    const oc: any = createOperatorClient({
        chain: sepolia,
        transport,
        account: { address: OPERATOR, type: 'local' } as any,
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
    oc.getChainId = vi.fn(async () => sepolia.id);
    oc.getBlock = vi.fn(async (args?: any) => (args?.blockNumber === undefined
        ? { number: 200n, timestamp: NOW, hash: BLOCK_HASH }
        : { number: args.blockNumber, hash: BLOCK_HASH }));
    oc.getCode = vi.fn(async ({ address }: any) => (address.toLowerCase() === FEED.toLowerCase() ? '0x6080' : '0x'));
    // The check's reads are eth_calls pinned to the receipt's block hash; decode them and answer by function.
    oc.readContract = vi.fn(async ({ functionName }: any) => {
        if (functionName === 'getPaymasterByOperator') return PM;
        if (functionName === 'getOperatorByPaymaster') return OPERATOR;
        if (functionName === 'owner') return owner;
        if (functionName === 'decimals') return 8;
        if (functionName === 'description') return 'ETH / USD';
        if (functionName === 'latestRoundData') return [1n, 3_000_00000000n, NOW - 60n, NOW - 60n, 1n];
        throw new Error(`unexpected read ${functionName}`);
    });
    oc.request = vi.fn(async ({ method, params }: any) => {
        const block = params[1];
        if (block?.blockHash !== BLOCK_HASH || block.requireCanonical !== true) throw new Error(`${method} not pinned to the checked block`);
        if (method === 'eth_getCode') return oc.getCode({ address: params[0] });
        if (method !== 'eth_call') throw new Error(`unexpected RPC ${method}`);
        const [{ to, data }] = params;
        const abi = (to.toLowerCase() === FACTORY.toLowerCase() ? PaymasterFactoryABI
            : [FEED, NO_CODE_FEED].some((f) => f.toLowerCase() === to.toLowerCase()) ? AGG : PaymasterABI) as Abi;
        const { functionName, args } = decodeFunctionData({ abi, data: data as Hex });
        const value = await oc.readContract({ address: to, functionName, args });
        return encodeFunctionResult({ abi, functionName, result: value } as any);
    });
    return oc;
}

describe('createOperatorClient().deployPaymasterV4', () => {
    it('returns the deploy hash once the receipt, mapping and owner() name the account', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED) })).resolves.toBe(TX);
        expect(oc.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
    });

    it('forwards confirmations to the receipt wait', async () => {
        const oc = operatorClient(OPERATOR);
        await oc.deployPaymasterV4({ initData: initFor(FEED), confirmations: 5 });
        expect(oc.waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: TX, confirmations: 5 }));
    });

    it('throws when the deployed clone is owned by someone else', async () => {
        const oc = operatorClient(OTHER);
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED) })).rejects.toThrow(`owner() is ${OTHER}`);
    });
});

describe('createOperatorClient().deployPaymasterV4 — the price feed inside initData is checked before sending', () => {
    it('a feed with no code on this chain sends nothing', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4({ initData: initFor(NO_CODE_FEED) })).rejects.toThrow('has no code on this chain');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('initData that is not initialize() (including the old default 0x) sends nothing', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4()).rejects.toThrow('not a PaymasterV4 initialize() call');
        await expect(oc.deployPaymasterV4({ initData: '0xdeadbeef' })).rejects.toThrow('not a PaymasterV4 initialize() call');
        // Decodable, but another function of the same ABI.
        const notInit = encodeFunctionData({ abi: PaymasterABI, functionName: 'owner', args: [] });
        await expect(oc.deployPaymasterV4({ initData: notInit })).rejects.toThrow('not initialize() but owner()');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('the feed is held to the staleness threshold the initData itself sets', async () => {
        const oc = operatorClient(OPERATOR);
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED, 30n) })).rejects.toThrow('max age 30s');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('an RPC on another chain than the client\'s sends nothing', async () => {
        const oc = operatorClient(OPERATOR);
        oc.getChainId = vi.fn(async () => 10);
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED) })).rejects.toThrow('the RPC is on chain 10');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });
});

describe('createOperatorClient().deployPaymasterV4 — signer and post-send confirmation', () => {
    it('a JSON-RPC signer is refused by default and accepted with allowJsonRpcAccount', async () => {
        const oc: any = createOperatorClient({ chain: sepolia, transport, account: { address: OPERATOR, type: 'json-rpc' } as any, addresses: { paymasterFactory: FACTORY } });
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED) })).rejects.toThrow('allowJsonRpcAccount');
    });

    it('a deploy whose receipt is not on the checked chain stops before the ownership check', async () => {
        const oc = operatorClient(OPERATOR);
        oc.waitForTransactionReceipt = vi.fn(async () => { throw new Error('timeout'); });
        await expect(oc.deployPaymasterV4({ initData: initFor(FEED) })).rejects.toThrow('may have been sent on another chain');
        expect(oc.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_call', params: [expect.objectContaining({ to: FACTORY }), expect.anything()] }));
    });
});
