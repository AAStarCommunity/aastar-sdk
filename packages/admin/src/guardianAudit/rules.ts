import { getAddress, toFunctionSelector, type Hex } from 'viem';
import { canonicalDigest } from './canonical.js';

/**
 * Pure rule evaluation. No I/O: the same record and ruleset always give the same verdict,
 * so a flag can be re-derived from the pinned ruleset digest after the fact.
 * Ported from the DVT guardian-watcher evaluator. Selectors use viem `toFunctionSelector`
 * (keccak256 of the signature, first 4 bytes), the same bytes as `ethers.id(sig).slice(0, 10)`.
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

function only(obj: Record<string, any>, allowed: readonly string[], where: string): void {
    for (const key of Object.keys(obj)) {
        if (!allowed.includes(key)) throw new Error(`ruleset: unknown key ${where}.${key}`);
    }
}

/** Validate a parsed ruleset; throws on a shape the evaluator would silently misread. Unknown keys throw at every level. */
export function validateRuleset(rs: unknown): Ruleset {
    if (!isRecord(rs) || rs.schema !== RULESET_SCHEMA) throw new Error('ruleset: unknown schema');
    for (const key of Object.keys(rs)) {
        if (!TOP_LEVEL.has(key)) throw new Error(`ruleset: unknown key ${key}`);
    }
    if (!isRecord(rs.source)) throw new Error('ruleset: source missing');
    only(rs.source, SOURCE_KEYS, 'source');
    for (const key of SOURCE_KEYS) {
        if (typeof rs.source[key] !== 'string') throw new Error(`ruleset: source.${key} missing`);
    }
    if (!isRecord(rs.bls)) throw new Error('ruleset: bls.SLASH missing');
    only(rs.bls, BLS_KEYS, 'bls');
    for (const kind of [...KINDS, 'UNRECOVERED']) {
        if (!isRecord(rs.bls[kind])) throw new Error(`ruleset: bls.${kind} missing`);
    }
    for (const kind of ['SLASH', 'REPUTATION', 'QUEUE', 'UNRECOVERED'] as const) {
        only(rs.bls[kind], FLAG_KEYS, `bls.${kind}`);
    }
    only(rs.bls.GENERIC, GENERIC_KEYS, 'bls.GENERIC');
    if (!Array.isArray(rs.bls.GENERIC.expected) || !isRecord(rs.bls.GENERIC.unexpected)) {
        throw new Error('ruleset: bls.GENERIC.expected / unexpected missing');
    }
    only(rs.bls.GENERIC.unexpected, FLAG_KEYS, 'bls.GENERIC.unexpected');
    for (const e of rs.bls.GENERIC.expected) {
        if (!isRecord(e) || typeof e.target !== 'string' || typeof e.signature !== 'string') {
            throw new Error('ruleset: GENERIC.expected entries need target (role) and signature');
        }
        only(e, EXPECTED_KEYS, 'bls.GENERIC.expected');
    }
    if (!isRecord(rs.ownerRoute) || typeof rs.ownerRoute.label !== 'string' || !isRecord(rs.ownerRoute.events)) {
        throw new Error('ruleset: ownerRoute missing');
    }
    only(rs.ownerRoute, OWNER_KEYS, 'ownerRoute');
    for (const [name, event] of Object.entries(rs.ownerRoute.events)) {
        if (!isRecord(event)) throw new Error(`ruleset: ownerRoute.events.${name} invalid`);
        only(event, OWNER_EVENT_KEYS, `ownerRoute.events.${name}`);
    }
    const pr = rs.publicRoute;
    if (!isRecord(pr) || typeof pr.label !== 'string' || !isRecord(pr.functions) || !isRecord(pr.unattributed)) {
        throw new Error('ruleset: publicRoute missing');
    }
    only(pr, PUBLIC_KEYS, 'publicRoute');
    only(pr.unattributed, FLAG_KEYS, 'publicRoute.unattributed');
    for (const [sig, f] of Object.entries(pr.functions)) {
        if (!isRecord(f) || !Array.isArray(f.events) || typeof f.reason !== 'string') {
            throw new Error(`ruleset: publicRoute.functions.${sig} needs events and reason`);
        }
        only(f, PUBLIC_FN_KEYS, `publicRoute.functions.${sig}`);
        if (f.flagIfCallAlsoEmits && typeof f.alsoReason !== 'string') {
            throw new Error(`ruleset: publicRoute.functions.${sig}.alsoReason missing`);
        }
    }
    return rs as Ruleset;
}

/** `{ schema, digest }` of a validated ruleset. The digest covers every rule string. */
export function rulesetId(rs: Ruleset): { schema: typeof RULESET_SCHEMA; digest: Hex } {
    const valid = validateRuleset(rs);
    return { schema: valid.schema, digest: canonicalDigest(valid) };
}

