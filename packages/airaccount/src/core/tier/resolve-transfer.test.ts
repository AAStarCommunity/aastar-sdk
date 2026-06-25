import { describe, it, expect, vi } from 'vitest';
import { resolveTransfer } from './resolve-transfer.js';

const ACCOUNT = '0xaCC0000000000000000000000000000000000001' as const;
const GUARD = '0x6Ua0000000000000000000000000000000000002'.replace('U', 'a') as `0x${string}`;
const TOKEN = '0x70c0000000000000000000000000000000000003' as const;

// Build a readContract mock from account-level + guard-level value maps.
function makeClient(account: Record<string, any>, guard: Record<string, any> = {}, token: Record<string, any> = {}) {
  return {
    readContract: vi.fn(async ({ address, functionName, args }: any) => {
      if (address === ACCOUNT) return account[functionName];
      // guard reads (GuardClient)
      if (functionName === 'tokenConfigs') return [token.tier1 ?? 0n, token.tier2 ?? 0n, token.daily ?? 0n];
      if (functionName === 'tokenTodaySpent') return token.spent ?? 0n;
      return guard[functionName];
    }),
  } as any;
}

const guardDefaults = (o: Record<string, any> = {}) => ({
  account: ACCOUNT, dailyLimit: 0n, minDailyLimit: 0n, todaySpent: 0n,
  remainingDailyAllowance: 0n, blockUnconfiguredTokens: false, ...o,
});

describe('resolveTransfer (#176 unified ETH+ERC20 tier/guard branch)', () => {
  it('ETH within tier1 → Tier 1, passkey only', async () => {
    const c = makeClient({ guard: GUARD, tier1Limit: 100n, tier2Limit: 1000n }, guardDefaults({ dailyLimit: 10000n, remainingDailyAllowance: 10000n }));
    const r = await resolveTransfer({ client: c, account: ACCOUNT, amount: 50n });
    expect(r.tier).toBe(1);
    expect(r.requiredSigs).toEqual({ passkey: true, bls: false, guardian: 0 });
  });

  it('ETH between tier1 and tier2 → Tier 2 (passkey + BLS)', async () => {
    const c = makeClient({ guard: GUARD, tier1Limit: 100n, tier2Limit: 1000n }, guardDefaults({ dailyLimit: 10000n, remainingDailyAllowance: 10000n }));
    const r = await resolveTransfer({ client: c, account: ACCOUNT, amount: 500n });
    expect(r.tier).toBe(2);
    expect(r.requiredSigs.bls).toBe(true);
    expect(r.requiredSigs.guardian).toBe(0);
  });

  it('exceeding the guard daily allowance forces Tier 3 even when account tier is 0 (the #176 case)', async () => {
    // account tier unconfigured (0/0) → accountTier=1, but amount blows the guard daily → T3 guardian.
    const c = makeClient({ guard: GUARD, tier1Limit: 0n, tier2Limit: 0n }, guardDefaults({ dailyLimit: 1000n, remainingDailyAllowance: 1000n }));
    const r = await resolveTransfer({ client: c, account: ACCOUNT, amount: 5000n });
    expect(r.tier).toBe(3);
    expect(r.requiredSigs).toEqual({ passkey: true, bls: true, guardian: 1 });
    expect(r.reason).toMatch(/daily allowance/);
  });

  it('ERC20 uses the token tier config (guard tokenConfigs), not the account tier', async () => {
    const c = makeClient(
      { guard: GUARD, tier1Limit: 999999n, tier2Limit: 999999n }, // account tiers high (irrelevant for token)
      guardDefaults(),
      { tier1: 10n, tier2: 100n, daily: 1000n, spent: 0n },
    );
    const r = await resolveTransfer({ client: c, account: ACCOUNT, amount: 50n, token: TOKEN });
    expect(r.asset).toBe(TOKEN);
    expect(r.tier).toBe(2); // 50 is between token tier1(10) and tier2(100)
    expect(r.limits.tier1Limit).toBe(10n);
  });

  it('hasGuard distinguishes "small amount" from "unprotected" (Medium review finding)', async () => {
    // ERC-20 with a guard but no config for this token → unguarded for this asset.
    const noCfg = makeClient({ guard: GUARD }, guardDefaults(), { tier1: 0n, tier2: 0n, daily: 0n });
    expect((await resolveTransfer({ client: noCfg, account: ACCOUNT, amount: 1n, token: TOKEN })).hasGuard).toBe(false);
    // ETH with a configured guard → guarded.
    const guarded = makeClient({ guard: GUARD, tier1Limit: 100n, tier2Limit: 1000n }, guardDefaults({ dailyLimit: 10000n, remainingDailyAllowance: 10000n }));
    expect((await resolveTransfer({ client: guarded, account: ACCOUNT, amount: 50n })).hasGuard).toBe(true);
  });

  it('strict mode + unconfigured token → blockReason', async () => {
    const c = makeClient({ guard: GUARD }, guardDefaults({ blockUnconfiguredTokens: true }), { tier1: 0n, tier2: 0n, daily: 0n });
    const r = await resolveTransfer({ client: c, account: ACCOUNT, amount: 1n, token: TOKEN });
    expect(r.blockReason).toMatch(/strict mode/);
  });
});
