import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterActions } from '../../src/actions/paymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const TOKEN = '0x3333333333333333333333333333333333333333' as `0x${string}`;

describe('PaymasterActions Exhaustive Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Core Operations', () => {
    it('deposits/withdrawals', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = paymasterActions(ADDR)(w);
      await act.depositFor({ user: USER, token: TOKEN, amount: 100n, account: USER });
      await act.withdraw({ token: TOKEN, amount: 100n, account: USER });
      await act.withdrawTo({ to: USER, amount: 100n, account: USER });
      await act.addDeposit({ value: 100n, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(4);
    });
    it('staking', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = paymasterActions(ADDR)(w);
      await act.addStake({ unstakeDelaySec: 100, value: 100n, account: USER });
      await act.unlockStake({ account: USER });
      await act.withdrawStake({ to: USER, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
    it('ownership', async () => {
        p.readContract.mockResolvedValue(USER);
        await paymasterActions(ADDR)(p).owner();
        w.writeContract.mockResolvedValue('0x');
        await paymasterActions(ADDR)(w).transferOwnership({ newOwner: USER, account: USER });
        await paymasterActions(ADDR)(w).renounceOwnership({ account: USER });
        expect(p.readContract).toHaveBeenCalledTimes(1);
        expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration & Meta', () => {
    it('setters', async () => {
        w.writeContract.mockResolvedValue('0x');
        const act = paymasterActions(ADDR)(w);
        await act.setTokenPrice({ token: TOKEN, price: 100n, account: USER });
        await act.setCachedPrice({ price: 100n, timestamp: 123456, account: USER });
        await act.setTreasury({ treasury: USER, account: USER });
        await act.setServiceFeeRate({ _serviceFeeRate: 100n, account: USER });
        await act.setMaxGasCostCap({ _maxGasCostCap: 1000n, account: USER });
        await act.setPriceStalenessThreshold({ _priceStalenessThreshold: 3600n, account: USER });
        await act.pause({ account: USER });
        await act.unpause({ account: USER });
        await act.updatePrice({ account: USER });
        await act.deactivateFromRegistry({ account: USER });
        expect(w.writeContract).toHaveBeenCalledTimes(10);
    });
    
    it('getters/constants', async () => {
        const act = paymasterActions(ADDR)(p);
        p.readContract.mockResolvedValue(100n);
        await act.balances({ user: USER, token: TOKEN });
        await act.tokenPrices({ token: TOKEN });
        await act.serviceFeeRate();
        await act.maxGasCostCap();
        await act.priceStalenessThreshold();
        await act.MAX_ETH_USD_PRICE();
        await act.MIN_ETH_USD_PRICE();
        await act.MAX_GAS_TOKENS();
        await act.MAX_SBTS();
        await act.MAX_SERVICE_FEE();
        await act.getRealtimeTokenCost({ gasCost: 100n, token: TOKEN });
        await act.calculateCost({ gasCost: 100n, token: TOKEN, useRealtime: true });

        p.readContract.mockResolvedValue(true);
        await act.paused();
        await act.isActiveInRegistry();
        await act.isRegistrySet();
        
        p.readContract.mockResolvedValue(USER);
        await act.registry();
        await act.ethUsdPriceFeed();
        await act.treasury();
        await act.entryPoint();
        
        p.readContract.mockResolvedValue(18);
        await act.oracleDecimals();
        await act.tokenDecimals({ token: TOKEN });
        
        p.readContract.mockResolvedValue({ price: 100n, updatedAt: 123 });
        await act.cachedPrice();
        
        p.readContract.mockResolvedValue('1.0');
        await act.version();

        // Count: 12 (first block) + 3 (bools) + 4 (addrs) + 2 (nums) + 1 (struct) + 1 (str) = 23
        expect(p.readContract).toHaveBeenCalledTimes(23);
    });
  });

  describe('Validation', () => {
    it('validate & postOp', async () => {
        const actP = paymasterActions(ADDR)(p);
        p.readContract.mockResolvedValue({ context: '0x', validationData: 0n });
        await actP.validatePaymasterUserOp({ userOp: {}, userOpHash: '0x', maxCost: 100n });
        
        const actW = paymasterActions(ADDR)(w);
        w.writeContract.mockResolvedValue('0x');
        await actW.postOp({ mode: 0, context: '0x', actualGasCost: 100n, actualUserOpFeePerGas: 100n, account: USER });
        
        expect(p.readContract).toHaveBeenCalledTimes(1);
        expect(w.writeContract).toHaveBeenCalledTimes(1);
    });
  });
});
