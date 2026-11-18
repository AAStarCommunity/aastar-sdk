import { describe, it, expect, vi } from 'vitest';
import { custom, type Address } from 'viem';
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

function client(addresses: Record<string, Address> = {}, implEntryPoint: Address = EP_V07) {
    const c: any = createEndUserClient({ chain: sepolia, transport, account: { address: OWNER, type: 'json-rpc' } as any, addresses });
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

    it('a factory with no code is refused', async () => {
        const c = client();
        c.getCode = vi.fn(async () => '0x');
        await expect(c.createSmartAccount({ owner: OWNER })).rejects.toThrow('has no code');
    });
});
