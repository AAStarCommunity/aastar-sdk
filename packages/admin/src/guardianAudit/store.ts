import type { Address, Hex } from 'viem';
import { isolatedClone } from './isolated.js';
import type { RawLog } from './rpc.js';

export interface Checkpoint { block: number; hash: Hex }

/**
 * A header both providers linked by parentHash to a header they reported as finalized (FU-100).
 * `scope` is the store scope of the scan that verified it. It hashes the chain id, so an anchor never
 * crosses chains or watch sets. A scan rereads the anchor height on both providers before it relies on it.
 */
export interface FinalizedAnchor { scope: Hex; block: number; hash: Hex }

const ANCHOR_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Thrown when `commit` sees a revision other than `expectedRevision`. Nothing is written.
 * The checkpoint value is not the concurrency token: caught-up commits leave it unchanged
 * and still advance the revision.
 */
export class StoreConflictError extends Error {
    constructor(message = 'store conflict') {
        super(message);
        this.name = 'StoreConflictError';
    }
}

/** Old name. Same class as StoreConflictError. */
export const CheckpointConflictError = StoreConflictError;

/**
 * Thrown when a scan's watched scope does not match the scope recorded by the first commit.
 * A changed watch set needs a new store (a backfill), never a silent resume.
 * Nothing is written.
 */
export class ScopeChangedError extends Error {
    constructor(message = 'a changed watch set needs a new store (a backfill), never a silent resume') {
        super(message);
        this.name = 'ScopeChangedError';
    }
}

/** id is `${blockHash}:${logIndex}` in lower case. */
export interface UnresolvedAction {
    id: string;
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    reason: string;
    log: RawLog;
}

/** An accepted action. Idempotent by id. */
export interface AttributedAction {
    id: string;
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    decoded: { kind: string; [k: string]: unknown };
    log: RawLog;
    attribution: unknown;
}

/**
 * One all-or-nothing write. `next: null` leaves the cursor where it is (a caught-up scan)
 * but still checks `expectedRevision`, applies the action changes, and advances the revision.
 * On StoreConflictError or ScopeChangedError the store applies nothing.
 * `scope` is recorded by the first commit and must be echoed after that.
 */
export interface Commit {
    expectedRevision: number;
    next: Checkpoint | null;
    scope: Hex;
    attributed: AttributedAction[];
    unresolved: UnresolvedAction[];
    resolve: string[];
    /**
     * Optional anchor cache. Absent: anchors stay as they are. Present: the full replacement set,
     * written in the same atomic write. An anchor whose scope is not `scope` rejects the whole commit
     * with ScopeChangedError. The scanner sends it only to a store whose snapshot has `anchors`.
     */
    anchors?: FinalizedAnchor[];
}

/** One consistent read. `revision` is the token `commit` must echo. `scope` is null until the first commit. */
export interface StoreSnapshot {
    revision: number;
    checkpoint: Checkpoint | null;
    scope: Hex | null;
    unresolved: UnresolvedAction[];
    attributed: AttributedAction[];
    /**
     * Stored anchors, `[]` when there are none. Undefined means the store has no anchor cache:
     * the scanner then walks to finalized on every scan, as before FU-100, and never writes on INCOMPLETE.
     */
    anchors?: FinalizedAnchor[];
}

/**
 * Injected persistence. Reads return copies; callbacks must not be able to mutate stored rows.
 * Row arrays have no required order. Compare them by id. The anchor cache (`anchors` on the snapshot
 * and the commit) is optional; see FinalizedAnchor and docs/agent/design/guardian-audit-d2-recovery.md.
 * Implementers run `runStoreConformance` (storeConformance.ts) against a fresh store and pass every check.
 */
export interface GuardianAuditStore {
    snapshot(): Promise<StoreSnapshot>;
    getCheckpoint(): Promise<Checkpoint | null>;
    listUnresolved(): Promise<UnresolvedAction[]>;
    listAttributed(): Promise<AttributedAction[]>;
    commit(change: Commit): Promise<void>;
}

