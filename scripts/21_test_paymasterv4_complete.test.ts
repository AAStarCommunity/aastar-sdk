/**
 * FU-77: the anvil script must call admin-client methods that exist.
 * `addGasToken` / `withdrawPNT` are undefined on that client; removing the
 * setTokenPrice / withdrawTo calls (or putting the old names back) fails this test.
 * The client is constructed only — no RPC.
 */
import { readFileSync } from 'node:fs';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { CORE_ADDRESSES } from '../packages/core/src/contract-addresses.js';
import { createAdminClient } from '../packages/sdk/src/clients/admin.js';

const ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

describe('scripts/21_test_paymasterv4_complete', () => {
  it('calls setTokenPrice and withdrawTo, which exist, and not addGasToken or withdrawPNT', () => {
    const src = readFileSync(new URL('./21_test_paymasterv4_complete.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/adminClient\.addGasToken\b/);
    expect(src).not.toMatch(/adminClient\.withdrawPNT\b/);
    expect(src).toMatch(/adminClient\.setTokenPrice\(/);
    expect(src).toMatch(/adminClient\.withdrawTo\(/);

    const admin = createAdminClient({
      chain: foundry,
      transport: http('http://127.0.0.1:1'),
      account: privateKeyToAccount(ANVIL_KEY),
      addresses: { ...CORE_ADDRESSES },
    });
    expect(typeof admin.setTokenPrice).toBe('function');
    expect(typeof admin.withdrawTo).toBe('function');
    expect(typeof (admin as { addGasToken?: unknown }).addGasToken).toBe('undefined');
    expect(typeof (admin as { withdrawPNT?: unknown }).withdrawPNT).toBe('undefined');
  });
});
