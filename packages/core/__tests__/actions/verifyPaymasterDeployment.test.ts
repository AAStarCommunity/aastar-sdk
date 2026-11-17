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
    const readContract = vi.fn(async ({ functionName, address }: any) => {
        if (functionName === 'getPaymasterByOperator') return opts.byOperator ?? PM;
        if (functionName === 'getOperatorByPaymaster') return opts.byPaymaster ?? OPERATOR;
        if (functionName === 'owner') {
            if (address === PM || address === PM2) return opts.owner ?? OPERATOR;
        }
        throw new Error(`unexpected read ${functionName} on ${address}`);
    });
    const waitForTransactionReceipt = vi.fn(async () => ({ status: opts.status ?? 'success', logs: opts.logs ?? [deployedLog(OPERATOR, PM)] }));
    return { client: { readContract, waitForTransactionReceipt } as any, readContract, waitForTransactionReceipt };
}

describe('verifyPaymasterDeployment', () => {
    it('returns the paymaster from the receipt once the mapping and owner() both name the operator', async () => {
        const { client, readContract } = fakeClient({});
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR, deployHash: TX })).resolves.toBe(PM);
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: PM, functionName: 'owner' }));
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
        const stolen = fakeClient({ owner: OTHER });
        await expect(verifyPaymasterDeployment(stolen.client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow(`owner() is ${OTHER}`);
    });

    it('without a deploy hash: no paymaster in the mapping throws', async () => {
        const { client } = fakeClient({ byOperator: zeroAddress });
        await expect(verifyPaymasterDeployment(client, { factory: FACTORY, operator: OPERATOR })).rejects.toThrow('has no paymaster');
    });
});
