import { getAddress, sha256, stringToBytes, toFunctionSelector, type Hex } from 'viem';
import { canonicalDigest, canonicalJson, snapshotPlain } from './canonical.js';
import { isProviderName } from './rpc.js';

/**
 * Pure rule evaluation. No I/O: the same record and ruleset always give the same verdict,
 * so a flag can be re-derived from the pinned ruleset digest after the fact.
 * Ported from the DVT guardian-watcher evaluator. Selectors use viem `toFunctionSelector`
 * (keccak256 of the signature, first 4 bytes), the same bytes as `ethers.id(sig).slice(0, 10)`.
 * Lookups of events, functions, BLS kinds, and roles use own properties only.
 * `validateRuleset` returns a deep-frozen null-prototype copy. `DEFAULT_RULESET` is frozen in place.
 *
 * Fact kinds are not fields of the ruleset. The DVT file bytes stay unchanged.
 * {@link DEFAULT_FACT_KINDS} is the SDK-side declaration, keyed by rule id.
 * `evaluate` reads that map. It does not infer kinds from frames, selectors, or rule text.
 * A rule id missing from the map is treated as `internalFrames`.
 *
 * The reference classifier is not in this package. It is published in PR-D.
 * Classifier identity is the caller-supplied name and version plus {@link classifierRulesetSha256}.
 * That hash covers the ruleset and the fact-kind map. It does not embed classifier code.
 */
export const RULESET_SCHEMA = 'aastar.guardian-audit.ruleset.v1' as const;

const KINDS = ['SLASH', 'GENERIC', 'QUEUE', 'REPUTATION'] as const;
const TOP_LEVEL = new Set(['schema', 'comment', 'source', 'bls', 'ownerRoute', 'publicRoute']);

export interface FlagReason {
    flag: boolean;
    reason: string;
}

export interface GenericExpected {
    target: string;
    signature: string;
    flag: boolean;
    reason: string;
    readPrice?: boolean;
}

export interface OwnerEventRule {
    flag: boolean;
    readPrice?: boolean;
}

export interface PublicFunctionRule {
    events: string[];
    flag: boolean;
    reason: string;
    flagIfCallAlsoEmits?: string[];
    alsoReason?: string;
    readPrice?: boolean;
}

/** Provenance of the rule text. Required on every ruleset. The ruleset digest covers these fields. */
export interface RulesetSource {
    repo: string;
    tag: string;
    commit: string;
    path: string;
    sha256: string;
}

export interface Ruleset {
    schema: typeof RULESET_SCHEMA;
    comment?: string;
    source: RulesetSource;
    bls: {
        SLASH: FlagReason;
        REPUTATION: FlagReason;
        QUEUE: FlagReason;
        GENERIC: {
            expected: GenericExpected[];
            unexpected: FlagReason;
        };
        UNRECOVERED: FlagReason;
    };
    ownerRoute: {
        label: string;
        events: Record<string, OwnerEventRule>;
        comment?: string;
    };
    publicRoute: {
        comment?: string;
        label: string;
        functions: Record<string, PublicFunctionRule>;
        unattributed: FlagReason;
    };
}

export interface RuleRecord {
    route: 'bls' | 'owner' | 'public' | 'unattributed';
    kind?: string;
    event?: string;
    selector?: Hex;
    fields?: Record<string, unknown>;
    callEvents?: string[];
}

export interface Verdict {
    flagged: boolean;
    reasons: string[];
    rule: string;
}

/** Closed set. Canonical order is the order of this array. */
export const FACT_KINDS = ['topLevel', 'receiptLogs', 'internalFrames'] as const;
export type FactKind = (typeof FACT_KINDS)[number];
/** Rule id → the fact kinds that rule's route uses. Absent id means `internalFrames`. */
export type FactKindMap = Readonly<Record<string, readonly FactKind[]>>;

/**
 * Optional policy inputs. Both are snapshotted as own data.
 * `attribution` is read only at `attributionSource`. Frames on that object are not read.
 */
export interface EvaluateOptions {
    attribution?: unknown;
    factKinds?: FactKindMap;
}

/** Replaces the rule reason when a single trace is asked to vouch for an internal frame. */
export const SINGLE_TRACE_INTERNAL_REASON = 'single-trace attribution (unverified internal frame)';

function isRecord(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const SOURCE_KEYS = ['repo', 'tag', 'commit', 'path', 'sha256'] as const;
const BLS_KEYS = ['SLASH', 'GENERIC', 'QUEUE', 'REPUTATION', 'UNRECOVERED'] as const;
const FLAG_KEYS = ['flag', 'reason'] as const;
const GENERIC_KEYS = ['expected', 'unexpected'] as const;
const EXPECTED_KEYS = ['target', 'signature', 'flag', 'reason', 'readPrice'] as const;
const OWNER_KEYS = ['label', 'events', 'comment'] as const;
const OWNER_EVENT_KEYS = ['flag', 'readPrice'] as const;
const PUBLIC_KEYS = ['comment', 'label', 'functions', 'unattributed'] as const;
const PUBLIC_FN_KEYS = ['events', 'flag', 'reason', 'flagIfCallAlsoEmits', 'alsoReason', 'readPrice'] as const;

const MAX_RULE_KEYS = 64;
const MAX_REASON = 1024;
/**
 * `assertVerdict` rejects a reason longer than this, which would make `buildEvidenceBundle` throw.
 * A synthesis that would pass the cap is replaced with {@link REASON_TOO_LONG} and flagged.
 */
const MAX_VERDICT_REASON = 4096;
const REASON_TOO_LONG = 'verdict reason too long';
const PUBLIC_EVENT_REASON = 'public route event is not listed for this function';
const MAX_SOURCE = 256;
/**
 * Every name rules compare with `===`, `includes`, or an own-property lookup.
 * A hex-shaped name would survive that comparison with its case intact, then fold
 * under canonical JSON, so one digest could name two verdicts.
 * Function signatures are not symbols; they use {@link SIGNATURE_RE} and match by selector.
 */
export const SYMBOL_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SIGNATURE_RE = /^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/;

/** Stop listing keys once the ruleset is past the cap. A million allowed keys never gets walked. */
function ownKeys(obj: object): string[] {
    const keys: string[] = [];
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        keys.push(key);
        if (keys.length > MAX_RULE_KEYS) throw new Error('ruleset: too large');
    }
    return keys;
}

