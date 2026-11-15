import { keccak256, stringToBytes, type Hex } from 'viem';
import { ambiguousEvents, publicFunction, SYMBOL_RE, type RuleRecord, type Ruleset } from './rules.js';

/**
 * Reference classifier and the event check every classifier is held to.
 *
 * Port of DVT `services/guardian-watcher/lib/scan.mjs` (commit 8a7cda74, the owner/public split at
 * :1355-1402), adapted to one bundle at a time:
 * - An event no permissionless function emits is the owner route, whoever called (Codex #400-fix R3 H1).
 * - An ambiguous event is classified only by the SP call that emitted it, taken from the trace
 *   attribution. No usable frame means `unattributed`. The root tx selector is never used for it.
 * - On the public route `callEvents` is the distinct events emitted by the same SP call, in log order.
 *   The SP call is identified by its forwarding path, so two sibling calls with the same path are
 *   merged. Merging only adds events, so it can add a flag and cannot remove one.
 * - `callEvents` sees only actions in this bundle. A decoder that returns `'ignore'` for an SP event
 *   hides that event from `callEvents`.
 * - A BLS action is `{ route: 'bls' }`, with `kind` and `fields` copied from the decoded action when
 *   the decoder recovered them. Without a recovered kind the verdict is `bls.UNRECOVERED` (flagged).
 *   Recovering the message is the decoder's job and is trusted the same way `'ignore'` is.
 *
 * Decoded shapes this classifier reads (decoder contract):
 * - SP / Registry event: `{ kind: 'event', event: <name>, signature: '<Name>(<types>)', ... }`.
 * - BLS aggregator action: `{ kind: 'bls', blsKind?: <name>, fields?: { ... } }`.
 * Any other shape throws, which `buildEvidenceBundle` reports as `classify failed`.
 *
 * Identity: {@link REFERENCE_CLASSIFIER}. The name is reserved for this code. `buildEvidenceBundle`
 * rejects a caller-supplied `classify` that claims it. The version changes whenever the records this
 * code produces change; the golden test in `reference.test.ts` fails until it does.
 */
export const REFERENCE_CLASSIFIER: Readonly<{ name: string; version: string }> = Object.freeze({
    name: 'aastar.guardian-audit.reference',
    version: '1.0.0',
});

/** `Name(types)`. Types are not parsed; a wrong type list fails the topic0 check. */
const SIGNATURE_RE = /^([A-Za-z][A-Za-z0-9_]{0,63})\(([A-Za-z0-9_,()[\]]{0,1024})\)$/;
const SELECTOR_RE = /^0x[0-9a-fA-F]{8}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HOP_TYPES = new Set(['CALL', 'DELEGATECALL', 'STATICCALL', 'CALLCODE', 'CREATE', 'CREATE2']);
const MAX_PATH = 1025;
const MAX_CALL_EVENTS = 64;

export const EVENT_MISMATCH = 'evidence record event does not match its log';

