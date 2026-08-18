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

describe('Sepolia canonical is the airaccount-contract v0.31.0 stack (CC-48)', () => {
  const s = CANONICAL_ADDRESSES[11155111];

  it('points at the v0.31.0 factory / router / impl / extension', () => {
    expect(s.airAccountFactoryV7).toBe('0x25C1E9F9120a406581f93bA82f7Cfd6805512791');
    expect(s.aaStarValidator).toBe('0xA15127e8601e77De7C655bf04ca75cccD8C968f0');
    expect(s.airAccountV7Impl).toBe('0x4873b7C1c07BE1b52d6583A64F5E902e593BDdad');
    expect(s.airAccountExtension).toBe('0x79b90Ed6CB97ec48cfDA86399752C58Bbc59D90a');
  });

  it('algId 0x01 is the CC-98 COMMITTEE validator, not the legacy whole-set one', () => {
    // The v0.31.0 router mounts dvt #237 at 0x01 (on-chain verified). Anything still expecting the
    // legacy 0x539B whole-set validator here is reading a superseded stack.
    expect(s.aaStarBLSAlgorithm).toBe('0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64');
    expect(s.aaStarBLSAlgorithm).not.toBe('0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC');
  });

  it('keeps the components v0.31.0 explicitly REUSES from v0.29.0', () => {
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
