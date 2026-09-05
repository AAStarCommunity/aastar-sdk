/**
 * The deployed-mode decisions, driven directly (CC-115 B6-prep, T6.1.1).
 *
 * These are pure functions precisely so this file can exist: the runner they serve has no exports
 * and executes at import time, so anything left inside it could only be exercised by standing up a
 * chain and spending real ETH.
 */
import { describe, expect, it } from 'vitest';
import { keccak256, encodeAbiParameters, encodePacked, type Address } from 'viem';

// Relative, not '@aastar/core': the root package does not depend on the workspace packages, so
// vitest cannot resolve the bare specifier here even though tsx can at runtime.
import { CANONICAL_ADDRESSES } from '../../packages/core/src/addresses.js';
import { readDeployedStackPin } from './deployed-stack.js';
import {
  DEPLOYMENT_KEYS,
  checkAccountRouting,
  checkValidatorRoster,
  checkFunderRole,
  checkStackInvariants,
  resolveDeployedAddresses,
} from './deployed-mode.js';

const A = (h: string) => h as Address;
const ROUTER = A('0xA97A752779ebfDA58612F6727Ec7C8366c39f897');
const ALG1 = A('0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9');

describe('resolveDeployedAddresses — provenance is recorded, never merged away', () => {
  const pin = readDeployedStackPin('sepolia');
  const book = CANONICAL_ADDRESSES[11155111] as unknown as Record<string, string>;

  it('resolves all nine keys the runner requires', () => {
    const { addresses } = resolveDeployedAddresses(pin, book);
    expect(Object.keys(addresses).sort()).toEqual([...DEPLOYMENT_KEYS].sort());
  });

  it('records WHICH record each address came from', () => {
    // The distinction this function exists for: five keys have two independent backings and four
    // have one. A flat map would make all nine look equally corroborated.
    const { addresses } = resolveDeployedAddresses(pin, book);
    const both = DEPLOYMENT_KEYS.filter((k) => addresses[k].source === 'pin+book');
    const bookOnly = DEPLOYMENT_KEYS.filter((k) => addresses[k].source === 'book');
    expect(both.sort()).toEqual(['blsAggregator', 'dvtValidator', 'entryPoint', 'registry', 'superPaymaster']);
    expect(bookOnly.sort()).toEqual(['aPNTs', 'agentIdentityRegistry', 'gToken', 'staking']);
  });

  it('the five double-backed keys AGREE — this is the cross-check, not a formality', () => {
    const { agreement } = resolveDeployedAddresses(pin, book);
    expect(agreement).toHaveLength(5);
    expect(agreement.filter((c) => !c.ok)).toEqual([]);
  });

  it('a disagreement is REPORTED, not resolved by precedence', () => {
    // A pin and an address book that disagree about a live contract is a question for a human.
    // Silently preferring one would produce a run whose evidence names an address nobody chose.
    const wrong = { ...book, registry: '0x00000000000000000000000000000000DeaDBeef' };
    const { agreement, addresses } = resolveDeployedAddresses(pin, wrong);
    const bad = agreement.filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['deployed:agree:registry']);
    // ...and it still resolves to the PIN's value, so the failure is visible rather than fatal here.
    expect(addresses.registry.address).toBe(pin.addresses.registry);
  });

  it('throws when a key exists in neither record — this mode cannot create one', () => {
    const { gToken, ...withoutGToken } = book;
    expect(() => resolveDeployedAddresses(pin, withoutGToken)).toThrow(/no address for gToken/);
  });
});

describe('checkStackInvariants — the two readings that differ from fresh-deploy', () => {
  const good = { defaultThreshold: 2n, aggregatorVersion: 'BLSAggregator-4.11.0', nodeCount: 3 };

  it('passes on the frozen stack readings', () => {
    expect(checkStackInvariants(good).filter((c) => !c.ok)).toEqual([]);
  });

  it('REJECTS the fresh-deploy threshold of 3 — the reading the old runner demanded', () => {
    // The whole reason this is a third mode: `sepolia` mode asserts 3 and would refuse the real
    // stack before its first transaction.
    const bad = checkStackInvariants({ ...good, defaultThreshold: 3n });
    expect(bad.filter((c) => !c.ok).map((c) => c.name)).toEqual(['deployed:defaultThreshold']);
  });

  it('REJECTS a different aggregator version', () => {
    const bad = checkStackInvariants({ ...good, aggregatorVersion: 'BLSAggregator-4.12.0' });
    expect(bad.filter((c) => !c.ok).map((c) => c.name)).toEqual(['deployed:aggregatorVersion']);
  });

  it('REJECTS N != 3', () => {
    expect(checkStackInvariants({ ...good, nodeCount: 7 }).filter((c) => !c.ok).map((c) => c.name))
      .toEqual(['deployed:nodeCount']);
  });
});

describe('checkAccountRouting — scoped to the accounts this run created', () => {
  const expected = { validatorRouter: ROUTER, algorithm1: ALG1 };

  it('accepts accounts that route to the frozen router and validator', () => {
    const accounts = [{ account: A('0x1'), validatorRouter: ROUTER, algorithm1: ALG1 }];
    expect(checkAccountRouting(accounts, expected).filter((c) => !c.ok)).toEqual([]);
  });

  it('REJECTS an account on the OTHER real router — the reason the scope was narrowed', () => {
    // 0x92EA8b02… genuinely routes to 0xe68d6A7B… → 0x539B9681… on chain. It is not a broken
    // account; it is a second deployment. Asserting "every account" would have made the invariant
    // false about the chain rather than about this run.
    const other = [{
      account: A('0x92EA8b02D34A4D5d10f0Db9Ea894e8bC72e292e8'),
      validatorRouter: A('0xe68d6A7Bb60DA4caE62ceC2439722fc5eEF87a5c'),
      algorithm1: A('0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC'),
    }];
    expect(checkAccountRouting(other, expected).filter((c) => !c.ok)).toHaveLength(2);
  });

  it('an EMPTY account set fails rather than passes', () => {
    // Zero accounts satisfying an invariant about accounts is the same green as all of them
    // satisfying it. This repo has paid for that shape repeatedly in one day.
    const out = checkAccountRouting([], expected);
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(false);
  });
});

