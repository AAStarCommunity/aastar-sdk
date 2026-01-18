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
      await acts.totalSupply();
      await acts.balanceOf({ account: USER });
      await acts.allowance({ owner: USER, spender: USER });
      await acts.cap();
      await acts.remainingMintableSupply();
      await acts.decimals(); // number
      
      p.readContract.mockResolvedValue('str');
      await acts.name();
      await acts.symbol();
      await acts.version();
      p.readContract.mockResolvedValue(USER);
      await acts.owner();

      expect(p.readContract).toHaveBeenCalledTimes(10);
    });
    
    it('write ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const acts = gTokenActions(ADDR)(w);
      await acts.transfer({ to: USER, amount: 100n, account: USER });
      await acts.transferFrom({ from: USER, to: USER, amount: 100n, account: USER });
      await acts.approve({ spender: USER, amount: 100n, account: USER });
      await acts.mint({ to: USER, amount: 100n, account: USER });
      await acts.burn({ amount: 100n, account: USER });
      await acts.burnFrom({ from: USER, amount: 100n, account: USER });
      await acts.transferOwnership({ newOwner: USER, account: USER });
      await acts.renounceOwnership({ account: USER });
      
      expect(w.writeContract).toHaveBeenCalledTimes(8);
    });
  });

  describe('XPNTs (ERC677 + Advanced)', () => {
    it('read ops', async () => {
      const acts = xPNTsTokenActions(ADDR)(p);
      p.readContract.mockResolvedValue(100n);
      await acts.exchangeRate();
      await acts.debts({ user: USER });
      await acts.getDebt({ user: USER });
      await acts.spendingLimits({ owner: USER, spender: USER });
      await acts.cumulativeSpent({ owner: USER, spender: USER });
      await acts.DEFAULT_SPENDING_LIMIT_APNTS();
      await acts.getDefaultSpendingLimitXPNTs();
      await acts.nonces({ owner: USER });
      
      p.readContract.mockResolvedValue(true);
      await acts.needsApproval({ owner: USER, spender: USER, amount: 100n });
      await acts.autoApprovedSpenders({ spender: USER });
      await acts.usedOpHashes({ opHash: '0x' });
      
      p.readContract.mockResolvedValue(USER);
      await acts.SUPERPAYMASTER_ADDRESS();
      await acts.FACTORY();
      await acts.communityOwner();
      
      p.readContract.mockResolvedValue('str');
      await acts.communityENS();
      await acts.communityName();
      await acts.version();
      
      p.readContract.mockResolvedValue({});
      await acts.eip712Domain();
      
      expect(p.readContract).toHaveBeenCalledTimes(18);
    });

    it('write ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const acts = xPNTsTokenActions(ADDR)(w);
      
      // Inherited ERC20 writes (just test one to prove mapping)
      await acts.transfer({ to: USER, amount: 100n, account: USER });
      
      // XPNTs writes
      await acts.burnFromWithOpHash({ from: USER, amount: 100n, userOpHash: '0x', account: USER });
      await acts.updateExchangeRate({ newRate: 100n, account: USER });
      await acts.recordDebt({ user: USER, amountXPNTs: 100n, account: USER });
      await acts.repayDebt({ amount: 100n, account: USER });
      await acts.setPaymasterLimit({ spender: USER, limit: 100n, account: USER });
      await acts.addAutoApprovedSpender({ spender: USER, account: USER });
      await acts.removeAutoApprovedSpender({ spender: USER, account: USER });
      await acts.permit({ owner: USER, spender: USER, value: 100n, deadline: 100n, v: 27, r: '0x', s: '0x', account: USER });
      await acts.transferAndCall({ to: USER, amount: 100n, data: '0x', account: USER });
      await acts.transferCommunityOwnership({ newOwner: USER, account: USER });
      await acts.setSuperPaymasterAddress({ spAddress: USER, account: USER });

      expect(w.writeContract).toHaveBeenCalledTimes(12);
    });

    it('metadata', async () => {
      p.readContract.mockResolvedValue({ name: 'n', symbol: 's', communityName: 'cn', communityENS: 'ce', communityOwner: USER });
      const acts = xPNTsTokenActions(ADDR)(p);
      const meta = await acts.getMetadata();
      expect(meta).toBeDefined();
    });
  });

  describe('Legacy tokenActions', () => {
    it('defaults to xPNTs', async () => {
      p.readContract.mockResolvedValue('1.0');
      const acts = tokenActions(ADDR)(p);
      expect(await acts.version()).toBe('1.0');
    });
  });
});
