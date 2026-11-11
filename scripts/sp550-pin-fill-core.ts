/**
 * Pure half of scripts/sp550-pin-fill.ts: parse the manifest's pins JSON, derive the SDK address-book
 * switch it implies, and render both as source edits. No I/O; the CLI runs the read-back gate on the
 * same pins and book BEFORE any of this is written, so nothing reaches the source without a PASS.
 */
import * as fs from 'fs';
import * as path from 'path';
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
/** Book key -> read-back contract key, as SP's pins files declare it in `_aliases` (mirrors the comparator's table). */
export const PINS_FILE_ALIASES: Readonly<Record<string, string>> = { staking: 'contracts.gTokenStaking' };

/** The manifest's pins JSON -> pins, the way check-sp550-cutover.ts --pins reads it, but strict about keys. */
export function parseManifestPins(json: unknown, mode: PinFillMode): Sp550FreshDeployPins {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('manifest pins: not a JSON object');
    const allowed: readonly string[] = mode === 'fresh' ? FRESH_KEYS : UPGRADE_KEYS;
    // `_aliases` is metadata, not a pin: it must be exactly the alias map the SDK reads with, then it is dropped.
    let obj = json as Record<string, unknown>;
    if ('_aliases' in obj) {
        const a = obj._aliases;
        if (JSON.stringify(a) !== JSON.stringify(PINS_FILE_ALIASES)) throw new Error(`manifest pins: _aliases ${JSON.stringify(a)} != the SDK's ${JSON.stringify(PINS_FILE_ALIASES)} (a renamed key would be compared under the wrong name)`);
        const { _aliases: _drop, ...rest } = obj;
        obj = rest;
    }
    const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
    if (unknown.length) throw new Error(`manifest pins: unknown key(s) for a ${mode} deploy: ${unknown.join(', ')} (refusing rather than dropping them)`);
    const j = obj as Record<string, any>;
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
export function bookSwitch(mode: PinFillMode, pins: Sp550FreshDeployPins): Record<string, string | null> {
    const out: Record<string, string> = mode === 'upgrade'
        ? { ...(pins.addresses ?? {}), aPNTs: pins.aPNTsCapped as string, xPNTsFactory: pins.xPNTsFactoryV2 as string }
        : { ...(pins.addresses ?? {}) } as Record<string, string>;
    for (const [k, a] of Object.entries(out)) {
        if (typeof a !== 'string' || !isAddress(a)) throw new Error(`book switch ${k}: ${JSON.stringify(a)} is not an address`);
    }
    // A fresh deploy's `absent` keys leave the book (null = remove the entry).
    const removed: Record<string, null> = mode === 'fresh' ? Object.fromEntries((pins.absent ?? []).map((k) => [k, null])) : {};
    for (const k of Object.keys(removed)) if (k in out) throw new Error(`book switch ${k}: both pinned and declared absent`);
    return { ...out, ...removed };
}

/** The book after the switch: entries set, `null` entries removed. */
export function applyBookSwitch(book: Record<string, unknown>, entries: Record<string, string | null>): Record<string, unknown> {
    const out = { ...book };
    for (const [k, a] of Object.entries(entries)) { if (a === null) delete out[k]; else out[k] = a; }
    return out;
}

/** The switch entries whose address differs from the shipped book (case-insensitive); only these are rewritten. */
export function changedEntries(entries: Record<string, string | null>, book: Record<string, unknown>): Record<string, string | null> {
    return Object.fromEntries(Object.entries(entries).filter(([k, a]) => a === null
        ? k in book
        : typeof book[k] !== 'string' || (book[k] as string).toLowerCase() !== a.toLowerCase()));
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
    // The declaration at the start of a line: a commented-out copy (`// export const …`) is not it.
    const decl = `\nexport const ${table}`;
    const count = source.split(decl).length - 1;
    if (count !== 1) throw new Error(`${table}: ${count} declarations at line start, refusing to guess which one ships`);
    const start = source.indexOf(decl) + 1;
    const end = source.indexOf('\n};', start);
    if (end < 0) throw new Error(`${table}: table end not found`);
    const block = source.slice(start, end);
    const spellings = TABLE_KEY[chainId] ?? [String(chainId)];
    const decls = spellings.reduce((n, k) => n + (block.split(`\n    ${k}: {`).length - 1), 0);
    if (decls > 1) throw new Error(`${table}[${chainId}]: ${decls} entries for this chain, refusing to guess which one ships`);
    for (const k of spellings) {
        const empty = `\n    ${k}: {},`;
        const i = block.indexOf(empty);
        if (i >= 0) return source.slice(0, start) + block.slice(0, i) + `\n    ${k}: ${renderPinsLiteral(pins as Sp550FreshDeployPins)},` + block.slice(i + empty.length) + source.slice(end);
        if (block.includes(`\n    ${k}: {`)) throw new Error(`${table}[${chainId}] is already filled; this tool only fills an empty entry`);
    }
    throw new Error(`${table}[${chainId}]: no entry for this chain`);
}

/**
 * Point `CANONICAL_ADDRESSES[chainId].<key>` at each switched address. An existing line is replaced
 * whole (its old comment described the old contract); a key the book lacks is appended to the block;
 * a `null` entry removes the key's line. A declaration is a line starting `    <key>:` (comment lines
 * start `    //`); a block with a `/*` comment is refused rather than parsed around.
 */
export function switchBook(source: string, chainId: number, entries: Record<string, string | null>, note: string): string {
    const decl = '\nexport const CANONICAL_ADDRESSES';
    const declCount = source.split(decl).length - 1;
    if (declCount !== 1) throw new Error(`CANONICAL_ADDRESSES: ${declCount} declarations at line start, refusing to guess which one ships`);
    const start = source.indexOf(decl) + 1;
    const end = source.indexOf('\n} as const;', start);
    const chainBlocks = source.slice(start, end).split(`\n  ${chainId}: {\n`).length - 1;
    if (chainBlocks > 1) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: ${chainBlocks} blocks for this chain (the last would win), refusing to guess`);
    const open = source.indexOf(`\n  ${chainId}: {\n`, start);
    if (open < 0 || open > end) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: no block for this chain`);
    // The chain's block ends at the first two-space `}` after it (`},` mid-table, `}` for the last one).
    const m = /\n  \}(,|\n)/.exec(source.slice(open));
    const close = m ? open + m.index : -1;
    if (close < 0 || close > end) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: block end not found`);
    let block = source.slice(open, close);
    if (block.includes('/*')) throw new Error(`CANONICAL_ADDRESSES[${chainId}]: block comment inside the chain's block, refusing to rewrite around it`);
    for (const [k, a] of Object.entries(entries)) {
        const decls = block.split(`\n    ${k}:`).length - 1;
        if (decls > 1) throw new Error(`CANONICAL_ADDRESSES[${chainId}].${k}: ${decls} declarations, refusing to guess which`);
        // Exactly an address literal, then at most a `//` comment: anything else on the line (another
        // property, code) would be destroyed by a whole-line rewrite.
        const re = new RegExp(`\\n    ${k}: "0x[0-9a-fA-F]{40}",(?:[ \\t]*//[^\\n]*)?(?=\\n|$)`);
        if (decls === 1 && !re.test(block)) throw new Error(`CANONICAL_ADDRESSES[${chainId}].${k}: not a plain address literal on its own line, refusing to rewrite it`);
        if (a === null) { if (decls) block = block.replace(re, () => ''); continue; }
        const line = `\n    ${k}: ${q(getAddress(a))},  // ${note}`;
        block = decls ? block.replace(re, () => line) : block + line;
    }
    return source.slice(0, open) + block + source.slice(close);
}

