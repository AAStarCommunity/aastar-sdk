/**
 * resolveTransfer — the unified "what does THIS transfer need?" decision API (aastar-sdk#176).
 *
 * A consumer (YAA) must not hand-judge the tier or read raw limits. It calls `resolveTransfer` once
 * and gets the branch: which tier, which signatures to collect (passkey / +BLS / +guardian), the
 * limits behind the decision, and any hard block. Works for ETH AND any ERC-20, because the two
 * INDEPENDENT on-chain mechanisms are combined here:
 *
 *   1. Account tier (`AAStarAirAccountV7`): tier1Limit / tier2Limit → resolveTier(amount).
 *   2. Guard daily allowance (`AAStarGlobalGuard`): ETH `dailyLimit`/`remainingDailyAllowance`, or a
 *      token's `tokenConfigs[token]` + `tokenTodaySpent`. Exceeding the daily allowance forces Tier 3
 *      (a guardian co-sign) REGARDLESS of the account tier — which is exactly the case #176 hit (an
 *      account with requiredTier=0 that still needed a guardian because it blew the guard dailyLimit).
 *
 * The required tier is the MAX of both. This is read-only + browser-safe.
 *
 * NOTE on signatures: this returns what the on-chain `validateUserOp` will REQUIRE. Collecting them
 * (passkey assertion, DVT-BLS from the signer network, guardian ECDSA) + assembling the UserOp is the
 * prepare/submit flow's job; `resolveTransfer` is the planner that drives fail-fast (don't submit
 * until `requiredSigs` are all gathered).
 */
import { type Address } from 'viem';
import { AAStarAirAccountV7ABI, GuardClient } from '@aastar/core';
import { resolveTier } from './tier-router.js';
import type { TierLevel } from './types.js';

const ZERO = '0x0000000000000000000000000000000000000000';

/** Signatures the chosen tier requires. */
export interface RequiredSigs {
  /** Always true — the device passkey (P-256) signs every tier. */
  passkey: true;
  /** Tier ≥ 2 needs the DVT-BLS aggregate signature. */
  bls: boolean;
  /** Tier 3 needs this many guardian ECDSA co-signatures (1 for a normal T3 transfer). */
  guardian: number;
}

/** The limits behind the decision (for the resolved asset). */
export interface TransferLimits {
  tier1Limit: bigint;
  tier2Limit: bigint;
  dailyLimit: bigint;
  todaySpent: bigint;
  remaining: bigint;
}

export interface TransferResolution {
  tier: TierLevel;
  requiredSigs: RequiredSigs;
  /** `'ETH'` for the native asset, else the ERC-20 token address. */
  asset: 'ETH' | Address;
  limits: TransferLimits;
  /** Why this tier was chosen (account-tier vs guard daily overage). */
  reason: string;
  /** Set when the transfer is hard-blocked before signing (e.g. strict-mode unconfigured token). */
  blockReason?: string;
}

/** Minimal read surface (decouples from viem's PublicClient generic). */
interface ReadClient {
  readContract(args: { address: Address; abi: unknown; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
}

const sigsForTier = (t: TierLevel): RequiredSigs => ({ passkey: true, bls: t >= 2, guardian: t >= 3 ? 1 : 0 });

export interface ResolveTransferParams {
  client: ReadClient;
  /** The AirAccount (smart account) address. */
  account: Address;
  /** Transfer amount in the asset's base units (wei for ETH, token decimals for ERC-20). */
  amount: bigint;
  /** ERC-20 token address; omit or `'ETH'` for the native asset. */
  token?: Address | 'ETH';
  /** Guard address; if omitted it's read from `account.guard()`. */
  guard?: Address;
}

export async function resolveTransfer(params: ResolveTransferParams): Promise<TransferResolution> {
  const { client, account, amount } = params;
  const isEth = !params.token || params.token === 'ETH';
  const token = isEth ? undefined : (params.token as Address);

  const readAccount = (fn: string, args: readonly unknown[] = []) =>
    client.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: fn, args });

  const guardAddr = params.guard ?? ((await readAccount('guard')) as Address);
  const hasGuard = !!guardAddr && guardAddr.toLowerCase() !== ZERO;

  let tier1Limit = 0n;
  let tier2Limit = 0n;
  let dailyLimit = 0n;
  let todaySpent = 0n;
  let remaining = 0n;
  let blockReason: string | undefined;

  if (isEth) {
    const [t1, t2] = await Promise.all([readAccount('tier1Limit'), readAccount('tier2Limit')]);
    tier1Limit = BigInt(t1 as bigint);
    tier2Limit = BigInt(t2 as bigint);
    if (hasGuard) {
      const cfg = await new GuardClient(client, guardAddr).getConfig();
      dailyLimit = cfg.dailyLimit;
      todaySpent = cfg.todaySpent;
      remaining = cfg.remainingDailyAllowance;
    }
  } else {
    if (!hasGuard) {
      // No guard → no per-token limits to enforce (the account tier still applies, but token tiers are 0).
    } else {
      const guard = new GuardClient(client, guardAddr);
      const [tc, spent, cfg] = await Promise.all([
        guard.getTokenConfig(token!),
        guard.getTokenTodaySpent(token!),
        guard.getConfig(),
      ]);
      tier1Limit = tc.tier1Limit;
      tier2Limit = tc.tier2Limit;
      dailyLimit = tc.dailyLimit;
      todaySpent = spent;
      remaining = dailyLimit > todaySpent ? dailyLimit - todaySpent : 0n;
      // Strict mode blocks tokens with no config at all.
      if (cfg.strictMode && tier1Limit === 0n && tier2Limit === 0n && dailyLimit === 0n) {
        blockReason = 'strict mode is on and this token has no Guard config — add a tokenConfig first';
      }
    }
  }

  // Mechanism 1: account tier from the amount vs tier limits.
  const accountTier = resolveTier(amount, { tier1Limit, tier2Limit });
  // Mechanism 2: exceeding the (token) daily allowance forces a guardian co-sign (Tier 3).
  const exceedsDaily = dailyLimit > 0n && amount > remaining;
  const tier = Math.max(accountTier, exceedsDaily ? 3 : 1) as TierLevel;

  const reason =
    tier === 3 && exceedsDaily && accountTier < 3
      ? `exceeds the ${isEth ? 'ETH' : 'token'} daily allowance (remaining ${remaining})`
      : tier === 3
        ? `exceeds tier2Limit (${tier2Limit})`
        : tier === 2
          ? `exceeds tier1Limit (${tier1Limit})`
          : tier1Limit === 0n && tier2Limit === 0n
            ? 'no tier limits configured — passkey only'
            : `within tier1Limit (${tier1Limit})`;

  return {
    tier,
    requiredSigs: sigsForTier(tier),
    asset: isEth ? 'ETH' : token!,
    limits: { tier1Limit, tier2Limit, dailyLimit, todaySpent, remaining },
    reason,
    blockReason,
  };
}
