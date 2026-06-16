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
      await act.withdrawProtocolRevenue({ to: U, amount: 100n, account: U });
      expect(w.writeContract).toHaveBeenCalledTimes(5);
    });
    // setBLSAggregator has no direct ABI fn (timelocked via queue/apply) — must throw.
    it('setBLSAggregator throws NOT_IMPLEMENTED (use queue/applyBLSAggregator)', async () => {
      await expect(superPaymasterActions(A)(w).setBLSAggregator({ aggregator: U, account: U })).rejects.toThrow('not available');
      expect(w.writeContract).not.toHaveBeenCalled();
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
    // These constants were removed from the SuperPaymaster ABI in v5.x — each must throw and
    // never issue a readContract call (they would revert on-chain).
    it('removed constants throw NOT_IMPLEMENTED', async () => {
      const act = superPaymasterActions(A)(p);
      for (const fn of [
        act.MAX_PROTOCOL_FEE, act.MAX_ETH_USD_PRICE, act.MIN_ETH_USD_PRICE,
        act.PAYMASTER_DATA_OFFSET, act.PRICE_CACHE_DURATION, act.RATE_OFFSET,
        act.VALIDATION_BUFFER_BPS, act.BPS_DENOMINATOR,
      ]) {
        await expect((fn as () => Promise<bigint>)()).rejects.toThrow('was removed');
      }
      expect(p.readContract).not.toHaveBeenCalled();
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
    it('resolveAPNTsToken returns active + pending from chain', async () => {
      const ACTIVE = '0xaaaa000000000000000000000000000000000001' as `0x${string}`;
      const PENDING = '0xbbbb000000000000000000000000000000000002' as `0x${string}`;
      // Reads run via Promise.all; route by functionName so order is irrelevant.
      p.readContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'APNTS_TOKEN') return Promise.resolve(ACTIVE);
        if (functionName === 'pendingAPNTsToken') return Promise.resolve(PENDING);
        if (functionName === 'pendingAPNTsTokenEta') return Promise.resolve(9999n);
        return Promise.reject(new Error('unexpected functionName'));
      });
      const act = superPaymasterActions(A)(p);
      const res = await act.resolveAPNTsToken();
      expect(res).toEqual({ active: ACTIVE, pending: PENDING, pendingEta: 9999n, fallbackUsed: false });
      expect(p.readContract).toHaveBeenCalledTimes(3);
    });
    it('resolveAPNTsToken reports no pending migration as zeroAddress', async () => {
      const ACTIVE = '0xaaaa000000000000000000000000000000000001' as `0x${string}`;
      const ZERO = '0x0000000000000000000000000000000000000000';
      p.readContract.mockImplementation(({ functionName }: any) => {
        if (functionName === 'APNTS_TOKEN') return Promise.resolve(ACTIVE);
        if (functionName === 'pendingAPNTsToken') return Promise.resolve(ZERO);
        if (functionName === 'pendingAPNTsTokenEta') return Promise.resolve(0n);
        return Promise.reject(new Error('unexpected functionName'));
      });
      const act = superPaymasterActions(A)(p);
      const res = await act.resolveAPNTsToken();
      expect(res.active).toBe(ACTIVE);
      expect(res.pending).toBe(ZERO);
      expect(res.pendingEta).toBe(0n);
      expect(res.fallbackUsed).toBe(false);
    });
    it('resolveAPNTsToken uses explicit fallback when chain read fails', async () => {
      const FALLBACK = '0xcccc000000000000000000000000000000000003' as `0x${string}`;
      const ZERO = '0x0000000000000000000000000000000000000000';
      p.readContract.mockRejectedValue(new Error('rpc down'));
      const act = superPaymasterActions(A)(p);
      const res = await act.resolveAPNTsToken({ fallback: FALLBACK });
      expect(res).toEqual({ active: FALLBACK, pending: ZERO, pendingEta: 0n, fallbackUsed: true });
    });
    it('resolveAPNTsToken rethrows when read fails and no fallback given', async () => {
      p.readContract.mockRejectedValue(new Error('rpc down'));
      const act = superPaymasterActions(A)(p);
      await expect(act.resolveAPNTsToken()).rejects.toThrow();
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

  describe('Beta5 Wave A: SuperPaymaster reads', () => {
    const USER_OP = {
      sender: U,
      nonce: 0n,
      initCode: '0x' as `0x${string}`,
      callData: '0x' as `0x${string}`,
      accountGasLimits: ('0x' + '00'.repeat(32)) as `0x${string}`,
      preVerificationGas: 21000n,
      gasFees: ('0x' + '00'.repeat(32)) as `0x${string}`,
      paymasterAndData: '0x' as `0x${string}`,
      signature: '0x' as `0x${string}`,
    };

    it('dryRunValidation decodes (ok, reasonCode) tuple and passes userOp + maxCost', async () => {
      const REASON = ('0x' + '00'.repeat(32)) as `0x${string}`;
      p.readContract.mockResolvedValueOnce([true, REASON]);
      const act = superPaymasterActions(A)(p);
      const res = await act.dryRunValidation({ userOp: USER_OP, maxCost: 500n });
      expect(res).toEqual({ ok: true, reasonCode: REASON });
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'dryRunValidation',
        args: [USER_OP, 500n],
      }));
    });

    it('dryRunValidation surfaces a rejection reasonCode', async () => {
      const REASON = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
      p.readContract.mockResolvedValueOnce([false, REASON]);
      const act = superPaymasterActions(A)(p);
      const res = await act.dryRunValidation({ userOp: USER_OP, maxCost: 1n });
      expect(res.ok).toBe(false);
      expect(res.reasonCode).toBe(REASON);
    });

    it('isChainlinkStale returns the bool from the right functionName', async () => {
      p.readContract.mockResolvedValueOnce(true);
      const act = superPaymasterActions(A)(p);
      expect(await act.isChainlinkStale()).toBe(true);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'isChainlinkStale',
        args: [],
      }));
    });

    it('priceMode decodes uint8 to a number', async () => {
      p.readContract.mockResolvedValueOnce(2);
      const act = superPaymasterActions(A)(p);
      const mode = await act.priceMode();
      expect(mode).toBe(2);
      expect(typeof mode).toBe('number');
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'priceMode',
        args: [],
      }));
    });

    it('priceValidUntil returns the uint48 timestamp as bigint', async () => {
      p.readContract.mockResolvedValueOnce(1700000000n);
      const act = superPaymasterActions(A)(p);
      expect(await act.priceValidUntil()).toBe(1700000000n);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'priceValidUntil',
        args: [],
      }));
    });

    it('pendingBLSAgg returns the pending aggregator address', async () => {
      p.readContract.mockResolvedValueOnce(U);
      const act = superPaymasterActions(A)(p);
      expect(await act.pendingBLSAgg()).toBe(U);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'pendingBLSAgg',
        args: [],
      }));
    });

    it('pendingBLSAggEta returns the uint48 ETA as bigint', async () => {
      p.readContract.mockResolvedValueOnce(1234n);
      const act = superPaymasterActions(A)(p);
      expect(await act.pendingBLSAggEta()).toBe(1234n);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'pendingBLSAggEta',
        args: [],
      }));
    });

    it('APNTS_TOKEN_TIMELOCK returns the timelock duration as bigint', async () => {
      p.readContract.mockResolvedValueOnce(86400n);
      const act = superPaymasterActions(A)(p);
      expect(await act.APNTS_TOKEN_TIMELOCK()).toBe(86400n);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'APNTS_TOKEN_TIMELOCK',
        args: [],
      }));
    });
  });
});
