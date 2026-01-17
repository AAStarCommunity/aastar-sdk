import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Token Extended Tests', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('transferFrom', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).transferFrom({ token: T, from: U, to: U, amount: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('name', async () => { p.readContract.mockResolvedValue('T'); expect(await tokenActions()(p).name({ token: T })).toBe('T'); });
  it('symbol', async () => { p.readContract.mockResolvedValue('TKN'); expect(await tokenActions()(p).symbol({ token: T })).toBe('TKN'); });
  it('decimals', async () => { p.readContract.mockResolvedValue(18); expect(await tokenActions()(p).decimals({ token: T })).toBe(18); });
  it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await tokenActions()(p).owner({ token: T })).toBe(U); });
  it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).transferOwnership({ token: T, newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('updateExchangeRate', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).updateExchangeRate({ token: T, newRate: 1000000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('wrap', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).wrap({ token: T, amount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('unwrap', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).unwrap({ token: T, amount: 50n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('increaseDebt', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).increaseDebt({ token: T, debtor: U, amount: 10n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('decreaseDebt', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).decreaseDebt({ token: T, debtor: U, amount: 5n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('debt', async () => { p.readContract.mockResolvedValue(100n); expect(await tokenActions()(p).debt({ token: T, user: U })).toBe(100n); });
  it('setSpendingLimit', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).setSpendingLimit({ token: T, spender: U, limit: 1000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('spendingLimits', async () => { p.readContract.mockResolvedValue(500n); expect(await tokenActions()(p).spendingLimits({ token: T, owner: U, spender: U })).toBe(500n); });
  it('nonces', async () => { p.readContract.mockResolvedValue(10n); expect(await tokenActions()(p).nonces({ token: T, owner: U })).toBe(10n); });
  it('DOMAIN_SEPARATOR', async () => { p.readContract.mockResolvedValue('0xabc'); expect(await tokenActions()(p).DOMAIN_SEPARATOR({ token: T })).toBe('0xabc'); });
  it('permit', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).permit({ token: T, owner: U, spender: U, value: 100n, deadline: 9999999999n, v: 27, r: '0x', s: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('getCommunityMetadata', async () => { p.readContract.mockResolvedValue({ name: 'C', description: 'D', imageURI: 'I' }); const r = await tokenActions()(p).getCommunityMetadata({ token: T }); expect(r).toBeDefined(); });
  it('setCommunityMetadata', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).setCommunityMetadata({ token: T, metadata: { name: 'C', description: 'D', imageURI: 'I' }, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
});
