import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { dvtActions } from '../../src/actions/dvt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('DVTActions', () => {
  let p: any;
  let w: any;

  beforeEach(() => {
    resetMocks();
    p = createMockPublicClient();
    w = createMockWalletClient();
  });

  it('createSlashProposal', async () => {
    w.writeContract.mockResolvedValue('0xhash');
    const actions = dvtActions(A)(w);
    await actions.createSlashProposal({ operator: U, level: 1, reason: 'test', account: w.account });
    expect(w.writeContract).toHaveBeenCalled();
  });

  it('isValidator', async () => {
    p.readContract.mockResolvedValue(true);
    const actions = dvtActions(A)(p);
    const result = await actions.isValidator({ user: U });
    expect(result).toBe(true);
  });

  it('proposals', async () => {
    p.readContract.mockResolvedValue([U, 1, 'reason', 0n, false]);
    const actions = dvtActions(A)(p);
    const result = await actions.proposals({ proposalId: 1n });
    expect(result).toBeDefined();
  });
});
