/**
 * Field-by-field comparison of SP's read-back file (schema "aoa-a7-readback/1": the A7 fork export,
 * and the live read-back after SEND) against the SDK pins and what the SDK itself reads on chain.
 * The read-back gate (sp550CutoverGate) proves chain == pins; this proves SP's file == pins == the
 * SDK's own reads, so the three agree on one deployment.
 *
 * Value conventions (DSR, binding on SP's generator): a field is never omitted; `null` = the function
 * does not exist by design; "unreadable:<reason>" = the call failed; "n/a:<reason>" = not applicable.
 * Addresses compare case-insensitively; hashes are 0x + 64 hex.
 *
 * Scope (DSR-accepted): header; per contract address / codehash / version / ERC-1967 impl /
 * extension; owner and pendingOwner for SuperPaymaster and the Registry. guardian, roles and
 * checks{} are only required to be present (DVT and DSR compare them).
 */
import { sp550PinnedAddressEntries, type Sp550CutoverPins } from '../packages/core/src/sp550Cutover.js';

export const READBACK_SCHEMA = 'aoa-a7-readback/1';
export const READBACK_HEADER_FIELDS = ['spCommit', 'tag', 'chainId', 'hardfork', 'forkBlock', 'readbackBlock', 'anvilVersion', 'dumpSha256'] as const;
export const READBACK_CONTRACT_FIELDS = [
    'address', 'version', 'codehash', 'erc1967Impl', 'implCodehash', 'extension', 'extensionCodehash', 'owner', 'pendingOwner', 'guardian', 'roles',
] as const;

/** What the SDK read: a value, a revert (the function is absent), or a failed call. */
export type Observed = { kind: 'value'; value: string } | { kind: 'reverted' } | { kind: 'error'; detail: string };
export type ChainReader = (address: string, fn: 'version' | 'owner' | 'pendingOwner') => Promise<Observed>;

