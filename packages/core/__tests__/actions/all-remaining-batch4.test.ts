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
    it('balanceOf', async () => { p.readContract.mockResolvedValue(5000n); expect(await entryPointActions(A)(p).balanceOf({ account: U })).toBe(5000n); });
  });

  describe('BLS Validator Complete', () => {
  });

  describe('DVT Validator Complete', () => {
  });

  describe('GTokenExtended Complete', () => {
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await gTokenExtendedActions(A)(p).owner()).toBe(U); });
  });
});
