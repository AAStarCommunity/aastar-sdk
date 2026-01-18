import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { paymasterActions } from '../../src/actions/paymaster';
import { sbtActions } from '../../src/actions/sbt';
import { reputationActions } from '../../src/actions/reputation';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Comprehensive Action Tests Batch 2', () => {
  let p: any;
  let w: any;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Registry Extended', () => {
    it('configureRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(A)(w).configureRole({ roleId: '0x01', config: {} as any, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('registerRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(A)(w).registerRole({ roleId: '0x01', user: U, data: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getRoleConfig', async () => { p.readContract.mockResolvedValue([0n, 0n, 0, 0, 0, 0, 0, true, 0n, 'desc', U, 0n]); await registryActions(A)(p).getRoleConfig({ roleId: '0x01' }); expect(p.readContract).toHaveBeenCalled(); });
  });

  describe('Staking Extended', () => {
    it('stakes (View)', async () => { p.readContract.mockResolvedValue([100n, 0n, 0n]); const res = await stakingActions(A)(p).stakes({ user: U }); expect(res).toBeDefined(); });
    it('roleLocks (View)', async () => { p.readContract.mockResolvedValue([0n, 0n, false]); const res = await stakingActions(A)(p).roleLocks({ user: U, roleId: '0x01' }); expect(res).toBeDefined(); });
  });

  describe('SBT Extended', () => {
    it('mintForRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await sbtActions(A)(w).mintForRole({ roleId: '0x01', user: U, roleData: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('sbtData', async () => { p.readContract.mockResolvedValue([U, U, 0n, 1n]); const res = await sbtActions(A)(p).sbtData({ tokenId: 1n }); expect(res.holder).toBe(U); });
  });

  describe('SuperPaymaster Extended', () => {
    it('operators', async () => { p.readContract.mockResolvedValue([0n, 0n, true, false, U, 0, 0, U, 0n, 0n]); const res = await superPaymasterActions(A)(p).operators({ id: U }); expect(res.isConfigured).toBe(true); });
    it('setOperatorPaused', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).setOperatorPaused({ operator: U, paused: true, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
