/**
 * The ONLY module in this portal that touches chain / keys / crypto. Every underlying operation goes
 * through @aastar/sdk — the page above is pure flow-wiring. Keeping all SDK calls here means YAAA can lift
 * src/ and swap only this file's wallet-connection glue for its own provider.
 */
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  toHex,
} from 'viem';
import { sepolia, optimismSepolia } from 'viem/chains';
// Import the NARROW subpaths, not the umbrella barrel: the full `@aastar/sdk` index pulls node-only code
// (config-file fs I/O, server bits) that breaks a browser bundle. /operator + /core are browser-safe.
import { onboardDvtNode, type OnboardDvtNodeResult } from '@aastar/sdk/operator';
import { buildDvtPop, type DvtPop } from '@aastar/sdk/core';
import type { NodeKind, Pop, PortalConfig, WalletConn } from './types';

const CHAINS = { sepolia, 'op-sepolia': optimismSepolia } as const;

/** BLS12-381 scalar field order r — a generated node key must be a scalar in [1, r-1]. */
const BLS12_381_R = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
function injected(): Eip1193 {
  const eth = (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;
  if (!eth) throw new Error('No injected wallet found (install MetaMask or a compatible wallet).');
  return eth;
}

/** Connect the injected wallet and return the operator address + chainId. */
export async function connectWallet(): Promise<WalletConn> {
  const eth = injected();
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as Address[];
  if (!accounts?.length) throw new Error('Wallet returned no accounts.');
  const chainIdHex = (await eth.request({ method: 'eth_chainId' })) as string;
  return { address: accounts[0], chainId: Number(BigInt(chainIdHex)) };
}

/** Public (read) client for a network. */
export function publicClientFor(cfg: PortalConfig) {
  return createPublicClient({ chain: CHAINS[cfg.network], transport: http() });
}

/** Wallet (write) client bound to the connected operator account via the injected provider. */
export function operatorWalletFor(cfg: PortalConfig, operator: Address) {
  return createWalletClient({ account: operator, chain: CHAINS[cfg.network], transport: custom(injected()) });
}

/** Generate a fresh in-browser BLS secret key for a LOCAL node (never leaves the browser; user saves it). */
export function generateLocalBlsKey(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let sk = BigInt(toHex(bytes)) % BLS12_381_R;
  if (sk <= 0n) sk = 1n;
  return toHex(sk, { size: 32 });
}

/** Derive the PoP tuple locally from a BLS secret key — SDK core, pure crypto, no chain. */
export function popFromLocalKey(blsSecretKey: Hex): Pop {
  return buildDvtPop(blsSecretKey) as DvtPop;
}

/**
 * KMS-TEE PoP signer (CC-37 `/pop` contract): POST {node_id | publicKey} → {publicKey, popPoint, popSig}.
 * The TEE signs the node's own pubkey (caller supplies no message → not a signing oracle). Returned as a
 * `popSigner` callback for onboardDvtNode. NOTE: pending KMS `/pop` going live (CC-37 rework + A-board TA
 * reflash) — until then the kms-tee path surfaces this as an error rather than submitting.
 */
export function kmsPopSigner(cfg: PortalConfig, nodeIdOrPubkey: string): () => Promise<DvtPop> {
  return async () => {
    const res = await fetch(`${cfg.kmsUrl.replace(/\/$/, '')}/pop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ node_id: nodeIdOrPubkey }),
    });
    if (!res.ok) throw new Error(`KMS /pop failed: HTTP ${res.status} (is the KMS /pop endpoint live? — CC-37)`);
    const pop = (await res.json()) as DvtPop;
    if (!pop.publicKey || !pop.popPoint || !pop.popSig) throw new Error('KMS /pop returned an incomplete DvtPop');
    return pop;
  };
}

export interface OnboardArgs {
  cfg: PortalConfig;
  operator: Address;
  /** local-key path: the generated/entered BLS secret key. */
  blsSecretKey?: Hex;
  /** kms-tee path: node id/pubkey the KMS maps to its sealed TEE key. */
  kmsNodeRef?: string;
  dryRun: boolean;
}

/**
 * The single entrypoint the UI calls to stake + register — a thin wrapper over @aastar/sdk `onboardDvtNode`.
 * Operator self-funds (the connected wallet is the operator); "owner 代付" needs an owner key that a browser
 * must not hold, so it is a backend/advanced concern deliberately left out of this client-only portal.
 */
export async function onboard(args: OnboardArgs): Promise<OnboardDvtNodeResult> {
  const { cfg, operator, blsSecretKey, kmsNodeRef, dryRun } = args;
  // The SDK bundles its own viem type tree; the portal pins its own viem. The clients are runtime-compatible
  // but their bundled .d.ts shapes skew (e.g. getBlock's transactions union), so widen at this one seam.
  const publicClient = publicClientFor(cfg) as unknown as never;
  const operatorWallet = operatorWalletFor(cfg, operator) as unknown as never;
  const base = { publicClient, operatorWallet, dryRun };

  if (cfg.nodeKind === 'kms-tee') {
    if (!kmsNodeRef) throw new Error('kms-tee node requires a KMS node id / pubkey reference');
    return onboardDvtNode({ ...base, popSigner: kmsPopSigner(cfg, kmsNodeRef) });
  }
  if (!blsSecretKey) throw new Error('local node requires a BLS secret key');
  return onboardDvtNode({ ...base, blsSecretKey });
}

/** DVT service reads — config recipe + runtime identity. Best-effort; the flow works without them. */
export async function fetchRecipe(cfg: PortalConfig): Promise<unknown | null> {
  if (!cfg.dvtUrl) return null;
  try {
    const r = await fetch(`${cfg.dvtUrl.replace(/\/$/, '')}/recipe?network=${cfg.network}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function fetchIdentity(cfg: PortalConfig, nodeId: Hex): Promise<unknown | null> {
  if (!cfg.dvtUrl) return null;
  try {
    const r = await fetch(`${cfg.dvtUrl.replace(/\/$/, '')}/identity/${nodeId}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export type { OnboardDvtNodeResult, DvtPop, NodeKind };
