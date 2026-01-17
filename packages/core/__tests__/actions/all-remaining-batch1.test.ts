import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { sbtActions } from '../../src/actions/sbt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('All Remaining Functions Batch 1', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Registry All', () => {
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Staking All', () => {
    it('lockStake', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(A)(w).lockStake({ user: U, roleId: 1n, stakeAmount: 100n, entryBurn: 10n, payer: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getStakingBalance', async () => { p.readContract.mockResolvedValue(500n); expect(await stakingActions(A)(p).getStakingBalance({ user: U })).toBe(500n); });
  });

  describe('SBT All', () => {
    it('safeTransferFrom', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await sbtActions(A)(w).safeTransferFrom({ from: U, to: U, tokenId: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('tokenByIndex', async () => { p.readContract.mockResolvedValue(5n); expect(await sbtActions(A)(p).tokenByIndex({ index: 0n })).toBe(5n); });
    it('tokenOfOwnerByIndex', async () => { p.readContract.mockResolvedValue(3n); expect(await sbtActions(A)(p).tokenOfOwnerByIndex({ owner: U, index: 0n })).toBe(3n); });
    it('getSBTData', async () => { p.readContract.mockResolvedValue({}); await sbtActions(A)(p).getSBTData({ tokenId: 1n }); expect(p.readContract).toHaveBeenCalled(); });
    it('getCommunityMembership', async () => { p.readContract.mockResolvedValue(10n); expect(await sbtActions(A)(p).getCommunityMembership({ user: U, community: U })).toBe(10n); });
    it('isApprovedForAll', async () => { p.readContract.mockResolvedValue(true); expect(await sbtActions(A)(p).isApprovedForAll({ owner: U, operator: U })).toBe(true); });
    it('supportsInterface', async () => { p.readContract.mockResolvedValue(true); expect(await sbtActions(A)(p).supportsInterface({ interfaceId: '0x01' })).toBe(true); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await sbtActions(A)(p).owner()).toBe(U); });
  });
});
