import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminClient } from './admin.js';
import { mainnet } from 'viem/chains';
import { http } from 'viem';

describe('AdminClient', () => {
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    it('should create admin client and access modules', () => {
        const client = createAdminClient({ chain: mainnet, transport: http() });
        expect(client.system).toBeDefined();
        expect(client.finance).toBeDefined();
        expect(client.operators).toBeDefined();
    });

    describe('SystemModule', () => {
        it('should grant role', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).registryRegisterRole = spy;
            
            const hash = await client.system.grantRole({ roleId: '0x1', user: MOCK_ADDR, data: '0x' });
            expect(hash).toBe('0xhash');
            expect(spy).toHaveBeenCalled();
        });

        it('should revoke role', async () => {
             const client = createAdminClient({ chain: mainnet, transport: http() });
             const spy = vi.fn().mockResolvedValue('0xhash');
             (client as any).registryUnRegisterRole = spy;
             
             const hash = await client.system.revokeRole({ roleId: '0x1', user: MOCK_ADDR });
             expect(hash).toBe('0xhash');
             expect(spy).toHaveBeenCalled();
        });

        it('should set super paymaster', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).registrySetSuperPaymaster = spy;
            
            const hash = await client.system.setSuperPaymaster(MOCK_ADDR);
            expect(hash).toBe('0xhash');
        });
    });

    describe('FinanceModule', () => {
        it('should deposit', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).superPaymasterDeposit = spy;
            
            const hash = await client.finance.deposit({ amount: 100n });
            expect(hash).toBe('0xhash');
        });

        it('should depositForOperator', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).superPaymasterDepositFor = spy;
            
            const hash = await client.finance.depositForOperator({ operator: MOCK_ADDR, amount: 100n });
            expect(hash).toBe('0xhash');
        });

        it('should withdrawTo', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).superPaymasterWithdrawTo = spy;
            
            const hash = await client.finance.withdrawTo({ to: MOCK_ADDR, amount: 100n });
            expect(hash).toBe('0xhash');
        });
    });

    describe('OperatorsModule', () => {
        it('should ban/unban operator', async () => {
            const client = createAdminClient({ chain: mainnet, transport: http() });
            const spy = vi.fn().mockResolvedValue('0xhash');
            (client as any).registryUpdateOperatorBlacklist = spy;
            
            await client.operators.ban(MOCK_ADDR);
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ statuses: [true] }));
            
            await client.operators.unban(MOCK_ADDR);
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ statuses: [false] }));
        });

        it('should setPaused', async () => {
             const client = createAdminClient({ chain: mainnet, transport: http() });
             const spy = vi.fn().mockResolvedValue('0xhash');
             (client as any).superPaymasterSetOperatorPaused = spy;
             
             await client.operators.setPaused(MOCK_ADDR, true);
             expect(spy).toHaveBeenCalledWith(expect.objectContaining({ paused: true }));
        });
    });
});
