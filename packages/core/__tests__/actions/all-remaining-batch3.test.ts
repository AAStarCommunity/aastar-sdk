import { describe, it, expect, beforeEach } from 'vitest';
import { aggregatorActions } from '../../src/actions/aggregator';
import { dvtActions } from '../../src/actions/dvt';
import { xPNTsFactoryActions, paymasterFactoryActions } from '../../src/actions/factory';
import { accountActions, accountFactoryActions } from '../../src/actions/account';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('All Remaining Functions Batch 3', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Aggregator Complete', () => {
    it('verifyAndExecute', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).verifyAndExecute({ proposalId: '0x01', operator: U, slashLevel: 1, repUsers: [U], newScores: [100n], epoch: 1n, proof: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('proposalNonces', async () => { p.readContract.mockResolvedValue(5n); expect(await aggregatorActions(A)(p).proposalNonces({ proposalId: '0x01' })).toBe(5n); });
    it('aggregatedSignatures', async () => { p.readContract.mockResolvedValue('0xsig'); expect(await aggregatorActions(A)(p).aggregatedSignatures({ index: 0n })).toBe('0xsig'); });
    it('setDVTValidator', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setDVTValidator({ dv: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setSuperPaymaster', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setSuperPaymaster({ sp: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('MAX_VALIDATORS', async () => { p.readContract.mockResolvedValue(100n); expect(await aggregatorActions(A)(p).MAX_VALIDATORS()).toBe(100n); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('DVT Complete', () => {
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('xPNTsFactory Complete', () => {
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await xPNTsFactoryActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await xPNTsFactoryActions(A)(p).version()).toBe('1.0'); });
  });

  describe('PaymasterFactory Complete', () => {
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterFactoryActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await paymasterFactoryActions(A)(p).version()).toBe('1.0'); });
  });

  describe('Account Complete', () => {
    it('addDeposit', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await accountActions(A)(w).addDeposit({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('withdrawDepositTo', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await accountActions(A)(w).withdrawDepositTo({ to: U, amount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getDeposit', async () => { p.readContract.mockResolvedValue(1000n); expect(await accountActions(A)(p).getDeposit()).toBe(1000n); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await accountActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('AccountFactory Complete', () => {
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await accountFactoryActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
