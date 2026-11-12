import { getAddress, sha256, stringToBytes, type Address, type Hex } from 'viem';
import { canonicalDigest, canonicalJson } from './canonical.js';
import { evaluate, RULESET_SCHEMA, rulesetId, type RuleRecord, type Ruleset, type Verdict } from './rules.js';
import { PROVIDER_NAME_RE, quantity } from './rpc.js';
import type { FoundAction, ScanResult } from './scan.js';

/**
 * Evidence file (`aastar.guardian-audit.evidence-file.v1`).
 *
 * The file is the published artifact. DVT commits `serializeEvidenceFile` bytes. Their sha256 is the
 * identity sent to kms.aastar.io. `digest` is keccak256(canonicalJson(bundle)) and does not cover
 * run metadata.
 *
 * {@link RUN_METADATA_VARIABLE_FIELDS} — `generatedAt`, `providers`, `sdkVersion` — and only these,
 * may legitimately differ between two honest reruns over the same range and scope. Two honest files
 * may therefore have different sha256, but they MUST have the same `digest` and byte-identical
 * `canonicalJson(bundle)`. Any other difference means one of them is wrong.
 *
 * `verifyEvidenceFile` does three steps: (i) parse, which requires canonical bytes and a digest that
 * matches the bundle; (ii) the rerun's digest equals the file's digest and `canonicalJson(rerun.bundle)`
 * equals `canonicalJson(file.bundle)`; (iii) sha256 is recomputed over the handed bytes and returned.
 * The caller compares that sha256 to the published value. A file that cannot be hashed (not a string,
 * or larger than {@link MAX_EVIDENCE_FILE_BYTES}) still returns `{ ok: false, reasons }` and the sha256
 * of the empty string. `verifyEvidenceFile` does not throw.
 *
 * The structural check used by `buildEvidenceBundle` and `parseEvidenceFile` fixes key sets, lowercase
 * hex, and action order. It does not re-run the rules. Whether `verdict` is the right verdict for
 * `record` is decided only by evaluating the ruleset again on a rerun.
 *
 * String values may contain URLs. They are data and stay in the bundle. Error text never includes them.
 *
 * Quantity fields (action and log block numbers, log indexes) are decimal numbers, so `10`, `0xa`,
 * and `0x0a` are one height. The published log is exactly
 * `{ address, topics, data, blockNumber, blockHash, transactionHash, logIndex }`.
 * `removed` is dropped: an accepted action is never removed.
 * `byPosition` orders by blockNumber, logIndex, blockHash, then txHash.
 */

export const EVIDENCE_SCHEMA = 'aastar.guardian-audit.evidence.v1' as const;

/** UTF-8 byte cap for a published evidence file. Shared by serialize, parse, sha256, and verify. */
export const MAX_EVIDENCE_FILE_BYTES = 64 * 1024 * 1024;

/** sha256('') — returned when the file cannot be hashed. Not a published identity. */
const UNHASHED_FILE_SHA256 = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as Hex;

/** Log stored on an evidence action. Quantities are decimal numbers. Hex is lowercase. No `removed`. */
export interface PublishedLog {
    address: Address;
    topics: Hex[];
    data: Hex;
    blockNumber: number;
    blockHash: Hex;
    transactionHash: Hex;
    logIndex: number;
}

export interface EvidenceAction {
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    decoded: FoundAction['decoded'];
    log: PublishedLog;
    attribution: unknown;
    record: RuleRecord;
    verdict: Verdict;
}

export interface EvidenceBundle {
    schema: typeof EVIDENCE_SCHEMA;
    chainId: number;
    scope: Hex;
    range: { from: number; to: number };
    state: 'COMPLETE' | 'UNATTRIBUTED';
    ruleset: { schema: Ruleset['schema']; digest: Hex };
    actions: EvidenceAction[];
    resolvedPrior: EvidenceAction[];
    /** Present only when `state` is UNATTRIBUTED. */
    unattributed?: number;
}

/** Not part of the keccak digest. Names only — never endpoint URLs. No other fields. */
export interface RunMetadata {
    providers: readonly [string, string];
    sdkVersion: string;
    generatedAt: string;
}

