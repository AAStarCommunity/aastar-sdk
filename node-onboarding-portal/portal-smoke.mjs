// Headless runtime smoke test: proves the portal loads, the wizard drives, and the in-browser SDK crypto
// (buildDvtPop via @aastar/sdk/core) actually produces a valid nodeId in a real browser — not just builds.
// The wallet is mocked (a real onboard needs MetaMask + funds; the chain path is already proven by the
// CLI E2E, register tx 0xe4e1de53…). Run: node portal-smoke.mjs
import { chromium } from 'playwright';

const URL = 'http://localhost:4173/';
const OPERATOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext();

// Inject a minimal EIP-1193 mock BEFORE any page script runs.
await ctx.addInitScript(({ operator }) => {
  window.ethereum = {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts') return [operator];
      if (method === 'eth_chainId') return '0xaa36a7'; // 11155111 sepolia
      return null;
    },
  };
}, { operator: OPERATOR });

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  // Ignore benign network 404s (e.g. favicon) — only app/JS errors count.
  if (m.type() === 'error' && !/status of 404|favicon/i.test(m.text())) errors.push('console.error: ' + m.text());
});

await page.goto(URL, { waitUntil: 'networkidle' });

// Step 1 heading renders
await page.getByRole('heading', { name: /下载节点镜像/ }).waitFor({ timeout: 10000 });
console.log('✓ portal loaded, step 1 rendered');

// 1 → 2 (image → config)
await page.getByRole('button', { name: /下一步/ }).click();
await page.getByRole('heading', { name: /填写配置/ }).waitFor();
// default network=sepolia, nodeKind=local
await page.getByRole('button', { name: /下一步/ }).click();

// 3 connect (mock wallet)
await page.getByRole('heading', { name: /连接钱包/ }).waitFor();
await page.getByRole('button', { name: /连接钱包/ }).click();
await page.getByText(OPERATOR, { exact: false }).waitFor({ timeout: 8000 });
console.log('✓ wallet connected (mock):', OPERATOR);
await page.getByRole('button', { name: /下一步/ }).click();

// 4 gen-key — the real in-browser SDK crypto
await page.getByRole('heading', { name: /生成密钥/ }).waitFor();
await page.getByRole('button', { name: /生成 BLS 私钥/ }).click();
// nodeId row appears — capture the 66-char 0x hex it renders
await page.getByText(/^0x[0-9a-fA-F]{64}$/).first().waitFor({ timeout: 10000 });
const nodeId = await page.evaluate(() => {
  const li = [...document.querySelectorAll('.kv li')].find((el) => el.querySelector('b')?.textContent === 'nodeId');
  return li?.querySelector('span')?.textContent?.trim() || '';
});
console.log('✓ in-browser buildDvtPop produced nodeId:', nodeId);

await page.screenshot({ path: 'portal-genkey.png', fullPage: true });

const ok = /^0x[0-9a-fA-F]{64}$/.test(nodeId) && errors.length === 0;
console.log('console/page errors:', errors.length ? errors : 'none');
console.log(ok ? '\n✅ PORTAL SMOKE PASS' : '\n❌ PORTAL SMOKE FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
