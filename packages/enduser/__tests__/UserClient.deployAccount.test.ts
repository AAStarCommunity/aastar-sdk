import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, encodeFunctionResult, type Abi, type Address } from 'viem';
import { SimpleAccountFactoryABI, SimpleAccountABI } from '@aastar/core';
import { UserClient } from '../src/UserClient';

const V07_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as Address;
const V06_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address;
const EP_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const EP_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
const OWNER = '0x1111111111111111111111111111111111111111' as Address;
const AA = '0x2222222222222222222222222222222222222222' as Address;

const ALL = [...(SimpleAccountFactoryABI as any[]), ...(SimpleAccountABI as any[])] as Abi;
function client(chainId: number, implEntryPoint: Address = EP_V07) {
    const c: any = {
        account: { address: OWNER },
        chain: { id: chainId },
        getChainId: vi.fn(async () => chainId),
        getBlock: vi.fn(async () => ({ number: 1n, hash: '0x' + '11'.repeat(32) })),
        getCode: vi.fn(async () => '0x6080'),
        readContract: vi.fn(async ({ functionName }: any) => {
            if (functionName === 'accountImplementation') return '0x68641DE71cfEa5a5d0D29712449Ee254bb1400C2';
            if (functionName === 'entryPoint') return implEntryPoint;
            if (functionName === 'getAddress') return AA;
            throw new Error(`unexpected read ${functionName}`);
        }),
        writeContract: vi.fn(async () => '0xbeef'),
        waitForTransactionReceipt: vi.fn(async ({ hash }: any) => ({ status: 'success', blockNumber: 1n, blockHash: '0x' + '11'.repeat(32), transactionHash: hash })),
        getTransaction: vi.fn(async ({ hash }: any) => ({ hash, chainId })),
    };
    // The factory check reads through pinned raw eth_getCode / eth_call; answer them through the stubs above.
    c.request = vi.fn(async ({ method, params }: any) => {
        if (params[1]?.blockHash !== '0x' + '11'.repeat(32) || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
        if (method === 'eth_getCode') return c.getCode({ address: params[0] });
        const { functionName } = decodeFunctionData({ abi: ALL, data: params[0].data });
        return encodeFunctionResult({ abi: ALL, functionName, result: await c.readContract({ functionName, address: params[0].to }) } as any);
    });
    return c;
}

describe('UserClient.deployAccount — account factory', () => {
    it('defaults to the address book\'s v0.7 factory for the chain, not 0x9406…', async () => {
        const c = client(10);
        await UserClient.deployAccount(c, { owner: OWNER });
        expect(c.writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: V07_FACTORY }));
    });

    it('an explicit v0.6 factory is refused against the chain\'s v0.7 EntryPoint, and nothing is sent', async () => {
        const c = client(10, EP_V06);
        await expect(UserClient.deployAccount(c, { owner: OWNER, factoryAddress: V06_FACTORY })).rejects.toThrow(`builds accounts for EntryPoint ${EP_V06}`);
        expect(c.writeContract).not.toHaveBeenCalled();
    });

    it('passing an ABI no longer skips the check: a v0.6 factory with customAbi is still refused', async () => {
        const c = client(10, EP_V06);
        await expect(UserClient.deployAccount(c, { owner: OWNER, factoryAddress: V06_FACTORY, customAbi: [] as any })).rejects.toThrow('builds accounts for EntryPoint');
        expect(c.writeContract).not.toHaveBeenCalled();
    });

    it('a non-simple accountType without its own ABI is refused, not deployed unchecked as a SimpleAccount', async () => {
        const c = client(10, EP_V06);
        await expect(UserClient.deployAccount(c, { owner: OWNER, factoryAddress: V06_FACTORY, accountType: 'kernel' })).rejects.toThrow('needs its own customAbi');
        expect(c.writeContract).not.toHaveBeenCalled();
    });

    it('a signing client with no configured chain is refused', async () => {
        const c = client(10);
        delete c.chain;
        await expect(UserClient.deployAccount(c, { owner: OWNER })).rejects.toThrow('has no configured chain');
        expect(c.writeContract).not.toHaveBeenCalled();
    });

    it('a reader on another chain than the signer is refused', async () => {
        const c = client(10);
        const reader = client(11155111);
        await expect(UserClient.deployAccount(c, { owner: OWNER, publicClient: reader })).rejects.toThrow('signing client is on chain 10');
        expect(c.writeContract).not.toHaveBeenCalled();
    });

    it('the createAccount send is confirmed on the checked chain before returning', async () => {
        const c = client(10);
        c.waitForTransactionReceipt = vi.fn(async () => { throw new Error('timeout'); });
        await expect(UserClient.deployAccount(c, { owner: OWNER })).rejects.toThrow('may have been sent on another chain');
    });

    it('a cancelled or wrong-chain createAccount is not returned as deployed', async () => {
        const replaced = client(10);
        replaced.waitForTransactionReceipt = vi.fn(async () => ({ status: 'success', blockNumber: 1n, blockHash: '0x' + '11'.repeat(32), transactionHash: '0xother' }));
        await expect(UserClient.deployAccount(replaced, { owner: OWNER })).rejects.toThrow('was replaced or cancelled');
        const elsewhere = client(10);
        elsewhere.getTransaction = vi.fn(async ({ hash }: any) => ({ hash, chainId: 11155111 }));
        await expect(UserClient.deployAccount(elsewhere, { owner: OWNER })).rejects.toThrow('is signed for chain 11155111, not 10');
    });

    it('a chain outside the address book with no factory given throws', async () => {
        await expect(UserClient.deployAccount(client(8453), { owner: OWNER })).rejects.toThrow('no simpleAccountFactory for chain 8453');
    });
});