/** The only fields that may differ between two honest reruns of one range and scope. */
export const RUN_METADATA_VARIABLE_FIELDS = ['generatedAt', 'providers', 'sdkVersion'] as const;

export const EVIDENCE_FILE_SCHEMA = 'aastar.guardian-audit.evidence-file.v1' as const;

export interface EvidenceFile {
    schema: typeof EVIDENCE_FILE_SCHEMA;
    bundle: EvidenceBundle;
    digest: Hex;
    runMetadata: RunMetadata;
}

export interface EvidenceFileCheck {
    ok: boolean;
    sha256: Hex;
    reasons: string[];
}

export interface EvidenceInput {
    result: ScanResult;
    scope: Hex;
    chainId: number;
    ruleset: Ruleset;
    roles: Record<string, string>;
    classify: (action: FoundAction) => RuleRecord;
    providers: readonly [string, string];
    sdkVersion: string;
    generatedAt?: string;
}

function isRecord(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Same node budget as canonical JSON. Repeated visits of a shared reference count again. */
const MAX_COPY_NODES = 1_000_000;
const MAX_COPY_DEPTH = 32;
const MAX_COPY_KEYS = 64;
const MAX_COPY_ARRAY = 4096;
const HASH_RE = /^0x[0-9a-f]{64}$/;
const ADDR_RE = /^0x[0-9a-f]{40}$/;
const DATA_RE = /^0x[0-9a-f]*$/;
const SELECTOR_RE = /^0x[0-9a-f]{8}$/;

const FILE_KEYS = ['schema', 'bundle', 'digest', 'runMetadata'] as const;
const BUNDLE_KEYS = ['schema', 'chainId', 'scope', 'range', 'state', 'ruleset', 'actions', 'resolvedPrior'] as const;
const RANGE_KEYS = ['from', 'to'] as const;
const RULESET_KEYS = ['schema', 'digest'] as const;
const ACTION_KEYS = ['blockNumber', 'blockHash', 'txHash', 'logIndex', 'address', 'kind', 'decoded', 'log', 'attribution', 'record', 'verdict'] as const;
const LOG_KEYS = ['address', 'topics', 'data', 'blockNumber', 'blockHash', 'transactionHash', 'logIndex'] as const;
const VERDICT_KEYS = ['flagged', 'reasons', 'rule'] as const;
const RECORD_KEYS = ['route', 'kind', 'event', 'selector', 'fields', 'callEvents'] as const;
const ROUTES = ['bls', 'owner', 'public', 'unattributed'] as const;

const PUBLIC_REASONS = new Set<string>([
    'evidence file is not a string',
    'evidence file too large',
    'evidence file is not JSON',
    'evidence file is not an object',
    'evidence file: invalid key',
    'evidence file: unknown key',
    'evidence file: unknown schema',
    'evidence file is missing bundle, digest, or runMetadata',
    'evidence file is not canonical',
    'evidence digest mismatch',
    'evidence bundle is invalid',
    'evidence action is invalid',
    'evidence hash is invalid',
    'evidence actions are unsorted',
    'evidence log is invalid',
    'evidence address is invalid',
    'evidence scope is invalid',
    'evidence range is invalid',
    'evidence state is invalid',
    'evidence actions missing',
    'evidence value too large',
    'unattributed count missing',
    'complete evidence has an unattributed action',
    'runMetadata missing',
    'runMetadata: unknown key',
    'runMetadata: invalid key',
    'evidence bundle requires two provider labels',
    'provider name is not a label',
    'provider names must differ',
    'sdkVersion must be a string',
    'generatedAt must be a string',
]);

interface CopyBudget { n: number }

function assertLabel(name: string): void {
    if (typeof name !== 'string' || name.length > 64 || !PROVIDER_NAME_RE.test(name)) throw new Error('provider name is not a label');
}

function boundedText(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('://') && !/[\r\n]/.test(value);
}

function readOwn(value: object, key: string): unknown {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc === undefined) return undefined;
    if ('value' in desc) return desc.value;
    if (typeof desc.get === 'function') return desc.get.call(value);
    return undefined;
}

