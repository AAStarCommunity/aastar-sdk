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
import { SP550_PIN_ALIASES, sp550FreshPinProblems, sp550UpgradePinProblems, type Sp550FreshDeployPins } from '../packages/core/src/sp550Deployments.js';

export const READBACK_SCHEMA = 'aoa-a7-readback/1';
/**
 * The binding JSON Schema (Draft 2020-12), vendored byte-for-byte from SuperPaymaster
 * 8f3305047a72f3f0132827447d70af1375debe8a docs/release/a7/ (re-frozen: a change needs DSR acceptance) (docs/sp550-cutover/a7/README.md).
 * The file is refused unless it hashes to READBACK_SCHEMA_SHA256.
 */
export const READBACK_SCHEMA_FILE = path.resolve(import.meta.dirname, '../docs/sp550-cutover/a7/aoa-a7-readback-1.schema.json');
export const READBACK_SCHEMA_SHA256 = 'bc009b278348c25be8858ef04b0dd3decf24489421a6dbc98d67956e619dc106';
export const READBACK_HEADER_FIELDS = [
    'source', 'spCommit', 'tag', 'chainId', 'hardfork', 'forkBlock', 'readbackBlock', 'readbackBlockHash',
    'anvilVersion', 'anvilCommit', 'dumpSha256', 'providers', 'ethConfig',
] as const;

