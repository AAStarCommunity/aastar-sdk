import { describe, it, expect, beforeEach } from 'vitest';
import { accountActions, accountFactoryActions } from '../../src/actions/account';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ACCOUNT_ADDR = '0x1111111111111111111111111111111111111111';
const FACTORY_ADDR = '0x2222222222222222222222222222222222222222';
const USER = '0x3333333333333333333333333333333333333333';

describe('AccountActions Comprehensive', () => {
    let p: any;
    let w: any;
    beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

    describe('SimpleAccount Actions', () => {
        it('should execute single transaction', async () => {
             w.writeContract.mockResolvedValue('0xHash');
             const acts = accountActions(ACCOUNT_ADDR)(w);
             await acts.execute({ dest: USER, value: 0n, func: '0x', account: USER });
             expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'execute',
                 args: [USER, 0n, '0x']
             }));
        });

        it('should execute batch transaction', async () => {
            w.writeContract.mockResolvedValue('0xHash');
            const acts = accountActions(ACCOUNT_ADDR)(w);
            await acts.executeBatch({ 
                dest: [USER, USER], 
                value: [0n, 10n], 
                func: ['0x', '0x1234'], 
                account: USER 
            });
            expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'executeBatch'
            }));
            // Args check: [[ {target: ..., value: ..., data: ...}, ... ]]
            const arg = w.writeContract.mock.calls[0][0].args[0];
            expect(arg).toHaveLength(2);
            expect(arg[1].value).toBe(10n);
        });

        it('should throw on batch mismatch', async () => {
            const acts = accountActions(ACCOUNT_ADDR)(w);
            await expect(acts.executeBatch({ 
                dest: [USER], 
                value: [0n, 10n], // mismatch
                func: ['0x'], 
                account: USER 
            })).rejects.toThrow();
        });

        it('should read contract state', async () => {
            p.readContract.mockResolvedValue(10n); // nonce
            const acts = accountActions(ACCOUNT_ADDR)(p);
            expect(await acts.getNonce()).toBe(10n);
            
            p.readContract.mockResolvedValue(USER); // entrypoint/owner
            expect(await acts.entryPoint()).toBe(USER);
            expect(await acts.owner()).toBe(USER);
            
            p.readContract.mockResolvedValue(100n); // deposit
            expect(await acts.getDeposit()).toBe(100n);
        });

        it('should manage deposits', async () => {
            w.writeContract.mockResolvedValue('0xHash');
            const acts = accountActions(ACCOUNT_ADDR)(w);
            await acts.addDeposit({ account: USER });
            await acts.withdrawDepositTo({ withdrawAddress: USER, amount: 100n, account: USER });
            expect(w.writeContract).toHaveBeenCalledTimes(2);
        });
    });

    describe('AccountFactory Actions', () => {
        it('should create account', async () => {
            w.writeContract.mockResolvedValue('0xHash');
            const acts = accountFactoryActions(FACTORY_ADDR)(w);
            await acts.createAccount({ owner: USER, salt: 123n, account: USER });
            expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'createAccount',
                args: [USER, 123n]
            }));
        });

        it('should get address', async () => {
            p.readContract.mockResolvedValue(ACCOUNT_ADDR);
            const acts = accountFactoryActions(FACTORY_ADDR)(p);
            expect(await acts.getAddress({ owner: USER, salt: 123n })).toBe(ACCOUNT_ADDR);
        });
    });
});