function ownKeyList(obj: object, cap: number, message: string): string[] {
    const keys: string[] = [];
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        keys.push(key);
        if (keys.length > cap) throw new Error(message);
    }
    return keys;
}

/** `allowed` is the exact set. A missing or extra key throws `message` and does not quote the key. */
function exactKeys(obj: object, allowed: readonly string[], message: string): void {
    const keys = ownKeyList(obj, allowed.length, message);
    if (keys.length !== allowed.length) throw new Error(message);
    for (const key of keys) {
        if (!allowed.includes(key)) throw new Error(message);
    }
}

function allowKeys(obj: object, allowed: readonly string[], required: readonly string[], cap: number, message: string): void {
    const keys = ownKeyList(obj, cap, message);
    for (const key of keys) {
        if (!allowed.includes(key)) throw new Error(message);
    }
    for (const key of required) {
        if (!keys.includes(key)) throw new Error(message);
    }
}

/** True when `text` is more than {@link MAX_EVIDENCE_FILE_BYTES} UTF-8 bytes. Stops early. */
function exceedsFileBytes(text: string): boolean {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c <= 0x7f) bytes += 1;
        else if (c <= 0x7ff) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            bytes += 4;
            i += 1;
        } else bytes += 3;
        if (bytes > MAX_EVIDENCE_FILE_BYTES) return true;
    }
    return false;
}

function assertEvidenceBytes(text: string): void {
    if (exceedsFileBytes(text)) throw new Error('evidence file too large');
}

/** Exactly the variable fields. An extra key is not a rerun difference; it is a different file. */
function assertRunMetadata(meta: unknown): RunMetadata {
    if (!isRecord(meta)) throw new Error('runMetadata missing');
    let seenKeys = 0;
    for (const key in meta) {
        if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
        seenKeys += 1;
        if (seenKeys > 8) throw new Error('runMetadata: invalid key');
        if (!(RUN_METADATA_VARIABLE_FIELDS as readonly string[]).includes(key)) {
            if (key.length > 64 || key.includes('://') || /[\r\n]/.test(key)) throw new Error('runMetadata: invalid key');
            throw new Error('runMetadata: unknown key');
        }
    }
    const providers = meta.providers;
    if (!Array.isArray(providers) || providers.length !== 2) throw new Error('evidence bundle requires two provider labels');
    assertLabel(providers[0]);
    assertLabel(providers[1]);
    if (providers[0] === providers[1]) throw new Error('provider names must differ');
    if (!boundedText(meta.sdkVersion, 64)) throw new Error('sdkVersion must be a string');
    if (!boundedText(meta.generatedAt, 64)) throw new Error('generatedAt must be a string');
    return { providers: [providers[0], providers[1]], sdkVersion: meta.sdkVersion, generatedAt: meta.generatedAt };
}

/**
 * Plain copy. One budget for the whole bundle: every visit counts, including a repeated visit of a
 * shared acyclic reference, and the budget is checked before descending. The seen set is the path,
 * so a DAG is copied again and a cycle still throws. Objects are null-prototype; an own `__proto__`
 * key is defined, not assigned.
 */
