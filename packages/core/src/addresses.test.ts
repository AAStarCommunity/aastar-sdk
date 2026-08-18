import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ADDRESSES,
  getCanonicalAddresses,
  isSupportedChainId,
  listSupportedChainIds,
  describeSupportedChains,
  COMMITTEE_STACK_ADDRESSES,
  getCommitteeStackAddresses,
} from './addresses.js';

describe('canonical address resolution', () => {
  it('lists exactly the chainIds present in CANONICAL_ADDRESSES', () => {
    const ids = listSupportedChainIds();
    expect(ids).toEqual(Object.keys(CANONICAL_ADDRESSES).map(Number));
    // OP mainnet + Sepolia + OP Sepolia are the deployed targets.
    expect(ids).toContain(10);
    expect(ids).toContain(11155111);
    expect(ids).toContain(11155420);
  });

  it('isSupportedChainId reflects the table', () => {
    expect(isSupportedChainId(11155111)).toBe(true);
    expect(isSupportedChainId(1)).toBe(false); // Ethereum mainnet not deployed yet
    expect(isSupportedChainId(999999)).toBe(false);
  });

  it('returns undefined for an unsupported chain', () => {
    expect(getCanonicalAddresses(1)).toBeUndefined();
    expect(getCanonicalAddresses(999999)).toBeUndefined();
  });

  it('resolves Sepolia and preserves the canonical values', () => {
    const a = getCanonicalAddresses(11155111);
    expect(a).toBeDefined();
    expect(a!.registry).toBe(CANONICAL_ADDRESSES[11155111].registry);
    expect(a!.superPaymaster).toBe(CANONICAL_ADDRESSES[11155111].superPaymaster);
  });

  it('adds the client-factory key aliases (gTokenStaking, mySBT)', () => {
    const a = getCanonicalAddresses(11155111)!;
    // Canonical table uses `staking`/`sbt`; clients reference `gTokenStaking`/`mySBT`.
    expect(a.gTokenStaking).toBe(CANONICAL_ADDRESSES[11155111].staking);
    expect(a.mySBT).toBe(CANONICAL_ADDRESSES[11155111].sbt);
  });

  it('resolves Optimism mainnet (chainId 10) distinctly from Sepolia', () => {
    const op = getCanonicalAddresses(10)!;
    const sep = getCanonicalAddresses(11155111)!;
    expect(op.registry).toBe(CANONICAL_ADDRESSES[10].registry);
    expect(op.registry).not.toBe(sep.registry);
  });

  it('describes supported chains with viem names + ids for friendly errors', () => {
    const desc = describeSupportedChains();
    // Every supported chainId appears, labelled (not a bare number list).
    for (const id of listSupportedChainIds()) {
      expect(desc).toContain(`(${id})`);
    }
    expect(desc).toContain('Sepolia');
    expect(desc).toContain('11155111');
  });
});

describe('COMMITTEE_STACK_ADDRESSES (airaccount-contract v0.31.0, CC-103)', () => {
  it('resolves the Sepolia committee stack', () => {
    const s = getCommitteeStackAddresses(11155111)!;
    expect(s.router).toBe('0xA15127e8601e77De7C655bf04ca75cccD8C968f0');
    expect(s.committeeValidator).toBe('0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64');
    expect(s.factory).toBe('0x25C1E9F9120a406581f93bA82f7Cfd6805512791');
    expect(s.accountImpl).toBe('0x4873b7C1c07BE1b52d6583A64F5E902e593BDdad');
  });

  it('returns undefined for a chain with no committee deployment', () => {
    expect(getCommitteeStackAddresses(10)).toBeUndefined();
    expect(getCommitteeStackAddresses(11155420)).toBeUndefined();
  });

  it('stays SEPARATE from canonical — canonical must not silently become a mixed stack', () => {
    // Upstream published 4 of the ~11 addresses in the Sepolia AirAccount block. Folding them into
    // CANONICAL_ADDRESSES would leave a half-v0.31.0 / half-v0.28.0 stack with nothing marking the
    // seam, so canonical keeps pointing at the whole v0.28.0 stack until the rest is published.
    const canonical = CANONICAL_ADDRESSES[11155111];
    const committee = getCommitteeStackAddresses(11155111)!;
    expect(canonical.aaStarValidator).not.toBe(committee.router);
    expect(canonical.airAccountFactoryV7).not.toBe(committee.factory);
    expect(canonical.aaStarBLSAlgorithm).not.toBe(committee.committeeValidator);
  });

  it('every address is a distinct, well-formed 20-byte value', () => {
    for (const [chainId, stack] of Object.entries(COMMITTEE_STACK_ADDRESSES)) {
      const vals = Object.values(stack);
      for (const v of vals) expect(v, `${chainId} ${v}`).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(new Set(vals.map((v) => v.toLowerCase())).size).toBe(vals.length);
    }
  });
});