/** The expected-set entry a GENERIC call matches, by target role address and selector, or null. */
export function matchGeneric(
    rs: Ruleset, roles: Record<string, string>, target: unknown, callData: unknown,
): GenericExpected | null {
    const sel = typeof callData === 'string' && callData.length >= 10 ? callData.slice(0, 10).toLowerCase() : null;
    for (const e of rs.bls.GENERIC.expected) {
        const addr = roles[e.target];
        if (!addr || !target) continue;
        if (getAddress(addr) !== getAddress(target as `0x${string}`)) continue;
        if (sel !== null && toFunctionSelector(e.signature) === sel) return e;
    }
    return null;
}

/** The publicRoute entry whose selector is `selector`, as [signature, entry], or null. */
export function publicFunction(rs: Ruleset, selector: unknown): [string, PublicFunctionRule] | null {
    if (typeof selector !== 'string') return null;
    const want = selector.toLowerCase();
    for (const [sig, f] of Object.entries(rs.publicRoute.functions)) {
        if (toFunctionSelector(sig) === want) return [sig, f];
    }
    return null;
}

/** Events that some permissionless function can emit: their caller decides the route. */
export function ambiguousEvents(rs: Ruleset): Set<string> {
    return new Set(Object.values(rs.publicRoute.functions).flatMap((f) => f.events));
}

/**
 * Verdict for one record: `{ flagged, reasons, rule }`.
 * `route` is `bls` (kind omitted when the message was not authenticated), `owner`, `public`, or `unattributed`.
 */
export function evaluate(rs: Ruleset, roles: Record<string, string>, record: RuleRecord): Verdict {
    if (record.route === 'public') {
        const pf = publicFunction(rs, record.selector);
        if (!pf) {
            return {
                flagged: true,
                reasons: ['public route without a listed function'],
                rule: 'publicRoute.unlisted',
            };
        }
        const [sig, f] = pf;
        const also = (f.flagIfCallAlsoEmits ?? []).filter((e) => (record.callEvents ?? []).includes(e));
        if (also.length) {
            return {
                flagged: true,
                reasons: [`${f.alsoReason}: ${also.join(', ')}`],
                rule: `publicRoute.functions.${sig}.also`,
            };
        }
        return {
            flagged: !!f.flag,
            reasons: [`${rs.publicRoute.label}: ${sig}: ${f.reason}`],
            rule: `publicRoute.functions.${sig}`,
        };
    }
    if (record.route === 'unattributed') {
        const u = rs.publicRoute.unattributed;
        return {
            flagged: !!u.flag,
            reasons: [`${u.reason}: ${record.event}`],
            rule: 'publicRoute.unattributed',
        };
    }
    if (record.route === 'owner') {
        const event = record.event ?? '';
        const r = rs.ownerRoute.events[event];
        if (!r) {
            return {
                flagged: true,
                reasons: [`unlisted SuperPaymaster event ${record.event}`],
                rule: 'ownerRoute.unlisted',
            };
        }
        return {
            flagged: !!r.flag,
            reasons: [`${rs.ownerRoute.label}: ${event}`],
            rule: `ownerRoute.events.${event}`,
        };
    }
    if (record.kind === undefined) {
        const r = rs.bls.UNRECOVERED;
        return { flagged: !!r.flag, reasons: [r.reason], rule: 'bls.UNRECOVERED' };
    }
    if (record.kind === 'GENERIC') {
        const e = matchGeneric(rs, roles, record.fields?.target, record.fields?.callData);
        if (e) {
            return {
                flagged: !!e.flag,
                reasons: [e.reason],
                rule: `bls.GENERIC.expected:${e.target}.${e.signature}`,
            };
        }
        const u = rs.bls.GENERIC.unexpected;
        return { flagged: !!u.flag, reasons: [u.reason], rule: 'bls.GENERIC.unexpected' };
    }
    const table = rs.bls as unknown as Record<string, FlagReason | undefined>;
    const r = table[record.kind];
    if (!r || typeof r.reason !== 'string') {
        return { flagged: true, reasons: [`unknown kind ${record.kind}`], rule: 'bls.unknown' };
    }
    return { flagged: !!r.flag, reasons: [r.reason], rule: `bls.${record.kind}` };
}

/** Whether this record wants prices read before/after (price-update rules). */
export function wantsPrice(rs: Ruleset, roles: Record<string, string>, record: RuleRecord): boolean {
    if (record.route === 'public') return !!publicFunction(rs, record.selector)?.[1].readPrice;
    if (record.route === 'owner' || record.route === 'unattributed') {
        return !!rs.ownerRoute.events[record.event ?? '']?.readPrice;
    }
    if (record.kind !== 'GENERIC') return false;
    return !!matchGeneric(rs, roles, record.fields?.target, record.fields?.callData)?.readPrice;
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
