/**
 * utils/ens.ts — ENS forward and reverse resolution helpers.
 *
 * Wraps viem's ENS actions with a simple, dual-direction API:
 *   resolveEns(name)  → 0x address (forward lookup)
 *   lookupAddress(address) → ENS name (reverse lookup)
 *
 * @example
 * ```ts
 * import { resolveEns, lookupAddress } from '@aastar/core/utils/ens';
 *
 * const address = await resolveEns('vitalik.eth');
 * // → "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
 *
 * const name = await lookupAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
 * // → "vitalik.eth"
 * ```
 *
 * Requirements: viem ≥ 2.0 (already a peer dep of @aastar/core)
 */

import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { getEnsAddress, getEnsName, normalize } from "viem/ens";
import { mainnet } from "viem/chains";

/** Options accepted by resolveEns and lookupAddress. */
export interface EnsOptions {
  /**
   * viem PublicClient configured for the ENS registry chain (usually mainnet).
   * If omitted, a default mainnet client using the public RPC is created.
   * Pass your own client to control the RPC URL, caching, etc.
   */
  client?: PublicClient;

  /**
   * Mainnet JSON-RPC URL. Only used when `client` is not provided.
   * Defaults to the viem public mainnet RPC.
   */
  rpcUrl?: string;
}

/**
 * Forward-resolve an ENS name to an Ethereum address.
 * Returns null if the name has no address record.
 *
 * @example
 * const address = await resolveEns('vitalik.eth');
 */
export async function resolveEns(
  name: string,
  options: EnsOptions = {},
): Promise<`0x${string}` | null> {
  const client = options.client ?? makeMainnetClient(options.rpcUrl);
  return getEnsAddress(client, { name: normalize(name) });
}

/**
 * Reverse-resolve an Ethereum address to its primary ENS name.
 * Returns null if the address has no reverse record.
 *
 * @example
 * const name = await lookupAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
 */
export async function lookupAddress(
  address: `0x${string}`,
  options: EnsOptions = {},
): Promise<string | null> {
  const client = options.client ?? makeMainnetClient(options.rpcUrl);
  return getEnsName(client, { address });
}

/**
 * Resolve both directions at once: given an ENS name, return the address and
 * confirm the reverse record matches (to detect misconfigurations).
 *
 * Returns `{ address, name, verified }` where `verified` is true only when
 * the reverse record of the resolved address points back to `name`.
 */
export async function resolveEnsVerified(
  name: string,
  options: EnsOptions = {},
): Promise<{ address: `0x${string}` | null; name: string; verified: boolean }> {
  const client = options.client ?? makeMainnetClient(options.rpcUrl);

  const address = await getEnsAddress(client, { name: normalize(name) });
  if (!address) return { address: null, name, verified: false };

  const reverseName = await getEnsName(client, { address });
  const verified =
    reverseName !== null && reverseName.toLowerCase() === name.toLowerCase();

  return { address, name, verified };
}

// ── Internal ─────────────────────────────────────────────────────────────────

function makeMainnetClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: mainnet as Chain,
    transport: http(rpcUrl),
  }) as unknown as PublicClient;
}
