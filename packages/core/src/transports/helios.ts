/**
 * transports/helios.ts — Helios light client viem transport.
 *
 * Provides a viem-compatible custom transport backed by @a16z/helios, a
 * Rust/WASM Ethereum light client that verifies block headers against the
 * consensus layer. Use this transport to make verified RPC calls without
 * trusting a centralized RPC provider.
 *
 * @example
 * ```ts
 * import { createHeliosTransport } from '@aastar/core/transports/helios';
 * import { createPublicClient } from 'viem';
 * import { mainnet } from 'viem/chains';
 *
 * const transport = await createHeliosTransport({
 *   executionRpcUrl: 'https://eth.llamarpc.com',
 *   consensusRpcUrl: 'https://www.lightclientdata.org',
 * });
 *
 * const client = createPublicClient({ chain: mainnet, transport });
 * const blockNumber = await client.getBlockNumber(); // verified ✓
 * ```
 *
 * Requirements:
 *   - @a16z/helios (^0.11.0)
 *   - Browser or Node.js with WASM support
 */

import { custom, type CustomTransportConfig } from "viem";

export interface HeliosTransportConfig {
  /**
   * Execution-layer JSON-RPC URL (used for historical state, mempool).
   * Example: "https://eth.llamarpc.com"
   */
  executionRpcUrl: string;

  /**
   * Consensus-layer REST beacon URL (used for light client sync).
   * Example: "https://www.lightclientdata.org"
   */
  consensusRpcUrl: string;

  /**
   * Network name. Defaults to "mainnet". Also accepts "sepolia".
   */
  network?: "mainnet" | "sepolia";

  /**
   * Options forwarded to viem's custom() transport (timeout, retryCount, etc.)
   */
  transportConfig?: CustomTransportConfig;
}

/**
 * Create a viem custom transport backed by the Helios light client.
 *
 * Helios is lazy-initialized on the first RPC request so the WASM module
 * loads only when needed. The returned transport is safe to pass directly
 * to `createPublicClient`.
 */
export async function createHeliosTransport(config: HeliosTransportConfig) {
  // Dynamic import — @a16z/helios is an optional dep; keep it out of main bundle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Helios } = await (import("@a16z/helios") as Promise<any>);

  const helios = new Helios({
    executionRpc: config.executionRpcUrl,
    consensusRpc: config.consensusRpcUrl,
    network: config.network ?? "mainnet",
  });

  await helios.start();

  return custom(
    {
      async request({ method, params }: { method: string; params?: unknown[] }) {
        // Route the call through the Helios client (verified response)
        return helios.send(method, params ?? []);
      },
    },
    config.transportConfig,
  );
}
