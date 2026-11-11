/**
 * Field-by-field comparison of SP's read-back file (schema "aoa-a7-readback/1": the A7 fork export,
 * and the live read-back after SEND) against the SDK pins AND what the SDK itself reads on chain at
 * pins.readbackBlock: every field compared here is also read by the SDK, so a file and a pin set
 * that agree with each other but not with the chain fail.
 *
 * Value conventions (DSR, binding on SP's generator): a field is never omitted; `null` = the function
 * does not exist by design; "unreadable:<reason>" = the call failed; "n/a:<reason>" = not applicable.
 * Addresses compare case-insensitively; hashes are 0x + 64 hex.
 *
 * Scope (DSR-accepted): header; per contract address / codehash / version / ERC-1967 impl /
 * extension; owner and pendingOwner for SuperPaymaster and the Registry. guardian, roles and
 * checks{} are only required to be present (DVT and DSR compare them).
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
    BaseError, ContractFunctionRevertedError, ContractFunctionZeroDataError,
} from 'viem';
import { sp550PinnedAddressEntries, type Sp550CutoverPins } from '../packages/core/src/sp550Cutover.js';
import { sp550FreshPinProblems, sp550UpgradePinProblems, type Sp550FreshDeployPins } from '../packages/core/src/sp550Deployments.js';

export const READBACK_SCHEMA = 'aoa-a7-readback/1';
/**
 * The binding JSON Schema (Draft 2020-12), vendored byte-for-byte from SuperPaymaster
 * 685ff69dde6e5d2434a74c55f48a72f5a8b66115 docs/release/a7/ (docs/sp550-cutover/a7/README.md).
 * The file is refused unless it hashes to READBACK_SCHEMA_SHA256.
 */
export const READBACK_SCHEMA_FILE = path.resolve(import.meta.dirname, '../docs/sp550-cutover/a7/aoa-a7-readback-1.schema.json');
export const READBACK_SCHEMA_SHA256 = 'd893b790e6f4ba217c7d07966d2bbba30624410adcf19fe74f7c62ab3fdc8e32';
export const READBACK_HEADER_FIELDS = [
    'source', 'spCommit', 'tag', 'chainId', 'hardfork', 'forkBlock', 'readbackBlock', 'readbackBlockHash',
    'anvilVersion', 'anvilCommit', 'dumpSha256', 'providers', 'ethConfig',
] as const;

/** Compile the schema after checking its hash; returns a validator that lists every violation. */
export function loadReadbackValidator(file = READBACK_SCHEMA_FILE, sha256 = READBACK_SCHEMA_SHA256): (x: unknown) => string[] {
    const raw = fs.readFileSync(file);
    const got = createHash('sha256').update(new Uint8Array(raw)).digest('hex');
    if (got !== sha256) throw new Error(`read-back schema ${file}: sha256 ${got} != pinned ${sha256}; refusing to validate against it`);
    const ajv = new (Ajv2020 as any)({ strict: true, allErrors: true });
    const validate = ajv.compile(JSON.parse(raw.toString('utf8')));
    return (x) => (validate(x) ? [] : ((validate.errors ?? []) as any[]).map((e) => `schema: ${e.instancePath || '(root)'} ${e.message}${e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : ''}`));
}

/**
 * Sepolia's Amsterdam fork as the UPSTREAM eth_config reports it (DSR / SP, 2026-11-11: active since
 * 2026-10-06). header.ethConfig must carry exactly these; a chain without an entry cannot pass.
 */
export const AMSTERDAM_ETH_CONFIG: Record<number, { activationTime: number; forkId: string }> = {
    11155111: { activationTime: 1791294816, forkId: '0x6c1d9423' },
};

/** The read-back's contract key for a pin name: book entries drop their `addresses.` prefix. */
export const contractKeyOf = (pinName: string) => (pinName.startsWith('addresses.') ? pinName.slice('addresses.'.length) : pinName);
/** Pinned names the read-back may cover through a proxy's fields instead of an entry of their own. */
const COVERED_BY_PROXY = new Set(['spImpl', 'registryImpl']);
export const READBACK_CONTRACT_FIELDS = [
    'address', 'version', 'codehash', 'erc1967Impl', 'implCodehash', 'extension', 'extensionCodehash', 'owner', 'pendingOwner', 'guardian', 'roles',
] as const;

