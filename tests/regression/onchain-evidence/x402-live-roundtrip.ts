/**
 * x402 LIVE round-trip against the DVT-hosted facilitator (YetAnotherAA-Validator#130).
 *
 * createPayment (direct/aPNTs) → POST /x402/verify → POST /x402/settle (real on-chain via the
 * dvt node's operator) → assert recipient received amount−fee. Proves the full SDK↔facilitator
 * wire end-to-end against the live service.
 *
 * Run: pnpm exec tsx tests/regression/onchain-evidence/x402-live-roundtrip.ts
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import { X402Client } from '../../../packages/x402/src/X402Client.ts';
import { getX402FacilitatorUrls } from '../../../packages/x402/src/facilitators.ts';

dotenv.config({ path: '.env.sepolia' });
// No secrets in source: prefer SEPOLIA_RPC_URL from env, else a keyless public RPC.
const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const n = (k?: string) => (k!.startsWith('0x') ? k! : `0x${k}`) as Hex;
const CHAIN_ID = 11155111;
const APNTS = '0x696A73701b104c6cCBbAadDD2216788ea08EaB89' as Address; // supported asset (direct)
const ERC20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

async function main() {
  const payer = privateKeyToAccount(n(process.env.PRIVATE_KEY_JASON));       // holds aPNTs
  const recipient = privateKeyToAccount(n(process.env.PRIVATE_KEY_BOB)).address;
  const url = getX402FacilitatorUrls(CHAIN_ID)[0];                            // https://dvt1.aastar.io/x402
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account: payer, chain: sepolia, transport: http(RPC) });

  const client = new X402Client({
    publicClient: pub as never, walletClient,
    superPaymasterAddress: '0xfe1DB01e1d6622e722B92ed5993af61325DB92aF',
    chainId: CHAIN_ID, tokenName: 'aPNTs', tokenVersion: '1',
    facilitator: { url },
  });

  const amount = parseUnits('10', 18);
  const maxFee = parseUnits('1', 18); // > 2% fee (0.2 aPNTs)
  console.log(`\n💸 x402 LIVE round-trip — facilitator ${url}`);
  console.log(`   payer(Jason)=${payer.address} recipient(Bob)=${recipient} asset=aPNTs amount=10`);

  const { payload } = await client.createPayment({
    from: payer.address, to: recipient, asset: APNTS, amount, settlement: 'direct', maxFee,
  });

  // Read the facilitator's advertised fee so we can assert the EXACT net amount (not just >0).
  const supported = await fetch(`${url}/supported`).then((r) => r.json());
  const feeBPS = BigInt(supported?.kinds?.[0]?.extra?.feeBPS ?? 0);
  const expectedNet = amount - (amount * feeBPS) / 10000n;
  console.log(`   feeBPS=${feeBPS} → expected net to recipient = ${formatUnits(expectedNet, 18)} aPNTs`);

  console.log('[1] POST /x402/verify …');
  const verify = await client.verifyViaFacilitator(payload);
  console.log(`    isValid=${verify.isValid}${verify.invalidReason ? ` reason=${verify.invalidReason}` : ''}`);
  if (!verify.isValid) throw new Error(`verify rejected: ${verify.invalidReason}`);

  const before = await pub.readContract({ address: APNTS, abi: ERC20, functionName: 'balanceOf', args: [recipient] });
  console.log('[2] POST /x402/settle …');
  const settle = await client.settleViaFacilitator(payload);
  if (!settle.success) throw new Error(`settle failed: ${settle.errorReason}`);
  const txHash = settle.transaction as Hex;
  await pub.waitForTransactionReceipt({ hash: txHash });
  const after = await pub.readContract({ address: APNTS, abi: ERC20, functionName: 'balanceOf', args: [recipient] });
  const received = after - before;
  console.log(`    success tx=${txHash}`);
  console.log(`    recipient Δ +${formatUnits(received, 18)} aPNTs (expected ${formatUnits(expectedNet, 18)} = amount − ${feeBPS}bps fee)`);
  if (received !== expectedNet) {
    throw new Error(`fee mismatch: recipient received ${received} wei, expected ${expectedNet} (amount ${amount} − ${feeBPS}bps)`);
  }

  console.log(`\n🎉 x402 LIVE round-trip PASSED — verify + settle via ${url}`);
  console.log(`   settle: https://sepolia.etherscan.io/tx/${txHash}`);
}

main().catch((e) => { console.error('❌ x402 live round-trip FAILED:', e?.message ?? e); process.exit(1); });
