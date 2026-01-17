/**
 * Comprehensive Unit Tests for All Actions - Batch 1
 * Expanding coverage for account, entryPoint, validators actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { accountActions, accountFactoryActions } from '../../src/actions/account';
import { entryPointActions } from '../../src/actions/entryPoint';
import { dvtActions as validatorDvtActions, blsActions } from '../../src/actions/validators';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('Account Actions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  it('should get nonce', async () => {
    publicClient.readContract.mockResolvedValue(5n);
    const actions = accountActions(ADDRESS)(publicClient);
    const result = await actions.getNonce();
    expect(result).toBe(5n);
  });

  it('should execute transaction', async () => {
    walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
    const actions = accountActions(ADDRESS)(walletClient);
    await actions.execute({ dest: ADDRESS, value: 100n, func: '0x', account: walletClient.account });
    expect(walletClient.writeContract).toHaveBeenCalled();
  });
});

describe('AccountFactory Actions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  it('should create account', async () => {
    walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
    const actions = accountFactoryActions(ADDRESS)(walletClient);
    await actions.createAccount({ owner: ADDRESS, salt: 0n, account: walletClient.account });
    expect(walletClient.writeContract).toHaveBeenCalled();
  });

  it('should get account address', async () => {
    publicClient.readContract.mockResolvedValue(ADDRESS);
    const actions = accountFactoryActions(ADDRESS)(publicClient);
    const result = await actions.getAddress({ owner: ADDRESS, salt: 0n });
    expect(result).toBe(ADDRESS);
  });
});

describe('EntryPoint Actions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
  });

  it('should get deposit info', async () => {
    publicClient.readContract.mockResolvedValue({ deposit: 1000n, staked: true, stake: 500n });
    const actions = entryPointActions(ADDRESS)(publicClient);
    expect(result).toBeDefined();
  });

  it('should get nonce', async () => {
    publicClient.readContract.mockResolvedValue(10n);
    const actions = entryPointActions(ADDRESS)(publicClient);
    const result = await actions.getNonce({ sender: ADDRESS, key: 0n });
    expect(result).toBe(10n);
  });
});

describe('Validator Actions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  it('dvt: should add validator', async () => {
    walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
    const actions = validatorDvtActions(ADDRESS)(walletClient);
    await actions.addValidator({ validator: ADDRESS, account: walletClient.account });
    expect(walletClient.writeContract).toHaveBeenCalled();
  });

  it('bls: should register public key', async () => {
    walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
    const actions = blsActions(ADDRESS)(walletClient);
    await actions.registerBLSPublicKey({ publicKey: '0xkey', account: walletClient.account });
    expect(walletClient.writeContract).toHaveBeenCalled();
  });

  it('bls: should get threshold', async () => {
    publicClient.readContract.mockResolvedValue(3n);
    const actions = blsActions(ADDRESS)(publicClient);
    const result = await actions.threshold();
    expect(result).toBe(3n);
  });
});
