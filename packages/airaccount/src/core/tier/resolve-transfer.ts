/**
 * resolveTransfer — the unified "what does THIS transfer need?" decision API (aastar-sdk#176).
 *
 * A consumer (YAA) must not hand-judge the tier or read raw limits. It calls `resolveTransfer` once
 * and gets the branch: which tier, which signatures to collect (passkey / +BLS / +guardian), the
 * limits behind the decision, and any hard block. Works for ETH AND any ERC-20, because the two
 * INDEPENDENT on-chain mechanisms are combined here:
 *
 *   1. Account tier (`AAStarAirAccountV7`): tier1Limit / tier2Limit → resolveTier(amount). This is
 *      what decides the SIGNATURES (Tier 3 = amount > tier2Limit = a guardian co-sign is REQUIRED).
 *   2. Guard daily allowance (`AAStarGlobalGuard`): ETH `dailyLimit`/`remainingDailyAllowance`, or a
 *      token's `tokenConfigs[token]` + `tokenTodaySpent`. This is a SEPARATE, HARD cap —
 *      `Guard.recordSpend` reverts `DailyLimitExceeded` and a guardian does NOT bypass it. So
 *      exceeding it is a `blockReason` (the transfer cannot succeed as-is), NOT a tier promotion.
 *
 * So `tier`/`requiredSigs` come from the account tier; `blockReason` flags a hard daily-limit block.
 * Read-only + browser-safe.
 *
 * NOTE on signatures: this returns what the on-chain `validateUserOp` will REQUIRE. Collecting them
 * (passkey assertion, DVT-BLS from the signer network, guardian ECDSA) + assembling the UserOp is the
 * prepare/submit flow's job; `resolveTransfer` is the planner that drives fail-fast (don't submit
 * until `requiredSigs` are all gathered).
 */
import { type Address, type Hex } from 'viem';
import { AAStarAirAccountV7ABI, GuardClient, PolicyRegistryABI } from '@aastar/core';
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
  /**
   * Whether AT LEAST ONE limit (tier1/tier2 or daily) is actually enforced for this asset. `false`
   * means nothing is enforced (no guard, or guard present but all limits 0, or an ERC-20 with no
   * tokenConfig) — so a `tier:1` result then reflects "unprotected", not "small amount". Computed the
   * same way for ETH and ERC-20.
   */
  hasGuard: boolean;
  /** Why this tier was chosen (account-tier vs guard daily overage). */
  reason: string;
  /** Set when the transfer is hard-blocked before signing (e.g. strict-mode unconfigured token). */
  blockReason?: string;
  /**
   * Layer-1 on-chain policy preview (only when `policyRegistry` is passed). `willPass=false` means the
   * DVT signer will reject this transfer at the on-chain gate — warn the user before submitting. The
   * Layer-2 node gate + out-of-band confirmation are NOT previewed here (signer-side).
   */
  policy?: { willPass: boolean; decision: number; limitValue: bigint };
}

