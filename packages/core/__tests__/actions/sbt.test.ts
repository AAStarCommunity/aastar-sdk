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

  describe('Batch & Mint-or-Add', () => {
    const USER_A = '0x000000000000000000000000000000000000000a' as `0x${string}`;
    const USER_B = '0x000000000000000000000000000000000000000b' as `0x${string}`;
    const USER_C = '0x000000000000000000000000000000000000000c' as `0x${string}`;

    it('batchAirdropMint sends one tx per item, in order, firing onProgress', async () => {
      w.writeContract
        .mockResolvedValueOnce('0xaa')
        .mockResolvedValueOnce('0xbb')
        .mockResolvedValueOnce('0xcc');
      const act = sbtActions(ADDR)(w);

      const progress: Array<{ done: number; total: number; user: string; ok: boolean }> = [];
      const results = await act.batchAirdropMint({
        items: [
          { user: USER_A, roleId: '0x01', roleData: '0x' },
          { user: USER_B, roleId: '0x01', roleData: '0x' },
          { user: USER_C, roleId: '0x01', roleData: '0x' },
        ],
        account: USER,
        onProgress: (done, total, last) => progress.push({ done, total, user: last.user, ok: last.ok }),
      });

      // One tx per item.
      expect(w.writeContract).toHaveBeenCalledTimes(3);
      // All airdropMint, in submitted order.
      expect(w.writeContract.mock.calls.map((c: any[]) => c[0].functionName)).toEqual([
        'airdropMint', 'airdropMint', 'airdropMint',
      ]);
      expect(w.writeContract.mock.calls.map((c: any[]) => c[0].args[0])).toEqual([USER_A, USER_B, USER_C]);
      // Results collected in order with tx hashes.
      expect(results).toEqual([
        { user: USER_A, ok: true, txHash: '0xaa' },
        { user: USER_B, ok: true, txHash: '0xbb' },
        { user: USER_C, ok: true, txHash: '0xcc' },
      ]);
      // onProgress fired once per item with monotonically increasing done/total.
      expect(progress).toEqual([
        { done: 1, total: 3, user: USER_A, ok: true },
        { done: 2, total: 3, user: USER_B, ok: true },
        { done: 3, total: 3, user: USER_C, ok: true },
      ]);
    });

    it('continueOnError keeps going past a failing item and records the error', async () => {
      w.writeContract
        .mockResolvedValueOnce('0xaa')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('0xcc');
      const act = sbtActions(ADDR)(w);

      const progress: number[] = [];
      const results = await act.batchAirdropMint({
        items: [
          { user: USER_A, roleId: '0x01', roleData: '0x' },
          { user: USER_B, roleId: '0x01', roleData: '0x' },
          { user: USER_C, roleId: '0x01', roleData: '0x' },
        ],
        account: USER,
        continueOnError: true,
        onProgress: (done) => progress.push(done),
      });

      // All three attempted despite the middle failure.
      expect(w.writeContract).toHaveBeenCalledTimes(3);
      expect(results[0]).toEqual({ user: USER_A, ok: true, txHash: '0xaa' });
      expect(results[1].user).toBe(USER_B);
      expect(results[1].ok).toBe(false);
      expect(results[1].txHash).toBeUndefined();
      expect(typeof results[1].error).toBe('string');
      expect(results[2]).toEqual({ user: USER_C, ok: true, txHash: '0xcc' });
      expect(progress).toEqual([1, 2, 3]);
    });

    it('reports ok:false when the tx is mined but REVERTED (submit != success)', async () => {
      w.writeContract.mockResolvedValue('0xdead');
      // Tx lands on-chain but reverts — must NOT be a false-positive ok:true.
      w.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' });
      const act = sbtActions(ADDR)(w);

      const results = await act.batchAirdropMint({
        items: [{ user: USER_A, roleId: '0x01', roleData: '0x' }],
        account: USER,
        continueOnError: true,
      });

      expect(w.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xdead' });
      expect(results[0].ok).toBe(false);
      expect(results[0].txHash).toBeUndefined();
      expect(typeof results[0].error).toBe('string');
    });

    it('without continueOnError it rethrows after recording the failing item', async () => {
      w.writeContract
        .mockResolvedValueOnce('0xaa')
        .mockRejectedValueOnce(new Error('boom'));
      const act = sbtActions(ADDR)(w);

      // The rethrown error must carry the batchAirdropMint context (AAStarError
      // wraps the underlying revert) — asserting the message guards against a
      // regression that swallows the cause or rethrows a bare/unwrapped error.
      await expect(
        act.batchAirdropMint({
          items: [
            { user: USER_A, roleId: '0x01', roleData: '0x' },
            { user: USER_B, roleId: '0x01', roleData: '0x' },
            { user: USER_C, roleId: '0x01', roleData: '0x' },
          ],
          account: USER,
        }),
      ).rejects.toThrow(/batchAirdropMint/);

      // Aborted: only the first two were attempted, the third never ran.
      expect(w.writeContract).toHaveBeenCalledTimes(2);
    });

    it('mintOrAddMembership reads getUserSBT then calls airdropMint (the dual-purpose mint-or-add path)', async () => {
      w.readContract.mockResolvedValue(0n); // first-time user
      w.writeContract.mockResolvedValue('0xfeed');
      const act = sbtActions(ADDR)(w);

      const tx = await act.mintOrAddMembership({ user: USER_A, roleId: '0x01', roleData: '0x', account: USER });

      expect(tx).toBe('0xfeed');
      expect(w.readContract).toHaveBeenCalledTimes(1);
      expect(w.readContract.mock.calls[0][0].functionName).toBe('getUserSBT');
      expect(w.writeContract).toHaveBeenCalledTimes(1);
      expect(w.writeContract.mock.calls[0][0].functionName).toBe('airdropMint');
    });

    it('mintOrAddMembership uses airdropMint for existing holders too (no separate add-membership fn)', async () => {
      w.readContract.mockResolvedValue(42n); // existing SBT holder
      w.writeContract.mockResolvedValue('0xbeef');
      const act = sbtActions(ADDR)(w);

      const tx = await act.mintOrAddMembership({ user: USER_B, roleId: '0x01', roleData: '0x', account: USER });

      expect(tx).toBe('0xbeef');
      expect(w.writeContract.mock.calls[0][0].functionName).toBe('airdropMint');
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
