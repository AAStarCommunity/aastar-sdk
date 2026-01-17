import { describe, it, expect, beforeEach } from 'vitest';
import { xPNTsFactoryActions, paymasterFactoryActions } from '../../src/actions/factory';
import { aggregatorActions } from '../../src/actions/aggregator';
import { dvtActions } from '../../src/actions/dvt';
import { gTokenExtendedActions } from '../../src/actions/gtokenExtended';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Comprehensive Action Tests Batch 3', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('xPNTsFactory Extended', () => {
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).owner()).toBe(U); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).REGISTRY()).toBe(U); });
    it('getImplementation', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).getImplementation()).toBe(U); });
    it('deployedTokens', async () => { p.readContract.mockResolvedValue(U); expect(await xPNTsFactoryActions(A)(p).deployedTokens({ index: 0n })).toBe(U); });
  });

  describe('PaymasterFactory Extended', () => {
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await paymasterFactoryActions(A)(p).owner()).toBe(U); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(U); expect(await paymasterFactoryActions(A)(p).REGISTRY()).toBe(U); });
  });

  describe('Aggregator Extended', () => {
    it('blsPublicKeys', async () => { p.readContract.mockResolvedValue(['0xkey', true]); await aggregatorActions(A)(p).blsPublicKeys({ validator: U }); expect(p.readContract).toHaveBeenCalled(); });
    it('setBLSThreshold', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setBLSThreshold({ threshold: 3, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setDefaultThreshold', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setDefaultThreshold({ newThreshold: 2n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setMinThreshold', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).setMinThreshold({ newThreshold: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('defaultThreshold', async () => { p.readContract.mockResolvedValue(2n); expect(await aggregatorActions(A)(p).defaultThreshold()).toBe(2n); });
    it('minThreshold', async () => { p.readContract.mockResolvedValue(1n); expect(await aggregatorActions(A)(p).minThreshold()).toBe(1n); });
    it('executeProposal', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await aggregatorActions(A)(w).executeProposal({ proposalId: '0x01', target: U, callData: '0x', requiredThreshold: 2n, proof: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('executedProposals', async () => { p.readContract.mockResolvedValue(true); expect(await aggregatorActions(A)(p).executedProposals({ proposalId: '0x01' })).toBe(true); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await aggregatorActions(A)(p).owner()).toBe(U); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await aggregatorActions(A)(p).version()).toBe('1.0'); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(U); expect(await aggregatorActions(A)(p).REGISTRY()).toBe(U); });
    it('DVT_VALIDATOR', async () => { p.readContract.mockResolvedValue(U); expect(await aggregatorActions(A)(p).DVT_VALIDATOR()).toBe(U); });
    it('SUPERPAYMASTER', async () => { p.readContract.mockResolvedValue(U); expect(await aggregatorActions(A)(p).SUPERPAYMASTER()).toBe(U); });
  });

  describe('DVT Extended', () => {
    it('signSlashProposal', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).signSlashProposal({ proposalId: '0x01', signature: '0xsig', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('addValidator', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await dvtActions(A)(w).addValidator({ validator: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await dvtActions(A)(p).owner()).toBe(U); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await dvtActions(A)(p).version()).toBe('1.0'); });
  });

  describe('GTokenExtended', () => {
    it('mint', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await gTokenExtendedActions(A)(w).mint({ to: U, amount: 50n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('burn', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await gTokenExtendedActions(A)(w).burn({ amount: 25n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