export function unresolvedId(blockHash: string, logIndex: number): string {
    return `${blockHash}:${logIndex}`.toLowerCase();
}

function copy<T>(value: T): T {
    return isolatedClone(value);
}

/**
 * `faultHook` adds `commitSteps` and `crashDuringNextCommit`.
 * This store publishes one atomic write, so `commitSteps()` is 1.
 * A crash armed at any step in `0..commitSteps()` throws before that write is visible.
 */
export function memoryStore(options?: { faultHook?: boolean }): GuardianAuditStore & {
    crashDuringNextCommit?: (step: number) => void;
    commitSteps?: () => number;
} {
    let revision = 0;
    let scope: Hex | null = null;
    let checkpoint: Checkpoint | null = null;
    let open = new Map<string, UnresolvedAction>();
    let attributed = new Map<string, AttributedAction>();
    let anchors: FinalizedAnchor[] = [];
    let crashAt: number | null = null;
    const store: GuardianAuditStore & {
        crashDuringNextCommit?: (step: number) => void;
        commitSteps?: () => number;
    } = {
        async snapshot() {
            return {
                revision,
                checkpoint: checkpoint ? copy(checkpoint) : null,
                scope,
                unresolved: [...open.values()].map((item) => copy(item)),
                attributed: [...attributed.values()].map((item) => copy(item)),
                anchors: anchors.map((item) => copy(item)),
            };
        },
        async getCheckpoint() {
            return checkpoint ? copy(checkpoint) : null;
        },
        async listUnresolved() { return [...open.values()].map((item) => copy(item)); },
        async listAttributed() { return [...attributed.values()].map((item) => copy(item)); },
        async commit(input) {
            // Materialize the whole payload first: caller getters run here, so a reentrant commit
            // lands before the revision check below and this one then conflicts (#445 Codex M2).
            const change = copy(input);
            if (change.expectedRevision !== revision) throw new StoreConflictError();
            const nextScope = change.scope.toLowerCase() as Hex;
            if (scope !== null && nextScope !== scope) throw new ScopeChangedError();
            let nextAnchors = anchors;
            if (change.anchors !== undefined) {
                if (!Array.isArray(change.anchors)) throw new TypeError('anchors must be an array');
                nextAnchors = change.anchors.map((item) => {
                    if (typeof item?.scope !== 'string' || item.scope.toLowerCase() !== nextScope) throw new ScopeChangedError();
                    if (!Number.isSafeInteger(item.block) || item.block < 0) throw new TypeError('anchor block must be a safe non-negative integer');
                    if (typeof item.hash !== 'string' || !ANCHOR_HASH_RE.test(item.hash)) throw new TypeError('anchor hash must be 32 bytes');
                    return { scope: nextScope, block: item.block, hash: item.hash.toLowerCase() as Hex };
                });
            }
            const nextOpen = new Map(open);
            const nextAttributed = new Map(attributed);
            for (const item of change.attributed) {
                const id = item.id.toLowerCase();
                nextAttributed.set(id, copy({ ...item, id }));
            }
            for (const item of change.unresolved) {
                const id = item.id.toLowerCase();
                nextOpen.set(id, copy({ ...item, id }));
            }
            for (const id of change.resolve) nextOpen.delete(id.toLowerCase());
            if (crashAt !== null) {
                crashAt = null;
                throw new Error('memory store crash');
            }
            open = nextOpen;
            attributed = nextAttributed;
            anchors = nextAnchors;
            if (change.next) checkpoint = { block: change.next.block, hash: change.next.hash };
            scope = nextScope;
            revision++;
        },
    };
    if (options?.faultHook) {
        store.commitSteps = () => 1;
        store.crashDuringNextCommit = (step) => { crashAt = step; };
    }
    return store;
}
