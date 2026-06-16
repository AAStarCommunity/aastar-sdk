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
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
    // deployForCommunity removed in v5.x (no such fn on xPNTsFactory) — must throw.
    it('deployForCommunity throws NOT_IMPLEMENTED', async () => {
      await expect(xPNTsFactoryActions(A)(w).deployForCommunity({ community: U, account: U })).rejects.toThrow('was removed');
      expect(w.writeContract).not.toHaveBeenCalled();
    });
    it('views', async () => {
      p.readContract.mockResolvedValue(U);
      const act = xPNTsFactoryActions(A)(p);
      await act.getTokenAddress({ community: U });
      p.readContract.mockResolvedValue(true);
      await act.hasToken({ community: U });
      await act.isTokenDeployed({ community: U });
      p.readContract.mockResolvedValue(5n);
      await act.getDeployedCount();
      await act.getTokenCount();
      expect(p.readContract).toHaveBeenCalledTimes(5);
    });
    // predictAddress / getCommunityByToken removed in v5.x — must throw.
    it('predictAddress throws NOT_IMPLEMENTED', async () => {
      await expect(xPNTsFactoryActions(A)(p).predictAddress({ community: U, salt: 1n })).rejects.toThrow('was removed');
    });
    it('getCommunityByToken throws NOT_IMPLEMENTED', async () => {
      await expect(xPNTsFactoryActions(A)(p).getCommunityByToken({ token: U })).rejects.toThrow('was removed');
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
      await act.setSuperPaymaster({ paymaster: U, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(1);
    });
    // setRegistry / setImplementation removed in v5.x (immutable REGISTRY / fixed implementation) — must throw.
    it('setRegistry throws NOT_IMPLEMENTED', async () => {
      await expect(xPNTsFactoryActions(A)(w).setRegistry({ registry: U, account: U })).rejects.toThrow('was removed');
      expect(w.writeContract).not.toHaveBeenCalled();
    });
    it('setImplementation throws NOT_IMPLEMENTED', async () => {
      await expect(xPNTsFactoryActions(A)(w).setImplementation({ impl: U, account: U })).rejects.toThrow('was removed');
      expect(w.writeContract).not.toHaveBeenCalled();
    });
    it('getters/owner', async () => {
      p.readContract.mockResolvedValue(U);
      const act = xPNTsFactoryActions(A)(p);
      await act.REGISTRY();
      await act.SUPERPAYMASTER();
      // tokenImplementation now reads the ABI-confirmed `implementation()` getter.
      await act.tokenImplementation();
      expect(p.readContract.mock.calls[2][0].functionName).toBe('implementation');
      await act.owner();
      expect(p.readContract).toHaveBeenCalledTimes(4);
    });
  });
});
