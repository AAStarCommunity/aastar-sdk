import type { Address, Hex } from 'viem';
import { canonicalDigest } from './canonical.js';
import { evaluate, rulesetId, type RuleRecord, type Ruleset, type Verdict } from './rules.js';
import type { RawLog } from './rpc.js';
import type { FoundAction, ScanResult } from './scan.js';

/**
 * Provider labels recorded in run metadata.
 * scan.ts does not export a label regex: `RawRpc.name` is a name, never a URL, and a reason that
 * contains `://` is dropped. A label is a short token — a letter, then letters, digits, `.`, `_`, or `-`.
 * Schemes, slashes, and colons cannot match, so a URL cannot be stored.
 */
const PROVIDER_LABEL = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

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

/** Not part of the evidence digest. Names only — never endpoint URLs. */
export interface RunMetadata {
    providers: readonly [string, string];
    sdkVersion: string;
    generatedAt: string;
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

function assertLabel(name: string): void {
    if (typeof name !== 'string' || !PROVIDER_LABEL.test(name)) throw new Error('provider name is not a label');
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
    if (!input.providers || input.providers.length !== 2) throw new Error('evidence bundle requires two provider labels');
    assertLabel(input.providers[0]);
    assertLabel(input.providers[1]);
    if (typeof input.sdkVersion !== 'string') throw new Error('sdkVersion must be a string');
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    if (typeof generatedAt !== 'string') throw new Error('generatedAt must be a string');

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
    const runMetadata: RunMetadata = {
        providers: [input.providers[0], input.providers[1]],
        sdkVersion: input.sdkVersion,
        generatedAt,
    };
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