/** What the SDK read: a value, a revert (the function is absent, or reverted), or a failed call. */
export type Observed = { kind: 'value'; value: string } | { kind: 'reverted' } | { kind: 'error'; detail: string };
/**
 * The SDK's reads at the read-back block. `codehash` = keccak256 of the runtime code ('0x' code is a
 * value of "none"); `erc1967Impl` = the ERC-1967 implementation slot as an address; the rest are calls.
 */
export type ReadKind = 'version' | 'owner' | 'pendingOwner' | 'EXTENSION' | 'codehash' | 'erc1967Impl' | 'blockHash';
export type ChainReader = (address: string, what: ReadKind) => Promise<Observed>;

/** Classify a thrown contract-call error: a revert / empty return is 'reverted', anything else an error. */
export function classifyCallError(e: unknown): Observed {
    const reverted = e instanceof BaseError && !!e.walk((x) => x instanceof ContractFunctionRevertedError || x instanceof ContractFunctionZeroDataError);
    return reverted ? { kind: 'reverted' } : { kind: 'error', detail: e instanceof BaseError ? e.shortMessage : String(e) };
}

/** Facts about this run the header must match; undefined = compare presence only (e.g. no dump on a live read-back). */
export interface ReadbackContext {
    chainId: number;
    mode: 'upgrade' | 'fresh';
    /** fork = the A7 dump this run loaded (forkBlock, dumpSha256, anvilCommit required); live = after SEND. */
    source: 'fork' | 'live';
    allowRc?: boolean;
    forkBlock?: bigint;
    dumpSha256?: string;
    hardfork?: string;
    anvilCommit?: string;
    spCommit?: string;
}

const eq = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const show = (v: unknown) => (v === undefined ? '(omitted)' : typeof v === 'bigint' ? v.toString() : JSON.stringify(v));
const notApplicable = (v: unknown) => v === null || (typeof v === 'string' && v.startsWith('n/a:'));
const asBig = (v: unknown): bigint | undefined => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
    if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
    return undefined;
};

/** Proxies: what their ERC-1967 slot / extension must name, from the pins. */
function proxyPins(pins: Sp550CutoverPins): Record<string, { impl?: [unknown, unknown]; ext?: [unknown, unknown] }> {
    const h = pins.codehashes ?? {};
    return {
        superPaymaster: { impl: [pins.spImpl, pins.spImplCodehash], ext: [pins.spAdminExtension, h.spAdminExtension] },
        registry: { impl: [pins.registryImpl, h.registryImpl] },
    };
}
/** Contracts whose version() is itself a pin, or must exist; a revert there is a failure, never `null`. */
const versionPin = (pins: Sp550CutoverPins): Record<string, unknown> => ({ superPaymaster: pins.spVersion, superPaymasterLens: pins.lensVersion });
const VERSION_REQUIRED = new Set(['superPaymaster', 'superPaymasterLens', 'aPNTsCapped']);
/** owner()/pendingOwner() read back for these; `true` = the function must exist (Ownable2Step SP). */
const OWNED: Record<string, { owner: boolean; pendingOwner: boolean }> = {
    superPaymaster: { owner: true, pendingOwner: true },
    registry: { owner: true, pendingOwner: false },
};