function isRecord(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * An event route names the log's own event. `decoded.signature` must hash to `topics[0]`, and its
 * name must equal `decoded.event` and `record.event`. The BLS route is not checked here.
 * Returns false on any mismatch or missing field. Never throws.
 */
export function eventMatchesLog(decoded: unknown, topics: unknown, record: unknown): boolean {
    if (!isRecord(record) || record.route === 'bls') return true;
    if (!isRecord(decoded) || !Array.isArray(topics) || topics.length === 0) return false;
    const signature = decoded.signature;
    if (typeof signature !== 'string') return false;
    const m = SIGNATURE_RE.exec(signature);
    if (!m) return false;
    const name = m[1]!;
    if (decoded.event !== name || record.event !== name) return false;
    const topic0 = topics[0];
    if (typeof topic0 !== 'string') return false;
    return keccak256(stringToBytes(signature)) === topic0.toLowerCase();
}

/** One action as the reference classifier reads it. Already structurally checked by the bundle. */
export interface ReferenceInput {
    blockNumber: number;
    logIndex: number;
    txHash: Hex;
    address: string;
    decoded: unknown;
    attribution: unknown;
}

interface Frame {
    key: string;
    selector: Hex | null;
}

/**
 * The SP call that emitted the log: the last hop that is not a DELEGATECALL or CALLCODE. Its `to`
 * must be the log address, and `emitter`, when present, must equal it too. Null on any doubt.
 */
function emittingFrame(action: ReferenceInput): Frame | null {
    const a = action.attribution;
    if (!isRecord(a)) return null;
    const path = a.forwardingPath;
    if (!Array.isArray(path) || path.length === 0 || path.length > MAX_PATH) return null;
    const address = action.address.toLowerCase();
    if (a.emitter !== undefined && (typeof a.emitter !== 'string' || a.emitter.toLowerCase() !== address)) return null;
    const hops: string[] = [];
    for (const hop of path) {
        if (!isRecord(hop) || !HOP_TYPES.has(hop.type)) return null;
        if (typeof hop.from !== 'string' || !ADDR_RE.test(hop.from)) return null;
        if (typeof hop.to !== 'string' || !ADDR_RE.test(hop.to)) return null;
        if (hop.selector !== null && (typeof hop.selector !== 'string' || !SELECTOR_RE.test(hop.selector))) return null;
        hops.push(`${hop.type}:${hop.from.toLowerCase()}:${hop.to.toLowerCase()}:${hop.selector === null ? '-' : hop.selector.toLowerCase()}`);
    }
    let i = path.length - 1;
    while (i >= 0 && (path[i].type === 'DELEGATECALL' || path[i].type === 'CALLCODE')) i -= 1;
    if (i < 0) return null;
    const entry = path[i];
    if (entry.type !== 'CALL' || entry.to.toLowerCase() !== address) return null;
    return {
        key: hops.slice(0, i + 1).join('>'),
        selector: entry.selector === null ? null : entry.selector.toLowerCase() as Hex,
    };
}

function eventName(decoded: Record<string, any>): string {
    if (typeof decoded.event !== 'string' || !SYMBOL_RE.test(decoded.event)) throw new Error('reference: event');
    return decoded.event;
}

/** One SP call: the tx and the forwarding path up to the call that entered SP. */
function groupOf(action: ReferenceInput, frame: Frame): string {
    return `${action.txHash.toLowerCase()}|${frame.key}`;
}

function byLog(a: ReferenceInput, b: ReferenceInput): number {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.logIndex - b.logIndex;
}

/**
 * Records for every action, in input order. Throws on a decoded shape it does not know.
 * Deterministic in the actions: grouping is by tx and frame, and events are read in log order.
 */
export function referenceRecords(actions: readonly ReferenceInput[], ruleset: Ruleset): RuleRecord[] {
    const amb = ambiguousEvents(ruleset);
    const frames = new Map<ReferenceInput, Frame | null>();
    const emitted = new Map<string, string[]>();
    for (const action of [...actions].sort(byLog)) {
        const decoded = action.decoded;
        if (!isRecord(decoded) || decoded.kind !== 'event') continue;
        const event = eventName(decoded);
        const frame = emittingFrame(action);
        frames.set(action, frame);
        if (!frame) continue;
        const group = groupOf(action, frame);
        const list = emitted.get(group) ?? [];
        if (!list.includes(event)) {
            if (list.length >= MAX_CALL_EVENTS) throw new Error('reference: too many events in one call');
            list.push(event);
        }
        emitted.set(group, list);
    }
    return actions.map((action) => {
        const decoded = action.decoded;
        if (!isRecord(decoded)) throw new Error('reference: decoded');
        if (decoded.kind === 'bls') {
            const rec: RuleRecord = { route: 'bls' };
            if (decoded.blsKind !== undefined) {
                if (typeof decoded.blsKind !== 'string' || !SYMBOL_RE.test(decoded.blsKind)) throw new Error('reference: blsKind');
                rec.kind = decoded.blsKind;
            }
            if (decoded.fields !== undefined) {
                if (!isRecord(decoded.fields)) throw new Error('reference: fields');
                rec.fields = decoded.fields;
            }
            return rec;
        }
        if (decoded.kind !== 'event') throw new Error('reference: decoded kind');
        const event = eventName(decoded);
        if (!amb.has(event)) return { route: 'owner', event };
        const frame = frames.get(action) ?? null;
        if (!frame || frame.selector === null) return { route: 'unattributed', event };
        const pub = publicFunction(ruleset, frame.selector);
        if (!pub) return { route: 'owner', event, selector: frame.selector };
        const callEvents = emitted.get(groupOf(action, frame)) ?? [event];
        return { route: 'public', event, selector: frame.selector, callEvents: [...callEvents] };
    });
}
