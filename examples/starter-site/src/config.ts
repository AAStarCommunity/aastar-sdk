import { sepolia, optimism, optimismSepolia } from 'viem/chains';
import type { Chain, Address } from 'viem';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE CONFIG
// Swap the whole site's brand, colors, and copy here. Everything visual reads from
// this object — there are no hard-coded strings/colors in the components/pages.
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandConfig {
  name: string;
  tagline: string;
  logoEmoji: string;
  colors: {
    primary: string;
    primaryText: string;
    bg: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
  };
  copy: {
    heroTitle: string;
    heroSubtitle: string;
    ctaPrimary: string;
    loginTitle: string;
    loginSubtitle: string;
    dashboardTitle: string;
  };
}

export const brand: BrandConfig = {
  name: 'Acme Wallet',
  tagline: 'Web3 without the friction',
  logoEmoji: '🍄',
  colors: {
    primary: '#4f46e5',
    primaryText: '#ffffff',
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  copy: {
    heroTitle: 'Your account. No seed phrase. No gas.',
    heroSubtitle:
      'Sign up with an email and a passkey. We handle the smart account and sponsor your gas.',
    ctaPrimary: 'Get started',
    loginTitle: 'Sign in',
    loginSubtitle: 'Email + passkey. Takes seconds.',
    dashboardTitle: 'Account',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME CONFIG (env-derived; not template-swappable)
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeConfig {
  apiURL: string;
  blsSeedNodes: string[];
  chain: Chain;
  rpcUrl: string;
  operator: Address;
  /** Registry contract address (for the on-chain credit-limit read). Optional. */
  registryAddress?: Address;
}

const CHAINS: Record<string, Chain> = { sepolia, optimism, optimismSepolia };

function resolveChain(name: string | undefined): Chain {
  const chain = CHAINS[name ?? 'sepolia'];
  if (!chain) {
    throw new Error(`[starter-site] Unsupported VITE_CHAIN="${name}". Use: ${Object.keys(CHAINS).join(', ')}.`);
  }
  return chain;
}

export const runtime: RuntimeConfig = {
  apiURL: import.meta.env.VITE_AIRACCOUNT_API_URL ?? 'http://localhost:3000/api/v1',
  blsSeedNodes: (import.meta.env.VITE_BLS_SEED_NODES ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean),
  chain: resolveChain(import.meta.env.VITE_CHAIN),
  rpcUrl: import.meta.env.VITE_RPC_URL ?? 'https://rpc.sepolia.org',
  operator: (import.meta.env.VITE_SP_OPERATOR ?? '0x0000000000000000000000000000000000000000') as Address,
  registryAddress: import.meta.env.VITE_REGISTRY_ADDRESS
    ? (import.meta.env.VITE_REGISTRY_ADDRESS as Address)
    : undefined,
};
