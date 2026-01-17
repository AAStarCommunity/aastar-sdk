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
    it('setThreshold', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await blsActions(A)(w).setThreshold({ newThreshold: 4n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('verifySignature', async () => { p.readContract.mockResolvedValue(true); expect(await blsActions(A)(p).verifySignature({ publicKey: '0xkey', message: '0xmsg', signature: '0xsig' })).toBe(true); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await blsActions(A)(p).owner()).toBe(U); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await blsActions(A)(p).version()).toBe('1.0'); });
  });

  describe('DVT Validator Extended', () => {
    it('validators', async () => { p.readContract.mockResolvedValue(true); expect(await validatorDvtActions(A)(p).validators({ validator: U })).toBe(true); });
    it('getValidator', async () => { p.readContract.mockResolvedValue(U); expect(await validatorDvtActions(A)(p).getValidator({ index: 0n })).toBe(U); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(U); expect(await validatorDvtActions(A)(p).REGISTRY()).toBe(U); });
    it('BLS_AGGREGATOR', async () => { p.readContract.mockResolvedValue(U); expect(await validatorDvtActions(A)(p).BLS_AGGREGATOR()).toBe(U); });
  });

  describe('Account Extended', () => {
    it('entryPoint', async () => { p.readContract.mockResolvedValue(U); expect(await accountActions(A)(p).entryPoint()).toBe(U); });
    it('executeBatch', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await accountActions(A)(w).executeBatch({ dests: [U], values: [1n], funcs: ['0x'], account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('validateUserOp', async () => { p.readContract.mockResolvedValue(0n); await accountActions(A)(p).validateUserOp({ userOp: {}, userOpHash: '0x', missingAccountFunds: 0n }); expect(p.readContract).toHaveBeenCalled(); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await accountActions(A)(p).owner()).toBe(U); });
  });

  describe('AccountFactory Extended', () => {
    it('accountImplementation', async () => { p.readContract.mockResolvedValue(U); expect(await accountFactoryActions(A)(p).accountImplementation()).toBe(U); });
  });

  describe('EntryPoint Extended', () => {
    it('handleOps', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).handleOps({ ops: [], beneficiary: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('handleAggregatedOps', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await entryPointActions(A)(w).handleAggregatedOps({ opsPerAggregator: [], beneficiary: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getUserOpHash', async () => { p.readContract.mockResolvedValue('0xhash'); expect(await entryPointActions(A)(p).getUserOpHash({ userOp: {} })).toBe('0xhash'); });
  });
});
