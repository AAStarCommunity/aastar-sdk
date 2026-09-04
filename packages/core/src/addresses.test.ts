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

describe('Sepolia canonical is the airaccount-contract v0.33.0 stack (T5.2.1)', () => {
  const s = CANONICAL_ADDRESSES[11155111];

  // T5.2.1 (2026-09-04): re-reviewed from v0.31.0 to v0.33.0. Values come from the upstream
  // .env.sepolia V0330 block at tag v0.33.0 (0ac628ec) and were read back on chain at block
  // 11634556 — never completed from a truncated hand-off string. The v0.31.0 stack stays deployed
  // and existing accounts on it are unaffected (CC-106); what moved is which stack NEW accounts get.
  it('points at the v0.33.0 factory / router / impl / extension', () => {
    expect(s.airAccountFactoryV7).toBe('0x2A5cf40c24B8D27B8A039DE2b628fb4C9C66dAb9');
    expect(s.aaStarValidator).toBe('0xA97A752779ebfDA58612F6727Ec7C8366c39f897');
    expect(s.airAccountV7Impl).toBe('0x63a6D78A7B7e443D4d15EDCf950aE567e0F80a3b');
    expect(s.airAccountExtension).toBe('0x4ad5C1EFa95deaadEF3d3Ab02CB96504DEa0fCC2');
    expect(s.agentRegistry).toBe('0x734625F68aA9f9dD7DBA2e1f8DE883FD12801Be9');
  });

  it('algId 0x01 is the v0.33.0 COMMITTEE validator, not the legacy or the v0.31.0 one', () => {
    // The v0.33.0 router mounts a NEW committee validator at 0x01 (on-chain verified). Two negatives
    // rather than one: the legacy whole-set validator has no committeeActive() at all, while the
    // v0.31.0 committee validator DOES — so a stale pin there would keep answering plausibly and
    // only fail later, on chain, at validateUserOp.
    expect(s.aaStarBLSAlgorithm).toBe('0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9');
    expect(s.aaStarBLSAlgorithm).not.toBe('0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64'); // v0.31.0
    expect(s.aaStarBLSAlgorithm).not.toBe('0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC'); // legacy whole-set
  });

  it('keeps the components v0.33.0 explicitly REUSES from earlier stacks', () => {
    expect(s.sessionKeyValidator).toBe('0x6b044fB27B4763Fd30D02e41EDF2c62af4Aa946f');
    expect(s.forceExitModule).toBe('0x3fDe77868b74a7979A40a2293a1CD265fbe66EEc');
    expect(s.airAccountDelegate).toBe('0xd2735E54C5f5f2BF523b8a9ddd0E183624c3f2c0');
    expect(s.calldataParserRegistry).toBe('0x7dEea4544446826601014bD94d0F6432A67496F5');
  });

  it('is a WHOLE stack — no v0.28.0 leftovers in the account block', () => {
    // The transitional COMMITTEE_STACK_ADDRESSES group existed only because upstream had published
    // 4 of 12 addresses. It is gone; this asserts canonical did not keep a half-migrated seam.
    for (const stale of [
      '0x778ab75636F1350c31930078208eFB02E9765ed3', // v0.28.0 factory
      '0xcCD6DfbaeE8c4249D2F9825781ece2cb5a456d97', // v0.28.0 impl
      '0x7499968EC5a162b783b5816CbEC339008F132CAC', // v0.28.0 extension
      '0xA6bdfD17C178b43B464736408e0Fe03D5a7684eB', // v0.28.0 router
    ]) {
      expect(Object.values(s)).not.toContain(stale);
    }
  });
});