function copyPlain(value: unknown, seen: Set<object>, depth: number, budget: CopyBudget): unknown {
    budget.n += 1;
    if (budget.n > MAX_COPY_NODES) throw new Error('evidence value too large');
    if (typeof value === 'string') {
        if (value.length > 1_048_576) throw new Error('evidence value too large');
        return value;
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'bigint') return value;
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value)) throw new Error('evidence number must be a safe integer');
        return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== 'object') throw new Error('evidence value unsupported');
    if (seen.has(value)) throw new Error('evidence value cycle');
    if (depth > MAX_COPY_DEPTH) throw new Error('evidence value too deep');
    if (Array.isArray(value)) {
        if (value.length > MAX_COPY_ARRAY) throw new Error('evidence value too large');
        seen.add(value);
        const out = new Array<unknown>(value.length);
        for (let i = 0; i < value.length; i++) {
            const item = readOwn(value, String(i));
            if (item === undefined) throw new Error('evidence value unsupported');
            out[i] = copyPlain(item, seen, depth + 1, budget);
        }
        seen.delete(value);
        return out;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error('evidence value unsupported');
    const keys: string[] = [];
    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        keys.push(key);
        if (keys.length > MAX_COPY_KEYS) throw new Error('evidence value too large');
    }
    seen.add(value);
    const out = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
        if (key.length > 128 || key.includes('://') || /[\r\n]/.test(key)) throw new Error('evidence value unsupported');
        const child = readOwn(value, key);
        if (child === undefined) continue;
        Object.defineProperty(out, key, {
            value: copyPlain(child, seen, depth + 1, budget),
            enumerable: true,
            writable: true,
            configurable: true,
        });
    }
    seen.delete(value);
    return out;
}

function evidenceAddress(value: unknown): Address {
    if (typeof value !== 'string' || value.length !== 42) throw new Error('evidence address is invalid');
    try {
        return getAddress(value as Address).toLowerCase() as Address;
    } catch {
        throw new Error('evidence address is invalid');
    }
}

function evidenceWord(value: unknown): Hex {
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/i.test(value)) throw new Error('evidence hash is invalid');
    return value.toLowerCase() as Hex;
}

function quantityNumber(value: unknown): number {
    if (typeof value === 'bigint') {
        if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('evidence log is invalid');
        return Number(value);
    }
    const normalized = typeof value === 'string' && /^0x/i.test(value) ? `0x${value.slice(2)}` : value;
    const n = quantity(normalized);
    if (n === null) throw new Error('evidence log is invalid');
    return n;
}

/** Fresh 7-field log. Extra fields and `removed` are dropped. Quantities are decimal numbers. */
function normalizeLog(log: unknown): PublishedLog {
    if (!isRecord(log)) throw new Error('evidence log is invalid');
    if (typeof log.data !== 'string' || log.data.length > 1_048_576 || !/^0x[0-9a-fA-F]*$/i.test(log.data)) {
        throw new Error('evidence log is invalid');
    }
    if (!Array.isArray(log.topics) || log.topics.length > 8) throw new Error('evidence log is invalid');
    const topics: Hex[] = [];
    for (const topic of log.topics) topics.push(evidenceWord(topic));
    return {
        address: evidenceAddress(log.address),
        topics,
        data: log.data.toLowerCase() as Hex,
        blockNumber: quantityNumber(log.blockNumber),
        blockHash: evidenceWord(log.blockHash),
        transactionHash: evidenceWord(log.transactionHash),
        logIndex: quantityNumber(log.logIndex),
    };
}

/** blockNumber, logIndex, blockHash, then txHash. Hashes are already lowercase. */
function byPosition(a: EvidenceAction, b: EvidenceAction): number {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
    if (a.blockHash < b.blockHash) return -1;
    if (a.blockHash > b.blockHash) return 1;
    if (a.txHash < b.txHash) return -1;
    if (a.txHash > b.txHash) return 1;
    return 0;
}