/** Minimal read surface (decouples from viem's PublicClient generic). */
interface ReadClient {
  readContract(args: { address: Address; abi: unknown; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
}

/** Single source of truth for the tier → required-signatures mapping (weights: passkey≥T1, +BLS≥T2, +guardian≥T3). */
export const sigsForTier = (t: TierLevel): RequiredSigs => ({ passkey: true, bls: t >= 2, guardian: t >= 3 ? 1 : 0 });

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
  /**
   * Layer-1 PolicyRegistry address. If given, the result includes a `policy` PREVIEW of the on-chain
   * per-account policy the DVT signer checks before signing (`checkPolicy`). NOTE: this previews only
   * Layer-1 (on-chain). The DVT node's Layer-2 env (operator allowlist / perTxMax) and out-of-band
   * confirmation are signer-side and surface in the signer's response, not here.
   */
  policyRegistry?: Address;
  /** Transfer target (recipient/contract). REQUIRED for the policy preview — without it the preview
   *  is skipped (previewing a self-transfer would give a misleading willPass=true). */
  target?: Address;
  /** Call selector for the policy preview. Default: ETH `0x00000000`, ERC-20 `0xa9059cbb` (transfer). */
  selector?: Hex;
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
  let blockReason: string | undefined;

  if (isEth) {
    const [t1, t2] = await Promise.all([readAccount('tier1Limit'), readAccount('tier2Limit')]);
    tier1Limit = BigInt(t1 as bigint);
    tier2Limit = BigInt(t2 as bigint);
    if (hasGuard) {
      const cfg = await new GuardClient(client, guardAddr).getConfig();
      dailyLimit = cfg.dailyLimit;
      todaySpent = cfg.todaySpent;
    }
  } else if (hasGuard) {
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
    // Strict mode blocks tokens with no config at all.
    if (cfg.strictMode && tier1Limit === 0n && tier2Limit === 0n && dailyLimit === 0n) {
      blockReason = 'strict mode is on and this token has no Guard config — add a tokenConfig first';
    }
  }
  // `assetGuarded` = at least one limit (tier OR daily) is actually enforced for THIS asset — same
  // check for ETH and ERC-20. A guard that exists but has dailyLimit=0 AND no tier limits is NOT
  // enforcing anything, so this is false (so `tier:1 + hasGuard:false` reads as "unprotected").
  const assetGuarded = tier1Limit !== 0n || tier2Limit !== 0n || dailyLimit !== 0n;
  // Unified remaining (same formula for ETH and ERC-20; fail-closed — never negative).
  const remaining = dailyLimit > todaySpent ? dailyLimit - todaySpent : 0n;

  // The required tier (which signatures) comes from the account tier limits, evaluated against the
  // CUMULATIVE daily spend (`todaySpent + amount`), NOT this transfer alone — the account's
  // `_enforceGuard` computes `requiredTier(guard.todaySpent() + value)` (AAStarAirAccountBase.sol),
  // so judging on `amount` alone under-estimates the tier and reverts with InsufficientTier. A
  // guardian co-sign is enabled at Tier 3 (cumulative > tier2Limit).
  const cumulative = todaySpent + amount;
  const tier = resolveTier(cumulative, { tier1Limit, tier2Limit });

  // The Guard daily allowance is a SEPARATE, HARD cap — `Guard.recordSpend` reverts
  // `DailyLimitExceeded` when `todaySpent + amount > dailyLimit`, and a guardian does NOT bypass it
  // (verified in AAStarGlobalGuard.sol). So exceeding it is a BLOCK, not a tier-3 promotion. The
  // Guard daily limit is monotonic — it can only be LOWERED — so the only remedy is the daily reset.
  if (dailyLimit > 0n && amount > remaining && !blockReason) {
    blockReason =
      `exceeds the ${isEth ? 'ETH' : 'token'} daily allowance (remaining ${remaining} of ${dailyLimit}); ` +
      `the Guard hard-reverts over-limit spends (a guardian does not bypass it, and the daily limit ` +
      `can only be lowered) — wait for the daily window to reset`;
  }

  const reason =
    tier === 3
      ? `cumulative spend (${cumulative}) exceeds tier2Limit (${tier2Limit}) — guardian co-sign required`
      : tier === 2
        ? `cumulative spend (${cumulative}) exceeds tier1Limit (${tier1Limit})`
        : tier1Limit === 0n && tier2Limit === 0n
          ? 'no tier limits configured — passkey only'
          : `cumulative spend (${cumulative}) within tier1Limit (${tier1Limit})`;

  // Optional Layer-1 policy preview (what the DVT signer checks on-chain before signing).
  // REQUIRES an explicit `target`: previewing against the account itself (a self-transfer) would
  // typically pass and yield a dangerous FALSE-POSITIVE willPass=true (#186 Med-B). Best-effort —
  // a registry read failure must NOT break the core tier/guard decision (#186 Med-A).
  let policy: TransferResolution['policy'];
  if (params.policyRegistry && params.target) {
    try {
      // For an ERC-20 transfer the call is `transfer(to,amount)` (selector 0xa9059cbb); a native ETH
      // transfer carries no selector (0x00000000). Caller can override.
      const selector = params.selector ?? (isEth ? '0x00000000' : '0xa9059cbb');
      const r = (await client.readContract({
        address: params.policyRegistry,
        abi: PolicyRegistryABI,
        functionName: 'checkPolicy',
        args: [account, params.target, isEth ? (ZERO as Address) : token!, amount, selector],
      })) as any;
      const [decision, limitValue] = Array.isArray(r) ? r : [r[0], r[1]];
      policy = { willPass: Number(decision) === 0, decision: Number(decision), limitValue: BigInt(limitValue) };
    } catch {
      policy = undefined; // preview unavailable (registry read failed) — never break the core result
    }
  }

  return {
    tier,
    requiredSigs: sigsForTier(tier),
    asset: isEth ? 'ETH' : token!,
    limits: { tier1Limit, tier2Limit, dailyLimit, todaySpent, remaining },
    hasGuard: assetGuarded,
    reason,
    blockReason,
    policy,
  };
}
