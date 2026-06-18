import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ADDRESSES,
  getCanonicalAddresses,
  isSupportedChainId,
  listSupportedChainIds,
  describeSupportedChains,
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
