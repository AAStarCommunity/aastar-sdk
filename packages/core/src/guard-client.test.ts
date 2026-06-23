import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData } from 'viem';
import { GuardClient } from './guard-client.js';
import { AAStarGlobalGuardABI } from './abis/index.js';

const GUARD = '0x1111111111111111111111111111111111111111' as const;
const ACCOUNT = '0x2222222222222222222222222222222222222222' as const;
const TOKEN = '0x3333333333333333333333333333333333333333' as const;

function mockClient(map: Record<string, unknown>) {
  return {
    readContract: vi.fn(async ({ functionName }: any) => map[functionName]),
  };
}

describe('GuardClient reads', () => {
  it('getConfig batches the ETH-level state', async () => {
    const c = new GuardClient(
      mockClient({
        account: ACCOUNT,
        dailyLimit: 1000n,
        minDailyLimit: 100n,
        todaySpent: 300n,
        remainingDailyAllowance: 700n,
        blockUnconfiguredTokens: true,
      }),
      GUARD,
    );
    expect(await c.getConfig()).toEqual({
      account: ACCOUNT,
      dailyLimit: 1000n,
      minDailyLimit: 100n,
      todaySpent: 300n,
      remainingDailyAllowance: 700n,
      strictMode: true,
    });
  });

  it('getTokenConfig handles a tuple (array) return', async () => {
    const c = new GuardClient(mockClient({ tokenConfigs: [10n, 20n, 50n] }), GUARD);
    expect(await c.getTokenConfig(TOKEN)).toEqual({ tier1Limit: 10n, tier2Limit: 20n, dailyLimit: 50n });
  });
});

describe('GuardClient management calldata (onlyAccount → via account.execute)', () => {
  const c = new GuardClient(mockClient({}), GUARD);

  const decode = (data: `0x${string}`) =>
    decodeFunctionData({ abi: AAStarGlobalGuardABI as never, data });

  it('encodeAddTokenConfig targets the guard with the right calldata', () => {
    const call = c.encodeAddTokenConfig(TOKEN, { tier1Limit: 1n, tier2Limit: 2n, dailyLimit: 3n });
    expect(call.to).toBe(GUARD);
    expect(call.value).toBe(0n);
    const { functionName, args } = decode(call.data) as any;
    expect(functionName).toBe('addTokenConfig');
    expect(args[0]).toBe(TOKEN);
    expect(args[1]).toMatchObject({ tier1Limit: 1n, tier2Limit: 2n, dailyLimit: 3n });
  });

  it('encodeDecreaseDailyLimit / encodeSetStrictMode encode correctly', () => {
    expect((decode(c.encodeDecreaseDailyLimit(500n).data) as any).functionName).toBe('decreaseDailyLimit');
    expect((decode(c.encodeDecreaseDailyLimit(500n).data) as any).args[0]).toBe(500n);
    const sm = decode(c.encodeSetStrictMode(true).data) as any;
    expect(sm.functionName).toBe('setStrictMode');
    expect(sm.args[0]).toBe(true);
  });
});
