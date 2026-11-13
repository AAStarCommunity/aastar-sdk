import { getAddress, sha256, stringToBytes, type Address, type Hex } from 'viem';
import { canonicalDigest, canonicalJson, consumeCanonicalFailure, exceedsUtf8Bytes, MAX_EVIDENCE_FILE_BYTES, snapshotPlain, type SnapshotBudget } from './canonical.js';
import { SYMBOL_RE, evaluate, RULESET_SCHEMA, rulesetId, type RuleRecord, type Ruleset, type Verdict } from './rules.js';
import { PROVIDER_NAME_RE, quantity } from './rpc.js';
import type { FoundAction, ScanResult } from './scan.js';

/** Armed with a fixed string before `throw`. Catches read this, never the caught object. */
let bundleArm: string | null = null;

function raise(message: string): never {
    bundleArm = message;
    throw new Error(message);
}

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
 * The digested bundle is a function of the chain, the scope, the range, the ruleset, the roles, and
 * the chain data inside this range. Store history is not an input. An action of this range with no
 * attribution is UNATTRIBUTED. A later attribution of an earlier range is published by re-running
 * that earlier range, which produces its own bundle.
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

/** UTF-8 byte cap for a published evidence file. Shared by canonical encoding, serialize, parse, sha256, and verify. */
export { MAX_EVIDENCE_FILE_BYTES };

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
    /** Present only when `state` is UNATTRIBUTED. Count of actions in this range with no attribution. */
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

const MAX_COPY_DEPTH = 32;
const MAX_COPY_KEYS = 64;
const HASH_RE = /^0x[0-9a-f]{64}$/;
const ADDR_RE = /^0x[0-9a-f]{40}$/;
const DATA_RE = /^0x[0-9a-f]*$/;
const SELECTOR_RE = /^0x[0-9a-f]{8}$/;

const FILE_KEYS = ['schema', 'bundle', 'digest', 'runMetadata'] as const;
const BUNDLE_KEYS = ['schema', 'chainId', 'scope', 'range', 'state', 'ruleset', 'actions'] as const;
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
    'unattributed count does not match',
    'complete evidence has an unattributed action',
    'evidence action is outside the range',
    'evidence action does not match its log',
    'evidence log is removed',
    'evidence action is duplicated',
    'runMetadata missing',
    'runMetadata: unknown key',
    'runMetadata: invalid key',
    'evidence bundle requires two provider labels',
    'provider name is not a label',
    'provider names must differ',
    'sdkVersion must be a string',
    'generatedAt must be a string',
]);

function assertLabel(name: string): void {
    if (typeof name !== 'string' || name.length > 64 || !PROVIDER_NAME_RE.test(name)) raise('provider name is not a label');
}

function boundedText(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('://') && !/[\r\n]/.test(value);
}

function ownKeyList(obj: object, cap: number, message: string): string[] {
    const keys: string[] = [];
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        keys.push(key);
        if (keys.length > cap) raise(message);
    }
    return keys;
}

/** `allowed` is the exact set. A missing or extra key throws `message` and does not quote the key. */
function exactKeys(obj: object, allowed: readonly string[], message: string): void {
    const keys = ownKeyList(obj, allowed.length, message);
    if (keys.length !== allowed.length) raise(message);
    for (const key of keys) {
        if (!allowed.includes(key)) raise(message);
    }
}

function allowKeys(obj: object, allowed: readonly string[], required: readonly string[], cap: number, message: string): void {
    const keys = ownKeyList(obj, cap, message);
    for (const key of keys) {
        if (!allowed.includes(key)) raise(message);
    }
    for (const key of required) {
        if (!keys.includes(key)) raise(message);
    }
}

/** True when `text` is more than {@link MAX_EVIDENCE_FILE_BYTES} UTF-8 bytes. Stops early. */
function exceedsFileBytes(text: string): boolean {
    return exceedsUtf8Bytes(text, MAX_EVIDENCE_FILE_BYTES);
}

