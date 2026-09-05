/**
 * The two fail-closed branches of {@link getAccountDvtValidator}, driven by a stub.
 *
 * WHY A STUB WHEN THERE IS AN ON-CHAIN TEST NEXT DOOR
 * ---------------------------------------------------
 * Because the chain will not produce these states on demand, and mutation proved the on-chain file
 * cannot reach them. Deleting the zero-router guard reds ZERO on-chain cases: the EOA probe there
 * (`0x…dEaD`) returns empty calldata, so viem fails to DECODE before the guard is ever consulted.
 * The guard was asleep, and the on-chain suite could not tell.
 *
 * That is the same three-layer distinction T2.1.1 recorded for the guardian-slash shape guards —
 * "the chain answered" and "the guard fired" are different events, and a suite that only sees the
 * first will report a sleeping guard as covered.
 */
import { describe, expect, it } from 'vitest';
import type { Address, PublicClient } from 'viem';

import { getAccountDvtValidator } from './committee.js';

const ZERO = '0x0000000000000000000000000000000000000000';
const ACCOUNT = '0x92EA8b02D34A4D5d10f0Db9Ea894e8bC72e292e8' as Address;
const ROUTER = '0xA97A752779ebfDA58612F6727Ec7C8366c39f897' as Address;
const VALIDATOR = '0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9' as Address;

/** A client that answers `validatorRouter` and `getAlgorithm` from a table. */
const stub = (answers: { validatorRouter?: string; getAlgorithm?: string }) =>
  ({
    readContract: async ({ functionName }: { functionName: string }) =>
      answers[functionName as keyof typeof answers],
  }) as unknown as PublicClient;

describe('getAccountDvtValidator — the branches the chain will not produce', () => {
  it('POSITIVE CONTROL: a well-formed pair resolves', () => {
    // Without this, every assertion below would also pass against a function that threw
    // unconditionally — and "it always throws" is not a fail-closed guard, it is a broken one.
    return expect(
      getAccountDvtValidator(stub({ validatorRouter: ROUTER, getAlgorithm: VALIDATOR }), ACCOUNT),
    ).resolves.toEqual({ router: ROUTER, validator: VALIDATOR });
  });

  it('REFUSES a zero validatorRouter — two zeros in a row read like data', async () => {
    // Without the guard this returns `{ router: 0x0, validator: 0x0 }` and the caller onboards a
    // node against address(0): no revert at read time, and the failure surfaces much later
    // somewhere that says nothing about routers.
    await expect(getAccountDvtValidator(stub({ validatorRouter: ZERO }), ACCOUNT))
      .rejects.toThrow(/validatorRouter\(\) = the zero address/);
  });

  it('REFUSES a router that mounts nothing at algId 0x01', async () => {
    // Distinct from the case above and reached only when the first passes: the account DOES route
    // somewhere, that somewhere just has no DVT validator. Conflating the two would tell an
    // operator to check their account when the fault is in the router.
    await expect(getAccountDvtValidator(stub({ validatorRouter: ROUTER, getAlgorithm: ZERO }), ACCOUNT))
      .rejects.toThrow(/mounts nothing at algId 0x01/);
  });

  it('the two refusals name DIFFERENT causes', async () => {
    // Guards against a later refactor collapsing them into one message. If both ever said the same
    // thing, one of the two tests above would be pinning a string the other already covers.
    const msg = async (c: PublicClient) => {
      try { await getAccountDvtValidator(c, ACCOUNT); return 'RESOLVED'; }
      catch (e) { return (e as Error).message; }
    };
    const a = await msg(stub({ validatorRouter: ZERO }));
    const b = await msg(stub({ validatorRouter: ROUTER, getAlgorithm: ZERO }));
    expect(a).not.toBe(b);
    expect(a).toMatch(/account/);
    expect(b).toMatch(/router/);
  });

  it('the zero check is case-insensitive — a checksummed zero is still zero', () => {
    // `0x0000…0000` has no letters, but a caller may hand back `0X0000…`. Cheap to hold, and the
    // failure it prevents is the guard silently not firing.
    return expect(getAccountDvtValidator(stub({ validatorRouter: '0X0000000000000000000000000000000000000000' }), ACCOUNT))
      .rejects.toThrow(/zero address/);
  });
});
