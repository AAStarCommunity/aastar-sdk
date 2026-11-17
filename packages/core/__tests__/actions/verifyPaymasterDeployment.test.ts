import { describe, it, expect, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Address, type Hash, zeroAddress } from 'viem';
import { verifyPaymasterDeployment } from '../../src/actions/factory';
import { PaymasterFactoryABI } from '../../src/abis/index';

const FACTORY = '0x1111111111111111111111111111111111111111' as Address;
const OPERATOR = '0x2222222222222222222222222222222222222222' as Address;
const OTHER = '0x3333333333333333333333333333333333333333' as Address;
const PM = '0x4444444444444444444444444444444444444444' as Address;
const PM2 = '0x5555555555555555555555555555555555555555' as Address;
const TX = ('0x' + 'ab'.repeat(32)) as Hash;
const RECEIPT_BLOCK = 100n;
const LATEST_BLOCK = 200n;

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
    status?: 'success' | 'reverted';
    logs?: ReturnType<typeof deployedLog>[];
    byOperator?: Address;
    byPaymaster?: Address;
    owner?: Address;
}) {
    // Answers only the exact reads the check must make: the configured factory, the caller's own entries, and
    // owner() on the paymaster being checked. Anything else throws, so a wrong target or argument is caught.
    const readContract = vi.fn(async ({ functionName, address, args, blockNumber }: any) => {
        if (blockNumber === undefined) throw new Error(`${functionName} read without a pinned block`);
        if (address === FACTORY && functionName === 'getPaymasterByOperator' && args[0] === OPERATOR) return opts.byOperator ?? PM;
        if (address === FACTORY && functionName === 'getOperatorByPaymaster' && (args[0] === PM || args[0] === PM2)) return opts.byPaymaster ?? OPERATOR;
        if ((address === PM || address === PM2) && functionName === 'owner') return opts.owner ?? OPERATOR;
        throw new Error(`unexpected read ${functionName}(${args}) on ${address}`);
    });
    const waitForTransactionReceipt = vi.fn(async () => ({ status: opts.status ?? 'success', blockNumber: RECEIPT_BLOCK, logs: opts.logs ?? [deployedLog(OPERATOR, PM)] }));
    const getBlockNumber = vi.fn(async () => LATEST_BLOCK);
    return { client: { readContract, waitForTransactionReceipt, getBlockNumber } as any, readContract, waitForTransactionReceipt };
}

describe('verifyPaymasterDeployment', () => {
    it('returns the paymaster from the receipt once the mapping and owner() both name the operator', async () => {
        const { client, readContract, waitForTransactionReceipt } = fakeClient({});
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX, confirmations: 3 })).resolves.toBe(PM);
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
        expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: TX, confirmations: 3 }));
        // All three reads are at the receipt's block, so they describe one state.
        expect(readContract).toHaveBeenCalledTimes(3);
        for (const [call] of readContract.mock.calls) expect(call.blockNumber).toBe(RECEIPT_BLOCK);
    });

    it('addresses are compared case-insensitively', async () => {
        const { client } = fakeClient({ owner: OPERATOR.toLowerCase() as Address, byPaymaster: OPERATOR.toUpperCase().replace('0X', '0x') as Address });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).resolves.toBe(PM);
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
        await expect(verifyPaymasterDeployment(ok.client, { factory: FACTORY, operator: OPERATOR })).resolves.toBe(PM);
        expect(ok.waitForTransactionReceipt).not.toHaveBeenCalled();
        // One latest block number, read once, pins the mapping lookup and all three checks.
        expect(ok.readContract).toHaveBeenCalledTimes(4);
        for (const [call] of ok.readContract.mock.calls) expect(call.blockNumber).toBe(LATEST_BLOCK);
        const stolen = fakeClient({ owner: OTHER });
        await expect(verifyPaymasterDeployment(stolen.client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow(`owner() is ${OTHER}`);
    });

    it('without a deploy hash: no paymaster in the mapping throws', async () => {
        const { client } = fakeClient({ byOperator: zeroAddress });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow('has no paymaster');
    });
});