function pack(
    actions: readonly FoundAction[],
    classify: (action: FoundAction) => RuleRecord,
    ruleset: Ruleset,
    roles: Record<string, string>,
    requireAttribution: boolean,
    budget: CopyBudget,
): EvidenceAction[] {
    if (actions.length > 100_000) throw new Error('evidence value too large');
    const out: EvidenceAction[] = [];
    for (const action of actions.slice()) {
        if (!isRecord(action)) throw new Error('evidence action is invalid');
        if (requireAttribution && (action.attribution === undefined || action.attribution === null)) {
            throw new Error('complete scan has an unattributed action');
        }
        const blockNumber = action.blockNumber;
        const logIndex = action.logIndex;
        if (typeof blockNumber !== 'number' || !Number.isSafeInteger(blockNumber) || blockNumber < 0
            || typeof logIndex !== 'number' || !Number.isSafeInteger(logIndex) || logIndex < 0) {
            throw new Error('evidence action is invalid');
        }
        if (typeof action.kind !== 'string' || action.kind.length === 0 || action.kind.length > 64
            || action.kind.includes('://') || /[\r\n]/.test(action.kind)) {
            throw new Error('evidence action is invalid');
        }
        const log = normalizeLog(action.log);
        let record: RuleRecord;
        try {
            record = classify(action);
        } catch {
            throw new Error('classify failed');
        }
        const seen = new Set<object>();
        const recordCopy = copyPlain(record, seen, 0, budget) as RuleRecord;
        out.push({
            blockNumber,
            blockHash: evidenceWord(action.blockHash),
            txHash: evidenceWord(action.txHash),
            logIndex,
            address: evidenceAddress(action.address),
            kind: action.kind,
            decoded: copyPlain(action.decoded, seen, 0, budget) as FoundAction['decoded'],
            log,
            attribution: action.attribution === undefined ? null : copyPlain(action.attribution, seen, 0, budget),
            record: recordCopy,
            verdict: evaluate(ruleset, roles, recordCopy),
        });
    }
    out.sort(byPosition);
    return out;
}

function assertHash(value: unknown): void {
    if (typeof value !== 'string' || !HASH_RE.test(value)) throw new Error('evidence hash is invalid');
}

function assertAddress(value: unknown): void {
    if (typeof value !== 'string' || !ADDR_RE.test(value)) throw new Error('evidence address is invalid');
}

function assertSafeCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function assertVerdict(verdict: unknown): void {
    if (!isRecord(verdict)) throw new Error('evidence action is invalid');
    exactKeys(verdict, VERDICT_KEYS, 'evidence action is invalid');
    if (typeof verdict.flagged !== 'boolean') throw new Error('evidence action is invalid');
    if (typeof verdict.rule !== 'string' || verdict.rule.length === 0 || verdict.rule.length > 512 || /[\r\n]/.test(verdict.rule)) {
        throw new Error('evidence action is invalid');
    }
    if (!Array.isArray(verdict.reasons) || verdict.reasons.length > 8) throw new Error('evidence action is invalid');
    for (const reason of verdict.reasons) {
        if (typeof reason !== 'string' || reason.length > 4096 || /[\r\n]/.test(reason)) throw new Error('evidence action is invalid');
    }
}

function assertRecord(record: unknown): void {
    if (!isRecord(record)) throw new Error('evidence action is invalid');
    allowKeys(record, RECORD_KEYS, ['route'], MAX_COPY_KEYS, 'evidence action is invalid');
    if (!(ROUTES as readonly string[]).includes(record.route)) throw new Error('evidence action is invalid');
    if (record.selector !== undefined && (typeof record.selector !== 'string' || !SELECTOR_RE.test(record.selector))) {
        throw new Error('evidence action is invalid');
    }
    if (record.callEvents !== undefined) {
        if (!Array.isArray(record.callEvents) || record.callEvents.length > MAX_COPY_KEYS) throw new Error('evidence action is invalid');
        for (const name of record.callEvents) {
            if (typeof name !== 'string' || name.length === 0 || name.length > 128) throw new Error('evidence action is invalid');
        }
    }
    if (record.fields !== undefined && !isRecord(record.fields)) throw new Error('evidence action is invalid');
    if (record.kind !== undefined && (typeof record.kind !== 'string' || record.kind.length > 64)) {
        throw new Error('evidence action is invalid');
    }
    if (record.event !== undefined && (typeof record.event !== 'string' || record.event.length > 128)) {
        throw new Error('evidence action is invalid');
    }
}

function assertPublishedLog(log: unknown): void {
    if (!isRecord(log)) throw new Error('evidence log is invalid');
    exactKeys(log, LOG_KEYS, 'evidence log is invalid');
    assertAddress(log.address);
    assertHash(log.blockHash);
    assertHash(log.transactionHash);
    if (typeof log.data !== 'string' || log.data.length > 1_048_576 || !DATA_RE.test(log.data)) throw new Error('evidence log is invalid');
    if (!Array.isArray(log.topics) || log.topics.length > 8) throw new Error('evidence log is invalid');
    for (const topic of log.topics) assertHash(topic);
    if (!assertSafeCount(log.blockNumber) || !assertSafeCount(log.logIndex)) throw new Error('evidence log is invalid');
}