/** Compile the schema after checking its hash; returns a validator that lists every violation. */
export function loadReadbackValidator(file = READBACK_SCHEMA_FILE, sha256 = READBACK_SCHEMA_SHA256): (x: unknown) => string[] {
    const raw = fs.readFileSync(file);
    const got = createHash('sha256').update(new Uint8Array(raw)).digest('hex');
    if (got !== sha256) throw new Error(`read-back schema ${file}: sha256 ${got} != pinned ${sha256}; refusing to validate against it`);
    // ajv's strict LINTS (strictRequired: keys required under additionalProperties; strictTypes: `required`
    // without a sibling `type`) are off: both are valid Draft 2020-12 and SP's validator accepts them.
    // strictSchema stays on, so an unknown keyword in the schema still fails to compile.
    const ajv = new (Ajv2020 as any)({ strict: true, strictRequired: false, strictTypes: false, allErrors: true });
    // x-readMethods (revision 3) documents how each field is read; an annotation, not a validation rule.
    ajv.addKeyword({ keyword: 'x-readMethods', schemaType: 'object' });
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

/**
 * Book keys whose read-back contract key differs (SP, 2026-11-11). Every SP pins file declares the same
 * map in `_aliases` (as "contracts.<key>"); parseManifestPins refuses a file whose map differs.
 */
export const BOOK_KEY_CONTRACT_ALIASES: Readonly<Record<string, string>> = { staking: 'gTokenStaking' };

/** The read-back's contract key for a pin name: book entries drop their `addresses.` prefix (and follow the alias map). */
export const contractKeyOf = (pinName: string) => {
    if (!pinName.startsWith('addresses.')) return pinName;
    const k = pinName.slice('addresses.'.length);
    return BOOK_KEY_CONTRACT_ALIASES[k] ?? k;
};
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
export type ReadKind = 'version' | 'owner' | 'pendingOwner' | 'EXTENSION' | 'codehash' | 'erc1967Impl' | 'blockHash' | 'ownership2StepSlot' | 'amsterdamAtForkBlock';

/**
 * ERC-7201 slot of Ownable2StepNamespaced's pending owner (SP 248ef831
 * contracts/src/utils/Ownable2StepNamespaced.sol:36; = cast index-erc7201 "aastar.storage.Ownership2Step").
 * The Registry's pendingOwner() returns sload(slot); the SDK reads both and requires them equal.
 */
export const OWNERSHIP_2STEP_SLOT = '0xdb5a3168abaa6147a9f3a4cb66016161119d4d50b6393344d27120286f742a00';
/**
 * `amsterdamAtForkBlock` (address ignored, `at.block` = header.forkBlock) answers a JSON value
 * `{ blockAccessListHash: bool, slotNumber: bool, ethConfigs: [{ activationTime, forkId }] }` read from
 * the UPSTREAM chain (never the fork): the block header's Amsterdam-only fields (agreed across
 * providers), and eth_config.current from every provider that serves it.
 */
export type ChainReader = (address: string, what: ReadKind, at?: { block?: bigint }) => Promise<Observed>;

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
/**
 * Contracts that have NO version() by design (their interface has none): only these may answer a
 * revert with `null`. A revert anywhere else is a failure — absence is never inferred from a revert.
 */
export const VERSION_ABSENT_BY_DESIGN = new Set(['spAdminExtension', 'xPNTsTokenV2Ext']);
/**
 * Book contracts whose standard interface has no version() (the core ABI has none — asserted in the
 * tests): a revert there must be reported "n/a:…" (schema 2228c0b6 forbids null outside the set above).
 */
export const VERSION_NOT_IN_INTERFACE = new Set(['timelockController']);
/** owner() / pendingOwner() the SDK reads back and compares (both must exist). */
const OWNED: Record<string, ReadonlyArray<'owner' | 'pendingOwner'>> = {
    superPaymaster: ['owner', 'pendingOwner'],
    registry: ['owner', 'pendingOwner'],
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
    // The SDK's own upstream read at forkBlock: the file's ethConfig / corroboration are not taken on trust.
    const am = await read('', 'amsterdamAtForkBlock', { block: asBig(hd.forkBlock) });
    if (am.kind !== 'value') p.push(`header.ethConfig: the SDK could not read the upstream at forkBlock ${show(hd.forkBlock)} (${am.kind === 'error' ? am.detail : 'reverted'})`);
    else {
        let seen: { blockAccessListHash?: boolean; slotNumber?: boolean; ethConfigs?: { activationTime?: number; forkId?: string }[] } | null = null;
        try { const v = JSON.parse(am.value); seen = v && typeof v === 'object' ? v : null; } catch { /* reported below */ }
        if (!seen) { p.push(`header.ethConfig: the upstream answer is not a JSON object (${am.value.slice(0, 60)})`); seen = { blockAccessListHash: true, slotNumber: true, ethConfigs: [] }; }
        if (seen.blockAccessListHash !== true || seen.slotNumber !== true) p.push(`header.ethConfig: the upstream block ${show(hd.forkBlock)} lacks Amsterdam header fields (blockAccessListHash ${seen.blockAccessListHash}, slotNumber ${seen.slotNumber})`);
        for (const cfg of seen.ethConfigs ?? []) {
            if (ref && (cfg.activationTime !== ref.activationTime || !eq(cfg.forkId, ref.forkId))) p.push(`header.ethConfig: the upstream eth_config reports ${show(cfg)}, not Amsterdam ${show(ref)}`);
        }
    }
    const co = ec.corroboration as Record<string, any>;
    if (co.blockAccessListHash !== true || co.slotNumber !== true) p.push(`header.ethConfig.corroboration: Amsterdam-only header fields not both present (blockAccessListHash ${show(co.blockAccessListHash)}, slotNumber ${show(co.slotNumber)})`);
    // eth_config's provider is optional in the schema but required here: corroboration means a second, different provider.
    if (typeof ec.provider !== 'string') p.push('header.ethConfig.provider: omitted (the eth_config provider must be named to prove corroboration is independent)');
    else if (co.provider === ec.provider) p.push(`header.ethConfig.corroboration.provider ${show(co.provider)} is the eth_config provider; it must be a second one`);
    for (const [what, prov] of [['ethConfig.provider', ec.provider], ['ethConfig.corroboration.provider', co.provider]] as const) {
        if (typeof prov === 'string' && !providers.includes(prov)) p.push(`header.${what} ${show(prov)} is not in header.providers`);
    }
    if (co.blockNumber !== hd.forkBlock) p.push(`header.ethConfig.corroboration.blockNumber ${show(co.blockNumber)} != header.forkBlock ${show(hd.forkBlock)}`);

    // Contracts: every pinned name (book entries without their prefix), every compared field also read by the SDK.
    const contracts = f.contracts as Record<string, any>;
    // A declared alias (addresses.superPaymaster = superPaymaster, …) is one contract: it is compared
    // under its top-level name, and must name the same address.
    const entries = sp550PinnedAddressEntries(pins).filter(([, a]) => typeof a === 'string') as [string, string][];
    const byName = Object.fromEntries(entries);
    for (const [top, book] of SP550_PIN_ALIASES) {
        if (byName[book] === undefined) continue;
        if (!eq(byName[book], byName[top])) p.push(`pins: ${book} ${byName[book]} != ${top} ${byName[top]} (declared alias)`);
        // Deduplicated below, so the alias's own codehash pin must be the same one that is compared.
        if (!eq(pins.codehashes?.[book], pins.codehashes?.[top])) p.push(`pins: codehashes.${book} ${show(pins.codehashes?.[book])} != codehashes.${top} ${show(pins.codehashes?.[top])} (declared alias)`);
    }
    const aliasBook = new Set(SP550_PIN_ALIASES.map(([, b]) => b));
    const pinned = entries.filter(([k]) => !aliasBook.has(k)).map(([k, a]) => [contractKeyOf(k), a, k] as const);
    const seenKeys = new Set<string>();
    for (const [k, , pinName] of pinned) {
        if (seenKeys.has(k)) p.push(`pins: ${pinName} maps to contracts.${k}, which another pin already names`);
        seenKeys.add(k);
    }
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
            if (VERSION_ABSENT_BY_DESIGN.has(k)) { if (c.version !== null) p.push(`contracts.${k}.version ${show(c.version)}, but version() reverts on chain (expected null)`); }
            else if (VERSION_NOT_IN_INTERFACE.has(k)) { if (!notApplicable(c.version) || c.version === null) p.push(`contracts.${k}.version ${show(c.version)}: ${k}'s interface has no version() (expected "n/a:…")`); }
            else p.push(`contracts.${k}: version() reverts on chain, but ${k} must have one`);
        } else {
            if (VERSION_ABSENT_BY_DESIGN.has(k)) p.push(`contracts.${k}: version() answers ${show(v.value)}, but ${k} has none by design (is this the pinned code?)`);
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
            // x-readMethods: the extension's codehash MUST equal the spAdminExtension entry's own.
            if (contracts.spAdminExtension && !eq(c.extensionCodehash, contracts.spAdminExtension.codehash)) p.push(`contracts.${k}.extensionCodehash ${show(c.extensionCodehash)} != contracts.spAdminExtension.codehash ${show(contracts.spAdminExtension.codehash)}`);
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
        for (const fn of OWNED[k] ?? []) {
            const o = await read(address, fn);
            if (o.kind === 'error') p.push(`contracts.${k}.${fn}: the SDK could not read ${fn}() (${o.detail})`);
            else if (o.kind === 'reverted') p.push(`contracts.${k}: ${fn}() reverts on chain, but ${k} must have one`);
            else if (!eq(c[fn], o.value)) p.push(`contracts.${k}.${fn} ${show(c[fn])} != ${fn}() on chain ${o.value}`);
        }
        // The Registry keeps its pending owner in an ERC-7201 slot: the raw slot must agree with the getter and the file.
        if (k === 'registry') {
            const slot = await read(address, 'ownership2StepSlot');
            if (slot.kind !== 'value') p.push(`contracts.registry.pendingOwner: the SDK could not read the ERC-7201 slot ${OWNERSHIP_2STEP_SLOT} (${slot.kind === 'error' ? slot.detail : 'reverted'})`);
            else if (!eq(c.pendingOwner, slot.value)) p.push(`contracts.registry.pendingOwner ${show(c.pendingOwner)} != ERC-7201 slot ${OWNERSHIP_2STEP_SLOT} on chain ${slot.value}`);
        }
    }
    // The recorded probe is checked on every comparison; only the SDK's own measurements need --probe.
    p.push(...recordedProbeProblems(f.amsterdamProbe, providers));

    // A contract the pins declare absent (e.g. timelockController: "n/a:none") must not appear DEPLOYED in
    // the file; an "n/a:not deployed" placeholder is fine.
    for (const k of pins.absent ?? []) {
        const key = BOOK_KEY_CONTRACT_ALIASES[k] ?? k;
        const e = contracts[key];
        if (!isNotDeployedPlaceholder(e)) p.push(`contracts.${key}: not an "n/a:" not-deployed placeholder (address ${show(e?.address)}, codehash ${show(e?.codehash)}), but the pins declare ${k} absent`);
    }

    // The snapshot must not have moved while the reads ran (a reorg could mix states across reads).
    const bh2 = await read('', 'blockHash');
    if (bh.kind === 'value' && (bh2.kind !== 'value' || !eq(bh2.value, bh.value))) p.push(`snapshot: block ${pins.readbackBlock} changed during the reads (${bh.value} -> ${bh2.kind === 'value' ? bh2.value : bh2.kind})`);
    return p;
}

