import { fallback, http, parseGwei, type Transport, type Chain } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Sepolia with a 2× base-fee multiplier for the on-chain evidence E2E.
 *
 * viem's default `baseFeeMultiplier` (1.2×) is too low for Sepolia's spiky base fee:
 * txs get mined-underpriced and sit pending for a long time (then time out / block the
 * EOA's nonce queue). This is upstream airaccount-contract RELEASE_CHECKLIST "Known
 * Oversight #7". 2× gives ample headroom so evidence txs confirm promptly.
 */
/**
 * Explicit EIP-1559 fees with a real priority tip. viem's chain-level `defaultPriorityFee`
 * does NOT propagate to writeContract/sendTransaction in this setup (only to the
 * estimateFeesPerGas read), so every write tx otherwise gets a ~0.001-gwei tip and sits
 * pending. Pass these explicitly into every send: `sendTransaction({...tx, ...fees})`.
 */
export async function bumpedFees(
  client: { getBlock: () => Promise<{ baseFeePerGas: bigint | null }> },
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const block = await client.getBlock();
  const base = block.baseFeePerGas ?? parseGwei('2');
  const maxPriorityFeePerGas = parseGwei('3');
  return { maxPriorityFeePerGas, maxFeePerGas: base * 3n + maxPriorityFeePerGas };
}

export const resilientSepoliaChain: Chain = {
  ...sepolia,
  // Sepolia fee policy: 3× base headroom + a real 3-gwei priority tip. viem's default priority
  // estimate is ~0.001 gwei, so txs sit pending (and stick the nonce) even when the base fee is
  // low — a real tip is what gets them mined promptly. `defaultPriorityFee` is the viem knob for
  // this (a custom `estimateFeesPerGas` did not take effect across the write paths).
  fees: {
    baseFeeMultiplier: 3,
    defaultPriorityFee: parseGwei('3'),
  },
};

/**
 * Resilient Sepolia transport for the on-chain evidence E2E.
 *
 * Fails over across SEPOLIA_RPC_URL → SEPOLIA_RPC_URL2 → SEPOLIA_RPC_URL3 (→ RPC_URL),
 * each with per-request retry. A single flaky endpoint no longer turns a valid call into
 * a false E2E failure — this was the root cause of the beta4 agent-lifecycle false
 * negatives (estimateGas/eth_sendRawTransaction intermittently erroring on one provider
 * while the call itself was valid: proven by a successful direct write, tx 0x6a268ca3…).
 */
export function resilientSepoliaTransport(): Transport {
  const urls = [
    process.env.SEPOLIA_RPC_URL,
    process.env.SEPOLIA_RPC_URL2,
    process.env.SEPOLIA_RPC_URL3,
    process.env.RPC_URL,
  ]
    .map((u) => (u || '').trim().replace(/^['"]|['"]$/g, ''))
    .filter((u, i, a) => Boolean(u) && a.indexOf(u) === i);

  if (urls.length === 0) {
    throw new Error('No Sepolia RPC URL in env (set SEPOLIA_RPC_URL / SEPOLIA_RPC_URL2 / SEPOLIA_RPC_URL3)');
  }

  return fallback(
    urls.map((u) => http(u, { retryCount: 3, retryDelay: 800, timeout: 30_000 })),
    { rank: false },
  );
}
