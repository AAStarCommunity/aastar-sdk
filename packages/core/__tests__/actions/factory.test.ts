import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterFactoryActions, xPNTsFactoryActions } from '../../src/actions/factory';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('FactoryActions Bulk Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('XPNTsFactory Actions', () => {
    it('deploys & creates', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = xPNTsFactoryActions(A)(w);
      await act.deployxPNTsToken({ name: 'n', symbol: 's', communityName: 'cn', communityENS: 'ce', exchangeRate: 100n, paymasterAOA: U, account: U });
      await act.createToken({ name: 'n', symbol: 's', community: U, account: U });
      await act.deployForCommunity({ community: U, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
    it('views', async () => {
      p.readContract.mockResolvedValue(U);
      const act = xPNTsFactoryActions(A)(p);
      await act.getTokenAddress({ community: U });
      await act.predictAddress({ community: U, salt: '0x01' });
      await act.getCommunityByToken({ token: U });
      p.readContract.mockResolvedValue(true);
      await act.hasToken({ community: U });
      await act.isTokenDeployed({ community: U });
      p.readContract.mockResolvedValue(5n);
      await act.getDeployedCount();
      await act.getTokenCount();
      expect(p.readContract).toHaveBeenCalledTimes(7);
    });
  });

  describe('Paymaster/Account Factory Actions', () => {
    it('deploys', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = paymasterFactoryActions(A)(w);
      await act.deployPaymaster({ version: 'v1', initData: '0x', account: U });
      await act.deployPaymasterDeterministic({ version: 'v1', salt: '0x01', initData: '0x', account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
    it('views', async () => {
      p.readContract.mockResolvedValue(U);
      const act = paymasterFactoryActions(A)(p);
      await expect(act.calculateAddress({ owner: U })).rejects.toThrow('Predicting address not supported');
      await act.getPaymaster({ owner: U });
      await act.getPaymasterByOperator({ operator: U });
      await act.getOperatorByPaymaster({ paymaster: U });
      p.readContract.mockResolvedValue(true);
      await act.hasPaymaster({ owner: U });
      await act.isPaymasterDeployed({ owner: U });
      p.readContract.mockResolvedValue(5n);
      await act.getPaymasterCount();
      expect(p.readContract).toHaveBeenCalledTimes(6);
    });
  });

  describe('Management & Meta', () => {
    it('setters', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = xPNTsFactoryActions(A)(w);
      await act.setRegistry({ registry: U, account: U });
      await act.setSuperPaymaster({ paymaster: U, account: U });
      await act.setImplementation({ impl: U, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
    it('getters/owner', async () => {
      p.readContract.mockResolvedValue(U);
      const act = xPNTsFactoryActions(A)(p);
      await act.REGISTRY();
      await act.SUPERPAYMASTER();
      await act.tokenImplementation();
      await act.owner();
      expect(p.readContract).toHaveBeenCalledTimes(4);
    });
  });
});