/** Own data only. `constructor`, `toString`, and `__proto__` are not rules. */
function ownValue(obj: object, key: string): unknown {
    if (!Object.hasOwn(obj, key)) return undefined;
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc === undefined || desc.get !== undefined || !('value' in desc)) return undefined;
    return desc.value;
}

/**
 * `section` is one of our tokens (`source`, `bls.SLASH`, `ownerRoute.events`, …).
 * The rejected key is not copied into the message.
 */
function unknownKey(section: string): never {
    throw new Error(`ruleset: unknown key in ${section}`);
}

function shortText(value: unknown, where: string, max: number): void {
    if (typeof value !== 'string' || value.length === 0 || value.length > max || value.includes('://') || /[\r\n]/.test(value)) {
        throw new Error(`ruleset: ${where} invalid`);
    }
}

function assertFlag(obj: Record<string, any>, where: string, withReason: boolean): void {
    if (typeof obj.flag !== 'boolean') throw new Error(`ruleset: ${where}.flag must be boolean`);
    if (withReason) shortText(obj.reason, `${where}.reason`, MAX_REASON);
    if (Object.hasOwn(obj, 'readPrice') && typeof obj.readPrice !== 'boolean') throw new Error(`ruleset: ${where}.readPrice must be boolean`);
}

function selectorOf(signature: string): Hex | null {
    try {
        return toFunctionSelector(signature);
    } catch {
        return null;
    }
}

function sameAddress(left: unknown, right: unknown): boolean {
    if (typeof left !== 'string' || typeof right !== 'string' || left.length !== 42 || right.length !== 42) return false;
    try {
        return getAddress(left as `0x${string}`) === getAddress(right as `0x${string}`);
    } catch {
        return false;
    }
}

function only(obj: Record<string, any>, allowed: readonly string[], section: string): void {
    for (const key of ownKeys(obj)) {
        if (!allowed.includes(key)) unknownKey(section);
    }
}

function deepFreeze<T>(value: T): T {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
    return Object.freeze(value);
}

/**
 * Validate a parsed ruleset. Unknown keys throw at every level; the message names the section, not the key.
 * Returns a new deep-frozen null-prototype copy. The input is not frozen and is not returned.
 */
