import { getAddress, sha256, stringToBytes, type Address, type Hex } from 'viem';
import { canonicalDigest, canonicalJson } from './canonical.js';
import { evaluate, rulesetId, type RuleRecord, type Ruleset, type Verdict } from './rules.js';
import { isWord, PROVIDER_NAME_RE, type RawLog } from './rpc.js';
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
 * The caller compares that sha256 to the published value.
 */

export const EVIDENCE_SCHEMA = 'aastar.guardian-audit.evidence.v1' as const;

export interface EvidenceAction {
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    decoded: FoundAction['decoded'];
    log: RawLog;
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

const MAX_FILE_CHARS = 2_000_000;
const MAX_COPY_DEPTH = 32;
const MAX_COPY_KEYS = 64;
const MAX_COPY_ARRAY = 4096;

function assertLabel(name: string): void {
    if (typeof name !== 'string' || name.length > 64 || !PROVIDER_NAME_RE.test(name)) throw new Error('provider name is not a label');
}

function boundedText(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('://') && !/[\r\n]/.test(value);
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
            throw new Error(`runMetadata: unknown key ${key}`);
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

function copyPlain(value: unknown, seen: Set<object>, depth: number): unknown {
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
        const out = value.map((item) => {
            if (item === undefined) throw new Error('evidence value unsupported');
            return copyPlain(item, seen, depth + 1);
        });
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
    const out: Record<string, unknown> = {};
    for (const key of keys) {
        if (key.length > 128 || key.includes('://') || /[\r\n]/.test(key)) throw new Error('evidence value unsupported');
        const child = (value as Record<string, unknown>)[key];
        if (child === undefined) continue;
        out[key] = copyPlain(child, seen, depth + 1);
    }
    seen.delete(value);
    return out;
}

function evidenceAddress(value: unknown): Address {
    if (typeof value !== 'string' || value.length !== 42) throw new Error('evidence address is invalid');
    try {
        return getAddress(value as Address);
    } catch {
        throw new Error('evidence address is invalid');
    }
}

function evidenceWord(value: unknown): Hex {
    if (typeof value !== 'string' || value.length !== 66 || !isWord(value)) throw new Error('evidence hash is invalid');
    return value as Hex;
}

function assertLog(log: unknown): void {
    if (!isRecord(log)) throw new Error('evidence log is invalid');
    for (const key of ['address', 'data', 'blockNumber', 'blockHash', 'transactionHash', 'logIndex'] as const) {
        if (typeof log[key] !== 'string' || log[key].length === 0 || log[key].length > 1_048_576) {
            throw new Error('evidence log is invalid');
        }
    }
    if (!Array.isArray(log.topics) || log.topics.length > 8) throw new Error('evidence log is invalid');
    for (const topic of log.topics) {
        if (typeof topic !== 'string' || topic.length !== 66 || !isWord(topic)) throw new Error('evidence log is invalid');
    }
    if ('removed' in log && typeof log.removed !== 'boolean') throw new Error('evidence log is invalid');
}

function byPosition(a: EvidenceAction, b: EvidenceAction): number {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    if (a.logIndex !== b.logIndex) return a.logIndex - b.logIndex;
    const at = a.txHash.toLowerCase();
    const bt = b.txHash.toLowerCase();
    if (at < bt) return -1;
    if (at > bt) return 1;
    return 0;
}

function pack(
    actions: readonly FoundAction[],
    classify: (action: FoundAction) => RuleRecord,
    ruleset: Ruleset,
    roles: Record<string, string>,
    requireAttribution: boolean,
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
        if (typeof action.kind !== 'string' || action.kind.length === 0 || action.kind.length > 64 || action.kind.includes('://')) {
            throw new Error('evidence action is invalid');
        }
        assertLog(action.log);
        let record: RuleRecord;
        try {
            record = classify(action);
        } catch {
            throw new Error('classify failed');
        }
        const seen = new Set<object>();
        out.push({
            blockNumber,
            blockHash: evidenceWord(action.blockHash),
            txHash: evidenceWord(action.txHash),
            logIndex,
            address: evidenceAddress(action.address),
            kind: action.kind,
            decoded: copyPlain(action.decoded, seen, 0) as FoundAction['decoded'],
            log: copyPlain(action.log, seen, 0) as RawLog,
            attribution: action.attribution === undefined ? null : copyPlain(action.attribution, seen, 0),
            record: copyPlain(record, seen, 0) as RuleRecord,
            verdict: evaluate(ruleset, roles, record),
        });
    }
    out.sort(byPosition);
    return out;
}

function assertPublished(bundle: EvidenceBundle): void {
    if (bundle.schema !== EVIDENCE_SCHEMA) throw new Error('evidence file: unknown schema');
    if (typeof bundle.chainId !== 'number' || !Number.isSafeInteger(bundle.chainId) || bundle.chainId <= 0) {
        throw new Error('evidence chainId is invalid');
    }
    if (typeof bundle.scope !== 'string' || bundle.scope.length !== 66 || !isWord(bundle.scope)) {
        throw new Error('evidence scope is invalid');
    }
    const range = bundle.range;
    if (!isRecord(range) || typeof range.from !== 'number' || typeof range.to !== 'number'
        || !Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 0 || range.to < 0) {
        throw new Error('evidence range is invalid');
    }
    if (!Array.isArray(bundle.actions) || !Array.isArray(bundle.resolvedPrior)
        || bundle.actions.length > 100_000 || bundle.resolvedPrior.length > 100_000) {
        throw new Error('evidence actions missing');
    }
    const rows = bundle.actions.length + bundle.resolvedPrior.length;
    if (rows > 100_000) throw new Error('evidence value too large');
    const requireAttribution = bundle.state === 'COMPLETE';
    for (const action of bundle.actions.concat(bundle.resolvedPrior)) {
        if (!isRecord(action)) throw new Error('evidence action is invalid');
        if (requireAttribution && (action.attribution === null || action.attribution === undefined)) {
            throw new Error('complete evidence has an unattributed action');
        }
        if (typeof action.blockNumber !== 'number' || !Number.isSafeInteger(action.blockNumber)
            || typeof action.logIndex !== 'number' || !Number.isSafeInteger(action.logIndex)) {
            throw new Error('evidence action is invalid');
        }
        if (typeof action.blockHash !== 'string' || action.blockHash.length !== 66
            || typeof action.txHash !== 'string' || action.txHash.length !== 66) {
            throw new Error('evidence hash is invalid');
        }
        if (typeof action.address !== 'string' || action.address.length !== 42) throw new Error('evidence address is invalid');
        if (!isRecord(action.log) || typeof action.log.data !== 'string') throw new Error('evidence log is invalid');
        if (!isRecord(action.record) || !isRecord(action.verdict) || typeof action.verdict.flagged !== 'boolean'
            || !Array.isArray(action.verdict.reasons)) {
            throw new Error('evidence action is invalid');
        }
    }
    if (bundle.state === 'COMPLETE') {
        if ('unattributed' in bundle) throw new Error('evidence state is invalid');
        return;
    }
    if (bundle.state === 'UNATTRIBUTED') {
        if (typeof bundle.unattributed !== 'number' || !Number.isSafeInteger(bundle.unattributed) || bundle.unattributed < 0) {
            throw new Error('unattributed count missing');
        }
        return;
    }
    throw new Error('evidence state is invalid');
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
    if (typeof input.scope !== 'string' || input.scope.length !== 66 || !isWord(input.scope)) {
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
    const bundle: EvidenceBundle = {
        schema: EVIDENCE_SCHEMA,
        chainId: input.chainId,
        scope: input.scope,
        range: { from: result.from, to: result.to },
        state: result.state,
        ruleset: id,
        actions: pack(result.actions, input.classify, ruleset, roles, result.state === 'COMPLETE'),
        resolvedPrior: pack(result.resolvedPrior, input.classify, ruleset, roles, result.state === 'COMPLETE'),
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

const FILE_KEYS = ['schema', 'bundle', 'digest', 'runMetadata'] as const;

/**
 * Canonical JSON of the file envelope, then exactly one newline.
 * This UTF-8 string is what gets committed. `runMetadata` is inside the file and outside `digest`.
 */
export function serializeEvidenceFile(parts: { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata }): string {
    if (!isRecord(parts) || !isRecord(parts.bundle) || typeof parts.digest !== 'string') {
        throw new Error('evidence file is missing bundle, digest, or runMetadata');
    }
    assertPublished(parts.bundle as EvidenceBundle);
    const runMetadata = assertRunMetadata(parts.runMetadata);
    return canonicalJson({
        schema: EVIDENCE_FILE_SCHEMA,
        bundle: parts.bundle,
        digest: parts.digest,
        runMetadata,
    }) + '\n';
}

/** sha256 of the UTF-8 bytes of the file text. This is the published identity. */
export function evidenceFileSha256(fileText: string): Hex {
    if (typeof fileText !== 'string') throw new Error('evidence file is not a string');
    if (fileText.length > MAX_FILE_CHARS) throw new Error('evidence file too large');
    return sha256(stringToBytes(fileText));
}

function publicReason(e: unknown): string {
    const message = e instanceof Error ? e.message : '';
    if (message.length === 0 || message.length > 240 || message.includes('://') || message.includes('\n')) {
        return 'evidence file rejected';
    }
    return message;
}

/**
 * Accept only the exact bytes `serializeEvidenceFile` would emit, and only when `digest` matches the bundle.
 * Pretty-printing, a missing trailing newline, reordered keys, and extra keys all throw.
 */
export function parseEvidenceFile(text: string): EvidenceFile {
    if (typeof text !== 'string') throw new Error('evidence file is not a string');
    if (text.length > MAX_FILE_CHARS) throw new Error('evidence file too large');
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
            throw new Error(`evidence file: unknown key ${key}`);
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
 * (i) parse — canonical encoding and digest self-consistency;
 * (ii) the rerun's digest equals the file's digest, and canonicalJson(rerun.bundle) equals canonicalJson(file.bundle);
 * (iii) sha256 is recomputed over the handed bytes and returned. The caller compares it to the published value.
 */
export function verifyEvidenceFile(fileText: string, rerun: { bundle: EvidenceBundle; digest: Hex }): EvidenceFileCheck {
    const fileSha = evidenceFileSha256(fileText);
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
