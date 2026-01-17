import { describe, it, expect, beforeEach } from 'vitest';
import { blsActions, dvtActions as validatorDvtActions } from '../../src/actions/validators';
import { accountActions, accountFactoryActions } from '../../src/actions/account';
import { entryPointActions } from '../../src/actions/entryPoint';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Final Coverage Batch', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('BLS Validator Extended', () => {
    it('registerBLSPublicKey', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await blsActions(A)(w).registerBLSPublicKey({ publicKey: '0xkey', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('threshold', async () => { p.readContract.mockResolvedValue(3n); expect(await blsActions(A)(p).threshold()).toBe(3n); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await blsActions(A)(p).owner()).toBe(U); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await blsActions(A)(p).version()).toBe('1.0'); });
  });


  describe('Account Extended', () => {
    it('entryPoint', async () => { p.readContract.mockResolvedValue(U); expect(await accountActions(A)(p).entryPoint()).toBe(U); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await accountActions(A)(p).owner()).toBe(U); });
  });


});