export function validateRuleset(input: unknown): Ruleset {
    const snap = snapshotPlain(input, { nodes: 0, bytes: 0 });
    if (!isRecord(snap) || snap.schema !== RULESET_SCHEMA) throw new Error('ruleset: unknown schema');
    const rs = snap;
    for (const key of ownKeys(rs)) {
        if (TOP_LEVEL.has(key)) continue;
        if (key.length > 160 || key.includes('://') || /[\r\n]/.test(key)) throw new Error('ruleset: invalid key');
        throw new Error('ruleset: unknown key');
    }
    if (rs.comment !== undefined) shortText(rs.comment, 'comment', MAX_REASON);
    if (!isRecord(rs.source)) throw new Error('ruleset: source missing');
    only(rs.source, SOURCE_KEYS, 'source');
    for (const key of SOURCE_KEYS) {
        if (typeof rs.source[key] !== 'string') throw new Error(`ruleset: source.${key} missing`);
        shortText(rs.source[key], `source.${key}`, MAX_SOURCE);
    }
    if (!isRecord(rs.bls)) throw new Error('ruleset: bls.SLASH missing');
    only(rs.bls, BLS_KEYS, 'bls');
    for (const kind of [...KINDS, 'UNRECOVERED']) {
        if (!isRecord(rs.bls[kind])) throw new Error(`ruleset: bls.${kind} missing`);
    }
    for (const kind of ['SLASH', 'REPUTATION', 'QUEUE', 'UNRECOVERED'] as const) {
        only(rs.bls[kind], FLAG_KEYS, `bls.${kind}`);
        assertFlag(rs.bls[kind], `bls.${kind}`, true);
    }
    only(rs.bls.GENERIC, GENERIC_KEYS, 'bls.GENERIC');
    if (!Array.isArray(rs.bls.GENERIC.expected) || !isRecord(rs.bls.GENERIC.unexpected)) {
        throw new Error('ruleset: bls.GENERIC.expected / unexpected missing');
    }
    if (rs.bls.GENERIC.expected.length > MAX_RULE_KEYS) throw new Error('ruleset: too large');
    only(rs.bls.GENERIC.unexpected, FLAG_KEYS, 'bls.GENERIC.unexpected');
    assertFlag(rs.bls.GENERIC.unexpected, 'bls.GENERIC.unexpected', true);
    for (const e of rs.bls.GENERIC.expected) {
        if (!isRecord(e) || typeof e.target !== 'string' || typeof e.signature !== 'string') {
            throw new Error('ruleset: GENERIC.expected entries need target (role) and signature');
        }
        only(e, EXPECTED_KEYS, 'bls.GENERIC.expected');
        if (!SYMBOL_RE.test(e.target)) throw new Error('ruleset: bls.GENERIC.expected.target invalid');
        shortText(e.signature, 'bls.GENERIC.expected.signature', 256);
        if (!SIGNATURE_RE.test(e.signature) || selectorOf(e.signature) === null) throw new Error('ruleset: bad signature');
        assertFlag(e, 'bls.GENERIC.expected', true);
    }
    if (!isRecord(rs.ownerRoute) || typeof rs.ownerRoute.label !== 'string' || !isRecord(rs.ownerRoute.events)) {
        throw new Error('ruleset: ownerRoute missing');
    }
    only(rs.ownerRoute, OWNER_KEYS, 'ownerRoute');
    shortText(rs.ownerRoute.label, 'ownerRoute.label', MAX_SOURCE);
    if (rs.ownerRoute.comment !== undefined) shortText(rs.ownerRoute.comment, 'ownerRoute.comment', MAX_REASON);
    for (const name of ownKeys(rs.ownerRoute.events)) {
        const event = ownValue(rs.ownerRoute.events, name);
        if (!isRecord(event) || !SYMBOL_RE.test(name)) throw new Error('ruleset: ownerRoute.events invalid');
        only(event, OWNER_EVENT_KEYS, 'ownerRoute.events');
        assertFlag(event, 'ownerRoute.events', false);
    }
    const pr = rs.publicRoute;
    if (!isRecord(pr) || typeof pr.label !== 'string' || !isRecord(pr.functions) || !isRecord(pr.unattributed)) {
        throw new Error('ruleset: publicRoute missing');
    }
    only(pr, PUBLIC_KEYS, 'publicRoute');
    shortText(pr.label, 'publicRoute.label', MAX_SOURCE);
    if (pr.comment !== undefined) shortText(pr.comment, 'publicRoute.comment', MAX_REASON);
    only(pr.unattributed, FLAG_KEYS, 'publicRoute.unattributed');
    assertFlag(pr.unattributed, 'publicRoute.unattributed', true);
    const seenSelectors = new Set<string>();
    for (const sig of ownKeys(pr.functions)) {
        const f = ownValue(pr.functions, sig);
        if (sig.length > 160 || !SIGNATURE_RE.test(sig)) throw new Error('ruleset: bad signature');
        if (!isRecord(f) || !Array.isArray(f.events)) throw new Error('ruleset: publicRoute.functions invalid');
        if (f.events.length > MAX_RULE_KEYS) throw new Error('ruleset: too large');
        only(f, PUBLIC_FN_KEYS, 'publicRoute.functions');
        assertFlag(f, 'publicRoute.functions', true);
        const sel = selectorOf(sig);
        if (sel === null) throw new Error('ruleset: bad signature');
        if (seenSelectors.has(sel)) throw new Error('ruleset: duplicate selector');
        seenSelectors.add(sel);
        for (const ev of f.events) {
            if (typeof ev !== 'string' || !SYMBOL_RE.test(ev)) throw new Error('ruleset: publicRoute.functions.events invalid');
        }
        if (f.flagIfCallAlsoEmits !== undefined) {
            if (!Array.isArray(f.flagIfCallAlsoEmits) || f.flagIfCallAlsoEmits.length > MAX_RULE_KEYS) {
                throw new Error('ruleset: too large');
            }
            for (const ev of f.flagIfCallAlsoEmits) {
                if (typeof ev !== 'string' || !SYMBOL_RE.test(ev)) {
                    throw new Error('ruleset: publicRoute.functions.flagIfCallAlsoEmits invalid');
                }
            }
        }
        if (Object.hasOwn(f, 'alsoReason')) shortText(f.alsoReason, 'publicRoute.functions.alsoReason', MAX_REASON);
        else if (f.flagIfCallAlsoEmits) throw new Error('ruleset: alsoReason missing');
    }
    return deepFreeze(rs) as Ruleset;
}

/** `{ schema, digest }` of a validated ruleset. The digest covers every rule string. */
export function rulesetId(rs: Ruleset): { schema: typeof RULESET_SCHEMA; digest: Hex } {
    const valid = validateRuleset(rs);
    return { schema: valid.schema, digest: canonicalDigest(valid) };
}

/** Every own value is a 20-byte address, on every route. The address is not copied into the error. */
function assertRoleMap(roles: unknown): Record<string, string> {
    if (!isRecord(roles)) throw new Error('roles missing');
    for (const key in roles) {
        if (!Object.hasOwn(roles, key)) continue;
        if (!SYMBOL_RE.test(key)) throw new Error('role name is invalid');
        const value = ownValue(roles, key);
        if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/i.test(value)) throw new Error('role address is invalid');
        try {
            getAddress(`0x${value.slice(2)}` as `0x${string}`);
        } catch {
            throw new Error('role address is invalid');
        }
    }
    return roles;
}

