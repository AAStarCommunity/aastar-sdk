import { sepolia, optimism, optimismSepolia } from 'viem/chains';
import type { Chain } from 'viem';
import type { Address } from 'viem';

/**
 * Widget configuration. Everything here is resolved from Vite env vars (VITE_*) at
 * build time, but `mount()` callers can override any field at runtime — see embed.tsx.
 *
 * IMPORTANT: all of this ships to the browser. Never read a private key here.
 */
export interface WidgetConfig {
  /** AirAccount / KMS backend base URL (YAAAClient.apiURL). */
  apiURL: string;
  /** BLS seed nodes for signer discovery. */
  blsSeedNodes: string[];
  /** Target viem chain (must have canonical AAStar addresses). */
  chain: Chain;
  /** JSON-RPC URL for the chain (balance reads / address prediction). */
  rpcUrl: string;
  /** SuperPaymaster operator that sponsors gas. */
  operator: Address;
}

const CHAINS: Record<string, Chain> = {
  sepolia,
  optimism,
  optimismSepolia,
};

function resolveChain(name: string | undefined): Chain {
  const chain = CHAINS[name ?? 'sepolia'];
  if (!chain) {
    throw new Error(
      `[embed-widget] Unsupported VITE_CHAIN="${name}". ` +
        `Use one of: ${Object.keys(CHAINS).join(', ')}.`,
    );
  }
  return chain;
}

/** Build the default config from environment variables. */
export function configFromEnv(): WidgetConfig {
  return {
    apiURL: import.meta.env.VITE_AIRACCOUNT_API_URL ?? 'http://localhost:3000/api/v1',
    blsSeedNodes: (import.meta.env.VITE_BLS_SEED_NODES ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    chain: resolveChain(import.meta.env.VITE_CHAIN),
    rpcUrl: import.meta.env.VITE_RPC_URL ?? 'https://rpc.sepolia.org',
    operator: (import.meta.env.VITE_SP_OPERATOR ??
      '0x0000000000000000000000000000000000000000') as Address,
  };
}

/** Allow a host page to override any subset of the env-derived config. */
export type WidgetOptions = Partial<{
  apiURL: string;
  blsSeedNodes: string[];
  chainName: string;
  rpcUrl: string;
  operator: Address;
}>;

export function resolveConfig(options?: WidgetOptions): WidgetConfig {
  const base = configFromEnv();
  if (!options) return base;
  return {
    apiURL: options.apiURL ?? base.apiURL,
    blsSeedNodes: options.blsSeedNodes ?? base.blsSeedNodes,
    chain: options.chainName ? resolveChain(options.chainName) : base.chain,
    rpcUrl: options.rpcUrl ?? base.rpcUrl,
    operator: options.operator ?? base.operator,
  };
}
