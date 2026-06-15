import { describe, it, expect, beforeEach, vi } from 'vitest';
import { keccak256, toBytes, encodeFunctionData, encodeAbiParameters } from 'viem';
import { registryActions } from '../../src/actions/registry';
import { RegistryABI } from '../../src/abis/index';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('RegistryActions Bulk Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Role Management (Writes)', () => {
    it('createNewRole', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).createNewRole({ roleId: '0x01', config: {} as any, roleOwner: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setRoleLockDuration', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setRoleLockDuration({ roleId: '0x01', duration: 100n, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setRoleOwner', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setRoleOwner({ roleId: '0x01', newOwner: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('exitRole', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).exitRole({ roleId: '0x01', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('syncExitFees - sends tx for non-empty array', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).syncExitFees({ roles: ['0x01' as `0x${string}`], account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('syncExitFees - rejects empty array', async () => { await expect(registryActions(ADDR)(w).syncExitFees({ roles: [], account: USER })).rejects.toThrow('must not be empty'); });
  });

  describe('Community & Credit (Views/Writes)', () => {
    it('communityByName', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).communityByName({ name: 'test' })).toBe(USER); });
    it('communityByENS', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).communityByENS({ ensName: 'test.eth' })).toBe(USER); });
    it('getCreditLimit', async () => { p.readContract.mockResolvedValue(100n); expect(await registryActions(ADDR)(p).getCreditLimit({ user: USER })).toBe(100n); });
    it('globalReputation', async () => { p.readContract.mockResolvedValue(100n); expect(await registryActions(ADDR)(p).globalReputation({ user: USER })).toBe(100n); });
    it('addLevelThreshold', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).addLevelThreshold({ threshold: 100n, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('batchUpdateGlobalReputation', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).batchUpdateGlobalReputation({ proposalId: 1n, users: [USER], newScores: [100n], epoch: 1n, proof: '0x', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Contract References (Setters)', () => {
    it('setBLSAggregator', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setBLSAggregator({ aggregator: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setMySBT', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setMySBT({ sbt: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setSuperPaymaster', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setSuperPaymaster({ paymaster: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setStaking', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setStaking({ staking: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setReputationSource', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).setReputationSource({ source: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Contract References (Getters)', () => {
    it('blsAggregator', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).blsAggregator()).toBe(USER); });
    it('MYSBT', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).MYSBT()).toBe(USER); });
    it('SUPER_PAYMASTER', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).SUPER_PAYMASTER()).toBe(USER); });
    it('GTOKEN_STAKING', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).GTOKEN_STAKING()).toBe(USER); });
    it('reputationSource', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).reputationSource()).toBe(USER); });
    it('isReputationSource', async () => { p.readContract.mockResolvedValue(true); expect(await registryActions(ADDR)(p).isReputationSource({ source: USER })).toBe(true); });
    it('lastReputationEpoch', async () => { p.readContract.mockResolvedValue(1n); expect(await registryActions(ADDR)(p).lastReputationEpoch({ user: USER })).toBe(1n); });
  });

  describe('View Functions', () => {
    it('getRoleUserCount', async () => { p.readContract.mockResolvedValue(10n); expect(await registryActions(ADDR)(p).getRoleUserCount({ roleId: '0x01' })).toBe(10n); });
    it('getRoleMembers', async () => { p.readContract.mockResolvedValue([USER]); expect(await registryActions(ADDR)(p).getRoleMembers({ roleId: '0x01' })).toEqual([USER]); });
    it('getUserRoles', async () => { p.readContract.mockResolvedValue(['0x01']); expect(await registryActions(ADDR)(p).getUserRoles({ user: USER })).toEqual(['0x01']); });
    it('roleMembers', async () => { p.readContract.mockResolvedValue(USER); expect(await registryActions(ADDR)(p).roleMembers({ roleId: '0x01', index: 0n })).toBe(USER); });
    it('userRoles', async () => { p.readContract.mockResolvedValue('0x01'); expect(await registryActions(ADDR)(p).userRoles({ user: USER, index: 0n })).toBe('0x01'); });
    it('userRoleCount', async () => { p.readContract.mockResolvedValue(1n); expect(await registryActions(ADDR)(p).userRoleCount({ user: USER })).toBe(1n); });
    it('creditTierConfig', async () => { p.readContract.mockResolvedValue(100n); expect(await registryActions(ADDR)(p).creditTierConfig({ tierIndex: 0n })).toBe(100n); });
    it('levelThresholds', async () => { p.readContract.mockResolvedValue(100n); expect(await registryActions(ADDR)(p).levelThresholds({ levelIndex: 0n })).toBe(100n); });
    it('calculateExitFee', async () => { p.readContract.mockResolvedValue(5n); expect(await registryActions(ADDR)(p).calculateExitFee({ roleId: '0x01', amount: 100n })).toBe(5n); });
    it('roleStakes', async () => { p.readContract.mockResolvedValue(100n); expect(await registryActions(ADDR)(p).roleStakes({ roleId: '0x01', user: USER })).toBe(100n); });
    it('roleMetadata', async () => { p.readContract.mockResolvedValue('0x'); expect(await registryActions(ADDR)(p).roleMetadata({ roleId: '0x01', user: USER })).toBe('0x'); });
  });

  describe('Constants (Role IDs)', () => {
    // Role IDs are compile-time keccak256 constants in the contract (IRegistry.sol),
    // NOT on-chain getters — the SDK must compute them locally (no readContract call).
    const roleId = (s: string) => keccak256(toBytes(s));
    it('ROLE_COMMUNITY = keccak256("COMMUNITY")', async () => { expect(await registryActions(ADDR)(p).ROLE_COMMUNITY()).toBe(roleId('COMMUNITY')); });
    it('ROLE_ENDUSER = keccak256("ENDUSER")', async () => { expect(await registryActions(ADDR)(p).ROLE_ENDUSER()).toBe(roleId('ENDUSER')); });
    it('ROLE_PAYMASTER_SUPER', async () => { expect(await registryActions(ADDR)(p).ROLE_PAYMASTER_SUPER()).toBe(roleId('PAYMASTER_SUPER')); });
    it('ROLE_PAYMASTER_AOA', async () => { expect(await registryActions(ADDR)(p).ROLE_PAYMASTER_AOA()).toBe(roleId('PAYMASTER_AOA')); });
    it('ROLE_DVT', async () => { expect(await registryActions(ADDR)(p).ROLE_DVT()).toBe(roleId('DVT')); });
    it('ROLE_KMS', async () => { expect(await registryActions(ADDR)(p).ROLE_KMS()).toBe(roleId('KMS')); });
    it('ROLE_ANODE', async () => { expect(await registryActions(ADDR)(p).ROLE_ANODE()).toBe(roleId('ANODE')); });
    it('does NOT call readContract for role IDs (regression: was reverting on-chain)', async () => {
      p.readContract.mockClear();
      await registryActions(ADDR)(p).ROLE_COMMUNITY();
      expect(p.readContract).not.toHaveBeenCalled();
    });
  });

  describe('Ownership & Version', () => {
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).transferOwnership({ newOwner: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x'); await registryActions(ADDR)(w).renounceOwnership({ account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await registryActions(ADDR)(p).version()).toBe('1.0'); });
  });
});