/** The probe's pass rule as SP's generator writes it (revision 3); any other predicate text is refused, not reinterpreted. */
export const AMSTERDAM_PROBE_PREDICATE = 'all(estimateSimulate[p] == gasUsedFork == expected.gasUsed for p if int) and all(callAtGasUsed.values())';

/**
 * SP's recorded probe on its own terms (revision 3): JUDGED — every integer estimateSimulate[p] ==
 * gasUsedFork == expected.gasUsed, at least one provider supplies one, and callAtGasUsed[p] is true for
 * every provider. RECORDED ONLY — estimateLive, estimateFork (an upstream estimate may add headroom),
 * callAtGasUsedMinusOne.
 */
export function recordedProbeProblems(probe: Record<string, any>, providers?: readonly unknown[]): string[] {
    const p: string[] = [];
    // Every per-provider map covers exactly header.providers: a missing or unrelated provider name
    // would otherwise let "every provider" pass on a subset.
    if (providers) {
        // Compared as sorted arrays (JSON), never joined strings: a key "alchemy,tenderly" is one provider.
        const want = JSON.stringify([...new Set(providers.map(String))].sort());
        for (const m of ['estimateLive', 'estimateSimulate', 'callAtGasUsed', 'callAtGasUsedMinusOne'] as const) {
            const got = JSON.stringify(Object.keys((probe[m] ?? {}) as object).sort());
            if (got !== want) p.push(`amsterdamProbe.${m} covers providers ${got}, not header.providers ${want}`);
        }
    }
    const norm = (x: unknown) => String(x).replace(/\s+/g, ' ').trim();
    if (norm(probe.predicate) !== AMSTERDAM_PROBE_PREDICATE) p.push(`amsterdamProbe.predicate ${show(probe.predicate)} is not the agreed rule "${AMSTERDAM_PROBE_PREDICATE}"`);
    for (const [k, v] of [['gasUsedFork', probe.gasUsedFork], ['expected.gasUsed', probe.expected.gasUsed]] as const) {
        if (!(Number.isSafeInteger(v) && v > 0)) p.push(`amsterdamProbe.${k} ${show(v)} is not a positive gas amount`);
    }
    if (probe.gasUsedFork !== probe.expected.gasUsed) p.push(`amsterdamProbe.gasUsedFork ${probe.gasUsedFork} != expected.gasUsed ${probe.expected.gasUsed}`);
    const sims = Object.entries(probe.estimateSimulate as Record<string, unknown>).filter(([, v]) => typeof v === 'number');
    if (!sims.length) p.push('amsterdamProbe.estimateSimulate: no provider supplied eth_simulateV1');
    for (const [prov, v] of sims) if (v !== probe.gasUsedFork) p.push(`amsterdamProbe.estimateSimulate.${prov} ${v} != gasUsedFork ${probe.gasUsedFork}`);
    const calls = Object.entries(probe.callAtGasUsed as Record<string, boolean>);
    if (!calls.length) p.push('amsterdamProbe.callAtGasUsed: no provider');
    for (const [prov, ok] of calls) if (ok !== true) p.push(`amsterdamProbe.callAtGasUsed.${prov} is ${show(ok)}: eth_call with gas = expected.gasUsed must succeed`);
    return p;
}