export async function readbackProblems(rb: unknown, pins: Sp550FreshDeployPins, ctx: ReadbackContext, read: ChainReader,
    validate: (x: unknown) => string[] = loadReadbackValidator()): Promise<string[]> {
    // The pins must be complete first: the comparison set is derived from them.
    const pinIssues = ctx.mode === 'fresh' ? sp550FreshPinProblems(pins, { allowRc: ctx.allowRc }) : sp550UpgradePinProblems(pins, { allowRc: ctx.allowRc });
    if (pinIssues.length) return pinIssues.map((x) => `pins: ${x}`);
    if (ctx.source === 'fork' && (ctx.forkBlock === undefined || ctx.dumpSha256 === undefined || ctx.anvilCommit === undefined)) {
        return ['context: a fork read-back is compared against the loaded dump: forkBlock, dumpSha256 and anvilCommit are required'];
    }
    // Then the binding schema: nothing is compared in a file that is not a valid aoa-a7-readback/1.
    const invalid = validate(rb);
    if (invalid.length) return invalid;
    const p: string[] = [];
    const f = rb as Record<string, any>;
    const hd = f.header as Record<string, any>;

    // Header.
    const isNa = (v: unknown) => typeof v === 'string' && v.startsWith('n/a:');
    if (hd.source !== ctx.source) p.push(`header.source ${show(hd.source)} != ${ctx.source}`);
    if (hd.chainId !== ctx.chainId) p.push(`header.chainId ${show(hd.chainId)} != ${ctx.chainId}`);
    if (hd.tag !== pins.tag) p.push(`header.tag ${show(hd.tag)} != pins.tag ${show(pins.tag)}`);
    if (asBig(hd.readbackBlock) !== pins.readbackBlock) p.push(`header.readbackBlock ${show(hd.readbackBlock)} != pins.readbackBlock ${show(pins.readbackBlock)}`);
    const bh = await read('', 'blockHash');
    if (bh.kind !== 'value') p.push(`header.readbackBlockHash: the SDK could not read block ${pins.readbackBlock} (${bh.kind === 'error' ? bh.detail : 'reverted'})`);
    else if (!eq(hd.readbackBlockHash, bh.value)) p.push(`header.readbackBlockHash ${show(hd.readbackBlockHash)} != block ${pins.readbackBlock} on chain ${bh.value}`);
    if (ctx.hardfork !== undefined && hd.hardfork !== ctx.hardfork) p.push(`header.hardfork ${show(hd.hardfork)} != ${ctx.hardfork}`);
    if (ctx.spCommit !== undefined && !eq(hd.spCommit, ctx.spCommit)) p.push(`header.spCommit ${show(hd.spCommit)} != the SP checkout ${ctx.spCommit}`);
    if (ctx.source === 'fork') {
        if (asBig(hd.forkBlock) !== ctx.forkBlock) p.push(`header.forkBlock ${show(hd.forkBlock)} != ${ctx.forkBlock}`);
        if (!eq(hd.dumpSha256, ctx.dumpSha256!.replace(/^0x/, ''))) p.push(`header.dumpSha256 ${show(hd.dumpSha256)} != the loaded dump ${ctx.dumpSha256}`);
        if (!eq(hd.anvilCommit, ctx.anvilCommit)) p.push(`header.anvilCommit ${show(hd.anvilCommit)} != the anvil this run used ${ctx.anvilCommit}`);
    } else {
        for (const k of ['anvilVersion', 'anvilCommit', 'dumpSha256']) if (!isNa(hd[k])) p.push(`header.${k} ${show(hd[k])}: a live read-back has no anvil or dump (expected "n/a:…")`);
    }
    const providers: unknown[] = hd.providers;
    if (!providers.length) p.push('header.providers: empty');
    for (const x of providers) if (typeof x !== 'string' || !/^[A-Za-z0-9_-]+$/.test(x)) p.push(`header.providers: ${show(x)} is not a provider NAME (never a URL)`);
    const ref = AMSTERDAM_ETH_CONFIG[ctx.chainId];
    const ec = hd.ethConfig as Record<string, any>;
    if (!ref) p.push(`header.ethConfig: no Amsterdam reference for chain ${ctx.chainId}`);
    else {
        if (ec.activationTime !== ref.activationTime) p.push(`header.ethConfig.activationTime ${show(ec.activationTime)} != Amsterdam ${ref.activationTime}`);
        if (!eq(ec.forkId, ref.forkId)) p.push(`header.ethConfig.forkId ${show(ec.forkId)} != Amsterdam ${ref.forkId}`);
    }
    const co = ec.corroboration as Record<string, any>;
    if (co.blockAccessListHash !== true || co.slotNumber !== true) p.push(`header.ethConfig.corroboration: Amsterdam-only header fields not both present (blockAccessListHash ${show(co.blockAccessListHash)}, slotNumber ${show(co.slotNumber)})`);
    if (ec.provider !== undefined && co.provider === ec.provider) p.push(`header.ethConfig.corroboration.provider ${show(co.provider)} is the eth_config provider; it must be a second one`);
    if (co.blockNumber !== hd.forkBlock) p.push(`header.ethConfig.corroboration.blockNumber ${show(co.blockNumber)} != header.forkBlock ${show(hd.forkBlock)}`);

    // Contracts: every pinned name (book entries without their prefix), every compared field also read by the SDK.
    const contracts = f.contracts as Record<string, any>;
    const pinned = (sp550PinnedAddressEntries(pins).filter(([, a]) => typeof a === 'string') as [string, string][])
        .map(([k, a]) => [contractKeyOf(k), a, k] as const);
    const proxies = proxyPins(pins);
    const versions = versionPin(pins);
    const value = (o: Observed, what: string, k: string): string | undefined => {
        if (o.kind === 'value') return o.value;
        p.push(`contracts.${k}: the SDK could not read ${what} (${o.kind === 'error' ? o.detail : 'reverted'})`);
        return undefined;
    };
    for (const [k, address, pinName] of pinned) {
        const c = contracts[k];
        if (!c) { if (!COVERED_BY_PROXY.has(pinName)) p.push(`contracts.${k}: omitted`); continue; }
        if (!eq(c.address, address)) p.push(`contracts.${k}.address ${show(c.address)} != pinned ${address}`);

        // codehash: file == pin == the SDK's read.
        const hash = pins.codehashes?.[pinName];
        const seen = value(await read(address, 'codehash'), 'the code hash', k);
        if (!eq(c.codehash, hash)) p.push(`contracts.${k}.codehash ${show(c.codehash)} != pins.codehashes.${pinName} ${show(hash)}`);
        if (seen !== undefined && !eq(seen, hash)) p.push(`contracts.${k}: code on chain ${seen} != pins.codehashes.${pinName} ${show(hash)}`);

        // version: the SDK's read decides; contracts that must have one fail on a revert.
        const v = await read(address, 'version');
        if (v.kind === 'error') p.push(`contracts.${k}.version: the SDK could not read version() (${v.detail})`);
        else if (v.kind === 'reverted') {
            if (VERSION_REQUIRED.has(k)) p.push(`contracts.${k}: version() reverts on chain, but ${k} must have one`);
            else if (c.version !== null && c.version !== undefined) p.push(`contracts.${k}.version ${show(c.version)}, but version() reverts on chain (expected null)`);
        } else {
            if (c.version !== v.value) p.push(`contracts.${k}.version ${show(c.version)} != version() on chain ${show(v.value)}`);
            if (k in versions && v.value !== versions[k]) p.push(`contracts.${k}: version() ${show(v.value)} != its pin ${show(versions[k])}`);
        }

        // ERC-1967 implementation and extension: pinned and read for the proxies, not applicable elsewhere.
        const px = proxies[k];
        if (px?.impl) {
            const impl = value(await read(address, 'erc1967Impl'), 'the ERC-1967 slot', k);
            if (!eq(c.erc1967Impl, px.impl[0])) p.push(`contracts.${k}.erc1967Impl ${show(c.erc1967Impl)} != pinned ${show(px.impl[0])}`);
            if (impl !== undefined && !eq(impl, px.impl[0])) p.push(`contracts.${k}: ERC-1967 slot on chain ${impl} != pinned ${show(px.impl[0])}`);
            if (!eq(c.implCodehash, px.impl[1])) p.push(`contracts.${k}.implCodehash ${show(c.implCodehash)} != pinned ${show(px.impl[1])}`);
            if (impl !== undefined) {
                const ih = value(await read(impl, 'codehash'), 'the implementation code hash', k);
                if (ih !== undefined && !eq(ih, px.impl[1])) p.push(`contracts.${k}: implementation code on chain ${ih} != pinned ${show(px.impl[1])}`);
            }
        }
        if (px?.ext) {
            const ext = value(await read(address, 'EXTENSION'), 'EXTENSION()', k);
            if (!eq(c.extension, px.ext[0])) p.push(`contracts.${k}.extension ${show(c.extension)} != pinned ${show(px.ext[0])}`);
            if (ext !== undefined && !eq(ext, px.ext[0])) p.push(`contracts.${k}: EXTENSION() on chain ${ext} != pinned ${show(px.ext[0])}`);
            if (!eq(c.extensionCodehash, px.ext[1])) p.push(`contracts.${k}.extensionCodehash ${show(c.extensionCodehash)} != pinned ${show(px.ext[1])}`);
            if (ext !== undefined) {
                const eh = value(await read(ext, 'codehash'), 'the extension code hash', k);
                if (eh !== undefined && !eq(eh, px.ext[1])) p.push(`contracts.${k}: extension code on chain ${eh} != pinned ${show(px.ext[1])}`);
            }
        }
        for (const [slot, hashField, isPinned] of [['erc1967Impl', 'implCodehash', !!px?.impl], ['extension', 'extensionCodehash', !!px?.ext]] as const) {
            if (isPinned) continue;
            for (const x of [slot, hashField]) if (c[x] !== undefined && !notApplicable(c[x])) p.push(`contracts.${k}.${x} ${show(c[x])}: ${k} is not a proxy here (expected null or "n/a:…")`);
        }

        // owner / pendingOwner, read back by the SDK for SP and the Registry.
        const own = OWNED[k];
        if (own) {
            for (const fn of ['owner', 'pendingOwner'] as const) {
                const o = await read(address, fn);
                if (o.kind === 'error') p.push(`contracts.${k}.${fn}: the SDK could not read ${fn}() (${o.detail})`);
                else if (o.kind === 'reverted') {
                    if (own[fn]) p.push(`contracts.${k}: ${fn}() reverts on chain, but ${k} must have one`);
                    else if (c[fn] !== null && c[fn] !== undefined) p.push(`contracts.${k}.${fn} ${show(c[fn])}, but ${fn}() reverts on chain (expected null)`);
                } else if (!eq(c[fn], o.value)) p.push(`contracts.${k}.${fn} ${show(c[fn])} != ${fn}() on chain ${o.value}`);
            }
        }
    }
    return p;
}