/** Optional record fields have their exact type before any route returns. */
function assertCallerRecord(record: Record<string, any>): void {
    if (record.event !== undefined && (typeof record.event !== 'string' || !SYMBOL_RE.test(record.event))) {
        throw new Error('record: event is not a short string');
    }
    if (record.kind !== undefined && (typeof record.kind !== 'string' || !SYMBOL_RE.test(record.kind))) {
        throw new Error('record: kind is not a short string');
    }
    if (record.selector !== undefined && typeof record.selector !== 'string') throw new Error('record: selector is invalid');
    if (record.fields !== undefined && !isRecord(record.fields)) throw new Error('record: fields invalid');
    if (record.callEvents !== undefined) {
        if (!Array.isArray(record.callEvents) || record.callEvents.length > MAX_RULE_KEYS) {
            throw new Error('record: callEvents too large');
        }
        for (const name of record.callEvents) {
            if (typeof name !== 'string' || !SYMBOL_RE.test(name)) throw new Error('record: callEvents invalid');
        }
    }
}

/**
 * The expected-set entry a GENERIC call matches, by target role address and selector, or null.
 * A target that names no own role returns null (unexpected). It does not throw.
 */
export function matchGeneric(
    rs: Ruleset, roles: Record<string, string>, target: unknown, callData: unknown,
): GenericExpected | null {
    const budget = { nodes: 0, bytes: 0 };
    const rules = validateRuleset(snapshotPlain(rs, budget));
    const roleMap = assertRoleMap(snapshotPlain(roles, budget));
    const tgt = snapshotPlain(target, budget);
    const data = snapshotPlain(callData, budget);
    if (typeof data === 'string' && data.length > 1_048_576) throw new Error('record: callData too long');
    const sel = typeof data === 'string' && data.length >= 10 ? data.slice(0, 10).toLowerCase() : null;
    if (!Array.isArray(rules.bls.GENERIC.expected) || rules.bls.GENERIC.expected.length > MAX_RULE_KEYS) {
        throw new Error('ruleset: too large');
    }
    for (const e of rules.bls.GENERIC.expected) {
        if (!Object.hasOwn(roleMap, e.target)) continue;
        const addr = ownValue(roleMap, e.target);
        if (!tgt) continue;
        if (typeof addr !== 'string' || addr.length !== 42) throw new Error('role address is invalid');
        let roleAddr: string;
        try {
            roleAddr = getAddress(`0x${addr.slice(2)}` as `0x${string}`);
        } catch {
            throw new Error('role address is invalid');
        }
        if (!sameAddress(roleAddr, tgt)) continue;
        const want = selectorOf(e.signature);
        if (want !== null && sel !== null && want === sel) return e;
    }
    return null;
}

/** The publicRoute entry whose selector is `selector`, as [signature, entry], or null. */
export function publicFunction(rs: Ruleset, selector: unknown): [string, PublicFunctionRule] | null {
    const rules = validateRuleset(rs);
    const snap = snapshotPlain(selector, { nodes: 0, bytes: 0 });
    if (typeof snap !== 'string' || snap.length !== 10) return null;
    const want = snap.toLowerCase();
    for (const sig of ownKeys(rules.publicRoute.functions)) {
        const got = selectorOf(sig);
        const entry = ownValue(rules.publicRoute.functions, sig);
        if (got !== null && got === want && isRecord(entry)) return [sig, entry as PublicFunctionRule];
    }
    return null;
}

/** Events that some permissionless function can emit: their caller decides the route. */
export function ambiguousEvents(rs: Ruleset): Set<string> {
    const rules = validateRuleset(rs);
    const names: string[] = [];
    for (const sig of ownKeys(rules.publicRoute.functions)) {
        const entry = ownValue(rules.publicRoute.functions, sig);
        const events = isRecord(entry) ? entry.events : undefined;
        if (!Array.isArray(events) || events.length > MAX_RULE_KEYS) throw new Error('ruleset: too large');
        names.push(...events);
    }
    return new Set(names);
}

/**
 * Verdict for one record: `{ flagged, reasons, rule }`.
 * `route` is `bls` (kind omitted when the message was not authenticated), `owner`, `public`, or `unattributed`.
 * After the rule verdict, a `single` attribution whose rule uses `internalFrames` is forced
 * to `{ flagged: true, reasons: ['single-trace attribution (unverified internal frame)'] }`.
 * `dual` leaves the rule verdict. Fact kinds come from `options.factKinds` or {@link DEFAULT_FACT_KINDS}.
 */