function assertEvidenceBytes(text: string): void {
    if (exceedsFileBytes(text)) raise('evidence file too large');
}

/** Exactly the variable fields. An extra key is not a rerun difference; it is a different file. */
function assertRunMetadata(meta: unknown): RunMetadata {
    if (!isRecord(meta)) raise('runMetadata missing');
    let seenKeys = 0;
    for (const key in meta) {
        if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
        seenKeys += 1;
        if (seenKeys > 8) raise('runMetadata: invalid key');
        if (!(RUN_METADATA_VARIABLE_FIELDS as readonly string[]).includes(key)) {
            if (key.length > 64 || key.includes('://') || /[\r\n]/.test(key)) raise('runMetadata: invalid key');
            raise('runMetadata: unknown key');
        }
    }
    const providers = meta.providers;
    if (!Array.isArray(providers) || providers.length !== 2) raise('evidence bundle requires two provider labels');
    assertLabel(providers[0]);
    assertLabel(providers[1]);
    if (providers[0] === providers[1]) raise('provider names must differ');
    if (!boundedText(meta.sdkVersion, 64)) raise('sdkVersion must be a string');
    if (!boundedText(meta.generatedAt, 64)) raise('generatedAt must be a string');
    return { providers: [providers[0], providers[1]], sdkVersion: meta.sdkVersion, generatedAt: meta.generatedAt };
}

function evidenceAddress(value: unknown): Address {
    if (typeof value !== 'string' || value.length !== 42) raise('evidence address is invalid');
    try {
        return getAddress(value as Address).toLowerCase() as Address;
    } catch {
        raise('evidence address is invalid');
    }
}

function evidenceWord(value: unknown): Hex {
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/i.test(value)) raise('evidence hash is invalid');
    return value.toLowerCase() as Hex;
}

function quantityNumber(value: unknown): number {
    if (typeof value === 'bigint') {
        if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) raise('evidence log is invalid');
        return Number(value);
    }
    const normalized = typeof value === 'string' && /^0x/i.test(value) ? `0x${value.slice(2)}` : value;
    const n = quantity(normalized);
    if (n === null) raise('evidence log is invalid');
    return n;
}