function assertAction(action: unknown, requireAttribution: boolean): EvidenceAction {
    if (!isRecord(action)) throw new Error('evidence action is invalid');
    exactKeys(action, ACTION_KEYS, 'evidence action is invalid');
    if (!assertSafeCount(action.blockNumber) || !assertSafeCount(action.logIndex)) throw new Error('evidence action is invalid');
    assertHash(action.blockHash);
    assertHash(action.txHash);
    assertAddress(action.address);
    if (typeof action.kind !== 'string' || action.kind.length === 0 || action.kind.length > 64) {
        throw new Error('evidence action is invalid');
    }
    if (!isRecord(action.decoded)) throw new Error('evidence action is invalid');
    assertPublishedLog(action.log);
    if (requireAttribution && (action.attribution === null || action.attribution === undefined)) {
        throw new Error('complete evidence has an unattributed action');
    }
    if (action.attribution !== null && !isRecord(action.attribution)) throw new Error('evidence action is invalid');
    assertRecord(action.record);
    assertVerdict(action.verdict);
    return action as EvidenceAction;
}

function assertSorted(actions: EvidenceAction[]): void {
    for (let i = 1; i < actions.length; i++) {
        if (byPosition(actions[i - 1]!, actions[i]!) > 0) throw new Error('evidence actions are unsorted');
    }
}

function assertPublished(bundle: EvidenceBundle): void {
    if (!isRecord(bundle)) throw new Error('evidence bundle is invalid');
    if (bundle.schema !== EVIDENCE_SCHEMA) throw new Error('evidence file: unknown schema');
    if (bundle.state !== 'COMPLETE' && bundle.state !== 'UNATTRIBUTED') throw new Error('evidence state is invalid');
    const top = bundle.state === 'UNATTRIBUTED' ? [...BUNDLE_KEYS, 'unattributed'] : BUNDLE_KEYS;
    exactKeys(bundle, top, 'evidence bundle is invalid');
    if (typeof bundle.chainId !== 'number' || !Number.isSafeInteger(bundle.chainId) || bundle.chainId <= 0) {
        throw new Error('evidence chainId is invalid');
    }
    if (typeof bundle.scope !== 'string' || !HASH_RE.test(bundle.scope)) throw new Error('evidence scope is invalid');
    const range = bundle.range;
    if (!isRecord(range)) throw new Error('evidence range is invalid');
    exactKeys(range, RANGE_KEYS, 'evidence range is invalid');
    if (!assertSafeCount(range.from) || !assertSafeCount(range.to)) throw new Error('evidence range is invalid');
    if (!isRecord(bundle.ruleset)) throw new Error('evidence bundle is invalid');
    exactKeys(bundle.ruleset, RULESET_KEYS, 'evidence bundle is invalid');
    if (bundle.ruleset.schema !== RULESET_SCHEMA || typeof bundle.ruleset.digest !== 'string' || !HASH_RE.test(bundle.ruleset.digest)) {
        throw new Error('evidence bundle is invalid');
    }
    if (!Array.isArray(bundle.actions) || !Array.isArray(bundle.resolvedPrior)
        || bundle.actions.length > 100_000 || bundle.resolvedPrior.length > 100_000) {
        throw new Error('evidence actions missing');
    }
    if (bundle.actions.length + bundle.resolvedPrior.length > 100_000) throw new Error('evidence value too large');
    const requireAttribution = bundle.state === 'COMPLETE';
    for (const action of bundle.actions) assertAction(action, requireAttribution);
    for (const action of bundle.resolvedPrior) assertAction(action, requireAttribution);
    assertSorted(bundle.actions as EvidenceAction[]);
    assertSorted(bundle.resolvedPrior as EvidenceAction[]);
    if (bundle.state === 'UNATTRIBUTED' && !assertSafeCount(bundle.unattributed)) throw new Error('unattributed count missing');
}

