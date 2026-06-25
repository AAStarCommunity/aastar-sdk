/**
 * Account tier PROFILES + tier-config encoders (aastar-sdk#176 phase 3).
 *
 * Both factory paths (`createAccount`, `createAccountWithDefaults`) leave the account's tier amount
 * thresholds (`tier1Limit`/`tier2Limit`) and weight config at 0 — so `requiredTier` stays 0 and the
 * weighted path reverts `WeightConfigNotInitialized`. The contract has a single `_buildDefaultConfig`,
 * so the per-user "profile → limits + weights" choice lives HERE, in the SDK (#176 补2/补3). After
 * `createAccountWithDefaults`, run {@link profileSetupCalls} (setTierLimits + setWeightConfig) to
 * actually arm the tiers — otherwise tiering is silently off (the #176 root cause).
 *
 * The encoders return an {@link AccountCall} (`{ to, value, data }`) to submit via the account owner
 * (a normal owner UserOp); `setTierLimits`/`setWeightConfig` are `onlyOwner`. RAISING limits later
 * needs guardians — see {@link encodeModifyTierLimitsWithGuardians}. Browser-safe (viem-only).
 */
import { type Address, type Hex, parseEther, encodeFunctionData } from 'viem';
import { AAStarAirAccountV7ABI } from '@aastar/core';

/** A call to submit via the account owner (`account.execute` / a UserOp to the account). */
export interface AccountCall {
  to: Address;
  value: bigint;
  data: Hex;
}

/**
 * The on-chain weight model (AAStarAgentStorageLayout): passkey=3, owner ECDSA=2, DVT-BLS=2, each
 * guardian=1; tier thresholds 3/5/6. These are fixed by the contract's design — profiles vary the
 * AMOUNT limits, not the weights. Exposed so callers can confirm/override.
 */
export interface WeightConfig {
  passkeyWeight: number;
  ecdsaWeight: number;
  blsWeight: number;
  guardian0Weight: number;
  guardian1Weight: number;
  guardian2Weight: number;
  tier1Threshold: number;
  tier2Threshold: number;
  tier3Threshold: number;
}

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  passkeyWeight: 3,
  ecdsaWeight: 2,
  blsWeight: 2,
  guardian0Weight: 1,
  guardian1Weight: 1,
  guardian2Weight: 1,
  tier1Threshold: 3,
  tier2Threshold: 5,
  tier3Threshold: 6,
};

export type ProfileName = 'web3-newbie' | 'trader' | 'conservative';

export interface AccountTierProfile {
  name: ProfileName;
  /** Up to this cumulative daily ETH spend → Tier 1 (passkey only). */
  tier1Limit: bigint;
  /** Up to this → Tier 2 (passkey + BLS). Above it → Tier 3 (+ guardian). */
  tier2Limit: bigint;
  /** Guard daily ETH allowance (a hard cap; set on the Guard, not the account tier). */
  dailyLimit: bigint;
  weights: WeightConfig;
}

/**
 * Starting-point profiles (amounts in wei). These are SDK defaults — the UI shows them, lets the user
 * tweak, then arms the account with the chosen values. Override freely.
 */
export const TIER_PROFILES: Record<ProfileName, AccountTierProfile> = {
  // Frequent small spends sign with just a passkey; bigger ones step up to BLS / guardian.
  'web3-newbie': { name: 'web3-newbie', tier1Limit: parseEther('0.01'), tier2Limit: parseEther('0.1'), dailyLimit: parseEther('0.2'), weights: DEFAULT_WEIGHT_CONFIG },
  // Higher limits → fewer co-sign prompts for an active user.
  trader: { name: 'trader', tier1Limit: parseEther('0.1'), tier2Limit: parseEther('1'), dailyLimit: parseEther('5'), weights: DEFAULT_WEIGHT_CONFIG },
  // Tight limits → guardian co-sign kicks in early; lowest daily cap.
  conservative: { name: 'conservative', tier1Limit: parseEther('0.005'), tier2Limit: parseEther('0.05'), dailyLimit: parseEther('0.1'), weights: DEFAULT_WEIGHT_CONFIG },
};

const enc = (functionName: string, args: readonly unknown[]): Hex =>
  encodeFunctionData({ abi: AAStarAirAccountV7ABI as never, functionName, args } as never);

/** `setTierLimits(tier1, tier2)` (onlyOwner) — arms the account tier amount thresholds. */
export function encodeSetTierLimits(account: Address, tier1Limit: bigint, tier2Limit: bigint): AccountCall {
  return { to: account, value: 0n, data: enc('setTierLimits', [tier1Limit, tier2Limit]) };
}

/** `setWeightConfig(config)` (onlyOwner) — arms the weight thresholds (needed for the weighted path). */
export function encodeSetWeightConfig(account: Address, weights: WeightConfig = DEFAULT_WEIGHT_CONFIG): AccountCall {
  return {
    to: account,
    value: 0n,
    data: enc('setWeightConfig', [{
      passkeyWeight: weights.passkeyWeight,
      ecdsaWeight: weights.ecdsaWeight,
      blsWeight: weights.blsWeight,
      guardian0Weight: weights.guardian0Weight,
      guardian1Weight: weights.guardian1Weight,
      guardian2Weight: weights.guardian2Weight,
      _padding: 0,
      tier1Threshold: weights.tier1Threshold,
      tier2Threshold: weights.tier2Threshold,
      tier3Threshold: weights.tier3Threshold,
    }]),
  };
}

/**
 * RAISE the tier limits (guardian-gated) — `setTierLimits` only LOWERS without guardians; loosening
 * needs guardian co-signatures over the change (deadline-bound). Collect `guardianSigs` first.
 */
export function encodeModifyTierLimitsWithGuardians(
  account: Address,
  tier1Limit: bigint,
  tier2Limit: bigint,
  deadline: bigint,
  guardianSigs: Hex[],
): AccountCall {
  return { to: account, value: 0n, data: enc('modifyTierLimitsWithGuardians', [tier1Limit, tier2Limit, deadline, guardianSigs]) };
}

/**
 * The calls to arm a freshly-created account with a profile: setTierLimits + setWeightConfig. Run
 * these right after `createAccountWithDefaults` (as owner) — WITHOUT them the account's tiers are off
 * (`requiredTier` returns 0) and large transfers revert for a missing tier (the #176 root cause).
 * The Guard `dailyLimit` is set separately at creation (`createAccountWithDefaults`'s dailyLimit arg).
 */
export function profileSetupCalls(account: Address, profile: AccountTierProfile): AccountCall[] {
  return [
    encodeSetTierLimits(account, profile.tier1Limit, profile.tier2Limit),
    encodeSetWeightConfig(account, profile.weights),
  ];
}
