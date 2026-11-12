import { sha256, stringToBytes, type Address, type Hex } from 'viem';
import { canonicalDigest, canonicalJson } from './canonical.js';
import { evaluate, rulesetId, type RuleRecord, type Ruleset, type Verdict } from './rules.js';
import { PROVIDER_NAME_RE, type RawLog } from './rpc.js';
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

function assertLabel(name: string): void {
    if (typeof name !== 'string' || !PROVIDER_NAME_RE.test(name)) throw new Error('provider name is not a label');
}

/** Exactly the variable fields. An extra key is not a rerun difference; it is a different file. */
function assertRunMetadata(meta: unknown): RunMetadata {
    if (!isRecord(meta)) throw new Error('runMetadata missing');
    for (const key of Object.keys(meta)) {
        if (!(RUN_METADATA_VARIABLE_FIELDS as readonly string[]).includes(key)) {
            throw new Error(`runMetadata: unknown key ${key}`);
        }
    }
    const providers = meta.providers;
    if (!Array.isArray(providers) || providers.length !== 2) throw new Error('evidence bundle requires two provider labels');
    assertLabel(providers[0]);
    assertLabel(providers[1]);
    if (providers[0] === providers[1]) throw new Error('provider names must differ');
    if (typeof meta.sdkVersion !== 'string') throw new Error('sdkVersion must be a string');
    if (typeof meta.generatedAt !== 'string') throw new Error('generatedAt must be a string');
    return { providers: [providers[0], providers[1]], sdkVersion: meta.sdkVersion, generatedAt: meta.generatedAt };
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
): EvidenceAction[] {
    const out: EvidenceAction[] = [];
    for (const action of actions) {
        const record = classify(action);
        out.push({
            blockNumber: action.blockNumber,
            blockHash: action.blockHash,
            txHash: action.txHash,
            logIndex: action.logIndex,
            address: action.address,
            kind: action.kind,
            decoded: action.decoded,
            log: action.log,
            attribution: action.attribution === undefined ? null : action.attribution,
            record,
            verdict: evaluate(ruleset, roles, record),
        });
    }
    out.sort(byPosition);
    return out;
}

/**
 * Evidence for a COMPLETE or UNATTRIBUTED scan. An INCOMPLETE scan has no evidence.
 * `digest` is keccak256(canonicalJson(bundle)). `runMetadata` is returned beside it and is not hashed.
 */
export function buildEvidenceBundle(input: EvidenceInput): { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata } {
    const { result } = input;
    if (result.state === 'INCOMPLETE') throw new Error('incomplete scan has no evidence');
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const runMetadata = assertRunMetadata({
        providers: input.providers,
        sdkVersion: input.sdkVersion,
        generatedAt,
    });

    const ruleset = rulesetId(input.ruleset);
    const bundle: EvidenceBundle = {
        schema: EVIDENCE_SCHEMA,
        chainId: input.chainId,
        scope: input.scope,
        range: { from: result.from, to: result.to },
        state: result.state,
        ruleset,
        actions: pack(result.actions, input.classify, input.ruleset, input.roles),
        resolvedPrior: pack(result.resolvedPrior, input.classify, input.ruleset, input.roles),
    };
    if (result.state === 'UNATTRIBUTED') bundle.unattributed = result.unattributed;
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
    return sha256(stringToBytes(fileText));
}

/**
 * Accept only the exact bytes `serializeEvidenceFile` would emit, and only when `digest` matches the bundle.
 * Pretty-printing, a missing trailing newline, reordered keys, and extra keys all throw.
 */
export function parseEvidenceFile(text: string): EvidenceFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('evidence file is not JSON');
    }
    if (!isRecord(parsed)) throw new Error('evidence file is not an object');
    for (const key of Object.keys(parsed)) {
        if (!(FILE_KEYS as readonly string[]).includes(key)) throw new Error(`evidence file: unknown key ${key}`);
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
        reasons.push(e instanceof Error ? e.message : 'evidence file rejected');
    }
    if (parsed) {
        if (rerun.digest !== parsed.digest) reasons.push('rerun digest differs from the file digest');
        if (canonicalJson(rerun.bundle) !== canonicalJson(parsed.bundle)) reasons.push('rerun bundle differs from the file bundle');
    }
    return { ok: reasons.length === 0, sha256: fileSha, reasons };
}