export function evaluate(
    rs: Ruleset, roles: Record<string, string>, record: RuleRecord, options?: EvaluateOptions,
): Verdict {
    const budget = { nodes: 0, bytes: 0 };
    const snapRules = snapshotPlain(rs, budget);
    const snapRoles = snapshotPlain(roles, budget);
    const rec = snapshotPlain(record, budget);
    if (!isRecord(rec)
        || (rec.route !== 'bls' && rec.route !== 'owner' && rec.route !== 'public' && rec.route !== 'unattributed')) {
        throw new Error('record: unknown route');
    }
    const rules = validateRuleset(snapRules);
    const roleMap = assertRoleMap(snapRoles);
    assertCallerRecord(rec);
    record = rec as RuleRecord;
    roles = roleMap;
    const policy = readEvaluatePolicy(options);
    const finish = (verdict: Verdict): Verdict => applySingleTrace(verdict, policy);
    if (record.route === 'public') {
        const pf = publicFunction(rules, record.selector);
        if (!pf) {
            return finish({
                flagged: true,
                reasons: ['public route without a listed function'],
                rule: 'publicRoute.unlisted',
            });
        }
        const [sig, f] = pf;
        // The log's own event is part of the verdict. A caller-supplied callEvents list cannot
        // stand in for it, and cannot hide an event this function does not emit.
        if (typeof record.event !== 'string' || !f.events.includes(record.event)) {
            return finish({ flagged: true, reasons: [PUBLIC_EVENT_REASON], rule: 'publicRoute.event' });
        }
        const callEvents = record.callEvents ?? [];
        // The event itself always counts as emitted (DVT scan guard). Do not mutate `callEvents`.
        const emitted = callEvents.includes(record.event) ? callEvents : [...callEvents, record.event];
        const also = (f.flagIfCallAlsoEmits ?? []).filter((e) => emitted.includes(e));
        if (also.length) {
            const reason = `${f.alsoReason}: ${also.join(', ')}`;
            if (reason.length > MAX_VERDICT_REASON) {
                return finish({
                    flagged: true,
                    reasons: [REASON_TOO_LONG],
                    rule: `publicRoute.functions.${sig}.also`,
                });
            }
            return finish({
                flagged: true,
                reasons: [reason],
                rule: `publicRoute.functions.${sig}.also`,
            });
        }
        return finish({
            flagged: !!f.flag,
            reasons: [`${rules.publicRoute.label}: ${sig}: ${f.reason}`],
            rule: `publicRoute.functions.${sig}`,
        });
    }
    if (record.route === 'unattributed') {
        if (typeof record.event !== 'string' || record.event.length === 0) throw new Error('record: event is not a short string');
        const u = rules.publicRoute.unattributed;
        return finish({
            flagged: !!u.flag,
            reasons: [`${u.reason}: ${record.event}`],
            rule: 'publicRoute.unattributed',
        });
    }
    if (record.route === 'owner') {
        const event = typeof record.event === 'string' ? record.event : '';
        const r = ownValue(rules.ownerRoute.events, event);
        if (!isRecord(r)) {
            return finish({
                flagged: true,
                reasons: [`unlisted SuperPaymaster event ${event}`],
                rule: 'ownerRoute.unlisted',
            });
        }
        return finish({
            flagged: !!r.flag,
            reasons: [`${rules.ownerRoute.label}: ${event}`],
            rule: `ownerRoute.events.${event}`,
        });
    }
    if (record.kind === undefined) {
        const r = rules.bls.UNRECOVERED;
        return finish({ flagged: !!r.flag, reasons: [r.reason], rule: 'bls.UNRECOVERED' });
    }
    if (record.kind === 'GENERIC') {
        const e = matchGeneric(rules, roles, record.fields?.target, record.fields?.callData);
        if (e) {
            return finish({
                flagged: !!e.flag,
                reasons: [e.reason],
                rule: `bls.GENERIC.expected:${e.target}.${e.signature}`,
            });
        }
        const u = rules.bls.GENERIC.unexpected;
        return finish({ flagged: !!u.flag, reasons: [u.reason], rule: 'bls.GENERIC.unexpected' });
    }
    const r = ownValue(rules.bls, record.kind);
    if (!isRecord(r) || typeof r.reason !== 'string') {
        return finish({ flagged: true, reasons: [`unknown kind ${record.kind}`], rule: 'bls.unknown' });
    }
    return finish({ flagged: !!r.flag, reasons: [r.reason], rule: `bls.${record.kind}` });
}

/** Whether this record wants prices read before/after (price-update rules). */
export function wantsPrice(rs: Ruleset, roles: Record<string, string>, record: RuleRecord): boolean {
    const budget = { nodes: 0, bytes: 0 };
    const snapRules = snapshotPlain(rs, budget);
    const snapRoles = snapshotPlain(roles, budget);
    const rec = snapshotPlain(record, budget);
    if (!isRecord(rec)
        || (rec.route !== 'bls' && rec.route !== 'owner' && rec.route !== 'public' && rec.route !== 'unattributed')) {
        throw new Error('record: unknown route');
    }
    const rules = validateRuleset(snapRules);
    const roleMap = assertRoleMap(snapRoles);
    assertCallerRecord(rec);
    record = rec as RuleRecord;
    roles = roleMap;
    if (record.route === 'public') return !!publicFunction(rules, record.selector)?.[1].readPrice;
    if (record.route === 'owner' || record.route === 'unattributed') {
        const event = ownValue(rules.ownerRoute.events, typeof record.event === 'string' ? record.event : '');
        return isRecord(event) && !!event.readPrice;
    }
    if (record.kind !== 'GENERIC') return false;
    return !!matchGeneric(rules, roles, record.fields?.target, record.fields?.callData)?.readPrice;
}

const SOURCE: RulesetSource = {
    repo: 'AAStarCommunity/YetAnotherAA-Validator',
    tag: 'archive/guardian-watcher-w2-2026-11-12',
    commit: '8a7cda74d99097b3f5c4337f31bd3225d6cd02e1',
    path: 'services/guardian-watcher/ruleset.json',
    sha256: '0x18593eb0b9d6603cbd0f59669cafb49cf5c7359e67025583d34b80cce497227b',
};

