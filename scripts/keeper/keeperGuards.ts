import { isAddress } from 'viem';
import { KeeperStartupRefusal } from './keeperKey.js';

/**
 * Local checks keeper.ts makes on its own configuration and on what it hands to `cast`. Pure functions, no network:
 * every refusal here happens before the first request, and no refusal echoes the value it refused (a key pasted into
 * the wrong option must not reach a log or Telegram).
 */

export const KEEPER_NETWORKS = ['anvil', 'sepolia', 'op-sepolia', 'op-mainnet', 'mainnet'] as const;
export type KeeperNetwork = (typeof KEEPER_NETWORKS)[number];
/** Networks where a live run must name an absolute fee ceiling (--hard-max-fee-gwei). */
export const MAINNET_NETWORKS: readonly KeeperNetwork[] = ['op-mainnet', 'mainnet'];

export function parseNetwork(raw: string | undefined): KeeperNetwork {
    const v = raw ?? 'op-sepolia';
    if ((KEEPER_NETWORKS as readonly string[]).includes(v)) return v as KeeperNetwork;
    throw new KeeperStartupRefusal(`unknown --network value (expected one of ${KEEPER_NETWORKS.join(', ')}; the value is not shown)`);
}

/** A non-negative decimal integer option (or its env fallback), at least `min`. `source` names where it came from. */
export function parseIntOption(source: string, raw: string | undefined, fallback: bigint, min: bigint): bigint {
    if (raw === undefined || raw === '') return fallback;
    if (!/^\d{1,15}$/.test(raw)) throw new KeeperStartupRefusal(`${source} must be a whole number (the value is not shown)`);
    const v = BigInt(raw);
    if (v < min) throw new KeeperStartupRefusal(`${source} must be at least ${min}`);
    return v;
}

/** A positive gwei amount with at most 9 decimals, as wei. */
export function parseGweiOption(flag: string, raw: string | undefined): bigint | undefined {
    if (raw === undefined) return undefined;
    const m = /^(\d{1,9})(?:\.(\d{1,9}))?$/.exec(raw);
    if (!m) throw new KeeperStartupRefusal(`${flag} must be a positive gwei amount such as 0.5 (the value is not shown)`);
    const wei = BigInt(m[1]!) * 10n ** 9n + BigInt((m[2] ?? '').padEnd(9, '0'));
    if (wei === 0n) throw new KeeperStartupRefusal(`${flag} must be greater than 0`);
    return wei;
}

/** A 20-byte address option (or env value). Mixed case must be a valid checksum. */
export function parseAddressOption(source: string, raw: string | undefined): `0x${string}` | undefined {
    if (raw === undefined || raw === '') return undefined;
    if (!isAddress(raw, { strict: true })) throw new KeeperStartupRefusal(`${source} is not a valid address (the value is not shown)`);
    return raw as `0x${string}`;
}

/**
 * Two env files that would both be loaded and that set the same variable to different values. dotenv keeps the first
 * value it loads, so the other file is silently ignored for that variable. Returns the variable names only.
 */
export function envFileConflicts(files: ReadonlyArray<{ name: string; vars: Record<string, string> }>): string[] {
    const first = new Map<string, string>();
    const conflicts = new Set<string>();
    for (const f of files) {
        for (const [k, v] of Object.entries(f.vars)) {
            if (first.has(k) && first.get(k) !== v) conflicts.add(k);
            if (!first.has(k)) first.set(k, v);
        }
    }
    return [...conflicts].sort();
}

/** The environment `cast` runs with: only what it needs to find itself and the keystore, plus the RPC URL. */
const CAST_ENV_ALLOW = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'FOUNDRY_DIR'] as const;
export function castChildEnv(env: Record<string, string | undefined>, rpcUrl: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of CAST_ENV_ALLOW) {
        const v = env[k];
        if (v !== undefined) out[k] = v;
    }
    // Through the environment, not argv: an RPC URL often carries an API key, and argv is visible to every user.
    out.ETH_RPC_URL = rpcUrl;
    return out;
}

/**
 * `cast send` arguments. The RPC URL is not among them (see castChildEnv). `--chain` makes cast sign for the expected
 * chain id, so a transaction cannot be valid on another chain the RPC might serve.
 */
export function castSendArgs(p: {
    signerArgs: readonly string[]; chainId: number; passwordFilePath: string; target: `0x${string}`;
    gasPriceWei?: bigint; maxFeeWei?: bigint;
}): string[] {
    const args = ['send', '--async', '--timeout', '60', '--chain', String(p.chainId), ...p.signerArgs];
    // For an EIP-1559 transaction cast's --gas-price is the max fee per gas. The hard ceiling, when set, is that value.
    const price = p.maxFeeWei ?? p.gasPriceWei;
    if (price !== undefined && price > 0n) args.push('--gas-price', price.toString());
    args.push('--password-file', p.passwordFilePath, p.target, 'updatePrice()');
    return args;
}

/** An RPC URL reduced to scheme and host, for logs: path, query and credentials are dropped. */
export function redactRpcUrl(url: string): string {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname !== '/' || u.search ? '/…' : ''}`;
    } catch {
        return '(unparseable RPC URL, not shown)';
    }
}

/** Child output for a log or Telegram: any URL is reduced as above, and the text is cut to `max` characters. */
export function safeChildError(text: string, max = 300): string {
    const scrubbed = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (m) => redactRpcUrl(m));
    return scrubbed.length > max ? `${scrubbed.slice(0, max)}…` : scrubbed;
}

export function assertChainId(actual: number, expected: number, when: string): void {
    if (actual !== expected) {
        throw new KeeperStartupRefusal(`${when}: the RPC serves chain ${actual}, the configured network is chain ${expected}; nothing is signed`);
    }
}

/**
 * Whether to send now, by fee. `maxBaseFeeWei` (--max-base-fee-gwei) is a soft gate: it may be overridden in the last
 * 180 s before the cached price expires. `hardMaxFeeWei` (--hard-max-fee-gwei) always applies: a base fee above it
 * means a transaction capped at it could not be included, so nothing is sent.
 */
export function feeDecision(p: {
    baseFeeWei: bigint | undefined; maxBaseFeeWei: bigint | undefined; hardMaxFeeWei: bigint | undefined; nearExpiry: boolean;
}): 'send' | 'skip-soft' | 'skip-hard' {
    if (p.hardMaxFeeWei !== undefined && (p.baseFeeWei === undefined || p.baseFeeWei > p.hardMaxFeeWei)) return 'skip-hard';
    if (p.maxBaseFeeWei !== undefined && (p.baseFeeWei === undefined || p.baseFeeWei > p.maxBaseFeeWei) && !p.nearExpiry) return 'skip-soft';
    return 'send';
}

/** A mined receipt counts as an update only when it succeeded. */
export function receiptOutcome(receipt: { status?: string } | undefined): 'receipt' | 'reverted' {
    return receipt?.status === 'success' ? 'receipt' : 'reverted';
}
