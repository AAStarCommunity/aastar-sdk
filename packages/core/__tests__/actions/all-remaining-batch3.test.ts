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
    it('MAX_VALIDATORS', async () => { p.readContract.mockResolvedValue(100n); expect(await aggregatorActions(A)(p).MAX_VALIDATORS()).toBe(100n); });
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('DVT Complete', () => {
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('xPNTsFactory Complete', () => {
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await xPNTsFactoryActions(A)(p).version()).toBe('1.0'); });
  });

  describe('PaymasterFactory Complete', () => {
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await paymasterFactoryActions(A)(p).version()).toBe('1.0'); });
  });


});
