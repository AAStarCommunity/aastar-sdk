import { describe, it, expect, vi } from 'vitest';
import { custom, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { ROLE_ENDUSER, ROLE_PAYMASTER_SUPER, RegistryABI } from '@aastar/core';
import { createOperatorClient } from '../src/clients/operator';
import { RoleDataFactory } from '../src/utils/roleData';

// Reads must name functions the vendored Registry ABI really has (a made-up getter would fail to encode).
const REGISTRY_FNS = new Set((RegistryABI as any[]).filter((e) => e.type === 'function').map((e) => e.name));

const OPERATOR = '0x3333333333333333333333333333333333333333' as Address;
const transport = custom({ request: async ({ method }) => { throw new Error(`unexpected RPC ${method}`); } });

const COMMUNITY = '0xb5600060e6de5E11D3636731964218E53caadf0E' as Address;

function operatorClient(hasRole: boolean, roleConfig = { minStake: 0n, ticketPrice: 10n ** 17n }) {
    const oc: any = createOperatorClient({ chain: sepolia, transport, account: { address: OPERATOR, type: 'local' } as any });
    oc.writeContract = vi.fn(async () => '0x' + 'cd'.repeat(32));
    oc.waitForTransactionReceipt = vi.fn(async () => ({ status: 'success' }));
    oc.readContract = vi.fn(async ({ functionName, abi }: any) => {
        if (abi === RegistryABI && !REGISTRY_FNS.has(functionName)) throw new Error(`${functionName} is not in the Registry ABI`);
        if (functionName === 'hasRole') return hasRole;
        if (functionName === 'getRoleConfig') return roleConfig;
        throw new Error(`unexpected read ${functionName}`);
    });
    return oc;
}

describe('createOperatorClient().onboardOperator — nothing is sent for a request that cannot be registered', () => {
    it('ENDUSER without roleData throws before any transaction (no approval is spent)', async () => {
        const oc = operatorClient(false);
        await expect(oc.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER })).rejects.toThrow('ENDUSER registration needs roleData');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('a role already held sends no approval and no registration', async () => {
        const oc = operatorClient(true);
        expect(await oc.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER })).toEqual([]);
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('ENDUSER approval follows the stake Registry locks for the roleData (minStake for an encoded 0)', async () => {
        const oc = operatorClient(false, { minStake: 7n, ticketPrice: 10n ** 17n });
        await oc.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community: COMMUNITY }) });
        expect(oc.writeContract.mock.calls[0][0].args[1]).toBe(7n + 10n ** 17n);
    });

    it('ENDUSER: a stakeAmount that disagrees with the roleData, or an encoded stake below minStake, sends nothing', async () => {
        const oc = operatorClient(false, { minStake: 7n, ticketPrice: 1n });
        await expect(oc.onboardOperator({ stakeAmount: 9n, depositAmount: 0n, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 8n }) })).rejects.toThrow('disagrees');
        await expect(oc.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 3n }) })).rejects.toThrow('below the role\'s minStake');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('ENDUSER: a non-zero encoded stake is approved as encoded; with minStake 0 only the ticket is approved', async () => {
        const a = operatorClient(false, { minStake: 7n, ticketPrice: 1n });
        await a.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 9n }) });
        expect(a.writeContract.mock.calls[0][0].args[1]).toBe(9n + 1n);
        const b = operatorClient(false, { minStake: 0n, ticketPrice: 1n });
        await b.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 9n }) });
        expect(b.writeContract.mock.calls[0][0].args[1]).toBe(1n);
    });

    it('a role id in upper-case hex is still treated as ENDUSER', async () => {
        const upper = ('0x' + ROLE_ENDUSER.slice(2).toUpperCase()) as `0x${string}`;
        const oc = operatorClient(false, { minStake: 7n, ticketPrice: 1n });
        await expect(oc.onboardOperator({ stakeAmount: 9n, depositAmount: 0n, roleId: upper, roleData: RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 8n }) })).rejects.toThrow('disagrees');
        await expect(oc.onboardOperator({ stakeAmount: 0n, depositAmount: 0n, roleId: upper })).rejects.toThrow('ENDUSER registration needs roleData');
        expect(oc.writeContract).not.toHaveBeenCalled();
    });

    it('a reverted deposit throws, also when the role is already held', async () => {
        const oc = operatorClient(true);
        oc.waitForTransactionReceipt = vi.fn(async () => ({ status: 'reverted' }));
        await expect(oc.onboardOperator({ stakeAmount: 0n, depositAmount: 1n, roleId: ROLE_PAYMASTER_SUPER })).rejects.toThrow('depositFor');
        expect(oc.writeContract).toHaveBeenCalledTimes(1);
    });

    it('a reverted approval stops before registration; a reverted registration stops before the deposit', async () => {
        const a = operatorClient(false);
        a.waitForTransactionReceipt = vi.fn(async () => ({ status: 'reverted' }));
        await expect(a.onboardOperator({ stakeAmount: 5n, depositAmount: 1n, roleId: ROLE_PAYMASTER_SUPER })).rejects.toThrow('approve');
        expect(a.writeContract).toHaveBeenCalledTimes(1);
        const b = operatorClient(false);
        b.waitForTransactionReceipt = vi.fn().mockResolvedValueOnce({ status: 'success' }).mockResolvedValueOnce({ status: 'reverted' });
        await expect(b.onboardOperator({ stakeAmount: 5n, depositAmount: 1n, roleId: ROLE_PAYMASTER_SUPER })).rejects.toThrow('registerRole');
        expect(b.writeContract).toHaveBeenCalledTimes(2);
    });

    it('a new registration approves stake + entry burn, then registers', async () => {
        const oc = operatorClient(false);
        await oc.onboardOperator({ stakeAmount: 5n, depositAmount: 0n, roleId: ROLE_PAYMASTER_SUPER });
        const calls = oc.writeContract.mock.calls.map((c: any) => c[0]);
        expect(calls[0].functionName).toBe('approve');
        expect(calls[0].args[1]).toBe(5n + 10n ** 17n);
        expect(calls[1].functionName).toBe('registerRole');
        expect(calls[1].args[1]).toBe(OPERATOR);
    });
});
