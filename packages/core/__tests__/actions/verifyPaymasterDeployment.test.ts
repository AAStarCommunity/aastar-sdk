import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionResult, getAddress, type Abi, type Address, type Hash, type Hex, zeroAddress } from 'viem';
import { verifyPaymasterDeployment } from '../../src/actions/factory';
import { PaymasterABI, PaymasterFactoryABI } from '../../src/abis/index';

const FACTORY = '0x1111111111111111111111111111111111111111' as Address;
const OPERATOR = '0x2222222222222222222222222222222222222222' as Address;
const OTHER = '0x3333333333333333333333333333333333333333' as Address;
const PM = '0x4444444444444444444444444444444444444444' as Address;
const PM2 = '0x5555555555555555555555555555555555555555' as Address;
const TX = ('0x' + 'ab'.repeat(32)) as Hash;
const RECEIPT_BLOCK = 100n;
const RECEIPT_HASH = ('0x' + 'b1'.repeat(32)) as Hash;
const LATEST_BLOCK = 200n;
const LATEST_HASH = ('0x' + 'c2'.repeat(32)) as Hash;
const lc = (a: string) => a.toLowerCase();

// A PaymasterDeployed log encoded with the vendored ABI, so the test also pins the event shape.
function deployedLog(operator: Address, paymaster: Address, emitter: Address = FACTORY) {
    return {
        address: emitter,
        topics: encodeEventTopics({ abi: PaymasterFactoryABI, eventName: 'PaymasterDeployed', args: { operator, paymaster } }),
        data: encodeAbiParameters([{ type: 'string' }, { type: 'uint256' }], ['v4.2', 1n]),
        blockHash: TX, blockNumber: 1n, logIndex: 0, transactionHash: TX, transactionIndex: 0, removed: false,
    };
}

function fakeClient(opts: {
    operator?: Address;
    paymaster?: Address; // the paymaster this scenario deployed; reads on any other one throw
    status?: 'success' | 'reverted';
    logs?: ReturnType<typeof deployedLog>[];
    byOperator?: Address;
    byPaymaster?: Address;
    owner?: Address;
    hashAfter?: Hash; // the block hash read back after the checks
    readError?: Error;
    ownerRaw?: Hex; // raw eth_call result for owner(), e.g. '0x' when the paymaster has no code
}) {
    const operator = opts.operator ?? OPERATOR;
    const paymaster = opts.paymaster ?? PM;
    // Answers only the exact reads the check must make: the configured factory, this caller's entry, the reverse
    // entry and owner() of this scenario's paymaster, each pinned to a canonical block hash. Anything else throws.
    // `readContract` records each decoded eth_call; `request` is what the code under test calls.
    const readContract = vi.fn(async ({ functionName, address, args, block }: any) => {
        if (opts.readError) throw opts.readError;
        if (!block?.blockHash || block.requireCanonical !== true) throw new Error(`${functionName} read not pinned to a canonical block hash`);
        if (lc(address) === lc(FACTORY) && functionName === 'getPaymasterByOperator' && lc(args[0]) === lc(operator)) return opts.byOperator ?? paymaster;
        if (lc(address) === lc(FACTORY) && functionName === 'getOperatorByPaymaster' && lc(args[0]) === lc(paymaster)) return opts.byPaymaster ?? operator;
        if (lc(address) === lc(paymaster) && functionName === 'owner') return opts.owner ?? operator;
        throw new Error(`unexpected read ${functionName}(${args}) on ${address}`);
    });
    const waitForTransactionReceipt = vi.fn(async () => ({
        status: opts.status ?? 'success', blockNumber: RECEIPT_BLOCK, blockHash: RECEIPT_HASH,
        logs: opts.logs ?? [deployedLog(operator, paymaster)],
    }));
    const getBlock = vi.fn(async (args?: { blockNumber?: bigint }) => {
        if (args?.blockNumber === undefined) return { number: LATEST_BLOCK, hash: LATEST_HASH };
        if (opts.hashAfter) return { number: args.blockNumber, hash: opts.hashAfter };
        return { number: args.blockNumber, hash: args.blockNumber === RECEIPT_BLOCK ? RECEIPT_HASH : LATEST_HASH };
    });
    const request = vi.fn(async ({ method, params }: any) => {
        if (method !== 'eth_call') throw new Error(`unexpected RPC ${method}`);
        const [{ to, data }, block] = params;
        const abi = (lc(to) === lc(FACTORY) ? PaymasterFactoryABI : PaymasterABI) as Abi;
        const { functionName, args } = decodeFunctionData({ abi, data: data as Hex });
        const value = await readContract({ functionName, address: to, args: args ?? [], block });
        if (functionName === 'owner' && opts.ownerRaw !== undefined) return opts.ownerRaw;
        // ABI-encoded addresses carry no case: the code under test always decodes checksummed addresses.
        return encodeFunctionResult({ abi, functionName, result: typeof value === 'string' ? lc(value) : value } as any);
    });
    return { client: { request, waitForTransactionReceipt, getBlock } as any, readContract, waitForTransactionReceipt, getBlock };
}

