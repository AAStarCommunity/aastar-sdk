import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { aggregatorActions } from '../../src/actions/aggregator';
import { dvtActions } from '../../src/actions/dvt';
import { stakingActions } from '../../src/actions/staking';
import { channelActions } from '../../src/actions/channel';
import { reputationActions } from '../../src/actions/reputation';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

// Beta5 Wave H — governance/admin/infra coverage gap closures.
// Each test asserts the exact ABI functionName + args (not just call count),
// so a renamed/re-shaped wrapper is caught.

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const OP = '0x3333333333333333333333333333333333333333' as `0x${string}`;
const ROLE = ('0x' + '12'.repeat(32)) as `0x${string}`;
const CHANNEL_ID = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
const PROOF = '0xdeadbeef' as `0x${string}`;

describe('Wave H — Registry gov/admin', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('setCreditTier wraps setCreditTier(level, limit)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await registryActions(A)(w).setCreditTier({ level: 3n, limit: 1000n, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'setCreditTier',
      args: [3n, 1000n],
    }));
  });

  it('setLevelThresholds wraps setLevelThresholds(uint256[])', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await registryActions(A)(w).setLevelThresholds({ thresholds: [10n, 20n, 30n], account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'setLevelThresholds',
      args: [[10n, 20n, 30n]],
    }));
  });

  it('updateOperatorBlacklist wraps (operator, users[], statuses[], proof)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await registryActions(A)(w).updateOperatorBlacklist({
      operator: OP, users: [U, A], statuses: [true, false], proof: PROOF, account: w.account,
    });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'updateOperatorBlacklist',
      args: [OP, [U, A], [true, false], PROOF],
    }));
  });

  it('syncStakeFromStaking wraps (user, roleId, newAmount)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await registryActions(A)(w).syncStakeFromStaking({ user: U, roleId: ROLE, newAmount: 500n, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'syncStakeFromStaking',
      args: [U, ROLE, 500n],
    }));
  });

  it('blacklistNonce reads blacklistNonce()', async () => {
    p.readContract.mockResolvedValue(7n);
    const result = await registryActions(A)(p).blacklistNonce();
    expect(result).toBe(7n);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'blacklistNonce' }));
  });
});

describe('Wave H — BLSAggregator permissionless registration', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('revokeBLSPublicKey wraps revokeBLSPublicKey(validator)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await aggregatorActions(A)(w).revokeBLSPublicKey({ validator: U, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'revokeBLSPublicKey',
      args: [U],
    }));
  });

  it('setPermissionlessBLSRegistration wraps (bool) — including false', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await aggregatorActions(A)(w).setPermissionlessBLSRegistration({ enabled: false, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'setPermissionlessBLSRegistration',
      args: [false],
    }));
  });

  it('permissionlessBLSRegistration reads bool', async () => {
    p.readContract.mockResolvedValue(true);
    const result = await aggregatorActions(A)(p).permissionlessBLSRegistration();
    expect(result).toBe(true);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'permissionlessBLSRegistration' }));
  });
});

describe('Wave H — DVTValidator removal/pruning', () => {
  let w: any;
  beforeEach(() => { resetMocks(); w = createMockWalletClient(); });

  it('removeValidator wraps removeValidator(v)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await dvtActions(A)(w).removeValidator({ v: U, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'removeValidator',
      args: [U],
    }));
  });

  it('pruneValidator wraps pruneValidator(v)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await dvtActions(A)(w).pruneValidator({ v: U, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'pruneValidator',
      args: [U],
    }));
  });
});

describe('Wave H — GTokenStaking ticket lock + cap', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('lockStakeWithTicket wraps (user, roleId, stakeAmount, ticketPrice, payer)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await stakingActions(A)(w).lockStakeWithTicket({
      user: U, roleId: ROLE, stakeAmount: 1000n, ticketPrice: 50n, payer: OP, account: w.account,
    });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'lockStakeWithTicket',
      args: [U, ROLE, 1000n, 50n, OP],
    }));
  });

  it('MAX_TOTAL_STAKE reads uint256', async () => {
    p.readContract.mockResolvedValue(123n);
    const result = await stakingActions(A)(p).MAX_TOTAL_STAKE();
    expect(result).toBe(123n);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'MAX_TOTAL_STAKE' }));
  });
});

describe('Wave H — MicroPaymentChannel close-timeout config', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('closeTimeout reads uint64 getter', async () => {
    p.readContract.mockResolvedValue(86400n);
    const result = await channelActions(A)(p).closeTimeout();
    expect(result).toBe(86400n);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'closeTimeout' }));
  });

  it('setCloseTimeout wraps setCloseTimeout(uint64)', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    await channelActions(A)(w).setCloseTimeout({ timeout: 3600n, account: w.account });
    expect(w.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'setCloseTimeout',
      args: [3600n],
    }));
  });

  it('closedChannels reads closedChannels(bytes32) -> bool', async () => {
    p.readContract.mockResolvedValue(true);
    const result = await channelActions(A)(p).closedChannels({ channelId: CHANNEL_ID });
    expect(result).toBe(true);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'closedChannels',
      args: [CHANNEL_ID],
    }));
  });

  it('MAX_CLOSE_TIMEOUT / MIN_CLOSE_TIMEOUT read uint64 bounds', async () => {
    p.readContract.mockResolvedValueOnce(604800n).mockResolvedValueOnce(60n);
    const actions = channelActions(A)(p);
    expect(await actions.MAX_CLOSE_TIMEOUT()).toBe(604800n);
    expect(await actions.MIN_CLOSE_TIMEOUT()).toBe(60n);
    expect(p.readContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ functionName: 'MAX_CLOSE_TIMEOUT' }));
    expect(p.readContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'MIN_CLOSE_TIMEOUT' }));
  });
});

describe('Wave H — ReputationSystem constant', () => {
  let p: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); });

  it('MAX_BOOSTED_COLLECTIONS reads uint256', async () => {
    p.readContract.mockResolvedValue(5n);
    const result = await reputationActions(A)(p).MAX_BOOSTED_COLLECTIONS();
    expect(result).toBe(5n);
    expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'MAX_BOOSTED_COLLECTIONS' }));
  });
});