/**
 * Evidence for a COMPLETE or UNATTRIBUTED scan. An INCOMPLETE scan has no evidence.
 * `digest` is keccak256(canonicalJson(bundle)). `runMetadata` is returned beside it and is not hashed.
 */
export function buildEvidenceBundle(input: EvidenceInput): { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata } {
    if (!isRecord(input)) throw new Error('evidence input is invalid');
    const { result } = input;
    if (!isRecord(result)) throw new Error('evidence state is invalid');
    if (result.state === 'INCOMPLETE') throw new Error('incomplete scan has no evidence');
    if (result.state !== 'COMPLETE' && result.state !== 'UNATTRIBUTED') throw new Error('evidence state is invalid');
    if (typeof input.chainId !== 'number' || !Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
        throw new Error('evidence chainId is invalid');
    }
    if (typeof input.scope !== 'string' || !/^0x[0-9a-fA-F]{64}$/i.test(input.scope)) {
        throw new Error('evidence scope is invalid');
    }
    if (typeof result.from !== 'number' || typeof result.to !== 'number'
        || !Number.isSafeInteger(result.from) || !Number.isSafeInteger(result.to) || result.from < 0 || result.to < 0) {
        throw new Error('evidence range is invalid');
    }
    if (!Array.isArray(result.actions) || !Array.isArray(result.resolvedPrior)) throw new Error('evidence actions missing');
    if (typeof result.count !== 'number' || result.count !== result.actions.length) {
        throw new Error('evidence count does not match actions');
    }
    if (result.state === 'UNATTRIBUTED'
        && (typeof result.unattributed !== 'number' || !Number.isSafeInteger(result.unattributed) || result.unattributed < 0)) {
        throw new Error('unattributed count missing');
    }
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const runMetadata = assertRunMetadata({
        providers: input.providers,
        sdkVersion: input.sdkVersion,
        generatedAt,
    });
    let ruleset: Ruleset;
    let roles: Record<string, string>;
    try {
        ruleset = structuredClone(input.ruleset);
        roles = structuredClone(input.roles);
    } catch {
        throw new Error('ruleset: unsupported value');
    }
    if (!isRecord(roles)) throw new Error('roles missing');
    const id = rulesetId(ruleset);
    const budget: CopyBudget = { n: 0 };
    const bundle: EvidenceBundle = {
        schema: EVIDENCE_SCHEMA,
        chainId: input.chainId,
        scope: input.scope.toLowerCase() as Hex,
        range: { from: result.from, to: result.to },
        state: result.state,
        ruleset: id,
        actions: pack(result.actions, input.classify, ruleset, roles, result.state === 'COMPLETE', budget),
        resolvedPrior: pack(result.resolvedPrior, input.classify, ruleset, roles, result.state === 'COMPLETE', budget),
    };
    if (result.state === 'UNATTRIBUTED') bundle.unattributed = result.unattributed;
    assertPublished(bundle);
    return { bundle, digest: canonicalDigest(bundle), runMetadata };
}

/** Recompute the bundle digest. A throw while canonicalising is a mismatch. */
export function verifyEvidenceBundle(bundle: EvidenceBundle, digest: Hex): boolean {
    try {
        return canonicalDigest(bundle) === digest;
    } catch {
        return false;
    }
}

/**
 * Canonical JSON of the file envelope, then exactly one newline.
 * This UTF-8 string is what gets committed. `runMetadata` is inside the file and outside `digest`.
 * Refuses a file over {@link MAX_EVIDENCE_FILE_BYTES}.
 */
export function serializeEvidenceFile(parts: { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata }): string {
    if (!isRecord(parts) || !isRecord(parts.bundle) || typeof parts.digest !== 'string') {
        throw new Error('evidence file is missing bundle, digest, or runMetadata');
    }
    assertPublished(parts.bundle as EvidenceBundle);
    const runMetadata = assertRunMetadata(parts.runMetadata);
    const text = canonicalJson({
        schema: EVIDENCE_FILE_SCHEMA,
        bundle: parts.bundle,
        digest: parts.digest,
        runMetadata,
    }) + '\n';
    assertEvidenceBytes(text);
    return text;
}