describe('checkFunderRole — the funder may fund, and may not govern', () => {
  const FUNDER = A('0x00000000000000000000000000000000000f00d1');
  const gov = [
    { label: 'registry.owner', address: A('0x0000000000000000000000000000000000000001') },
    { label: 'staking.owner', address: A('0x0000000000000000000000000000000000000002') },
    { label: 'aggregator.owner', address: A('0x0000000000000000000000000000000000000003') },
  ];
  // Two registries, because B6 spans both and the same node has DIFFERENT operators on each.
  const operators = {
    guardianSlots: [A('0x5D870E132CC010E882E90f4aFaACDC4F19C7Eca3')],
    committee: [A('0xEcAACb915f7D92e9916f449F7ad42BD0408733c9')],
  };

  it('passes for an ordinary funder', () => {
    expect(checkFunderRole(FUNDER, gov, operators).filter((c) => !c.ok)).toEqual([]);
  });

  it('REJECTS a funder that is one of the governance owners', () => {
    const bad = checkFunderRole(gov[1].address, gov, operators).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['deployed:funder:not:staking.owner']);
  });

  it('REJECTS an operator of registry A, and NAMES which registry', () => {
    const bad = checkFunderRole(A(operators.guardianSlots[0].toUpperCase()), gov, operators).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['deployed:funder:not-an-operator:guardianSlots']);
  });

  it('REJECTS an operator of registry B — the case a single-list check would clear', () => {
    // This is the whole reason the parameter is a map. A run that consulted only the guardian slots
    // would pass a funder that is a committee operator, and the output would look identical.
    const bad = checkFunderRole(operators.committee[0], gov, operators).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['deployed:funder:not-an-operator:committee']);
  });

  it('an EMPTY list fails PER REGISTRY — naming the one that was not read', () => {
    const bad = checkFunderRole(FUNDER, gov, { ...operators, committee: [] }).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['deployed:funder:operator-list-nonempty:committee']);
  });
});

describe('checkValidatorRoster — two independent paths to the same set', () => {
  const SLOTS = [
    '0x5D870E132CC010E882E90f4aFaACDC4F19C7Eca3',
    '0x40F0b12128f256B62Fa22b36D37012Ee004bbd1f',
    '0xD904A706E355D6b48bAeDBec472CE94BC6981601',
  ] as const;
  const HASH = '0x12e163e7065f48e34225677be9596d9e800def6389fe783bf472b8d72905acfb';
  const manifest = { slotOrder: [...SLOTS], activeCount: 3, orderedAddressSetHash: HASH };
  const live = SLOTS.map((address, i) => ({
    slot: i + 1, address: address as Address, roleStake: 30n * 10n ** 18n, effectiveStake: 30n * 10n ** 18n,
  }));

  it('the documented convention reproduces the manifest digest', () => {
    // `hashConventions.validatorSetHash` says keccak256(abi.encode(address[])). My first attempt
    // used encodePacked and got 0xa281865c… — the fix was to READ the recorded convention, not to
    // try encodings until one matched.
    expect(keccak256(encodeAbiParameters([{ type: 'address[]' }], [[...SLOTS] as Address[]]))).toBe(HASH);
  });

  it('NEGATIVE CONTROL: encodePacked does NOT reproduce it', () => {
    // Without this, the assertion above would pass for any convention that happened to work, and
    // the "two independent paths" claim would rest on a coincidence.
    expect(keccak256(encodePacked(['address[]'], [[...SLOTS] as Address[]]))).not.toBe(HASH);
  });

  it('accepts the live set', () => {
    expect(checkValidatorRoster(live, manifest, HASH).filter((c) => !c.ok)).toEqual([]);
  });

  it('REJECTS a reordered set — slotOrder is order-sensitive', () => {
    // Reordering keeps the same MEMBERS. A set comparison would pass; the slot table is a sequence.
    const swapped = [live[1], live[0], live[2]].map((s, i) => ({ ...s, slot: i + 1 }));
    const bad = checkValidatorRoster(swapped, manifest, HASH).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['roster:slotOrder']);
  });

  it('REJECTS a zero stake, naming the slot', () => {
    const bad = checkValidatorRoster(
      live.map((s, i) => (i === 1 ? { ...s, effectiveStake: 0n } : s)), manifest, HASH,
    ).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['roster:stake:slot2']);
  });

  it('REJECTS N != 3 on either side', () => {
    expect(checkValidatorRoster(live.slice(0, 2), manifest, HASH).filter((c) => !c.ok).map((c) => c.name))
      .toContain('roster:count');
    expect(checkValidatorRoster(live, { ...manifest, activeCount: 4 }, HASH).filter((c) => !c.ok).map((c) => c.name))
      .toContain('roster:count');
  });

  it('REJECTS a digest that does not match, independently of slotOrder', () => {
    // The two paths must be able to disagree — otherwise the second one is decoration.
    const bad = checkValidatorRoster(live, manifest, '0x' + '11'.repeat(32)).filter((c) => !c.ok);
    expect(bad.map((c) => c.name)).toEqual(['roster:setHash']);
  });
});
