import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterActions } from '../../src/actions/paymaster';
import { reputationActions } from '../../src/actions/reputation';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;  
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('All Remaining Functions Batch 2', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Paymaster All', () => {
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await paymasterActions(A)(p).version()).toBe('1.0'); });
  });


});