/** sha256 of the UTF-8 bytes of the file text, when it fits in {@link MAX_EVIDENCE_FILE_BYTES}. */
export function evidenceFileSha256(fileText: string): Hex {
    if (typeof fileText !== 'string') throw new Error('evidence file is not a string');
    assertEvidenceBytes(fileText);
    return sha256(stringToBytes(fileText));
}

function publicReason(e: unknown): string {
    const message = e instanceof Error ? e.message : '';
    if (PUBLIC_REASONS.has(message)) return message;
    return 'evidence file rejected';
}

/**
 * Accept only the exact bytes `serializeEvidenceFile` would emit, and only when `digest` matches the bundle.
 * Pretty-printing, a missing trailing newline, reordered keys, and extra keys all throw.
 */
export function parseEvidenceFile(text: string): EvidenceFile {
    if (typeof text !== 'string') throw new Error('evidence file is not a string');
    assertEvidenceBytes(text);
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('evidence file is not JSON');
    }
    if (!isRecord(parsed)) throw new Error('evidence file is not an object');
    let seenKeys = 0;
    for (const key in parsed) {
        if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
        seenKeys += 1;
        if (seenKeys > 8) throw new Error('evidence file: invalid key');
        if (!(FILE_KEYS as readonly string[]).includes(key)) {
            if (key.length > 64 || key.includes('://') || /[\r\n]/.test(key)) throw new Error('evidence file: invalid key');
            throw new Error('evidence file: unknown key');
        }
    }
    if (parsed.schema !== EVIDENCE_FILE_SCHEMA) throw new Error('evidence file: unknown schema');
    if (!isRecord(parsed.bundle) || typeof parsed.digest !== 'string' || !isRecord(parsed.runMetadata)) {
        throw new Error('evidence file is missing bundle, digest, or runMetadata');
    }
    const parts = { bundle: parsed.bundle as EvidenceBundle, digest: parsed.digest as Hex, runMetadata: parsed.runMetadata as RunMetadata };
    if (serializeEvidenceFile(parts) !== text) throw new Error('evidence file is not canonical');
    if (!verifyEvidenceBundle(parts.bundle, parts.digest)) throw new Error('evidence digest mismatch');
    return { schema: EVIDENCE_FILE_SCHEMA, ...parts, runMetadata: assertRunMetadata(parts.runMetadata) };
}

/**
 * Verifier procedure:
 * (i) parse — canonical encoding, structural bundle, and digest self-consistency;
 * (ii) the rerun's digest equals the file's digest, and canonicalJson(rerun.bundle) equals canonicalJson(file.bundle);
 * (iii) sha256 is recomputed over the handed bytes and returned. The caller compares it to the published value.
 * Never throws. Reasons are drawn from a fixed set; anything else is `evidence file rejected`.
 */
export function verifyEvidenceFile(fileText: string, rerun: { bundle: EvidenceBundle; digest: Hex }): EvidenceFileCheck {
    let fileSha: Hex;
    try {
        fileSha = evidenceFileSha256(fileText);
    } catch (e) {
        return { ok: false, sha256: UNHASHED_FILE_SHA256, reasons: [publicReason(e)] };
    }
    const reasons: string[] = [];
    let parsed: EvidenceFile | null = null;
    try {
        parsed = parseEvidenceFile(fileText);
    } catch (e) {
        reasons.push(publicReason(e));
    }
    if (parsed) {
        if (!isRecord(rerun) || typeof rerun.digest !== 'string' || !isRecord(rerun.bundle)) {
            reasons.push('rerun bundle missing');
        } else {
            try {
                if (rerun.digest !== parsed.digest) reasons.push('rerun digest differs from the file digest');
                if (canonicalJson(rerun.bundle) !== canonicalJson(parsed.bundle)) reasons.push('rerun bundle differs from the file bundle');
            } catch {
                reasons.push('rerun bundle differs from the file bundle');
            }
        }
    }
    return { ok: reasons.length === 0, sha256: fileSha, reasons };
}
