import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { paymasterActions } from '../../src/actions/paymaster';
import { sbtActions } from '../../src/actions/sbt';
import { reputationActions } from '../../src/actions/reputation';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Comprehensive Action Tests Batch 2', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Registry Extended', () => {
    it('configureRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(A)(w).configureRole({ roleId: 1n, config: {}, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('registerRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(A)(w).registerRole({ roleId: 1n, user: U, data: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getRoleConfig', async () => { p.readContract.mockResolvedValue({}); await registryActions(A)(p).getRoleConfig({ roleId: 1n }); expect(p.readContract).toHaveBeenCalled(); });
    it('mySBT', async () => { p.readContract.mockResolvedValue(U); expect(await registryActions(A)(p).mySBT()).toBe(U); });
    it('superPaymaster', async () => { p.readContract.mockResolvedValue(U); expect(await registryActions(A)(p).superPaymaster()).toBe(U); });
    it('ROLE_ENDUSER', async () => { p.readContract.mockResolvedValue(2n); expect(await registryActions(A)(p).ROLE_ENDUSER()).toBe(2n); });
    it('ROLE_PAYMASTER_SUPER', async () => { p.readContract.mockResolvedValue(3n); expect(await registryActions(A)(p).ROLE_PAYMASTER_SUPER()).toBe(3n); });
    it('communityToToken', async () => { p.readContract.mockResolvedValue(U); expect(await registryActions(A)(p).communityToToken({ community: U })).toBe(U); });
    it('getCreditLimit', async () => { p.readContract.mockResolvedValue(1000n); expect(await registryActions(A)(p).getCreditLimit({ user: U })).toBe(1000n); });
  });

  describe('Staking Extended', () => {
    it('getLockedStake', async () => { p.readContract.mockResolvedValue(500n); expect(await stakingActions(A)(p).getLockedStake({ user: U, roleId: 1n })).toBe(500n); });
    it('hasRoleLock', async () => { p.readContract.mockResolvedValue(true); expect(await stakingActions(A)(p).hasRoleLock({ user: U, roleId: 1n })).toBe(true); });
    it('availableBalance', async () => { p.readContract.mockResolvedValue(300n); expect(await stakingActions(A)(p).availableBalance({ user: U })).toBe(300n); });
    it('totalStaked', async () => { p.readContract.mockResolvedValue(5000n); expect(await stakingActions(A)(p).totalStaked()).toBe(5000n); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await stakingActions(A)(p).owner()).toBe(U); });
  });

  describe('Paymaster Extended', () => {
    it('addGasToken', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).addGasToken({ token: U, priceFeed: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getSupportedGasTokens', async () => { p.readContract.mockResolvedValue([U]); expect(await paymasterActions(A)(p).getSupportedGasTokens()).toEqual([U]); });
    it('addSBT', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).addSBT({ sbt: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getSupportedSBTs', async () => { p.readContract.mockResolvedValue([U]); expect(await paymasterActions(A)(p).getSupportedSBTs()).toEqual([U]); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await paymasterActions(A)(p).owner()).toBe(U); });
  });

  describe('SBT Extended', () => {
    it('safeMintForRole', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await sbtActions(A)(w).safeMintForRole({ roleId: 1n, to: U, tokenURI: 'uri', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('ownerOf', async () => { p.readContract.mockResolvedValue(U); expect(await sbtActions(A)(p).ownerOf({ tokenId: 1n })).toBe(U); });
    it('tokenURI', async () => { p.readContract.mockResolvedValue('uri'); expect(await sbtActions(A)(p).tokenURI({ tokenId: 1n })).toBe('uri'); });
    it('totalSupply', async () => { p.readContract.mockResolvedValue(100n); expect(await sbtActions(A)(p).totalSupply()).toBe(100n); });
    it('symbol', async () => { p.readContract.mockResolvedValue('SBT'); expect(await sbtActions(A)(p).symbol()).toBe('SBT'); });
    it('approve', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await sbtActions(A)(w).approve({ to: U, tokenId: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getApproved', async () => { p.readContract.mockResolvedValue(U); expect(await sbtActions(A)(p).getApproved({ tokenId: 1n })).toBe(U); });
    it('setApprovalForAll', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await sbtActions(A)(w).setApprovalForAll({ operator: U, approved: true, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Reputation Extended', () => {
    it('enableRule', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await reputationActions(A)(w).enableRule({ ruleId: '0x01', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('disableRule', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await reputationActions(A)(w).disableRule({ ruleId: '0x01', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getCommunityScore', async () => { p.readContract.mockResolvedValue(500n); expect(await reputationActions(A)(p).getCommunityScore({ community: U })).toBe(500n); });
    it('communityReputations', async () => { p.readContract.mockResolvedValue(300n); expect(await reputationActions(A)(p).communityReputations({ community: U, user: U })).toBe(300n); });
    it('getRuleCount', async () => { p.readContract.mockResolvedValue(10n); expect(await reputationActions(A)(p).getRuleCount()).toBe(10n); });
    it('owner', async () => { p.readContract.mockResolvedValue(U); expect(await reputationActions(A)(p).owner()).toBe(U); });
  });

  describe('SuperPaymaster Extended', () => {
    it('entryPoint', async () => { p.readContract.mockResolvedValue(U); expect(await superPaymasterActions(A)(p).entryPoint()).toBe(U); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(U); expect(await superPaymasterActions(A)(p).REGISTRY()).toBe(U); });
    it('APNTS_TOKEN', async () => { p.readContract.mockResolvedValue(U); expect(await superPaymasterActions(A)(p).APNTS_TOKEN()).toBe(U); });
    it('protocolFeeBPS', async () => { p.readContract.mockResolvedValue(100n); expect(await superPaymasterActions(A)(p).protocolFeeBPS()).toBe(100n); });
    it('protocolRevenue', async () => { p.readContract.mockResolvedValue(5000n); expect(await superPaymasterActions(A)(p).protocolRevenue()).toBe(5000n); });
    it('operators', async () => { p.readContract.mockResolvedValue({}); await superPaymasterActions(A)(p).operators({ operator: U }); expect(p.readContract).toHaveBeenCalled(); });
    it('setProtocolFee', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).setProtocolFee({ feeRecipient: U, feeBps: 200n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('withdrawProtocolRevenue', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).withdrawProtocolRevenue({ to: U, amount: 1000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
