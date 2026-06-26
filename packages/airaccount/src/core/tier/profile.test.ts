import { describe, it, expect } from 'vitest';
import { decodeFunctionData, parseEther } from 'viem';
import { AAStarAirAccountV7ABI } from '@aastar/core';
import {
  TIER_PROFILES,
  DEFAULT_WEIGHT_CONFIG,
  encodeSetTierLimits,
  encodeSetWeightConfig,
  profileSetupCalls,
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

  it('DEFAULT_WEIGHT_CONFIG matches the on-chain weight model', () => {
    expect(DEFAULT_WEIGHT_CONFIG).toMatchObject({ passkeyWeight: 3, ecdsaWeight: 2, blsWeight: 2, tier3Threshold: 6 });
  });

  it('each profile has its OWN weights copy — mutating one does not pollute others (#184 Low)', () => {
    TIER_PROFILES.trader.weights.passkeyWeight = 99; // tweak one profile
    expect(TIER_PROFILES['web3-newbie'].weights.passkeyWeight).toBe(3); // others unaffected
    expect(DEFAULT_WEIGHT_CONFIG.passkeyWeight).toBe(3); // default unaffected
    TIER_PROFILES.trader.weights.passkeyWeight = 3; // restore
    // the shared default is frozen
    expect(Object.isFrozen(DEFAULT_WEIGHT_CONFIG)).toBe(true);
  });
});