/** A number the SDK measured itself, or why it could not ('n/a' = the provider has no such method). */
export type Measured = { kind: 'value'; value: bigint } | { kind: 'error'; detail: string } | { kind: 'n/a'; detail: string };

/**
 * The SDK's own measurements, judged like SP's (revision 3): its fork's whole-tx receipt gasUsed ==
 * SP's gasUsedFork; its own upstream's eth_simulateV1 gasUsed (when the upstream has the method) ==
 * expected.gasUsed; eth_call with gas = expected.gasUsed succeeds on its upstream and on its fork.
 * Estimates are not measured: they are recorded only.
 */
export function probeProblems(probe: Record<string, any>, mine: { gasUsedFork: Measured; simulateUpstream: Measured; callUpstream: Measured; callFork: Measured }): string[] {
    const p: string[] = [];
    const cmp = (what: string, m: Measured, theirs: unknown) => {
        if (m.kind === 'error') p.push(`amsterdamProbe: the SDK could not measure ${what} (${m.detail})`);
        else if (m.kind === 'value' && m.value !== BigInt(theirs as number)) p.push(`amsterdamProbe: the SDK's ${what} ${m.value} != SP's ${theirs}`);
    };
    cmp('whole-tx receipt gasUsed on its fork', mine.gasUsedFork, probe.gasUsedFork);
    if (mine.gasUsedFork.kind === 'n/a') p.push(`amsterdamProbe: the SDK's fork gasUsed is required (${mine.gasUsedFork.detail})`);
    cmp('eth_simulateV1 gasUsed on its own upstream', mine.simulateUpstream, probe.expected.gasUsed);
    for (const [what, m] of [['eth_call at gas = expected.gasUsed on its own upstream', mine.callUpstream], ['eth_call at gas = expected.gasUsed on its fork', mine.callFork]] as const) {
        if (m.kind === 'error') p.push(`amsterdamProbe: ${what} failed (${m.detail})`);
        else if (m.kind === 'n/a') p.push(`amsterdamProbe: ${what} is required (${m.detail})`);
    }
    return p;
}

