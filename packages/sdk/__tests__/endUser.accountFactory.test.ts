import { describe, it, expect, vi } from 'vitest';
import { custom, decodeFunctionData, encodeFunctionResult, type Abi, type Address } from 'viem';
import { SimpleAccountFactoryABI, SimpleAccountABI } from '@aastar/core';
import { sepolia } from 'viem/chains';
import { createEndUserClient } from '../src/clients/endUser';

const V07_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as Address;
const V06_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address;
const EP_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const EP_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
const IMPL = '0x68641DE71cfEa5a5d0D29712449Ee254bb1400C2' as Address;
const OWNER = '0x1111111111111111111111111111111111111111' as Address;
const AA = '0x2222222222222222222222222222222222222222' as Address;

// No request may reach the network: every chain call is stubbed on the client itself.
const transport = custom({ request: async ({ method }) => { throw new Error(`unexpected RPC ${method}`); } });

function client(addresses: Record<string, Address> = {}, implEntryPoint: Address = EP_V07, chain: any = sepolia) {
    const c: any = createEndUserClient({ chain, transport, account: { address: OWNER, type: 'json-rpc' } as any, addresses });
    c.getChainId = vi.fn(async () => chain.id);
    c.getBlock = vi.fn(async () => ({ number: 1n, hash: '0x' + '11'.repeat(32) }));
    // The factory check reads through pinned raw eth_getCode / eth_call; answer them through the stubs below.
    const ALL = [...(SimpleAccountFactoryABI as any[]), ...(SimpleAccountABI as any[])] as Abi;
    c.request = vi.fn(async ({ method, params }: any) => {
        if (params[1]?.blockHash !== '0x' + '11'.repeat(32) || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
        if (method === 'eth_getCode') return c.getCode({ address: params[0] });
        const { functionName } = decodeFunctionData({ abi: ALL, data: params[0].data });
        return encodeFunctionResult({ abi: ALL, functionName, result: await c.readContract({ functionName, address: params[0].to }) } as any);
    });
    c.getCode = vi.fn(async () => '0x6080');
    c.getBytecode = vi.fn(async () => undefined);
    c.readContract = vi.fn(async ({ functionName }: any) => {
        if (functionName === 'accountImplementation') return IMPL;
        if (functionName === 'entryPoint') return implEntryPoint;
        if (functionName === 'getAddress') return AA;
        throw new Error(`unexpected read ${functionName}`);
    });
    return c;
}

describe('createEndUserClient().createSmartAccount — account factory', () => {
    it('uses the address book\'s v0.7 factory, checked against the EntryPoint', async () => {
        const c = client();
        const { initCode } = await c.createSmartAccount({ owner: OWNER });
        expect(initCode.toLowerCase().startsWith(V07_FACTORY.toLowerCase())).toBe(true);
        expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: V07_FACTORY, functionName: 'accountImplementation' }));
    });

    it('a configured v0.6 factory is refused with the v0.7 EntryPoint, naming both', async () => {
        const c = client({ simpleAccountFactory: V06_FACTORY }, EP_V06);
        await expect(c.createSmartAccount({ owner: OWNER })).rejects.toThrow(`builds accounts for EntryPoint ${EP_V06}, but the SDK is configured for ${EP_V07}`);
    });

    it('an RPC on another chain than the client\'s is refused before any factory read', async () => {
        const c = client();
        c.getChainId = vi.fn(async () => 10);
        await expect(c.createSmartAccount({ owner: OWNER })).rejects.toThrow('the RPC is on chain 10, the client is configured for 11155111');
        expect(c.readContract).not.toHaveBeenCalled();
    });

    it('deploySmartAccount sends createAccount to the checked factory, and a v0.6 factory sends nothing', async () => {
        const ok = client();
        ok.writeContract = vi.fn(async () => '0xbeef');
        ok.waitForTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
        await ok.deploySmartAccount({ owner: OWNER });
        expect(ok.writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: V07_FACTORY, functionName: 'createAccount' }));
        const bad = client({ simpleAccountFactory: V06_FACTORY }, EP_V06);
        bad.writeContract = vi.fn(async () => '0xbeef');
        await expect(bad.deploySmartAccount({ owner: OWNER })).rejects.toThrow('builds accounts for EntryPoint');
        expect(bad.writeContract).not.toHaveBeenCalled();
    });

    it('a chain outside the address book needs its own factory: global defaults do not count as "explicit"', async () => {
        const base = { ...sepolia, id: 8453, name: 'other' };
        const c = client({ registry: '0x3333333333333333333333333333333333333333' }, EP_V07, base);
        await expect(c.createSmartAccount({ owner: OWNER })).rejects.toThrow('no simpleAccountFactory for chain 8453');
        const ok = client({ registry: '0x3333333333333333333333333333333333333333', simpleAccountFactory: V07_FACTORY }, EP_V07, base);
        await expect(ok.createSmartAccount({ owner: OWNER })).resolves.toBeTruthy();
    });

    it('changing the caller\'s addresses object after construction does not swap the factory between prediction and deploy', async () => {
        const OTHER_FACTORY = '0x5555555555555555555555555555555555555555' as Address;
        const addresses: Record<string, Address> = { simpleAccountFactory: V07_FACTORY };
        const c = client(addresses);
        c.writeContract = vi.fn(async () => '0xbeef');
        c.waitForTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
        const read = c.readContract.getMockImplementation();
        c.readContract = vi.fn(async (args: any) => { if (args.functionName === 'getAddress') addresses.simpleAccountFactory = OTHER_FACTORY; return read(args); });
        await c.deploySmartAccount({ owner: OWNER });
        expect(c.writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: V07_FACTORY, functionName: 'createAccount' }));
    });

    it('a factory with no code is refused', async () => {
        const c = client();
        c.getCode = vi.fn(async () => '0x');
        await expect(c.createSmartAccount({ owner: OWNER })).rejects.toThrow('has no code');
    });
});