/** The probe's pass rule as SP's generator writes it; any other predicate text is refused, not reinterpreted. */
export const AMSTERDAM_PROBE_PREDICATE = 'all(estimateLive[p] == estimateFork for p in estimateLive) and estimateFork == expected.estimate and gasUsedFork == expected.gasUsed';

/** A number the SDK measured itself, or why it could not. */
export type Measured = { kind: 'value'; value: bigint } | { kind: 'error'; detail: string };

/**
 * The Amsterdam positive control (EIP-8037 CREATE gas): SP's recorded numbers must satisfy the
 * predicate, AND the SDK's own measurements must equal them, like with like: the SDK's estimate on
 * its fork == SP's estimateFork, the SDK's whole-tx receipt gasUsed on its fork == SP's gasUsedFork,
 * and the SDK's own upstream (live) estimate == expected.estimate.
 */
export function probeProblems(probe: Record<string, any>, mine: { estimateFork: Measured; gasUsedFork: Measured; estimateLive: Measured }): string[] {
    const p: string[] = [];
    const norm = (x: unknown) => String(x).replace(/\s+/g, ' ').trim();
    if (norm(probe.predicate) !== AMSTERDAM_PROBE_PREDICATE) p.push(`amsterdamProbe.predicate ${show(probe.predicate)} is not the agreed rule "${AMSTERDAM_PROBE_PREDICATE}"`);
    const live = Object.entries(probe.estimateLive as Record<string, number>);
    if (!live.length) p.push('amsterdamProbe.estimateLive: no provider');
    for (const [prov, v] of live) if (v !== probe.estimateFork) p.push(`amsterdamProbe.estimateLive.${prov} ${v} != estimateFork ${probe.estimateFork}`);
    if (probe.estimateFork !== probe.expected.estimate) p.push(`amsterdamProbe.estimateFork ${probe.estimateFork} != expected.estimate ${probe.expected.estimate}`);
    if (probe.gasUsedFork !== probe.expected.gasUsed) p.push(`amsterdamProbe.gasUsedFork ${probe.gasUsedFork} != expected.gasUsed ${probe.expected.gasUsed}`);
    const cmpMine = (what: string, m: Measured, theirs: unknown) => {
        if (m.kind === 'error') p.push(`amsterdamProbe: the SDK could not measure ${what} (${m.detail})`);
        else if (m.value !== BigInt(theirs as number)) p.push(`amsterdamProbe: the SDK's ${what} ${m.value} != SP's ${theirs}`);
    };
    cmpMine('estimate on its fork', mine.estimateFork, probe.estimateFork);
    cmpMine('whole-tx receipt gasUsed on its fork', mine.gasUsedFork, probe.gasUsedFork);
    cmpMine('live estimate from its own upstream', mine.estimateLive, probe.expected.estimate);
    return p;
}