/**
 * Fold the upstreams' raw answers at forkBlock into the `amsterdamAtForkBlock` observation: the
 * Amsterdam-only header VALUES (not just their shape) must agree across providers; every eth_config a
 * provider serves is handed on to be checked on its own.
 */
export function aggregateAmsterdam(answers: ({ blockAccessListHash?: unknown; slotNumber?: unknown; ethConfig?: unknown } | string)[]): Observed {
    if (!answers.length) return { kind: 'error', detail: 'no upstream' };
    const bad = answers.find((x) => typeof x === 'string');
    if (bad !== undefined) return { kind: 'error', detail: bad as string };
    const rows = answers as { blockAccessListHash?: unknown; slotNumber?: unknown; ethConfig?: unknown }[];
    const HASH = /^0x[0-9a-fA-F]{64}$/;
    // slotNumber is a JSON-RPC quantity: compared as a number (0x10 == 0x010), the hash case-insensitively.
    const qty = (v: unknown) => (typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v) ? BigInt(v).toString() : `raw:${String(v)}`);
    const vals = rows.map((r) => `${String(r.blockAccessListHash).toLowerCase()}/${qty(r.slotNumber)}`);
    if (!vals.every((v) => v === vals[0])) return { kind: 'error', detail: `upstreams disagree on the Amsterdam header at forkBlock: ${vals.join(' vs ')}` };
    const r0 = rows[0];
    const hashOk = typeof r0.blockAccessListHash === 'string' && HASH.test(r0.blockAccessListHash) && !/^0x0{64}$/.test(r0.blockAccessListHash);
    const slotOk = typeof r0.slotNumber === 'string' && /^0x[0-9a-fA-F]+$/.test(r0.slotNumber);
    return { kind: 'value', value: JSON.stringify({ blockAccessListHash: hashOk, slotNumber: slotOk, ethConfigs: rows.map((r) => r.ethConfig).filter(Boolean) }) };
}

/**
 * A read-back entry that explicitly says "not deployed": every identity field (address, codehash, and
 * any implementation / extension identity) is an "n/a:" placeholder or null. Anything carrying a real
 * address or hash — or an unreadable one — is NOT that. Shared by the comparator and pin-fill's live check.
 */
export function isNotDeployedPlaceholder(c: any): boolean {
    if (c === undefined || c === null) return true;
    const na = (v: unknown) => v === null || (typeof v === 'string' && v.startsWith('n/a:'));
    return ['address', 'codehash', 'erc1967Impl', 'implCodehash', 'extension', 'extensionCodehash'].every((f) => c[f] === undefined || na(c[f]))
        && na(c.address) && na(c.codehash);
}