/** DVT ruleset.json, schema id renamed, `source` added. Rule and reason text is unchanged. */
export const DEFAULT_RULESET: Ruleset = {
    schema: RULESET_SCHEMA,
    source: SOURCE,
    comment: 'M0 §5.2. Pinned in git: every record and every registry entry carries the commit SHA of this file. Targets are release-manifest ROLES, resolved to addresses from the watcher config.',
    bls: {
        SLASH: {
            flag: true,
            reason: 'BLS operator slash executed (impossible through DVTValidator in 5.5.0: empty evidence allowlist; so this came by the owner route)',
        },
        REPUTATION: {
            flag: true,
            reason: 'BLS reputation batch (5.5.0 does no reputation scoring)',
        },
        QUEUE: {
            flag: true,
            reason: 'operator frozen by a guardian quorum (queueSlashWithConsensus)',
        },
        GENERIC: {
            expected: [
                {
                    target: 'superPaymaster',
                    signature: 'updatePriceDVT(int256,uint256,bytes,uint8)',
                    flag: true,
                    reason: 'BLS price update: threshold is caller-chosen (>= minThreshold); SP caps each update but not a chain of updates',
                    readPrice: true,
                },
            ],
            unexpected: {
                flag: true,
                reason: 'generic BLS call outside the expected target/selector set',
            },
        },
        UNRECOVERED: {
            flag: true,
            reason: 'BLS-executed action whose message could not be authenticated from the transaction',
        },
    },
    ownerRoute: {
        label: 'owner/guardian route: not BLS, no on-chain signer verification',
        events: {
            PriceUpdated: { flag: true, readPrice: true },
            PriceModeChanged: { flag: true },
            EmergencyPriceQueued: { flag: true },
            EmergencyPriceExecuted: { flag: true, readPrice: true },
            EmergencyPriceCancelled: { flag: true },
            SlashQueued: { flag: true },
            SlashCancelled: { flag: true },
            OperatorSlashed: { flag: true },
            SlashExecutedWithProof: { flag: true },
            OperatorPaused: { flag: true },
            OperatorUnpaused: { flag: true },
            GlobalPauseSet: { flag: true },
            GuardianSet: { flag: true },
            BLSAggregatorQueued: { flag: true },
            BLSAggregatorUpdated: { flag: true },
        },
        comment: 'Events from a call into SuperPaymaster whose selector is NOT one of publicRoute.functions (owner, guardian or aggregator-only functions). The caller and selector are recorded when known.',
    },
    publicRoute: {
        comment: '#400 M1 (DSR verdicts 2026-11-10). SuperPaymaster functions ANYONE may call that emit watched events (SP 5.5.1 SuperPaymasterAdmin.sol: updatePrice :507, executeEmergencyPrice :417, pauseUnderstakedOperator :105). An event is classified by the selector and msg.sender of the SP call that emitted it; the caller is recorded and never accused.',
        label: 'permissionless call: caller recorded, not accused',
        functions: {
            'updatePrice()': {
                events: ['PriceUpdated', 'PriceModeChanged', 'EmergencyPriceCancelled'],
                flag: false,
                reason: 'routine permissionless price refresh (Chainlink)',
                flagIfCallAlsoEmits: ['PriceModeChanged', 'EmergencyPriceCancelled'],
                alsoReason: 'price mode changed via permissionless refresh (caller not accused)',
                readPrice: true,
            },
            'executeEmergencyPrice()': {
                events: ['PriceModeChanged', 'EmergencyPriceExecuted', 'PriceUpdated'],
                flag: true,
                reason: 'permissionless execution of an owner-queued emergency price (caller not accused)',
                readPrice: true,
            },
            'pauseUnderstakedOperator(address)': {
                events: ['OperatorPaused'],
                flag: false,
                reason: 'permissionless pause of an understaked operator (routine; W3)',
            },
        },
        unattributed: {
            flag: true,
            reason: 'SuperPaymaster event that a permissionless function can also emit, whose emitting call could not be determined after every retry (not attributed to anyone)',
        },
    },
};
deepFreeze(DEFAULT_RULESET);

const MAX_FACT_KEYS = 256;
const MAX_FACT_KEY = 256;
/** `dual:` + 64 + `+` + 64, matching the bundle cap. Longer text is rejected before it is scanned. */
const ATTRIBUTION_SOURCE_MAX = 133;
const INTERNAL_FRAMES_ONLY: readonly FactKind[] = Object.freeze(['internalFrames']);
const TOP_AND_LOGS: readonly FactKind[] = Object.freeze(['topLevel', 'receiptLogs']);
const LOGS_AND_FRAMES: readonly FactKind[] = Object.freeze(['receiptLogs', 'internalFrames']);
const LOGS_ONLY: readonly FactKind[] = Object.freeze(['receiptLogs']);

/**
 * Fact kinds for every rule id {@link DEFAULT_RULESET} can emit from its declared entries.
 * BLS verdicts use the authenticated top-level call and receipt logs.
 * Public functions and owner events use the emitting call, which may be a non-root frame.
 * `publicRoute.unattributed` is the receipt event whose emitting call was not found.
 * Dynamic ids (`publicRoute.unlisted`, `publicRoute.event`, `ownerRoute.unlisted`, `bls.unknown`)
 * are absent on purpose: a missing id fail-closes as `internalFrames`.
 */