/** Facts about this run the header must match; undefined = compare presence only (e.g. no dump on a live read-back). */
export interface ReadbackContext {
    chainId: number;
    forkBlock?: bigint;
    dumpSha256?: string;
    hardfork?: string;
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

/** Proxies and what their ERC-1967 slot / extension must name, from the pins. */
function proxyPins(pins: Sp550CutoverPins): Record<string, { impl?: [unknown, unknown]; ext?: [unknown, unknown] }> {
    const h = pins.codehashes ?? {};
    return {
        superPaymaster: { impl: [pins.spImpl, pins.spImplCodehash], ext: [pins.spAdminExtension, h.spAdminExtension] },
        'addresses.registry': { impl: [pins.registryImpl, h.registryImpl] },
    };
}
/** Contracts whose version() is itself a pin. */
const versionPin = (pins: Sp550CutoverPins): Record<string, unknown> => ({ superPaymaster: pins.spVersion, superPaymasterLens: pins.lensVersion });
const OWNED = ['superPaymaster', 'addresses.registry'];

export async function readbackProblems(rb: unknown, pins: Sp550CutoverPins, ctx: ReadbackContext, read: ChainReader): Promise<string[]> {
    const p: string[] = [];
    if (!rb || typeof rb !== 'object' || Array.isArray(rb)) return ['read-back: not a JSON object'];
    const f = rb as Record<string, any>;
    if (f.schema !== READBACK_SCHEMA) p.push(`schema: ${show(f.schema)} is not "${READBACK_SCHEMA}"`);

    // Header.
    const hd = f.header;
    if (!hd || typeof hd !== 'object') p.push('header: missing');
    else {
        for (const k of READBACK_HEADER_FIELDS) if (hd[k] === undefined) p.push(`header.${k}: omitted`);
        if (hd.chainId !== undefined && asBig(hd.chainId) !== BigInt(ctx.chainId)) p.push(`header.chainId ${show(hd.chainId)} != ${ctx.chainId}`);
        if (hd.tag !== undefined && hd.tag !== pins.tag) p.push(`header.tag ${show(hd.tag)} != pins.tag ${show(pins.tag)}`);
        if (hd.readbackBlock !== undefined && asBig(hd.readbackBlock) !== pins.readbackBlock) p.push(`header.readbackBlock ${show(hd.readbackBlock)} != pins.readbackBlock ${show(pins.readbackBlock)}`);
        if (ctx.forkBlock !== undefined && hd.forkBlock !== undefined && asBig(hd.forkBlock) !== ctx.forkBlock) p.push(`header.forkBlock ${show(hd.forkBlock)} != ${ctx.forkBlock}`);
        if (ctx.dumpSha256 !== undefined && hd.dumpSha256 !== undefined && !eq(String(hd.dumpSha256).replace(/^0x/, ''), ctx.dumpSha256.replace(/^0x/, ''))) p.push(`header.dumpSha256 ${show(hd.dumpSha256)} != the loaded dump ${ctx.dumpSha256}`);
        if (ctx.hardfork !== undefined && hd.hardfork !== undefined && hd.hardfork !== ctx.hardfork) p.push(`header.hardfork ${show(hd.hardfork)} != ${ctx.hardfork}`);
        if (ctx.spCommit !== undefined && hd.spCommit !== undefined && !eq(hd.spCommit, ctx.spCommit)) p.push(`header.spCommit ${show(hd.spCommit)} != the SP checkout ${ctx.spCommit}`);
    }
    if (f.checks === undefined) p.push('checks: omitted');

    // Contracts: exactly the pinned names, every field present.
    const contracts = f.contracts;
    if (!contracts || typeof contracts !== 'object') return [...p, 'contracts: missing'];
    const pinned = sp550PinnedAddressEntries(pins).filter(([, a]) => typeof a === 'string') as [string, string][];
    const names = new Set(pinned.map(([k]) => k));
    for (const k of Object.keys(contracts)) if (!names.has(k)) p.push(`contracts.${k}: not a pinned name`);
    const proxies = proxyPins(pins);
    const versions = versionPin(pins);
    for (const [k, address] of pinned) {
        const c = contracts[k];
        if (!c || typeof c !== 'object') { p.push(`contracts.${k}: omitted`); continue; }
        for (const field of READBACK_CONTRACT_FIELDS) if (c[field] === undefined) p.push(`contracts.${k}.${field}: omitted`);
        if (!eq(c.address, address)) p.push(`contracts.${k}.address ${show(c.address)} != pinned ${address}`);
        const hash = pins.codehashes?.[k];
        if (!eq(c.codehash, hash)) p.push(`contracts.${k}.codehash ${show(c.codehash)} != pins.codehashes.${k} ${show(hash)}`);

        // version: what the SDK reads decides whether the contract has one.
        const v = await read(address, 'version');
        if (v.kind === 'error') p.push(`contracts.${k}.version: the SDK could not read version() (${v.detail})`);
        else if (v.kind === 'reverted') { if (c.version !== null && c.version !== undefined) p.push(`contracts.${k}.version ${show(c.version)}, but version() reverts on chain (expected null)`); }
        else {
            if (c.version !== v.value) p.push(`contracts.${k}.version ${show(c.version)} != version() on chain ${show(v.value)}`);
            if (k in versions && v.value !== versions[k]) p.push(`contracts.${k}: version() ${show(v.value)} != its pin ${show(versions[k])}`);
        }

        // ERC-1967 implementation and extension: pinned for the proxies, not applicable elsewhere.
        for (const [slot, hashField, pin] of [['erc1967Impl', 'implCodehash', proxies[k]?.impl], ['extension', 'extensionCodehash', proxies[k]?.ext]] as const) {
            if (pin) {
                if (!eq(c[slot], pin[0])) p.push(`contracts.${k}.${slot} ${show(c[slot])} != pinned ${show(pin[0])}`);
                if (!eq(c[hashField], pin[1])) p.push(`contracts.${k}.${hashField} ${show(c[hashField])} != pinned ${show(pin[1])}`);
            } else {
                for (const x of [slot, hashField]) if (c[x] !== undefined && !notApplicable(c[x])) p.push(`contracts.${k}.${x} ${show(c[x])}: ${k} is not a proxy here (expected null or "n/a:…")`);
            }
        }

        // owner / pendingOwner, read back by the SDK for SP and the Registry.
        if (OWNED.includes(k)) {
            for (const fn of ['owner', 'pendingOwner'] as const) {
                const o = await read(address, fn);
                if (o.kind === 'error') p.push(`contracts.${k}.${fn}: the SDK could not read ${fn}() (${o.detail})`);
                else if (o.kind === 'reverted') { if (c[fn] !== null && c[fn] !== undefined) p.push(`contracts.${k}.${fn} ${show(c[fn])}, but ${fn}() reverts on chain (expected null)`); }
                else if (!eq(c[fn], o.value)) p.push(`contracts.${k}.${fn} ${show(c[fn])} != ${fn}() on chain ${o.value}`);
            }
        }
    }
    return p;
}
