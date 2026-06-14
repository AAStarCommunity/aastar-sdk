import { describe, it, expect, beforeEach } from 'vitest';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('SuperPaymasterActions Exhaustive Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Core Operations', () => {
    it('deposit/withdraw/ETH', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.deposit({ amount: 100n, account: U });
      await act.depositETH({ value: 100n, account: U });
      await act.depositFor({ targetOperator: U, amount: 100n, account: U });
      await act.withdraw({ amount: 100n, account: U });
      await act.withdrawTo({ to: U, amount: 100n, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(5);
    });
    it('stking ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.addStake({ unstakeDelaySec: 3600, value: 100n, account: U });
      await act.unlockStake({ account: U });
      await act.withdrawStake({ to: U, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
  });

  describe('Operator Management', () => {
    it('configure/paused/limits', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.configureOperator({ xPNTsToken: U, opTreasury: U, account: U });
      await act.setOperatorPaused({ operator: U, paused: true, account: U });
      await act.setOperatorLimits({ minTxInterval: 10, account: U });
      await act.updateReputation({ operator: U, newScore: 100n, account: U });
      await act.executeSlashWithBLS({ operator: U, level: 1, proof: '0x', account: U });
      await act.slashOperator({ operator: U, level: 1, penaltyAmount: 100n, reason: 'r', account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(6);
    });
    it('blocks/sbt status', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.updateBlockedStatus({ operator: U, users: [U], statuses: [true], account: U });
      await act.updateSBTStatus({ user: U, status: true, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
  });

  describe('Price & Protocol', () => {
    it('prices', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.setAPNTSPrice({ newPrice: 100n, account: U });
      await act.updatePrice({ account: U });
      await act.updatePriceDVT({ price: 100n, updatedAt: 123n, proof: '0x', account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
    it('protocol config', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.setProtocolFee({ newFeeBPS: 100n, account: U });
      await act.setTreasury({ treasury: U, account: U });
      await act.setXPNTsFactory({ factory: U, account: U });
      await act.setAPNTsToken({ token: U, account: U });
      await act.setBLSAggregator({ aggregator: U, account: U });
      await act.withdrawProtocolRevenue({ to: U, amount: 100n, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(6);
    });
  });

  describe('Views & Getters', () => {
    it('operator/credit/slash', async () => {
      p.readContract.mockResolvedValueOnce([100n, 100n, true, false, U, 0, 0, U, 0n, 0n]);
      p.readContract.mockResolvedValueOnce(100n);
      p.readContract.mockResolvedValueOnce(100n);
      p.readContract.mockResolvedValueOnce([100n, 100n, 100n, 'r', 1]);
      p.readContract.mockResolvedValueOnce(1n);
      p.readContract.mockResolvedValueOnce([[100n, 100n, 100n, 'r', 1]]);
      p.readContract.mockResolvedValueOnce([100n, 100n, 100n, 'r', 1]);
      const act = superPaymasterActions(A)(p);
      await act.operators({ operator: U });
      await act.getAvailableCredit({ user: U, token: U });
      await act.getDeposit();
      await act.getLatestSlash({ operator: U });
      await act.getSlashCount({ operator: U });
      await act.getSlashHistory({ operator: U });
      await act.slashHistory({ operator: U, index: 0n });
      expect(p.readContract).toHaveBeenCalledTimes(7);
    });
    it('state/price/protocol', async () => {
      p.readContract.mockResolvedValueOnce([123, true]);
      p.readContract.mockResolvedValueOnce([100n, 123n, 1n, 18]);
      p.readContract.mockResolvedValueOnce(100n);
      p.readContract.mockResolvedValueOnce(500n);
      p.readContract.mockResolvedValueOnce(1000n);
      p.readContract.mockResolvedValueOnce(10000n);
      p.readContract.mockResolvedValueOnce(3600n);
      p.readContract.mockResolvedValueOnce(true);
      const act = superPaymasterActions(A)(p);
      await act.userOpState({ user: U, operator: U });
      await act.cachedPrice();
      await act.aPNTsPriceUSD();
      await act.protocolFeeBPS();
      await act.protocolRevenue();
      await act.totalTrackedBalance();
      await act.priceStalenessThreshold();
      await act.sbtHolders({ user: U });
      expect(p.readContract).toHaveBeenCalledTimes(8);
    });
  });

  describe('Pending-Debt Reconciliation', () => {
    it('pendingDebts returns the recorded bigint', async () => {
      p.readContract.mockResolvedValueOnce(4200n);
      const act = superPaymasterActions(A)(p);
      const debt = await act.pendingDebts({ token: A, user: U });
      expect(debt).toBe(4200n);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'pendingDebts',
        args: [A, U],
      }));
    });

    it('retryPendingDebt writes with token/user/amount', async () => {
      w.writeContract.mockResolvedValue('0xretry');
      const act = superPaymasterActions(A)(w);
      const hash = await act.retryPendingDebt({ token: A, user: U, amount: 500n, account: U });
      expect(hash).toBe('0xretry');
      expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'retryPendingDebt',
        args: [A, U, 500n],
      }));
    });

    it('clearPendingDebt writes with token/user', async () => {
      w.writeContract.mockResolvedValue('0xclear');
      const act = superPaymasterActions(A)(w);
      const hash = await act.clearPendingDebt({ token: A, user: U, account: U });
      expect(hash).toBe('0xclear');
      expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'clearPendingDebt',
        args: [A, U],
      }));
    });

    it('rejects invalid addresses', async () => {
      const actP = superPaymasterActions(A)(p);
      await expect(actP.pendingDebts({ token: 'bad' as any, user: U })).rejects.toThrow();
      const actW = superPaymasterActions(A)(w);
      await expect(actW.retryPendingDebt({ token: A, user: 'bad' as any, amount: 1n, account: U })).rejects.toThrow();
      await expect(actW.clearPendingDebt({ token: 'bad' as any, user: U, account: U })).rejects.toThrow();
      expect(p.readContract).not.toHaveBeenCalled();
      expect(w.writeContract).not.toHaveBeenCalled();
    });
  });

  describe('Constants & Meta', () => {
    it('refernce getters', async () => {
      p.readContract.mockResolvedValue(U);
      const act = superPaymasterActions(A)(p);
      await act.APNTS_TOKEN();
      await act.REGISTRY();
      await act.BLS_AGGREGATOR();
      await act.ETH_USD_PRICE_FEED();
      await act.treasury();
      await act.xpntsFactory();
      await act.entryPoint();
      expect(p.readContract).toHaveBeenCalledTimes(7);
    });
    it('thresholds', async () => {
      p.readContract.mockResolvedValue(100n);
      const act = superPaymasterActions(A)(p);
      await act.MAX_PROTOCOL_FEE();
      await act.MAX_ETH_USD_PRICE();
      await act.MIN_ETH_USD_PRICE();
      await act.PAYMASTER_DATA_OFFSET();
      await act.PRICE_CACHE_DURATION();
      await act.RATE_OFFSET();
      await act.VALIDATION_BUFFER_BPS();
      await act.BPS_DENOMINATOR();
      expect(p.readContract).toHaveBeenCalledTimes(8);
    });
    it('ownership/version', async () => {
      p.readContract.mockResolvedValueOnce(U);
      p.readContract.mockResolvedValueOnce('1.0');
      const actP = superPaymasterActions(A)(p);
      await actP.owner();
      await actP.version();
      w.writeContract.mockResolvedValue('0x');
      const actW = superPaymasterActions(A)(w);
      await actW.transferOwnership({ newOwner: U, account: U });
      await actW.renounceOwnership({ account: U });
      expect(p.readContract).toHaveBeenCalledTimes(2);
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
  });

  describe('Governance & Timelock', () => {
    it('aPNTs token migration writes', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.executeAPNTsTokenChange({ account: U });
      await act.cancelAPNTsTokenChange({ account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(2);
      expect(w.writeContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'executeAPNTsTokenChange', args: [] }));
      expect(w.writeContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'cancelAPNTsTokenChange', args: [] }));
    });
    it('aPNTs token migration reads', async () => {
      p.readContract.mockResolvedValueOnce(U);
      p.readContract.mockResolvedValueOnce(1234n);
      const act = superPaymasterActions(A)(p);
      expect(await act.pendingAPNTsToken()).toBe(U);
      expect(await act.pendingAPNTsTokenEta()).toBe(1234n);
      expect(p.readContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'pendingAPNTsToken', args: [] }));
      expect(p.readContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'pendingAPNTsTokenEta', args: [] }));
    });
    it('emergency price writes', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.emergencySetPrice({ newPrice: -500n, account: U });
      await act.executeEmergencyPrice({ account: U });
      await act.cancelEmergencyPrice({ account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
      expect(w.writeContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'emergencySetPrice', args: [-500n] }));
      expect(w.writeContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'executeEmergencyPrice', args: [] }));
      expect(w.writeContract).toHaveBeenNthCalledWith(3, expect.objectContaining({ functionName: 'cancelEmergencyPrice', args: [] }));
    });
    it('emergency price reads', async () => {
      p.readContract.mockResolvedValueOnce(-100n);
      p.readContract.mockResolvedValueOnce(111n);
      p.readContract.mockResolvedValueOnce(222n);
      p.readContract.mockResolvedValueOnce(86400n);
      const act = superPaymasterActions(A)(p);
      expect(await act.emergencyPendingPrice()).toBe(-100n);
      expect(await act.emergencyActivatedAt()).toBe(111n);
      expect(await act.emergencyQueuedAt()).toBe(222n);
      expect(await act.EMERGENCY_TIMELOCK()).toBe(86400n);
      expect(p.readContract).toHaveBeenCalledTimes(4);
    });
    it('BLS aggregator timelock writes', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = superPaymasterActions(A)(w);
      await act.queueBLSAggregator({ aggregator: U, account: U });
      await act.applyBLSAggregator({ account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(2);
      expect(w.writeContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'queueBLSAggregator', args: [U] }));
      expect(w.writeContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'applyBLSAggregator', args: [] }));
    });
    it('rejects invalid aggregator address', async () => {
      const act = superPaymasterActions(A)(w);
      await expect(act.queueBLSAggregator({ aggregator: 'bad' as any, account: U })).rejects.toThrow();
    });
  });
});
