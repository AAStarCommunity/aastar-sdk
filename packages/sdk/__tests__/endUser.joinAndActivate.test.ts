import { describe, it, expect, vi } from 'vitest';
import { custom, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { RegistryABI, ROLE_ENDUSER, decodeEndUserRoleData } from '@aastar/core';
import { createEndUserClient } from '../src/clients/endUser';

const OWNER = '0x1111111111111111111111111111111111111111' as Address;
const COMMUNITY = '0xb5600060e6de5E11D3636731964218E53caadf0E' as Address;
const transport = custom({ request: async ({ method }) => { throw new Error(`unexpected RPC ${method}`); } });

function client(status: 'success' | 'reverted' = 'success') {
    const c: any = createEndUserClient({ chain: sepolia, transport, account: { address: OWNER, type: 'json-rpc' } as any });
    c.writeContract = vi.fn(async () => '0x' + 'ab'.repeat(32));
    c.waitForTransactionReceipt = vi.fn(async () => ({ status }));
    c.readContract = vi.fn(async ({ functionName }: any) => { if (functionName === 'getUserSBT') return 7n; throw new Error(`no ${functionName}`); });
    return c;
}

describe('createEndUserClient().joinAndActivate — Registry.registerRole', () => {
    it('the account registers itself through registerRole(roleId, self, EndUserRoleData{community, 0})', async () => {
        const c = client();
        await c.joinAndActivate({ community: COMMUNITY, roleId: ROLE_ENDUSER });
        const call = c.writeContract.mock.calls[0][0];
        expect(call.abi).toBe(RegistryABI);
        expect(call.functionName).toBe('registerRole');
        expect(call.args[0]).toBe(ROLE_ENDUSER);
        expect(call.args[1]).toBe(OWNER);
        expect(decodeEndUserRoleData(call.args[2])).toEqual({ community: COMMUNITY, stakeAmount: 0n });
    });

    it('roleData given by the caller is sent unchanged', async () => {
        const c = client();
        await c.joinAndActivate({ community: COMMUNITY, roleId: ROLE_ENDUSER, roleData: '0x1234' });
        expect(c.writeContract.mock.calls[0][0].args[2]).toBe('0x1234');
    });

    it('credit is read for the account that registered, not a separately set aaAddress', async () => {
        const c = client();
        c.aaAddress = '0x9999999999999999999999999999999999999999';
        c.readContract = vi.fn(async ({ functionName }: any) => {
            if (functionName === 'getUserSBT') return 7n;
            if (functionName === 'communityToToken') return '0x8888888888888888888888888888888888888888';
            if (functionName === 'getAvailableCredit') return 5n;
            throw new Error(`no ${functionName}`);
        });
        await c.joinAndActivate({ community: COMMUNITY, roleId: ROLE_ENDUSER });
        const credit = c.readContract.mock.calls.map((x: any) => x[0]).find((a: any) => a.functionName === 'getAvailableCredit');
        expect(credit.args[0]).toBe(OWNER);
    });

    it('a reverted registration throws instead of reporting an SBT', async () => {
        const c = client('reverted');
        await expect(c.joinAndActivate({ community: COMMUNITY, roleId: ROLE_ENDUSER })).rejects.toThrow('reverted');
        expect(c.readContract).not.toHaveBeenCalled();
    });
});
