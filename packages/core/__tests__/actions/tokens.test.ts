import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions, xPNTsTokenActions, gTokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('TokenActions Exhaustive Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('GToken (Base ERC20 + extensions)', () => {
    it('read ops', async () => {
      p.readContract.mockResolvedValue(100n);
      const acts = gTokenActions(ADDR)(p);
      await acts.totalSupply({ token: ADDR });
      await acts.balanceOf({ token: ADDR, account: USER });
      await acts.allowance({ token: ADDR, owner: USER, spender: USER });
      await acts.cap({ token: ADDR });
      await acts.remainingMintableSupply({ token: ADDR });
      await acts.decimals({ token: ADDR }); // number
      
      p.readContract.mockResolvedValue('str');
      await acts.name({ token: ADDR });
      await acts.symbol({ token: ADDR });
      await acts.version({ token: ADDR });
      p.readContract.mockResolvedValue(USER);
      await acts.owner({ token: ADDR });

      expect(p.readContract).toHaveBeenCalledTimes(10);
    });
    
    it('write ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const acts = gTokenActions(ADDR)(w);
      await acts.transfer({ token: ADDR, to: USER, amount: 100n, account: USER });
      await acts.transferFrom({ token: ADDR, from: USER, to: USER, amount: 100n, account: USER });
      await acts.approve({ token: ADDR, spender: USER, amount: 100n, account: USER });
      await acts.mint({ token: ADDR, to: USER, amount: 100n, account: USER });
      await acts.burn({ token: ADDR, amount: 100n, account: USER });
      await acts.burnFrom({ token: ADDR, from: USER, amount: 100n, account: USER });
      await acts.transferOwnership({ token: ADDR, newOwner: USER, account: USER });
      await acts.renounceOwnership({ token: ADDR, account: USER });
      
      expect(w.writeContract).toHaveBeenCalledTimes(8);
    });
  });

  describe('XPNTs (ERC677 + Advanced)', () => {
    it('read ops', async () => {
      const acts = xPNTsTokenActions(ADDR)(p);
      p.readContract.mockResolvedValue(100n);
      await acts.exchangeRate({ token: ADDR });
      await acts.debts({ token: ADDR, user: USER });
      await acts.getDebt({ token: ADDR, user: USER });
      await acts.MAX_SINGLE_TX_LIMIT({ token: ADDR });
      await acts.nonces({ token: ADDR, owner: USER });
      
      p.readContract.mockResolvedValue(true);
      await acts.needsApproval({ token: ADDR, owner: USER, spender: USER, amount: 100n });
      await acts.autoApprovedSpenders({ token: ADDR, spender: USER });
      await acts.usedOpHashes({ token: ADDR, opHash: '0x' });
      
      p.readContract.mockResolvedValue(USER);
      await acts.SUPERPAYMASTER_ADDRESS({ token: ADDR });
      await acts.FACTORY({ token: ADDR });
      await acts.communityOwner({ token: ADDR });
      
      p.readContract.mockResolvedValue('str');
      await acts.communityENS({ token: ADDR });
      await acts.communityName({ token: ADDR });
      await acts.version({ token: ADDR });
      
      p.readContract.mockResolvedValue({});
      await acts.eip712Domain({ token: ADDR });
      
      expect(p.readContract).toHaveBeenCalledTimes(15);
    });

    it('write ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const acts = xPNTsTokenActions(ADDR)(w);
      
      // Inherited ERC20 writes (just test one to prove mapping)
      await acts.transfer({ token: ADDR, to: USER, amount: 100n, account: USER });
      
      // XPNTs writes
      await acts.burnFromWithOpHash({ token: ADDR, from: USER, amount: 100n, userOpHash: '0x', account: USER });
      await acts.updateExchangeRate({ token: ADDR, newRate: 100n, account: USER });
      await acts.recordDebt({ token: ADDR, user: USER, amountXPNTs: 100n, account: USER });
      await acts.repayDebt({ token: ADDR, amount: 100n, account: USER });
      await acts.addAutoApprovedSpender({ token: ADDR, spender: USER, account: USER });
      await acts.removeAutoApprovedSpender({ token: ADDR, spender: USER, account: USER });
      await acts.emergencyRevokePaymaster({ token: ADDR, account: USER });
      await acts.permit({ token: ADDR, owner: USER, spender: USER, value: 100n, deadline: 100n, v: 27, r: '0x', s: '0x', account: USER });
      await acts.transferAndCall({ token: ADDR, to: USER, amount: 100n, data: '0x', account: USER });
      await acts.transferCommunityOwnership({ token: ADDR, newOwner: USER, account: USER });
      await acts.setSuperPaymasterAddress({ token: ADDR, spAddress: USER, account: USER });

      expect(w.writeContract).toHaveBeenCalledTimes(12);
    });

    it('metadata', async () => {
      p.readContract.mockResolvedValue({ name: 'n', symbol: 's', communityName: 'cn', communityENS: 'ce', communityOwner: USER });
      const acts = xPNTsTokenActions(ADDR)(p);
      const meta = await acts.getMetadata({ token: ADDR });
      expect(meta).toBeDefined();
    });
  });

  describe('XPNTs (Spending limits / facilitators / emergency / rate constants)', () => {
    it('write ops assert functionName + args', async () => {
      w.writeContract.mockResolvedValue('0xhash');
      const acts = xPNTsTokenActions(ADDR)(w);

      await acts.setMaxSingleTxLimit({ token: ADDR, newLimit: 500n, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        address: ADDR, functionName: 'setMaxSingleTxLimit', args: [500n],
      }));

      await acts.setSpenderDailyCap({ token: ADDR, newCap: 1000n, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'setSpenderDailyCap', args: [1000n],
      }));

      const opHash = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
      await acts.recordDebtWithOpHash({ token: ADDR, user: USER, amountAPNTs: 42n, opHash, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'recordDebtWithOpHash', args: [USER, 42n, opHash],
      }));

      await acts.addApprovedFacilitator({ token: ADDR, facilitator: USER, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'addApprovedFacilitator', args: [USER],
      }));

      await acts.removeApprovedFacilitator({ token: ADDR, facilitator: USER, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'removeApprovedFacilitator', args: [USER],
      }));

      await acts.renounceFactory({ token: ADDR, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'renounceFactory', args: [],
      }));

      await acts.unsetEmergencyDisabled({ token: ADDR, account: USER });
      expect(w.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: 'unsetEmergencyDisabled', args: [],
      }));
    });

    it('read ops assert functionName + args', async () => {
      const acts = xPNTsTokenActions(ADDR)(p);
      const opHash = ('0x' + 'cd'.repeat(32)) as `0x${string}`;

      p.readContract.mockResolvedValue(123n);
      expect(await acts.maxSingleTxLimit({ token: ADDR })).toBe(123n);
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'maxSingleTxLimit', args: [] }));

      await acts.spenderDailyCapTokens({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'spenderDailyCapTokens', args: [] }));

      await acts.exchangeRateUpdatedAt({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'exchangeRateUpdatedAt', args: [] }));

      // Exchange-rate guard constants
      await acts.EXCHANGE_RATE_COOLDOWN({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'EXCHANGE_RATE_COOLDOWN', args: [] }));
      await acts.EXCHANGE_RATE_DELTA_BPS({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'EXCHANGE_RATE_DELTA_BPS', args: [] }));
      await acts.EXCHANGE_RATE_MAX({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'EXCHANGE_RATE_MAX', args: [] }));
      await acts.EXCHANGE_RATE_MIN({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'EXCHANGE_RATE_MIN', args: [] }));
      await acts.MAX_SINGLE_TX_LIMIT_CAP({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'MAX_SINGLE_TX_LIMIT_CAP', args: [] }));

      p.readContract.mockResolvedValue(true);
      expect(await acts.usedDebtHashes({ token: ADDR, opHash })).toBe(true);
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'usedDebtHashes', args: [opHash] }));
      await acts.emergencyDisabled({ token: ADDR });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'emergencyDisabled', args: [] }));
      await acts.approvedFacilitators({ token: ADDR, facilitator: USER });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'approvedFacilitators', args: [USER] }));

      p.readContract.mockResolvedValue(USER);
      expect(await acts.emergencyRevokedAddress({ token: ADDR })).toBe(USER);
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'emergencyRevokedAddress', args: [] }));
    });

    it('spenderRateLimit destructures the (dailyBurnTotal, windowStart, reserved) tuple', async () => {
      const acts = xPNTsTokenActions(ADDR)(p);
      p.readContract.mockResolvedValue([100n, 200n, 0n]);
      const rl = await acts.spenderRateLimit({ token: ADDR, spender: USER });
      expect(p.readContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'spenderRateLimit', args: [USER] }));
      expect(rl).toEqual({ dailyBurnTotal: 100n, windowStart: 200n, reserved: 0n });
    });
  });

  describe('Legacy tokenActions', () => {
    it('defaults to xPNTs', async () => {
      p.readContract.mockResolvedValue('1.0');
      const acts = tokenActions(ADDR)(p);
      expect(await acts.version({ token: ADDR })).toBe('1.0');
    });
  });
});
