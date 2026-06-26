import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, parseEther } from 'viem';
import { AAStarAirAccountV7ABI } from '@aastar/core';
import {
  TIER_PROFILES,
  DEFAULT_WEIGHT_CONFIG,
  encodeSetTierLimits,
  encodeSetWeightConfig,
  profileSetupCalls,
  modifyTierLimitsGuardianDigest,
  modifyTierLimitsGuardianDigestFromChain,
} from './profile.js';

const ACCOUNT = '0xACC0000000000000000000000000000000000001' as const;
const decode = (data: `0x${string}`) => decodeFunctionData({ abi: AAStarAirAccountV7ABI as never, data });

describe('tier profiles (#176 phase 3)', () => {
  it('ships three profiles with ascending tier1 ≤ tier2 ≤ dailyLimit (sane)', () => {
    for (const p of Object.values(TIER_PROFILES)) {
      expect(p.tier1Limit <= p.tier2Limit).toBe(true);
      expect(p.tier2Limit <= p.dailyLimit).toBe(true);
      expect(p.weights.tier1Threshold).toBeLessThan(p.weights.tier2Threshold);
    }
    expect(TIER_PROFILES.trader.tier2Limit).toBe(parseEther('1'));
  });

  it('encodeSetTierLimits → setTierLimits(tier1, tier2) to the account', () => {
    const call = encodeSetTierLimits(ACCOUNT, 10n, 100n);
    expect(call.to).toBe(ACCOUNT);
    expect(call.value).toBe(0n);
    const { functionName, args } = decode(call.data) as any;
    expect(functionName).toBe('setTierLimits');
    expect(args).toEqual([10n, 100n]);
  });

  it('encodeSetWeightConfig encodes the default weight model (3/2/2, thresholds 3/5/6, _padding 0)', () => {
    const { functionName, args } = decode(encodeSetWeightConfig(ACCOUNT).data) as any;
    expect(functionName).toBe('setWeightConfig');
    expect(args[0]).toMatchObject({
      passkeyWeight: 3, ecdsaWeight: 2, blsWeight: 2,
      tier1Threshold: 3, tier2Threshold: 5, tier3Threshold: 6, _padding: 0,
    });
  });

  it('profileSetupCalls arms tiers + weights (2 owner calls) — the #176 "create then configure"', () => {
    const calls = profileSetupCalls(ACCOUNT, TIER_PROFILES['web3-newbie']);
    expect(calls.map((c) => (decode(c.data) as any).functionName)).toEqual(['setTierLimits', 'setWeightConfig']);
    expect(calls.every((c) => c.to === ACCOUNT)).toBe(true);
    // tier limits match the chosen profile
    expect((decode(calls[0].data) as any).args).toEqual([parseEther('0.01'), parseEther('0.1')]);
  });

  it('modifyTierLimitsGuardianDigest matches a pinned golden hash (#188 / #191 — catches transposition)', () => {
    const acct = '0xacc0000000000000000000000000000000000001' as const;
    const p = { chainId: 11155111n, account: acct, tierLimitNonce: 7n, tier1Limit: 1n, tier2Limit: 2n, deadline: 999n };
    // GOLDEN: pinned hex for these exact inputs (formula verified against AAStarAirAccountBase
    // _guardianOpHash in review). A field transposition (e.g. swapping tier1/tier2 in the encoding)
    // changes the digest → != golden → fails. NOT re-derived by the same code path.
    const GOLDEN = '0x1e69487123200f48090c2df7b40a870bfffdb3af3ba6fde44b605dd23f19731c';
    expect(modifyTierLimitsGuardianDigest(p)).toBe(GOLDEN);
    // every field is bound: a change to ANY of them must move off the golden (replay/transposition-safe)
    expect(modifyTierLimitsGuardianDigest({ ...p, tierLimitNonce: 8n })).not.toBe(GOLDEN);
    expect(modifyTierLimitsGuardianDigest({ ...p, tier1Limit: 2n, tier2Limit: 1n })).not.toBe(GOLDEN); // transposed
    expect(modifyTierLimitsGuardianDigest({ ...p, chainId: 1n })).not.toBe(GOLDEN);
    expect(modifyTierLimitsGuardianDigest({ ...p, deadline: 1000n })).not.toBe(GOLDEN);
  });

  it('modifyTierLimitsGuardianDigestFromChain reads tierLimitNonce then builds the same digest (#188 e2e / contract#132)', async () => {
    const acct = '0xacc0000000000000000000000000000000000001' as const;
    const client = {
      readContract: vi.fn(async ({ functionName }: any) => {
        expect(functionName).toBe('tierLimitNonce');
        return 7n; // the on-chain nonce
      }),
    };
    const digest = await modifyTierLimitsGuardianDigestFromChain({
      client, account: acct, chainId: 11155111n, tier1Limit: 1n, tier2Limit: 2n, deadline: 999n,
    });
    // identical to passing the read nonce to the pure builder (the GOLDEN above uses nonce=7)
    expect(digest).toBe('0x1e69487123200f48090c2df7b40a870bfffdb3af3ba6fde44b605dd23f19731c');
    expect(client.readContract).toHaveBeenCalledOnce();
  });

  it('DEFAULT_WEIGHT_CONFIG matches the on-chain weight model', () => {
    expect(DEFAULT_WEIGHT_CONFIG).toMatchObject({ passkeyWeight: 3, ecdsaWeight: 2, blsWeight: 2, tier3Threshold: 6 });
  });

  it('each profile has its OWN weights copy, not a shared reference (#184 Low)', () => {
    // Assert isolation by reference identity — no mutation of the shared static (avoids a transient
    // bad value under parallel test runs, per the #185 R4 suggestion).
    expect(TIER_PROFILES.trader.weights).not.toBe(DEFAULT_WEIGHT_CONFIG);
    expect(TIER_PROFILES.trader.weights).not.toBe(TIER_PROFILES['web3-newbie'].weights);
    expect(TIER_PROFILES.trader.weights).toEqual(DEFAULT_WEIGHT_CONFIG); // a copy: equal values, different object
    expect(Object.isFrozen(DEFAULT_WEIGHT_CONFIG)).toBe(true);
  });
});