export const DEFAULT_FACT_KINDS: FactKindMap = deepFreeze({
    'bls.SLASH': TOP_AND_LOGS,
    'bls.REPUTATION': TOP_AND_LOGS,
    'bls.QUEUE': TOP_AND_LOGS,
    'bls.UNRECOVERED': TOP_AND_LOGS,
    'bls.GENERIC.unexpected': TOP_AND_LOGS,
    'bls.GENERIC.expected:superPaymaster.updatePriceDVT(int256,uint256,bytes,uint8)': TOP_AND_LOGS,
    'ownerRoute.events.PriceUpdated': LOGS_AND_FRAMES,
    'ownerRoute.events.PriceModeChanged': LOGS_AND_FRAMES,
    'ownerRoute.events.EmergencyPriceQueued': LOGS_AND_FRAMES,
    'ownerRoute.events.EmergencyPriceExecuted': LOGS_AND_FRAMES,
    'ownerRoute.events.EmergencyPriceCancelled': LOGS_AND_FRAMES,
    'ownerRoute.events.SlashQueued': LOGS_AND_FRAMES,
    'ownerRoute.events.SlashCancelled': LOGS_AND_FRAMES,
    'ownerRoute.events.OperatorSlashed': LOGS_AND_FRAMES,
    'ownerRoute.events.SlashExecutedWithProof': LOGS_AND_FRAMES,
    'ownerRoute.events.OperatorPaused': LOGS_AND_FRAMES,
    'ownerRoute.events.OperatorUnpaused': LOGS_AND_FRAMES,
    'ownerRoute.events.GlobalPauseSet': LOGS_AND_FRAMES,
    'ownerRoute.events.GuardianSet': LOGS_AND_FRAMES,
    'ownerRoute.events.BLSAggregatorQueued': LOGS_AND_FRAMES,
    'ownerRoute.events.BLSAggregatorUpdated': LOGS_AND_FRAMES,
    'publicRoute.functions.updatePrice()': LOGS_AND_FRAMES,
    'publicRoute.functions.updatePrice().also': LOGS_AND_FRAMES,
    'publicRoute.functions.executeEmergencyPrice()': LOGS_AND_FRAMES,
    'publicRoute.functions.pauseUnderstakedOperator(address)': LOGS_AND_FRAMES,
    'publicRoute.unattributed': LOGS_ONLY,
});

/** Rule ids a validated ruleset can emit from its declared entries. Not the dynamic failure ids. */
export function rulesetRuleIds(rs: Ruleset): string[] {
    const rules = validateRuleset(rs);
    const ids = ['bls.SLASH', 'bls.REPUTATION', 'bls.QUEUE', 'bls.UNRECOVERED', 'bls.GENERIC.unexpected'];
    for (const expected of rules.bls.GENERIC.expected) {
        ids.push(`bls.GENERIC.expected:${expected.target}.${expected.signature}`);
    }
    for (const event of ownKeys(rules.ownerRoute.events)) ids.push(`ownerRoute.events.${event}`);
    for (const sig of ownKeys(rules.publicRoute.functions)) {
        ids.push(`publicRoute.functions.${sig}`);
        const entry = ownValue(rules.publicRoute.functions, sig);
        if (isRecord(entry) && Array.isArray(entry.flagIfCallAlsoEmits) && entry.flagIfCallAlsoEmits.length > 0) {
            ids.push(`publicRoute.functions.${sig}.also`);
        }
    }
    ids.push('publicRoute.unattributed');
    return ids;
}

/**
 * sha256 of the canonical JSON of the validated ruleset plus the resolved fact-kind map.
 * Every declared rule id is present. An id missing from `factKinds` is stored as `internalFrames`,
 * which is the same policy `evaluate` applies. The caller does not supply this hash.
 * The reference classifier is not hashed here; it ships in PR-D.
 */
export function classifierRulesetSha256(rs: Ruleset, factKinds?: FactKindMap): Hex {
    const rules = validateRuleset(rs);
    const declared = normalizeFactKindMap(factKinds === undefined ? DEFAULT_FACT_KINDS : factKinds);
    return sha256(stringToBytes(canonicalJson({
        factKinds: resolveFactKinds(rules, declared),
        ruleset: rules,
    })));
}

interface EvaluatePolicy {
    kind: 'single' | 'dual' | null;
    factKinds: Record<string, readonly FactKind[]>;
}

function readEvaluatePolicy(options: unknown): EvaluatePolicy {
    const attribution = optionField(options, 'attribution');
    const factKinds = optionField(options, 'factKinds');
    return {
        kind: attributionKind(attribution),
        factKinds: normalizeFactKindMap(factKinds === undefined ? DEFAULT_FACT_KINDS : factKinds),
    };
}

function applySingleTrace(verdict: Verdict, policy: EvaluatePolicy): Verdict {
    if (policy.kind !== 'single') return verdict;
    const declared = Object.hasOwn(policy.factKinds, verdict.rule)
        ? policy.factKinds[verdict.rule]!
        : INTERNAL_FRAMES_ONLY;
    if (!declared.includes('internalFrames')) return verdict;
    return { flagged: true, reasons: [SINGLE_TRACE_INTERNAL_REASON], rule: verdict.rule };
}

/** Own data fields of `options` only. `undefined` options yield `undefined` for both fields. */
function optionField(options: unknown, key: 'attribution' | 'factKinds'): unknown {
    if (options === undefined) return undefined;
    if (!isRecord(options)) throw new Error('evaluate options are invalid');
    let count = 0;
    try {
        for (const name in options) {
            if (!Object.prototype.hasOwnProperty.call(options, name)) continue;
            count += 1;
            if (count > 8) throw new Error('evaluate options are invalid');
            if (name !== 'attribution' && name !== 'factKinds') throw new Error('evaluate options are invalid');
        }
        if (!Object.prototype.hasOwnProperty.call(options, key)) return undefined;
        const desc = Object.getOwnPropertyDescriptor(options, key);
        if (desc === undefined) return undefined;
        if (desc.get !== undefined) {
            try {
                return desc.get.call(options);
            } catch {
                throw new Error('evaluate options are invalid');
            }
        }
        return desc.value;
    } catch (error) {
        if (error instanceof Error && error.message === 'evaluate options are invalid') throw error;
        throw new Error('evaluate options are invalid');
    }
}

