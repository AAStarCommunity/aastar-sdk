import { describe, it, expect, beforeEach } from 'vitest';
import { xPNTsFactoryActions, paymasterFactoryActions } from '../../src/actions/factory';
import { aggregatorActions } from '../../src/actions/aggregator';
import { dvtActions } from '../../src/actions/dvt';
import { tokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Comprehensive Action Tests Batch 3', () => {
  let p: any;
  let w: any;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('xPNTsFactory', () => {
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).owner()).toBe(U); });
    it('deployedTokens', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).deployedTokens({ index: 0n })).toBe(U); });
  });

  describe('Aggregator', () => {
    it('blsPublicKeys', async () => { p.readContract.mockResolvedValue(['0xkey', true]); await aggregatorActions(A)(p).blsPublicKeys({ validator: U }); expect(p.readContract).toHaveBeenCalled(); });
    it('setDefaultThreshold', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setDefaultThreshold({ newThreshold: 2n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('DVT', () => {
    it('createSlashProposal', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).createSlashProposal({ operator: U, level: 1, reason: 'test', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('isValidator (View)', async () => { p.readContract.mockResolvedValue(true); const res = await dvtActions(A)(p).isValidator({ user: U }); expect(res).toBe(true); });
  });

  describe('Token Actions', () => {
    it('mint', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).mint({ token: A, to: U, amount: 50n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
