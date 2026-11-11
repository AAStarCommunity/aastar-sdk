/**
 * Pure half of scripts/sp550-pin-fill.ts: parse the manifest's pins JSON, derive the SDK address-book
 * switch it implies, and render both as source edits. No I/O; the CLI runs the read-back gate on the
 * same pins and book BEFORE any of this is written, so nothing reaches the source without a PASS.
 */
import { getAddress, isAddress } from 'viem';
import type { Sp550CutoverPins } from '../packages/core/src/sp550Cutover.js';
import type { Sp550FreshDeployPins } from '../packages/core/src/sp550Deployments.js';

export type PinFillMode = 'upgrade' | 'fresh';

/** Every key a pins JSON may carry; anything else is refused rather than silently dropped. */
const UPGRADE_KEYS = [
    'tag', 'spVersion', 'superPaymaster', 'spImpl', 'spImplCodehash', 'spAdminExtension', 'superPaymasterLens', 'lensVersion',
    'xPNTsFactoryV2', 'xPNTsTokenV2Impl', 'xPNTsTokenV2Ext', 'aoaProtocolRegistry', 'globalTierSource', 'aPNTsCapped',
    'registryImpl', 'disclosureRegistry', 'addresses', 'readbackBlock', 'codehashes',
] as const;
const FRESH_KEYS = [...UPGRADE_KEYS, 'absent'] as const;

/** The manifest's pins JSON -> pins, the way check-sp550-cutover.ts --pins reads it, but strict about keys. */
export function parseManifestPins(json: unknown, mode: PinFillMode): Sp550FreshDeployPins {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('manifest pins: not a JSON object');
    const allowed: readonly string[] = mode === 'fresh' ? FRESH_KEYS : UPGRADE_KEYS;
    const unknown = Object.keys(json).filter((k) => !allowed.includes(k));
    if (unknown.length) throw new Error(`manifest pins: unknown key(s) for a ${mode} deploy: ${unknown.join(', ')} (refusing rather than dropping them)`);
    const j = json as Record<string, any>;
    const rb = j.readbackBlock;
    if (rb !== undefined && !(typeof rb === 'number' && Number.isSafeInteger(rb) && rb >= 0) && !(typeof rb === 'string' && /^\d+$/.test(rb))) {
        throw new Error(`manifest pins: readbackBlock ${JSON.stringify(rb)} is not a block number`);
    }
    return { ...j, readbackBlock: rb === undefined ? undefined : BigInt(rb) } as Sp550FreshDeployPins;
}

/**
 * The SDK book entries the cutover certifies. An upgrade points the book at the capped aPNTs and the
 * v2 factory (the gate checks both against SP.APNTS_TOKEN() and SP.xpntsFactory()) plus every
 * certified `addresses` entry; a fresh deploy takes every SP-owned entry from the manifest. Entries
 * whose address does not change are dropped by `changedEntries` before anything is written.
 */
export function bookSwitch(mode: PinFillMode, pins: Sp550FreshDeployPins): Record<string, string> {
    const out: Record<string, string> = mode === 'upgrade'
        ? { ...(pins.addresses ?? {}), aPNTs: pins.aPNTsCapped as string, xPNTsFactory: pins.xPNTsFactoryV2 as string }
        : { ...(pins.addresses ?? {}) } as Record<string, string>;
    for (const [k, a] of Object.entries(out)) {
        if (typeof a !== 'string' || !isAddress(a)) throw new Error(`book switch ${k}: ${JSON.stringify(a)} is not an address`);
    }
    return out;
}

/** The switch entries whose address differs from the shipped book (case-insensitive); only these are rewritten. */
export function changedEntries(entries: Record<string, string>, book: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(entries).filter(([k, a]) => typeof book[k] !== 'string' || (book[k] as string).toLowerCase() !== a.toLowerCase()));
}

const q = (s: string) => JSON.stringify(s);
const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k));