describe('verifyPaymasterDeployment', () => {
    it('returns the paymaster from the receipt once the mapping and owner() both name the operator', async () => {
        const { client, readContract, waitForTransactionReceipt, getBlock } = fakeClient({});
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX, confirmations: 3 })).resolves.toBe(PM);
        expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: TX, confirmations: 3 }));
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: FACTORY, functionName: 'getPaymasterByOperator', args: [OPERATOR] }));
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: FACTORY, functionName: 'getOperatorByPaymaster', args: [PM] }));
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
        // All three reads are at the receipt's block, and that block's hash is read back afterwards.
        expect(readContract).toHaveBeenCalledTimes(3);
        for (const [call] of readContract.mock.calls) expect(call.block).toEqual({ blockHash: RECEIPT_HASH, requireCanonical: true });
        expect(getBlock).toHaveBeenCalledWith({ blockNumber: RECEIPT_BLOCK });
    });

    it('takes the paymaster from the log, not a fixed address', async () => {
        const { client } = fakeClient({ paymaster: PM2 });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).resolves.toBe(PM2);
    });

    it('addresses are compared case-insensitively', async () => {
        const op = getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdef0001');
        const pm = getAddress('0xfedcbafedcbafedcbafedcbafedcbafedcba0002');
        expect(op).not.toBe(lc(op));
        const { client } = fakeClient({ operator: op, paymaster: pm, owner: lc(op) as Address, byPaymaster: op.toUpperCase().replace('0X', '0x') as Address, byOperator: lc(pm) as Address });
        // Lowercase caller against the checksummed log and mixed-case reads.
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: lc(op) as Address, deployHash: TX })).resolves.toBe(pm);
        // Checksummed caller against the decoded (checksummed) reads, with the log and fixtures in other casings.
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: op, deployHash: TX })).resolves.toBe(pm);
    });

    it('owner() with no code or truncated data rejects with the block and deploy hash', async () => {
        for (const ownerRaw of ['0x', '0x1234'] as Hex[]) {
            const { client } = fakeClient({ ownerRaw });
            await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX }))
                .rejects.toThrow(`at block ${RECEIPT_BLOCK} ${RECEIPT_HASH} (deploy tx ${TX})`);
        }
    });

    it('a node that rejects the EIP-1898 block parameter fails the check', async () => {
        const { client } = fakeClient({ readError: new Error('invalid argument 1: hex string without 0x prefix') });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX }))
            .rejects.toThrow('support EIP-1898 block-hash calls (invalid argument 1');
    });

    it('a reorg at the checked height during the check throws', async () => {
        const { client } = fakeClient({ hashAfter: ('0x' + 'dd'.repeat(32)) as Hash });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow('during the check (reorg)');
    });

    it('a node that cannot serve the receipt block\'s state throws with the block and deploy hash', async () => {
        const { client } = fakeClient({ readError: new Error('missing trie node') });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX }))
            .rejects.toThrow(`at block ${RECEIPT_BLOCK} ${RECEIPT_HASH} (deploy tx ${TX}); the node may not serve that block's state or support EIP-1898 block-hash calls (missing trie node)`);
    });

    it('a reverted deploy throws before any read', async () => {
        const { client, readContract } = fakeClient({ status: 'reverted' });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow('reverted');
        expect(readContract).not.toHaveBeenCalled();
    });

    it('two PaymasterDeployed for the operator in one receipt throw', async () => {
        const { client } = fakeClient({ logs: [deployedLog(OPERATOR, PM), deployedLog(OPERATOR, PM2)] });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow('found 2');
    });

    it('a PaymasterDeployed whose operator is not the caller throws', async () => {
        const { client } = fakeClient({ logs: [deployedLog(OTHER, PM)] });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow('found 0');
    });

    it('a PaymasterDeployed emitted by another contract is not trusted', async () => {
        const { client } = fakeClient({ logs: [deployedLog(OPERATOR, PM, OTHER)] });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow('found 0');
    });

    it('the factory mapping pointing elsewhere throws', async () => {
        const { client } = fakeClient({ byOperator: PM2 });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow(`maps ${OPERATOR} to ${PM2}`);
    });

    it('the reverse mapping naming another operator throws', async () => {
        const { client } = fakeClient({ byPaymaster: OTHER });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow(`to operator ${OTHER}`);
    });

    it('a clone owned by someone else throws', async () => {
        const { client } = fakeClient({ owner: OTHER });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).rejects.toThrow(`owner() is ${OTHER}`);
    });

    it('without a deploy hash: an earlier deploy is checked the same way', async () => {
        const ok = fakeClient({});
        // `confirmations` applies only to a deploy receipt: a reused deploy is checked at latest without waiting.
        await expect(verifyPaymasterDeployment(ok.client, { factory: FACTORY, operator: OPERATOR, confirmations: 12 })).resolves.toBe(PM);
        expect(ok.waitForTransactionReceipt).not.toHaveBeenCalled();
        // One latest block, read once, pins the mapping lookup and all three checks; its hash is read back afterwards.
        expect(ok.readContract).toHaveBeenCalledTimes(4);
        for (const [call] of ok.readContract.mock.calls) expect(call.block).toEqual({ blockHash: LATEST_HASH, requireCanonical: true });
        expect(ok.getBlock).toHaveBeenCalledWith({ blockNumber: LATEST_BLOCK });
        const stolen = fakeClient({ owner: OTHER });
        await expect(verifyPaymasterDeployment(stolen.client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow(`owner() is ${OTHER}`);
    });

    it('without a deploy hash: no paymaster in the mapping throws', async () => {
        const { client } = fakeClient({ byOperator: zeroAddress });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow('has no paymaster');
    });
});