/** Loopback by the PARSED host (WHATWG URL normalises 127.1, userinfo, case); an unparsable URL counts as loopback. */
export function isLoopbackUrl(url: string): boolean {
    let host: string;
    try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return true; }
    return isLoopbackHost(host);
}

/** A loopback / unspecified host: localhost names, 127/8, 0.0.0.0, ::1, ::, and IPv4-mapped forms of those. */
export function isLoopbackHost(host: string): boolean {
    const h = host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost')) return true;
    if (/^127\.\d+\.\d+\.\d+$/.test(h) || h === '0.0.0.0') return true;
    if (h === '::1' || h === '::') return true;
    // IPv4-mapped IPv6 (WHATWG writes ::ffff:127.0.0.1 as ::ffff:7f00:1): 127/8 is 7f00:0000/8, 0.0.0.0 is 0:0.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (mapped) { const hi = parseInt(mapped[1], 16); return hi >> 8 === 0x7f || (hi === 0 && parseInt(mapped[2], 16) === 0); }
    return /^::ffff:(127\.\d+\.\d+\.\d+|0\.0\.0\.0)$/.test(h);
}

/** The file operations writeAll needs (tests inject failures). */
export interface WriteIo { read(p: string): string; write(p: string, s: string): void; rename(a: string, b: string): void; remove(p: string): void }
const nodeIo: WriteIo = {
    read: (p) => fs.readFileSync(p, 'utf8'), write: (p, s) => fs.writeFileSync(p, s),
    rename: (a, b) => fs.renameSync(a, b), remove: (p) => fs.rmSync(p, { force: true }),
};

