/**
 * GuardClient — read + manage an account's AAStarGlobalGuard (the per-account spending-limit /
 * tiered-policy contract; see airaccount-contract `src/core/AAStarGlobalGuard.sol`).
 *
 * The Guard's write methods are `onlyAccount` — they CANNOT be called by an EOA directly. So the
 * management methods here return a {@link GuardCall} (`{ to, value, data }`) that the caller wraps
 * in `account.execute(to, value, data)` and submits as a UserOp (e.g. via the AirAccount client).
 * Reads are plain view calls (any caller). Browser-safe (viem-only) — usable from a YAA frontend
 * to build policy management + viewing entry points.
 *
 * Monotonic-by-design: limits can only DECREASE, token configs can only be ADDED (never edited or
 * removed), and ETH daily limit can't go below `minDailyLimit`. The contract enforces this; these
 * wrappers just expose the allowed operations.
 */
import { type Address, type Hex, encodeFunctionData } from 'viem';
import { AAStarGlobalGuardABI } from './abis/index.js';

/** Per-token tiered limits (tier1 ≤ tier2 ≤ dailyLimit). */
export interface GuardTokenConfig {
  /** Tier-1 (ECDSA single-sig) cumulative cap. */
  tier1Limit: bigint;
  /** Tier-2 (P256 + BLS) cumulative cap. */
  tier2Limit: bigint;
  /** Per-day total cap. */
  dailyLimit: bigint;
}

/** Snapshot of the Guard's ETH-level config + state. */
export interface GuardConfig {
  /** The bound account (immutable). */
  account: Address;
  /** Current ETH daily limit (0 = no ETH limit / guard inactive). */
  dailyLimit: bigint;
  /** Floor the ETH daily limit can never go below (immutable). */
  minDailyLimit: bigint;
  /** ETH spent today. */
  todaySpent: bigint;
  /** ETH still spendable today. */
  remainingDailyAllowance: bigint;
  /** Strict mode: when true, any token without a config is blocked. */
  strictMode: boolean;
}

/** A Guard management call to submit via `account.execute(to, value, data)` (UserOp). */
export interface GuardCall {
  to: Address;
  value: bigint;
  data: Hex;
}

/** Minimal read surface (decouples from viem's PublicClient generic). */
interface ReadClient {
  readContract(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

export class GuardClient {
  constructor(
    private readonly publicClient: ReadClient,
    public readonly guardAddress: Address,
  ) {}

  private read(functionName: string, args: readonly unknown[] = []): Promise<unknown> {
    return this.publicClient.readContract({
      address: this.guardAddress,
      abi: AAStarGlobalGuardABI,
      functionName,
      args,
    });
  }

  // ─── Reads (any caller) ───────────────────────────────────────────────

  /** ETH-level config + live spend state in one batch. */
  async getConfig(): Promise<GuardConfig> {
    const [account, dailyLimit, minDailyLimit, todaySpent, remainingDailyAllowance, strictMode] =
      await Promise.all([
        this.read('account'),
        this.read('dailyLimit'),
        this.read('minDailyLimit'),
        this.read('todaySpent'),
        this.read('remainingDailyAllowance'),
        this.read('blockUnconfiguredTokens'),
      ]);
    return {
      account: account as Address,
      dailyLimit: BigInt(dailyLimit as bigint),
      minDailyLimit: BigInt(minDailyLimit as bigint),
      todaySpent: BigInt(todaySpent as bigint),
      remainingDailyAllowance: BigInt(remainingDailyAllowance as bigint),
      strictMode: strictMode as boolean,
    };
  }

  /** A token's tiered config (`tier1Limit`/`tier2Limit`/`dailyLimit`). All-zero = unconfigured. */
  async getTokenConfig(token: Address): Promise<GuardTokenConfig> {
    // tokenConfigs returns (uint128 tier1, uint128 tier2, uint256 daily) — viem gives an array
    // (or a named object on some versions); handle both.
    const r = (await this.read('tokenConfigs', [token])) as any;
    const t1 = Array.isArray(r) ? r[0] : r.tier1Limit;
    const t2 = Array.isArray(r) ? r[1] : r.tier2Limit;
    const dy = Array.isArray(r) ? r[2] : r.dailyLimit;
    return { tier1Limit: BigInt(t1), tier2Limit: BigInt(t2), dailyLimit: BigInt(dy) };
  }

  /** A token's amount spent today. */
  async getTokenTodaySpent(token: Address): Promise<bigint> {
    return BigInt((await this.read('tokenTodaySpent', [token])) as bigint);
  }

  // ─── Management (onlyAccount → wrap each in account.execute as a UserOp) ──

  /** Add a token's tiered limit config (add-only; cannot edit/remove an existing one). */
  encodeAddTokenConfig(token: Address, config: GuardTokenConfig): GuardCall {
    return this.call('addTokenConfig', [
      token,
      { tier1Limit: config.tier1Limit, tier2Limit: config.tier2Limit, dailyLimit: config.dailyLimit },
    ]);
  }

  /** Lower the ETH daily limit (can only decrease; not below `minDailyLimit`). */
  encodeDecreaseDailyLimit(newLimit: bigint): GuardCall {
    return this.call('decreaseDailyLimit', [newLimit]);
  }

  /** Lower a token's daily limit (decrease-only). */
  encodeDecreaseTokenDailyLimit(token: Address, newLimit: bigint): GuardCall {
    return this.call('decreaseTokenDailyLimit', [token, newLimit]);
  }

  /** Enable/disable strict mode (block tokens that have no config). */
  encodeSetStrictMode(enabled: boolean): GuardCall {
    return this.call('setStrictMode', [enabled]);
  }

  private call(functionName: string, args: readonly unknown[]): GuardCall {
    return {
      to: this.guardAddress,
      value: 0n,
      data: encodeFunctionData({ abi: AAStarGlobalGuardABI as never, functionName, args } as never),
    };
  }
}
