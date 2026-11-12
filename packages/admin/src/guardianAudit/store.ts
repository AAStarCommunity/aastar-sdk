import type { Address, Hex } from 'viem';
import type { RawLog } from './rpc.js';

export interface Checkpoint { block: number; hash: Hex }

/** Thrown when `commit` sees a cursor other than `expected`. Nothing is written. */
export class CheckpointConflictError extends Error {
    constructor(message = 'checkpoint conflict') {
        super(message);
        this.name = 'CheckpointConflictError';
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
 * One all-or-nothing write. `next: null` leaves the cursor put (a caught-up scan)
 * but still checks `expected` and applies the action changes.
 * The store must apply the whole value atomically: on CheckpointConflictError, apply nothing.
 */
export interface Commit {
    expected: Checkpoint | null;
    next: Checkpoint | null;
    attributed: AttributedAction[];
    unresolved: UnresolvedAction[];
    resolve: string[];
}

/** Injected persistence. Reads return copies; callbacks must not be able to mutate stored rows. */
export interface GuardianAuditStore {
    getCheckpoint(): Promise<Checkpoint | null>;
    listUnresolved(): Promise<UnresolvedAction[]>;
    listAttributed(): Promise<AttributedAction[]>;
    commit(change: Commit): Promise<void>;
}

export function unresolvedId(blockHash: string, logIndex: number): string {
    return `${blockHash}:${logIndex}`.toLowerCase();
}

function sameCursor(a: Checkpoint | null, b: Checkpoint | null): boolean {
    if (a === null || b === null) return a === b;
    return a.block === b.block && a.hash.toLowerCase() === b.hash.toLowerCase();
}

function copy<T>(value: T): T {
    return structuredClone(value);
}

export function memoryStore(): GuardianAuditStore {
    let checkpoint: Checkpoint | null = null;
    let open = new Map<string, UnresolvedAction>();
    let attributed = new Map<string, AttributedAction>();
    return {
        async getCheckpoint() {
            return checkpoint ? copy(checkpoint) : null;
        },
        async listUnresolved() { return [...open.values()].map((item) => copy(item)); },
        async listAttributed() { return [...attributed.values()].map((item) => copy(item)); },
        async commit(change) {
            if (!sameCursor(checkpoint, change.expected)) throw new CheckpointConflictError();
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
        },
    };
}
