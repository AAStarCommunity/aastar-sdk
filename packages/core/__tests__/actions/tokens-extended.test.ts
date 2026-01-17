import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Token All Functions', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('transferFrom', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).transferFrom({ token: T, from: U, to: U, amount: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('name', async () => { p.readContract.mockResolvedValue('T'); expect(await tokenActions()(p).name({ token: T })).toBe('T'); });
  it('symbol', async () => { p.readContract.mockResolvedValue('TKN'); expect(await tokenActions()(p).symbol({ token: T })).toBe('TKN'); });
  it('decimals', async () => { p.readContract.mockResolvedValue(18); expect(await tokenActions()(p).decimals({ token: T })).toBe(18); });
  it('getMetadata', async () => { p.readContract.mockResolvedValue({ name: 'T', symbol: 'TKN', ens: '', logo: '', owner: U }); const r = await tokenActions()(p).getMetadata({ token: T }); expect(r.name).toBe('T'); });
  it('needsApproval', async () => { p.readContract.mockResolvedValue(true); expect(await tokenActions()(p).needsApproval({ token: T, owner: U, spender: U, amount: 100n })).toBe(true); });
});
