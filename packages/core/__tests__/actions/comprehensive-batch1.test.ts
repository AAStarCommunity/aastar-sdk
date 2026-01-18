import { describe, it, expect, beforeEach } from 'vitest';
import { accountActions, accountFactoryActions } from '../../src/actions/account';
import { entryPointActions } from '../../src/actions/entryPoint';
import { dvtActions, blsActions as validatorBlsActions } from '../../src/actions/dvt';
import { aggregatorActions as validatorAggregatorActions } from '../../src/actions/aggregator';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('Account Actions', () => {
  let publicClient: any;
  let walletClient: any;

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
  let publicClient: any;
  let walletClient: any;

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
});

describe('EntryPoint Actions', () => {
  let publicClient: any;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
  });

  it('should get deposit info', async () => {
    publicClient.readContract.mockResolvedValue([1000n, true, 500n, 100n, 10n]);
    const actions = entryPointActions(ADDRESS)(publicClient);
    const result = await actions.getDepositInfo({ account: ADDRESS });
    expect(publicClient.readContract).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe('Validator (DVT/Aggregator) Actions', () => {
  let publicClient: any;
  let walletClient: any;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  it('dvt: should add validator', async () => {
    walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
    const actions = dvtActions(ADDRESS)(walletClient);
    await actions.addValidator({ v: ADDRESS, account: walletClient.account });
    expect(walletClient.writeContract).toHaveBeenCalled();
  });
});