/** Fresh 7-field log. Extra fields and `removed` are dropped. Quantities are decimal numbers. */
function normalizeLog(log: unknown): PublishedLog {
    if (!isRecord(log)) raise('evidence log is invalid');
    if (typeof log.data !== 'string' || log.data.length > 1_048_576 || !/^0x[0-9a-fA-F]*$/i.test(log.data)) {
        raise('evidence log is invalid');
    }
    if (!Array.isArray(log.topics) || log.topics.length > 8) raise('evidence log is invalid');
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

interface PreparedAction {
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    decoded: FoundAction['decoded'];
    log: PublishedLog;
    attribution: unknown;
    snapshot: unknown;
}

/** Selector and 20-byte addresses are stored lowercase before the record is checked. */
function normalizeClassifier(value: unknown, depth: number): void {
    if (depth > MAX_COPY_DEPTH || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        for (const item of value) normalizeClassifier(item, depth + 1);
        return;
    }
    const rec = value as Record<string, unknown>;
    for (const key in rec) {
        if (!Object.prototype.hasOwnProperty.call(rec, key)) continue;
        const child = rec[key];
        if (key === 'selector' && typeof child === 'string' && /^0x[0-9a-fA-F]{8}$/i.test(child)) {
            rec[key] = child.toLowerCase();
            continue;
        }
        if (typeof child === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(child)) {
            rec[key] = child.toLowerCase();
            continue;
        }
        normalizeClassifier(child, depth + 1);
    }
}

function assertRoleMap(roles: unknown): Record<string, string> {
    if (!isRecord(roles)) raise('roles missing');
    for (const key in roles) {
        if (!Object.hasOwn(roles, key)) continue;
        if (!SYMBOL_RE.test(key)) raise('role name is invalid');
        const value = (roles as Record<string, unknown>)[key];
        if (typeof value !== 'string' || value.length !== 42 || !/^0x[0-9a-fA-F]{40}$/i.test(value)) {
            raise('role address is invalid');
        }
        try {
            getAddress(`0x${value.slice(2)}` as Address);
        } catch {
            raise('role address is invalid');
        }
    }
    return roles as Record<string, string>;
}

/**
 * One plain action, checked before any classifier runs.
 * `removed: true` is rejected here. The published log never carries `removed`.
 */
function prepareAction(raw: unknown, range: { from: number; to: number }, identities: Set<string>): PreparedAction {
    const snapshot = raw;
    if (!isRecord(snapshot)) raise('evidence action is invalid');
    if (!isRecord(snapshot.log)) raise('evidence log is invalid');
    if (Object.prototype.hasOwnProperty.call(snapshot.log, 'removed') && snapshot.log.removed !== false) {
        raise('evidence log is removed');
    }
    const log = normalizeLog(snapshot.log);
    const blockNumber = quantityNumber(snapshot.blockNumber);
    const logIndex = quantityNumber(snapshot.logIndex);
    const blockHash = evidenceWord(snapshot.blockHash);
    const txHash = evidenceWord(snapshot.txHash);
    const address = evidenceAddress(snapshot.address);
    if (blockNumber !== log.blockNumber || logIndex !== log.logIndex || blockHash !== log.blockHash
        || txHash !== log.transactionHash || address !== log.address) {
        raise('evidence action does not match its log');
    }
    if (blockNumber < range.from || blockNumber > range.to) raise('evidence action is outside the range');
    const identity = `${blockHash}:${logIndex}`;
    if (identities.has(identity)) raise('evidence action is duplicated');
    identities.add(identity);
    if (typeof snapshot.kind !== 'string' || snapshot.kind.length === 0 || snapshot.kind.length > 64
        || snapshot.kind.includes('://') || /[\r\n]/.test(snapshot.kind)) {
        raise('evidence action is invalid');
    }
    if (!isRecord(snapshot.decoded)) raise('evidence action is invalid');
    const attribution = snapshot.attribution === undefined ? null : snapshot.attribution;
    if (attribution !== null && !isRecord(attribution)) raise('evidence action is invalid');
    return {
        blockNumber, blockHash, txHash, logIndex, address,
        kind: snapshot.kind,
        decoded: snapshot.decoded as FoundAction['decoded'],
        log, attribution, snapshot,
    };
}

function classifyOne(
    prepared: PreparedAction,
    classify: (action: FoundAction) => RuleRecord,
    ruleset: Ruleset,
    roles: Record<string, string>,
    budget: SnapshotBudget,
): EvidenceAction {
    const arg = snapshotPlain(prepared.snapshot, budget);
    let raw: unknown;
    try {
        raw = classify(arg as FoundAction);
    } catch {
        raise('classify failed');
    }
    const record = snapshotPlain(raw, budget);
    normalizeClassifier(record, 0);
    assertRecord(record);
    return {
        blockNumber: prepared.blockNumber,
        blockHash: prepared.blockHash,
        txHash: prepared.txHash,
        logIndex: prepared.logIndex,
        address: prepared.address,
        kind: prepared.kind,
        decoded: prepared.decoded,
        log: prepared.log,
        attribution: prepared.attribution,
        record: record as RuleRecord,
        verdict: evaluate(ruleset, roles, record as RuleRecord),
    };
}

function assertHash(value: unknown): void {
    if (typeof value !== 'string' || !HASH_RE.test(value)) raise('evidence hash is invalid');
}

function assertAddress(value: unknown): void {
    if (typeof value !== 'string' || !ADDR_RE.test(value)) raise('evidence address is invalid');
}

function assertSafeCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function assertVerdict(verdict: unknown): void {
    if (!isRecord(verdict)) raise('evidence action is invalid');
    exactKeys(verdict, VERDICT_KEYS, 'evidence action is invalid');
    if (typeof verdict.flagged !== 'boolean') raise('evidence action is invalid');
    if (typeof verdict.rule !== 'string' || verdict.rule.length === 0 || verdict.rule.length > 512 || /[\r\n]/.test(verdict.rule)) {
        raise('evidence action is invalid');
    }
    if (!Array.isArray(verdict.reasons) || verdict.reasons.length > 8) raise('evidence action is invalid');
    for (const reason of verdict.reasons) {
        if (typeof reason !== 'string' || reason.length > 4096 || /[\r\n]/.test(reason)) raise('evidence action is invalid');
    }
}

function assertRecord(record: unknown): void {
    if (!isRecord(record)) raise('evidence action is invalid');
    allowKeys(record, RECORD_KEYS, ['route'], MAX_COPY_KEYS, 'evidence action is invalid');
    if (!(ROUTES as readonly string[]).includes(record.route)) raise('evidence action is invalid');
    if (record.selector !== undefined && (typeof record.selector !== 'string' || !SELECTOR_RE.test(record.selector))) {
        raise('evidence action is invalid');
    }
    if (record.callEvents !== undefined) {
        if (!Array.isArray(record.callEvents) || record.callEvents.length > MAX_COPY_KEYS) raise('evidence action is invalid');
        for (const name of record.callEvents) {
            if (typeof name !== 'string' || !SYMBOL_RE.test(name)) raise('evidence action is invalid');
        }
    }
    if (record.fields !== undefined && !isRecord(record.fields)) raise('evidence action is invalid');
    if (record.kind !== undefined && (typeof record.kind !== 'string' || !SYMBOL_RE.test(record.kind))) {
        raise('evidence action is invalid');
    }
    if (record.event !== undefined && (typeof record.event !== 'string' || !SYMBOL_RE.test(record.event))) {
        raise('evidence action is invalid');
    }
    if (record.route === 'unattributed' && (typeof record.event !== 'string' || record.event.length === 0)) {
        raise('evidence action is invalid');
    }
    if (record.route === 'public' && (typeof record.selector !== 'string' || !SELECTOR_RE.test(record.selector))) {
        raise('evidence action is invalid');
    }
}

function assertPublishedLog(log: unknown): void {
    if (!isRecord(log)) raise('evidence log is invalid');
    exactKeys(log, LOG_KEYS, 'evidence log is invalid');
    assertAddress(log.address);
    assertHash(log.blockHash);
    assertHash(log.transactionHash);
    if (typeof log.data !== 'string' || log.data.length > 1_048_576 || !DATA_RE.test(log.data)) raise('evidence log is invalid');
    if (!Array.isArray(log.topics) || log.topics.length > 8) raise('evidence log is invalid');
    for (const topic of log.topics) assertHash(topic);
    if (!assertSafeCount(log.blockNumber) || !assertSafeCount(log.logIndex)) raise('evidence log is invalid');
}

function assertAction(
    action: unknown,
    range: { from: number; to: number },
    requireAttribution: boolean,
    identities: Set<string>,
): EvidenceAction {
    if (!isRecord(action)) raise('evidence action is invalid');
    exactKeys(action, ACTION_KEYS, 'evidence action is invalid');
    if (!assertSafeCount(action.blockNumber) || !assertSafeCount(action.logIndex)) raise('evidence action is invalid');
    assertHash(action.blockHash);
    assertHash(action.txHash);
    assertAddress(action.address);
    if (typeof action.kind !== 'string' || action.kind.length === 0 || action.kind.length > 64) {
        raise('evidence action is invalid');
    }
    if (!isRecord(action.decoded)) raise('evidence action is invalid');
    assertPublishedLog(action.log);
    const log = action.log as PublishedLog;
    if (action.blockNumber !== log.blockNumber || action.logIndex !== log.logIndex
        || action.blockHash !== log.blockHash || action.txHash !== log.transactionHash
        || action.address !== log.address) {
        raise('evidence action does not match its log');
    }
    if (action.blockNumber < range.from || action.blockNumber > range.to) {
        raise('evidence action is outside the range');
    }
    const identity = `${action.blockHash}:${action.logIndex}`;
    if (identities.has(identity)) raise('evidence action is duplicated');
    identities.add(identity);
    if (requireAttribution && (action.attribution === null || action.attribution === undefined)) {
        raise('complete evidence has an unattributed action');
    }
    if (action.attribution !== null && !isRecord(action.attribution)) raise('evidence action is invalid');
    assertRecord(action.record);
    assertVerdict(action.verdict);
    return action as EvidenceAction;
}

function assertSorted(actions: EvidenceAction[]): void {
    for (let i = 1; i < actions.length; i++) {
        if (byPosition(actions[i - 1]!, actions[i]!) > 0) raise('evidence actions are unsorted');
    }
}

function assertPublished(bundle: EvidenceBundle): void {
    if (!isRecord(bundle)) raise('evidence bundle is invalid');
    if (bundle.schema !== EVIDENCE_SCHEMA) raise('evidence file: unknown schema');
    if (bundle.state !== 'COMPLETE' && bundle.state !== 'UNATTRIBUTED') raise('evidence state is invalid');
    const top = bundle.state === 'UNATTRIBUTED' ? [...BUNDLE_KEYS, 'unattributed'] : BUNDLE_KEYS;
    exactKeys(bundle, top, 'evidence bundle is invalid');
    if (typeof bundle.chainId !== 'number' || !Number.isSafeInteger(bundle.chainId) || bundle.chainId <= 0) {
        raise('evidence chainId is invalid');
    }
    if (typeof bundle.scope !== 'string' || !HASH_RE.test(bundle.scope)) raise('evidence scope is invalid');
    const range = bundle.range;
    if (!isRecord(range)) raise('evidence range is invalid');
    exactKeys(range, RANGE_KEYS, 'evidence range is invalid');
    if (!assertSafeCount(range.from) || !assertSafeCount(range.to)) raise('evidence range is invalid');
    if (!isRecord(bundle.ruleset)) raise('evidence bundle is invalid');
    exactKeys(bundle.ruleset, RULESET_KEYS, 'evidence bundle is invalid');
    if (bundle.ruleset.schema !== RULESET_SCHEMA || typeof bundle.ruleset.digest !== 'string' || !HASH_RE.test(bundle.ruleset.digest)) {
        raise('evidence bundle is invalid');
    }
    if (!Array.isArray(bundle.actions) || bundle.actions.length > 100_000) raise('evidence actions missing');
    const requireAttribution = bundle.state === 'COMPLETE';
    const identities = new Set<string>();
    let missing = 0;
    for (const action of bundle.actions) {
        const published = assertAction(action, range as { from: number; to: number }, requireAttribution, identities);
        if (published.attribution == null) missing += 1;
    }
    assertSorted(bundle.actions as EvidenceAction[]);
    if (bundle.state === 'UNATTRIBUTED') {
        if (!assertSafeCount(bundle.unattributed)) raise('unattributed count missing');
        if (missing === 0 || bundle.unattributed !== missing) raise('unattributed count does not match');
    } else if (missing !== 0) {
        raise('complete evidence has an unattributed action');
    }
}

/**
 * Evidence for a COMPLETE or UNATTRIBUTED scan. An INCOMPLETE scan has no evidence.
 * `digest` is keccak256(canonicalJson(bundle)). `runMetadata` is returned beside it and is not hashed.
 * State comes from this range's actions: any action here without attribution is UNATTRIBUTED.
 * `result.resolvedPrior` and `result.unattributed` are not read.
 */
export function buildEvidenceBundle(input: EvidenceInput): { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata } {
    const budget: SnapshotBudget = { nodes: 0, bytes: 0 };
    const snap = snapshotPlain(input, budget);
    if (!isRecord(snap)) raise('evidence input is invalid');
    const result = snap.result;
    if (!isRecord(result)) raise('evidence state is invalid');
    const state = result.state;
    if (state === 'INCOMPLETE') raise('incomplete scan has no evidence');
    if (state !== 'COMPLETE' && state !== 'UNATTRIBUTED') raise('evidence state is invalid');
    const chainId = snap.chainId;
    if (typeof chainId !== 'number' || !Number.isSafeInteger(chainId) || chainId <= 0) {
        raise('evidence chainId is invalid');
    }
    const scope = snap.scope;
    if (typeof scope !== 'string' || !/^0x[0-9a-fA-F]{64}$/i.test(scope)) {
        raise('evidence scope is invalid');
    }
    const from = result.from;
    const to = result.to;
    if (typeof from !== 'number' || typeof to !== 'number'
        || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < 0) {
        raise('evidence range is invalid');
    }
    const actions = result.actions;
    if (!Array.isArray(actions)) raise('evidence actions missing');
    const actionCount = actions.length;
    if (actionCount > 100_000) raise('evidence value too large');
    const count = result.count;
    if (typeof count !== 'number' || count !== actionCount) raise('evidence count does not match actions');
    const classify = snap.classify;
    if (typeof classify !== 'function') raise('classify is not a function');
    const generatedAtRaw = snap.generatedAt;
    const runMetadata = assertRunMetadata({
        providers: snap.providers,
        sdkVersion: snap.sdkVersion,
        generatedAt: generatedAtRaw === undefined ? new Date().toISOString() : generatedAtRaw,
    });
    const roles = assertRoleMap(snap.roles);
    const ruleset = snap.ruleset as Ruleset;
    const id = rulesetId(ruleset);
    const range = { from, to };
    const identities = new Set<string>();
    const prepared = actions.map((raw) => prepareAction(raw, range, identities));
    let missing = 0;
    for (const item of prepared) {
        if (item.attribution === null) missing += 1;
    }
    const publishedState = missing > 0 ? 'UNATTRIBUTED' : 'COMPLETE';
    const recordBudget: SnapshotBudget = { nodes: 0, bytes: 0 };
    const packed = prepared.map((item) => classifyOne(item, classify as EvidenceInput['classify'], ruleset, roles, recordBudget));
    packed.sort(byPosition);
    const bundle: EvidenceBundle = {
        schema: EVIDENCE_SCHEMA,
        chainId,
        scope: scope.toLowerCase() as Hex,
        range,
        state: publishedState,
        ruleset: id,
        actions: packed,
    };
    if (publishedState === 'UNATTRIBUTED') bundle.unattributed = missing;
    assertPublished(bundle);
    return { bundle, digest: canonicalDigest(bundle), runMetadata };
}

/** Recompute the bundle digest. A throw while canonicalising is a mismatch. */
export function verifyEvidenceBundle(bundle: EvidenceBundle, digest: Hex): boolean {
    try {
        const budget: SnapshotBudget = { nodes: 0, bytes: 0 };
        const snapBundle = snapshotPlain(bundle, budget);
        const snapDigest = snapshotPlain(digest, budget);
        return canonicalDigest(snapBundle) === snapDigest;
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
    const snap = snapshotPlain(parts, { nodes: 0, bytes: 0 });
    if (!isRecord(snap) || !isRecord(snap.bundle) || typeof snap.digest !== 'string') {
        raise('evidence file is missing bundle, digest, or runMetadata');
    }
    assertPublished(snap.bundle as EvidenceBundle);
    const runMetadata = assertRunMetadata(snap.runMetadata);
    let body: string;
    try {
        body = canonicalJson({
            schema: EVIDENCE_FILE_SCHEMA,
            bundle: snap.bundle,
            digest: snap.digest,
            runMetadata,
        });
    } catch {
        const message = consumeCanonicalFailure();
        if (message === 'canonical: output too large') raise('evidence file too large');
        raise(message);
    }
    const text = `${body}\n`;
    assertEvidenceBytes(text);
    return text;
}

/** sha256 of the UTF-8 bytes of the file text, when it fits in {@link MAX_EVIDENCE_FILE_BYTES}. */
export function evidenceFileSha256(fileText: string): Hex {
    if (typeof fileText !== 'string') raise('evidence file is not a string');
    assertEvidenceBytes(fileText);
    return sha256(stringToBytes(fileText));
}

function publicReason(): string {
    const message = bundleArm;
    bundleArm = null;
    consumeCanonicalFailure();
    if (message !== null && PUBLIC_REASONS.has(message)) return message;
    return 'evidence file rejected';
}

/**
 * Accept only the exact bytes `serializeEvidenceFile` would emit, and only when `digest` matches the bundle.
 * Pretty-printing, a missing trailing newline, reordered keys, and extra keys all throw.
 */
export function parseEvidenceFile(text: string): EvidenceFile {
    if (typeof text !== 'string') raise('evidence file is not a string');
    assertEvidenceBytes(text);
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        raise('evidence file is not JSON');
    }
    if (!isRecord(parsed)) raise('evidence file is not an object');
    let seenKeys = 0;
    for (const key in parsed) {
        if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
        seenKeys += 1;
        if (seenKeys > 8) raise('evidence file: invalid key');
        if (!(FILE_KEYS as readonly string[]).includes(key)) {
            if (key.length > 64 || key.includes('://') || /[\r\n]/.test(key)) raise('evidence file: invalid key');
            raise('evidence file: unknown key');
        }
    }
    if (parsed.schema !== EVIDENCE_FILE_SCHEMA) raise('evidence file: unknown schema');
    if (!isRecord(parsed.bundle) || typeof parsed.digest !== 'string' || !isRecord(parsed.runMetadata)) {
        raise('evidence file is missing bundle, digest, or runMetadata');
    }
    const parts = { bundle: parsed.bundle as EvidenceBundle, digest: parsed.digest as Hex, runMetadata: parsed.runMetadata as RunMetadata };
    if (serializeEvidenceFile(parts) !== text) raise('evidence file is not canonical');
    if (!verifyEvidenceBundle(parts.bundle, parts.digest)) raise('evidence digest mismatch');
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
    bundleArm = null;
    consumeCanonicalFailure();
    let fileSha: Hex = UNHASHED_FILE_SHA256;
    try {
        try {
            fileSha = evidenceFileSha256(fileText);
        } catch {
            return { ok: false, sha256: UNHASHED_FILE_SHA256, reasons: [publicReason()] };
        }
        const reasons: string[] = [];
        let parsed: EvidenceFile | null = null;
        try {
            parsed = parseEvidenceFile(fileText);
        } catch {
            reasons.push(publicReason());
        }
        if (parsed) {
            const safeRerun = snapshotPlain(rerun, { nodes: 0, bytes: 0 });
            if (!isRecord(safeRerun) || typeof safeRerun.digest !== 'string' || !isRecord(safeRerun.bundle)) {
                reasons.push('rerun bundle missing');
            } else {
                try {
                    if (safeRerun.digest !== parsed.digest) reasons.push('rerun digest differs from the file digest');
                    if (canonicalJson(safeRerun.bundle) !== canonicalJson(parsed.bundle)) reasons.push('rerun bundle differs from the file bundle');
                } catch {
                    reasons.push('rerun bundle differs from the file bundle');
                }
            }
        }
        return { ok: reasons.length === 0, sha256: fileSha, reasons };
    } catch {
        return { ok: false, sha256: fileSha, reasons: [publicReason()] };
    }
}
