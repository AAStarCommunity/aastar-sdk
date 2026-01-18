import { describe, it, expect, beforeEach } from 'vitest';
import { sbtActions } from '../../src/actions/sbt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('SBTActions Exhaustive Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Minting & Burning', () => {
    it('minting ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = sbtActions(ADDR)(w);
      await act.airdropMint({ user: USER, roleId: '0x01', roleData: '0x', account: USER });
      await act.mintForRole({ user: USER, roleId: '0x01', roleData: '0x', account: USER });
      await act.burnSBT({ user: USER, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(3);
    });
  });

  describe('Membership & Activity', () => {
    it('membership ops', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = sbtActions(ADDR)(w);
      await act.leaveCommunity({ community: ADDR, account: USER });
      await act.deactivateMembership({ user: USER, community: ADDR, account: USER });
      await act.deactivateAllMemberships({ user: USER, account: USER });
      await act.recordActivity({ user: USER, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(4);
    });
    it('membership views', async () => {
      const act = sbtActions(ADDR)(p);
      p.readContract.mockResolvedValue(100n); // generic bigint
      await act.getUserSBT({ user: USER });
      await act.userToSBT({ user: USER });
      await act.membershipIndex({ tokenId: 1n, community: ADDR });
      await act.lastActivityTime({ tokenId: 1n, community: ADDR });
      
      p.readContract.mockResolvedValue([USER, USER, 0n, 1n]); // SBTData
      await act.getSBTData({ tokenId: 1n });
      await act.sbtData({ tokenId: 1n });
      
      p.readContract.mockResolvedValue([ADDR, 0n, 0n, true, 'meta']); // Membership
      await act.getCommunityMembership({ tokenId: 1n, community: ADDR });
      
      p.readContract.mockResolvedValue([[ADDR, 0n, 0n, true, 'meta']]); // Memberships[]
      await act.getMemberships({ tokenId: 1n });
      
      p.readContract.mockResolvedValue([ADDR]); // Address[]
      await act.getActiveMemberships({ tokenId: 1n });
      
      p.readContract.mockResolvedValue(true); // bool
      await act.verifyCommunityMembership({ user: USER, community: ADDR });
      await act.weeklyActivity({ tokenId: 1n, community: ADDR, week: 1n });
      
      expect(p.readContract).toHaveBeenCalledTimes(11);
    });
  });

  describe('ERC721 Standard', () => {
    it('writes', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = sbtActions(ADDR)(w);
      await act.safeTransferFrom({ from: USER, to: USER, tokenId: 1n, account: USER });
      await act.transferFrom({ from: USER, to: USER, tokenId: 1n, account: USER });
      await act.approve({ to: USER, tokenId: 1n, account: USER });
      await act.setApprovalForAll({ operator: USER, approved: true, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(4);
    });
    it('views', async () => {
      const act = sbtActions(ADDR)(p);
      p.readContract.mockResolvedValue(1n);
      await act.balanceOf({ owner: USER });
      await act.nextTokenId();
      
      p.readContract.mockResolvedValue(USER);
      await act.ownerOf({ tokenId: 1n });
      await act.getApproved({ tokenId: 1n });
      
      p.readContract.mockResolvedValue(true);
      await act.isApprovedForAll({ owner: USER, operator: USER });
      await act.supportsInterface({ interfaceId: '0x01ffc9a7' });
      
      p.readContract.mockResolvedValue('uri');
      await act.tokenURI({ tokenId: 1n });
      await act.name();
      await act.symbol();
      
      expect(p.readContract).toHaveBeenCalledTimes(9);
    });
  });

  describe('Admin & Config', () => {
    it('config setters', async () => {
      w.writeContract.mockResolvedValue('0x');
      const act = sbtActions(ADDR)(w);
      await act.setBaseURI({ baseURI: 'uri', account: USER });
      await act.setReputationCalculator({ calculator: USER, account: USER });
      await act.setMintFee({ fee: 100n, account: USER });
      await act.setMinLockAmount({ amount: 100n, account: USER });
      await act.pause({ account: USER });
      await act.unpause({ account: USER });
      await act.setDAOMultisig({ multisig: USER, account: USER });
      await act.setRegistry({ registry: USER, account: USER });
      expect(w.writeContract).toHaveBeenCalledTimes(8);
    });
    it('config getters', async () => {
      const act = sbtActions(ADDR)(p);
      p.readContract.mockResolvedValue(USER);
      await act.reputationCalculator();
      await act.daoMultisig();
      await act.REGISTRY();
      await act.GTOKEN_STAKING();
      await act.GTOKEN();
      
      p.readContract.mockResolvedValue(100n);
      await act.mintFee();
      await act.minLockAmount();
      
      p.readContract.mockResolvedValue(true);
      await act.paused();
      
      p.readContract.mockResolvedValue('1.0');
      await act.version();
      
      expect(p.readContract).toHaveBeenCalledTimes(9);
    });
    it('ownership', async () => {
      const actP = sbtActions(ADDR)(p);
      p.readContract.mockResolvedValue(USER);
      await actP.owner();
      
      w.writeContract.mockResolvedValue('0x');
      const actW = sbtActions(ADDR)(w);
      await actW.transferOwnership({ newOwner: USER, account: USER });
      await actW.renounceOwnership({ account: USER });
      
      expect(p.readContract).toHaveBeenCalledTimes(1);
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });
  });
});
