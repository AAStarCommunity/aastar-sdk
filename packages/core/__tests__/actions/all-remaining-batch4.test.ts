import { describe, it, expect, beforeEach } from 'vitest';
import { entryPointActions } from '../../src/actions/entryPoint';
import { blsActions, dvtActions as validatorDvtActions } from '../../src/actions/validators';
import { gTokenExtendedActions } from '../../src/actions/gtokenExtended';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('All Remaining Functions Batch 4', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('EntryPoint Complete', () => {
    it('depositTo', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).depositTo({ account: U }); expect(w.writeContract).toHaveBeenCalled(); });
    it('balanceOf', async () => { p.readContract.mockResolvedValue(5000n); expect(await entryPointActions(A)(p).balanceOf({ account: U })).toBe(5000n); });
    it('withdrawTo', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).withdrawTo({ withdrawAddress: U, withdrawAmount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('addStake', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).addStake({ unstakeDelaySec: 86400n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unlockStake', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).unlockStake({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('withdrawStake', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).withdrawStake({ withdrawAddress: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('BLS Validator Complete', () => {
    it('getValidatorCount', async () => { p.readContract.mockResolvedValue(5n); expect(await blsActions(A)(p).getValidatorCount()).toBe(5n); });
    it('getValidator', async () => { p.readContract.mockResolvedValue(U); expect(await blsActions(A)(p).getValidator({ index: 0n })).toBe(U); });
    it('isValidator', async () => { p.readContract.mockResolvedValue(true); expect(await blsActions(A)(p).isValidator({ validator: U })).toBe(true); });
    it('DOMAIN_SEPARATOR', async () => { p.readContract.mockResolvedValue('0xdomain'); expect(await blsActions(A)(p).DOMAIN_SEPARATOR()).toBe('0xdomain'); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await blsActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('DVT Validator Complete', () => {
    it('addValidatorBatch', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await validatorDvtActions(A)(w).addValidatorBatch({ validators: [U], account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('removeValidatorBatch', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await validatorDvtActions(A)(w).removeValidatorBatch({ validators: [U], account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('SUPERPAYMASTER', async () => { p.readContract.mockResolvedValue(U); expect(await validatorDvtActions(A)(p).SUPERPAYMASTER()).toBe(U); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await validatorDvtActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('GTokenExtended Complete', () => {
    it('approve', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await gTokenExtendedActions(A)(w).approve({ spender: U, amount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('allowance', async () => { p.readContract.mockResolvedValue(500n); expect(await gTokenExtendedActions(A)(p).allowance({ owner: U, spender: U })).toBe(500n); });
    it('burnFrom', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await gTokenExtendedActions(A)(w).burnFrom({ from: U, amount: 10n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await gTokenExtendedActions(A)(p).owner()).toBe(U); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await gTokenExtendedActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
