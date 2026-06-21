/**
 * Launch token-sale E2E (Sepolia) — exercises the full @aastar/tokens TokenSaleClient
 * surface against the LIVE launch contracts + relayer, mapping each launch.mushroom.cv/join
 * page feature to an SDK call. Everything uses the launch config (LAUNCH_SALE_ADDRESSES).
 *
 * Run:  pnpm exec tsx scripts/launch_sale_e2e.ts
 * Needs: .env.launch-e2e (LAUNCH_E2E_PRIVATE_KEY), the test wallet funded with USDC
 *        (+ a little Sepolia ETH for the self-pay leg). Optional SEPOLIA_RPC_URL.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Local-env workaround ONLY: this machine reaches the internet through an HTTP proxy
// (https_proxy=127.0.0.1:7890). curl honors it, but Node's built-in fetch does NOT read
// proxy env vars, so direct connects to the Cloudflare relayer time out. Patch the global
// fetch to route through the proxy via undici ProxyAgent. The SDK itself uses plain global
// fetch (correct for browsers and normal Node); this is purely test-harness plumbing.
try {
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (proxyUrl) {
    // `undici` is bundled in Node but not exposed as an importable package; fall back to the
    // pnpm-vendored copy if the bare specifier doesn't resolve.
    let undici: any;
    try { undici = await import('undici'); }
    catch {
      const { createRequire } = await import('node:module');
      const require_ = createRequire(import.meta.url);
      const { sync } = require_('glob');
      const hit = sync('node_modules/.pnpm/undici@*/node_modules/undici/index.js')[0];
      if (hit) undici = await import(resolve(process.cwd(), hit));
    }
    if (undici?.ProxyAgent) {
      const agent = new undici.ProxyAgent(proxyUrl);
      globalThis.fetch = ((url: any, opts: any = {}) =>
        undici.fetch(url, { ...opts, dispatcher: agent })) as any;
    }
  }
} catch { /* undici not present; proceed with default fetch */ }
import { createPublicClient, createWalletClient, http, formatUnits, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { TokenSaleClient, usd, type SaleTokenKind } from '@aastar/tokens';
import { getLaunchSaleAddresses } from '@aastar/core';

// ── env ──────────────────────────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env.launch-e2e'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch { /* ignore */ }
  return out;
}
const env = loadEnv();
const PK = (env.LAUNCH_E2E_PRIVATE_KEY || process.env.LAUNCH_E2E_PRIVATE_KEY) as `0x${string}`;
if (!PK) throw new Error('LAUNCH_E2E_PRIVATE_KEY not set (.env.launch-e2e)');
const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

const results: Array<{ step: string; ok: boolean; detail: string }> = [];
const rec = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${step} — ${detail}`);
};

const BUY_USD = usd(1); // $1 per buy to conserve funds

async function main() {
  console.log('=== Launch token-sale E2E (Sepolia) ===');
  console.log('account:', account.address);
  console.log('rpc    :', RPC);
  const addrs = getLaunchSaleAddresses(sepolia.id)!;
  console.log('config :', JSON.stringify(addrs, null, 2));

  const sale = new TokenSaleClient(publicClient, walletClient);

  // 1. Prices (page: price display)
  try {
    const p = await sale.getPrices();
    rec('getPrices', p.gToken > 0n && p.aPNTs > 0n,
      `GToken $${formatUnits(p.gToken, 6)} · aPNTs $${formatUnits(p.aPNTs, 6)}`);
  } catch (e: any) { rec('getPrices', false, e.shortMessage || e.message); }

  // 2. Payout token resolution (de-dup: on-chain sale.gToken()/aPNTs())
  for (const t of ['GTOKEN', 'APNTS'] as SaleTokenKind[]) {
    try { rec(`getPayoutToken(${t})`, true, await sale.getPayoutToken(t)); }
    catch (e: any) { rec(`getPayoutToken(${t})`, false, e.shortMessage || e.message); }
  }

  // 3. Quote (page: estimate)
  try {
    const q = await sale.quote('GTOKEN', BUY_USD);
    rec('quote(GTOKEN,$1)', q > 0n, `${formatUnits(q, 18)} GT`);
  } catch (e: any) { rec('quote(GTOKEN,$1)', false, e.shortMessage || e.message); }

  // 4. Balances (page: wallet panel)
  let bal0;
  try {
    bal0 = await sale.getBalances(account.address);
    rec('getBalances', true,
      `ETH ${formatEther(bal0.eth).slice(0, 8)} · USDC ${formatUnits(bal0.usdc, 6)} · USDT ${formatUnits(bal0.usdt, 6)} · GT ${formatUnits(bal0.gToken, 18)} · aPNTs ${formatUnits(bal0.aPNTs, 18)}`);
  } catch (e: any) { rec('getBalances', false, e.shortMessage || e.message); return finish(); }

  const haveUSDC = bal0.usdc >= BUY_USD;
  const haveETH = bal0.eth > 0n;

  // 5. Gasless buy GTOKEN (page: gasless tab) — needs USDC only
  if (haveUSDC) {
    try {
      const r = await sale.buyGasless({ token: 'GTOKEN', usdAmount: BUY_USD });
      rec('buyGasless(GTOKEN)', true, `tx ${r.txHash} rule=${r.matchedRule ?? '-'}`);
    } catch (e: any) { rec('buyGasless(GTOKEN)', false, e.shortMessage || e.message); }
  } else rec('buyGasless(GTOKEN)', false, 'SKIPPED: insufficient USDC');

  // 6. Gasless buy APNTS with gift recipient (page: gift checkbox)
  if (haveUSDC) {
    const giftTo = '0x000000000000000000000000000000000000dEaD';
    try {
      const r = await sale.buyGasless({ token: 'APNTS', usdAmount: BUY_USD, recipient: giftTo });
      rec('buyGasless(APNTS,gift)', true, `tx ${r.txHash}`);
    } catch (e: any) { rec('buyGasless(APNTS,gift)', false, e.shortMessage || e.message); }
  } else rec('buyGasless(APNTS,gift)', false, 'SKIPPED: insufficient USDC');

  // 7. Self-pay buy GTOKEN with USDC (page: self-pay tab) — needs ETH for gas
  if (haveUSDC && haveETH) {
    try {
      const r = await sale.buySelfPay({ token: 'GTOKEN', usdAmount: BUY_USD, payToken: 'USDC' });
      rec('buySelfPay(GTOKEN,USDC)', true, `tx ${r.txHash}`);
    } catch (e: any) { rec('buySelfPay(GTOKEN,USDC)', false, e.shortMessage || e.message); }
  } else rec('buySelfPay(GTOKEN,USDC)', false, `SKIPPED: ${!haveETH ? 'no ETH for gas' : 'insufficient USDC'}`);

  // 8. Balances after (confirm tokens received)
  try {
    const bal1 = await sale.getBalances(account.address);
    const gtDelta = bal1.gToken - bal0.gToken;
    rec('getBalances(after)', true,
      `GT Δ ${formatUnits(gtDelta, 18)} · USDC ${formatUnits(bal1.usdc, 6)}`);
  } catch (e: any) { rec('getBalances(after)', false, e.shortMessage || e.message); }

  finish();
}

function finish() {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== SUMMARY: ${pass}/${results.length} steps OK ===`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('Failed/skipped:');
    for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