/** The pins as a TS object literal at `indent`, fields in the interface's order. */
export function renderPinsLiteral(pins: Sp550FreshDeployPins, indent = '    '): string {
    const inner = indent + '    ';
    const lines: string[] = [];
    const keys = [...FRESH_KEYS].filter((k) => (pins as Record<string, unknown>)[k] !== undefined);
    for (const k of keys) {
        const v = (pins as Record<string, any>)[k];
        if (k === 'readbackBlock') lines.push(`${inner}readbackBlock: ${(v as bigint).toString()}n,`);
        else if (k === 'codehashes' || k === 'addresses') {
            const entries = Object.entries(v as Record<string, string>).filter(([, x]) => x !== undefined);
            lines.push(`${inner}${k}: {`);
            for (const [n, x] of entries) lines.push(`${inner}    ${key(n)}: ${q(k === 'addresses' ? getAddress(x) : x)},`);
            lines.push(`${inner}},`);
        } else if (k === 'absent') lines.push(`${inner}absent: [${(v as string[]).map(q).join(', ')}],`);
        else lines.push(`${inner}${k}: ${q(isAddress(v) ? getAddress(v) : v)},`);
    }
    return `{\n${lines.join('\n')}\n${indent}}`;
}

/** The source spelling of a chain's key in a pins table (`11155111` or `[optimism.id]`). */
const TABLE_KEY: Record<number, string[]> = { 10: ['10', '[optimism.id]'], 11155420: ['11155420', '[optimismSepolia.id]'], 11155111: ['11155111', '[sepolia.id]'] };

/**
 * Fill `<table>[chainId]` in `source`. Only an EMPTY entry (`<key>: {},`) is filled: a filled entry
 * is never overwritten by this tool (a re-pin is a reviewed edit, not a regeneration).
 */
export function fillPinsTable(source: string, table: string, chainId: number, pins: Sp550CutoverPins | Sp550FreshDeployPins): string {
    const start = source.indexOf(`export const ${table}`);
    if (start < 0) throw new Error(`${table}: not found in source`);
    const end = source.indexOf('\n};', start);
    if (end < 0) throw new Error(`${table}: table end not found`);
    const block = source.slice(start, end);
    for (const k of TABLE_KEY[chainId] ?? [String(chainId)]) {
        const empty = `\n    ${k}: {},`;
        const i = block.indexOf(empty);
        if (i >= 0) return source.slice(0, start) + block.slice(0, i) + `\n    ${k}: ${renderPinsLiteral(pins as Sp550FreshDeployPins)},` + block.slice(i + empty.length) + source.slice(end);
        if (block.includes(`\n    ${k}: {`)) throw new Error(`${table}[${chainId}] is already filled; this tool only fills an empty entry`);
    }
    throw new Error(`${table}[${chainId}]: no entry for this chain`);
}

/**
 * Point `CANONICAL_ADDRESSES[chainId].<key>` at each switched address. An existing line is replaced
 * whole (its old comment described the old contract); a key the book lacks is appended to the block.
 */
export function switchBook(source: string, chainId: number, entries: Record<string, string>, note: string): string {
    const start = source.indexOf('export const CANONICAL_ADDRESSES');
    if (start < 0) throw new Error('CANONICAL_ADDRESSES: not found in source');
    const end = source.indexOf('\n} as const;', start);
    const open = source.indexOf(`\n  ${chainId}: {\n`, start);
    if (open < 0 || open > end) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: no block for this chain`);
    // The chain's block ends at the first two-space `}` after it (`},` mid-table, `}` for the last one).
    const m = /\n  \}(,|\n)/.exec(source.slice(open));
    const close = m ? open + m.index : -1;
    if (close < 0 || close > end) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: block end not found`);
    let block = source.slice(open, close);
    for (const [k, a] of Object.entries(entries)) {
        const line = `\n    ${k}: ${q(getAddress(a))},  // ${note}`;
        const re = new RegExp(`\\n    ${k}: "0x[0-9a-fA-F]{40}",[^\\n]*`);
        const hits = block.match(new RegExp(re.source, 'g'))?.length ?? 0;
        if (hits > 1) throw new Error(`CANONICAL_ADDRESSES[${chainId}].${k}: ${hits} lines, refusing to guess which`);
        if (!hits && block.includes(`\n    ${k}:`)) throw new Error(`CANONICAL_ADDRESSES[${chainId}].${k}: not a plain address literal, refusing to rewrite it`);
        block = hits ? block.replace(re, () => line) : block + line;
    }
    return source.slice(0, open) + block + source.slice(close);
}