// P1.5 — on-chain community registry queries (Beta3.1 Wave 2).
const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));
const COMMUNITY_ROLE_DATA_PARAMS = [{
  type: 'tuple',
  components: [
    { name: 'name', type: 'string' },
    { name: 'ensName', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'logoURI', type: 'string' },
    { name: 'stakeAmount', type: 'uint256' }
  ]
}] as const;

const buildRoleData = (pr: { name: string; ensName: string; website: string; description: string; logoURI: string; stakeAmount: bigint }) =>
  encodeAbiParameters(COMMUNITY_ROLE_DATA_PARAMS, [[pr.name, pr.ensName, pr.website, pr.description, pr.logoURI, pr.stakeAmount] as any]);

describe('RegistryActions — P1.5 community registry queries', () => {
  let p: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); p.getLogs = vi.fn(); p.getTransaction = vi.fn(); });

  describe('PART A — on-chain getters (ABI-confirmed)', () => {
    it('getCommunityByName reads the correct ABI function name', async () => {
      p.readContract.mockResolvedValue(USER);
      const out = await registryActions(ADDR)(p).getCommunityByName({ name: 'AAStar' });
      expect(out).toBe(USER);
      expect(p.readContract.mock.calls[0][0].functionName).toBe('getCommunityByName');
      expect(p.readContract.mock.calls[0][0].args).toEqual(['AAStar']);
    });

    it('getCommunityByENS reads the correct ABI function name', async () => {
      p.readContract.mockResolvedValue(USER);
      const out = await registryActions(ADDR)(p).getCommunityByENS({ ensName: 'aastar.eth' });
      expect(out).toBe(USER);
      expect(p.readContract.mock.calls[0][0].functionName).toBe('getCommunityByENS');
    });

    it('getRoleStake / getEffectiveStake pass args in ABI-declared order', async () => {
      const act = registryActions(ADDR)(p);
      p.readContract.mockResolvedValue(500n);
      await act.getRoleStake({ roleId: ROLE_COMMUNITY, user: USER });
      expect(p.readContract.mock.calls[0][0].functionName).toBe('getRoleStake');
      expect(p.readContract.mock.calls[0][0].args).toEqual([ROLE_COMMUNITY, USER]); // (roleId, user)

      await act.getEffectiveStake({ user: USER, roleId: ROLE_COMMUNITY });
      expect(p.readContract.mock.calls[1][0].functionName).toBe('getEffectiveStake');
      expect(p.readContract.mock.calls[1][0].args).toEqual([USER, ROLE_COMMUNITY]); // (user, roleId)
    });
  });

  describe('PART B — getCommunityProfile (event -> calldata back-trace)', () => {
    it('returns null when no RoleRegistered log is found', async () => {
      p.getLogs.mockResolvedValue([]);
      const out = await registryActions(ADDR)(p).getCommunityProfile({ community: USER });
      expect(out).toBeNull();
      // Filtered by indexed [roleId=ROLE_COMMUNITY, user=community].
      expect(p.getLogs.mock.calls[0][0].args).toEqual({ roleId: ROLE_COMMUNITY, user: USER });
    });

    it('back-traces registerRole calldata and decodes the community profile', async () => {
      const profile = { name: 'AAStar', ensName: 'aastar.eth', website: 'https://aastar.io', description: 'infra', logoURI: 'ipfs://logo', stakeAmount: 1000n };
      const roleData = buildRoleData(profile);
      const calldata = encodeFunctionData({ abi: RegistryABI, functionName: 'registerRole', args: [ROLE_COMMUNITY, USER, roleData] });

      p.getLogs.mockResolvedValue([{ transactionHash: '0xdeadbeef', args: { roleId: ROLE_COMMUNITY, user: USER, burnAmount: 42n, timestamp: 1700000000n } }]);
      p.getTransaction.mockResolvedValue({ input: calldata });

      const out = await registryActions(ADDR)(p).getCommunityProfile({ community: USER });
      expect(out).not.toBeNull();
      expect(out!.name).toBe('AAStar');
      expect(out!.ensName).toBe('aastar.eth');
      expect(out!.website).toBe('https://aastar.io');
      expect(out!.description).toBe('infra');
      expect(out!.logoURI).toBe('ipfs://logo');
      expect(out!.stakeAmount).toBe(1000n);
      expect(out!.burnAmount).toBe(42n);
      expect(out!.registeredAt).toBe(1700000000n);
      expect(out!.txHash).toBe('0xdeadbeef');
      expect(out!.rawRoleData).toBe(roleData);
      expect(p.getTransaction.mock.calls[0][0]).toEqual({ hash: '0xdeadbeef' });
    });

    it('decodes safeMintForRole calldata (the other registration entrypoint, roleData at arg index 2)', async () => {
      const roleData = buildRoleData({ name: 'MintedCommunity', ensName: '', website: '', description: '', logoURI: '', stakeAmount: 0n });
      const calldata = encodeFunctionData({ abi: RegistryABI, functionName: 'safeMintForRole', args: [ROLE_COMMUNITY, USER, roleData] });
      p.getLogs.mockResolvedValue([{ transactionHash: '0xabc', args: { burnAmount: 0n, timestamp: 1n } }]);
      p.getTransaction.mockResolvedValue({ input: calldata });
      const out = await registryActions(ADDR)(p).getCommunityProfile({ community: USER });
      expect(out!.name).toBe('MintedCommunity');
    });

    it('returns null when the originating transaction has empty calldata', async () => {
      p.getLogs.mockResolvedValue([{ transactionHash: '0xabc', args: {} }]);
      p.getTransaction.mockResolvedValue({ input: '0x' });
      const out = await registryActions(ADDR)(p).getCommunityProfile({ community: USER });
      expect(out).toBeNull();
    });
  });
});
