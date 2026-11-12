import type { Address, Hex } from 'viem';
import type { RawLog } from './rpc.js';

export interface Checkpoint { block: number; hash: Hex }

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
 * On StoreConflictError the store applies nothing.
 */
export interface Commit {
    expectedRevision: number;
    next: Checkpoint | null;
    attributed: AttributedAction[];
    unresolved: UnresolvedAction[];
    resolve: string[];
}

/** One consistent read. `revision` is the token `commit` must echo. */
export interface StoreSnapshot {
    revision: number;
    checkpoint: Checkpoint | null;
    unresolved: UnresolvedAction[];
    attributed: AttributedAction[];
}

/** Injected persistence. Reads return copies; callbacks must not be able to mutate stored rows. */
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
    return structuredClone(value);
}

export function memoryStore(): GuardianAuditStore {
    let revision = 0;
    let checkpoint: Checkpoint | null = null;
    let open = new Map<string, UnresolvedAction>();
    let attributed = new Map<string, AttributedAction>();
    return {
        async snapshot() {
            return {
                revision,
                checkpoint: checkpoint ? copy(checkpoint) : null,
                unresolved: [...open.values()].map((item) => copy(item)),
                attributed: [...attributed.values()].map((item) => copy(item)),
            };
        },
        async getCheckpoint() {
            return checkpoint ? copy(checkpoint) : null;
        },
        async listUnresolved() { return [...open.values()].map((item) => copy(item)); },
        async listAttributed() { return [...attributed.values()].map((item) => copy(item)); },
        async commit(change) {
            if (change.expectedRevision !== revision) throw new StoreConflictError();
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
            open = nextOpen;
            attributed = nextAttributed;
            if (change.next) checkpoint = { block: change.next.block, hash: change.next.hash };
            revision++;
        },
    };
}