/**
 * Write every file or none: each goes to a temp file first, then all are renamed into place. A
 * restore (after a failed rename, or the returned restore()) puts a file back only while it still
 * holds what this run wrote — another writer's edit is never clobbered — and attempts EVERY file,
 * reporting each one it could not restore instead of stopping at the first.
 */
export function writeAll(files: { path: string; before: string; after: string }[], root: string, io: WriteIo = nodeIo): () => string[] {
    const restoreEach = (done: typeof files) => done.flatMap((f) => {
        try {
            if (io.read(f.path) !== f.after) return [`${path.relative(root, f.path)} changed since this run wrote it; left as is, restore it by hand`];
            io.write(f.path, f.before);
            return [];
        } catch (e) { return [`${path.relative(root, f.path)} could not be restored (${(e as Error).message}); restore it by hand`]; }
    });
    for (const f of files) io.write(`${f.path}.pin-fill.tmp`, f.after);
    const done: typeof files = [];
    try { for (const f of files) { io.rename(`${f.path}.pin-fill.tmp`, f.path); done.push(f); } }
    catch (e) {
        const left = restoreEach(done);
        for (const f of files) io.remove(`${f.path}.pin-fill.tmp`);
        // `unrestored` tells the caller to KEEP its recovery data (journal + before-images).
        throw Object.assign(new Error(`write failed (${(e as Error).message})${left.length ? `; ${left.join('; ')}` : '; nothing left changed'}`), { unrestored: left });
    }
    return () => restoreEach(files);
}

/**
 * --write's independent cross-check (DSR, H3): SP's own LIVE read-back (schema aoa-a7-readback/1,
 * source "live", gathered by SP on its own two providers and committed in the step-13 manifest PR)
 * must name every pinned address and codehash the manifest pins name. Pure: the caller validated
 * the file against the schema. One bad pair of endpoints on the SDK side cannot satisfy this.
 */
export function spLiveReadbackProblems(rb: any, pins: Sp550FreshDeployPins, chainId: number, pinnedEntries: [string, unknown][]): string[] {
    const p: string[] = [];
    const eqi = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
    if (rb?.header?.source !== 'live') p.push(`SP read-back: header.source ${JSON.stringify(rb?.header?.source)} is not "live"`);
    if (rb?.header?.chainId !== chainId) p.push(`SP read-back: header.chainId ${rb?.header?.chainId} != ${chainId}`);
    if (rb?.header?.tag !== pins.tag) p.push(`SP read-back: header.tag ${JSON.stringify(rb?.header?.tag)} != pins.tag ${JSON.stringify(pins.tag)}`);
    const c = rb?.contracts ?? {};
    const h = pins.codehashes ?? {};
    // spImpl / registryImpl are the proxies' erc1967Impl fields in the read-back.
    const viaProxy: Record<string, [string, string, string]> = { spImpl: ['superPaymaster', 'erc1967Impl', 'implCodehash'], registryImpl: ['registry', 'erc1967Impl', 'implCodehash'] };
    for (const [name, addr] of pinnedEntries) {
        if (typeof addr !== 'string') continue;
        const proxy = viaProxy[name];
        if (proxy) {
            const e = c[proxy[0]];
            if (!eqi(e?.[proxy[1]], addr)) p.push(`SP read-back: contracts.${proxy[0]}.${proxy[1]} ${JSON.stringify(e?.[proxy[1]])} != pins.${name} ${addr}`);
            if (!eqi(e?.[proxy[2]], h[name])) p.push(`SP read-back: contracts.${proxy[0]}.${proxy[2]} ${JSON.stringify(e?.[proxy[2]])} != pins.codehashes.${name} ${h[name]}`);
            continue;
        }
        const key = name.startsWith('addresses.') ? (PINS_FILE_ALIASES[name.slice('addresses.'.length)]?.replace(/^contracts\./, '') ?? name.slice('addresses.'.length)) : name;
        const e = c[key];
        if (!e) { p.push(`SP read-back: contracts.${key} missing (pins.${name})`); continue; }
        if (!eqi(e.address, addr)) p.push(`SP read-back: contracts.${key}.address ${JSON.stringify(e.address)} != pins.${name} ${addr}`);
        if (!eqi(e.codehash, h[name])) p.push(`SP read-back: contracts.${key}.codehash ${JSON.stringify(e.codehash)} != pins.codehashes.${name} ${h[name]}`);
    }
    if (!eqi(c.superPaymaster?.extension, pins.spAdminExtension)) p.push(`SP read-back: contracts.superPaymaster.extension ${JSON.stringify(c.superPaymaster?.extension)} != pins.spAdminExtension ${pins.spAdminExtension}`);
    return p;
}