/**
 * Kind of `attribution.attributionSource`, or null when the object has no such own field.
 * Other fields (`forwardingPath`, `immediateCaller`) are not read.
 */
function attributionKind(attribution: unknown): 'single' | 'dual' | null {
    if (attribution === undefined || attribution === null) return null;
    if (!isRecord(attribution)) throw new Error('attribution is invalid');
    let source: unknown;
    try {
        if (!Object.prototype.hasOwnProperty.call(attribution, 'attributionSource')) return null;
        const desc = Object.getOwnPropertyDescriptor(attribution, 'attributionSource');
        if (desc === undefined) return null;
        if (desc.get !== undefined) {
            try {
                source = desc.get.call(attribution);
            } catch {
                throw new Error('attribution source is invalid');
            }
        } else {
            source = desc.value;
        }
    } catch (error) {
        if (error instanceof Error && (error.message === 'attribution source is invalid' || error.message === 'attribution is invalid')) {
            throw error;
        }
        throw new Error('attribution is invalid');
    }
    return parseAttributionKind(source);
}

function parseAttributionKind(source: unknown): 'single' | 'dual' {
    if (typeof source !== 'string' || source.length === 0 || source.length > ATTRIBUTION_SOURCE_MAX) {
        throw new Error('attribution source is invalid');
    }
    if (source === 'single' || source === 'dual') return source;
    const colon = source.indexOf(':');
    if (colon <= 0 || source.indexOf(':', colon + 1) !== -1) throw new Error('attribution source is invalid');
    const kind = source.slice(0, colon);
    const rest = source.slice(colon + 1);
    if (kind === 'single') {
        if (!isProviderName(rest)) throw new Error('attribution source is invalid');
        return 'single';
    }
    if (kind !== 'dual') throw new Error('attribution source is invalid');
    const plus = rest.indexOf('+');
    if (plus <= 0 || rest.indexOf('+', plus + 1) !== -1) throw new Error('attribution source is invalid');
    const left = rest.slice(0, plus);
    const right = rest.slice(plus + 1);
    if (!isProviderName(left) || !isProviderName(right) || left === right) {
        throw new Error('attribution source is invalid');
    }
    return 'dual';
}

/**
 * Copy `map` into a null-prototype object. Key count is capped before values are read.
 * Kinds are rewritten in {@link FACT_KINDS} order. Empty, unknown, and duplicate kinds are rejected.
 */
function normalizeFactKindMap(map: unknown): Record<string, readonly FactKind[]> {
    if (!isRecord(map)) throw new Error('fact kind map is invalid');
    const keys: string[] = [];
    try {
        for (const key in map) {
            if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
            keys.push(key);
            if (keys.length > MAX_FACT_KEYS) throw new Error('fact kind map is too large');
        }
    } catch (error) {
        if (error instanceof Error && error.message === 'fact kind map is too large') throw error;
        throw new Error('fact kind map is invalid');
    }
    const out: Record<string, readonly FactKind[]> = Object.create(null);
    for (const key of keys) {
        if (key.length === 0 || key.length > MAX_FACT_KEY || key.includes('://') || /[\r\n]/.test(key)) {
            throw new Error('fact kind is invalid');
        }
        let desc: PropertyDescriptor | undefined;
        try {
            desc = Object.getOwnPropertyDescriptor(map, key);
        } catch {
            throw new Error('fact kind is invalid');
        }
        if (desc === undefined || desc.get !== undefined || !('value' in desc)) throw new Error('fact kind is invalid');
        const value = desc.value;
        const seen = new Set<string>();
        try {
            if (!Array.isArray(value) || value.length === 0 || value.length > FACT_KINDS.length) {
                throw new Error('fact kind is invalid');
            }
            for (const item of value) {
                if (typeof item !== 'string' || !(FACT_KINDS as readonly string[]).includes(item) || seen.has(item)) {
                    throw new Error('fact kind is invalid');
                }
                seen.add(item);
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'fact kind is invalid') throw error;
            throw new Error('fact kind is invalid');
        }
        const ordered: FactKind[] = [];
        for (const kind of FACT_KINDS) {
            if (seen.has(kind)) ordered.push(kind);
        }
        Object.defineProperty(out, key, { value: ordered, enumerable: true, writable: true, configurable: true });
    }
    return out;
}

/** Declared ids filled in, missing ids stored as `internalFrames`, extra keys kept. */
function resolveFactKinds(rules: Ruleset, declared: Record<string, readonly FactKind[]>): Record<string, readonly FactKind[]> {
    const out: Record<string, readonly FactKind[]> = Object.create(null);
    const ids = rulesetRuleIds(rules);
    const known = new Set(ids);
    for (const id of ids) {
        const kinds = Object.hasOwn(declared, id) ? declared[id]! : INTERNAL_FRAMES_ONLY;
        Object.defineProperty(out, id, { value: kinds, enumerable: true, writable: true, configurable: true });
    }
    for (const key of Object.keys(declared)) {
        if (known.has(key)) continue;
        Object.defineProperty(out, key, {
            value: declared[key],
            enumerable: true,
            writable: true,
            configurable: true,
        });
    }
    return out;
}
