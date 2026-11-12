import type { Address, Hex } from 'viem';
import type { RawLog } from './rpc.js';

export interface Checkpoint { block: number; hash: Hex }

/** Thrown when `setCheckpoint` sees a cursor other than `expected`. The cursor stays put. */
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

/** An accepted action, durable before its unresolved row is removed. Idempotent by id. */
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
 * Injected persistence. `putUnresolved` and `putAttributed` are idempotent by id.
 * `setCheckpoint` must be atomic: commit `next` only when the stored checkpoint
 * still equals `expected` (block and hash, case-insensitive). Otherwise throw
 * CheckpointConflictError and leave the cursor unchanged.
 */
export interface GuardianAuditStore {
    getCheckpoint(): Promise<Checkpoint | null>;
    setCheckpoint(next: Checkpoint, expected: Checkpoint | null): Promise<void>;
    putUnresolved(items: UnresolvedAction[]): Promise<void>;
    listUnresolved(): Promise<UnresolvedAction[]>;
    resolveUnresolved(id: string): Promise<void>;
    putAttributed(items: AttributedAction[]): Promise<void>;
    listAttributed(): Promise<AttributedAction[]>;
}

export function unresolvedId(blockHash: string, logIndex: number): string {
    return `${blockHash}:${logIndex}`.toLowerCase();
}

function sameCursor(a: Checkpoint | null, b: Checkpoint | null): boolean {
    if (a === null || b === null) return a === b;
    return a.block === b.block && a.hash.toLowerCase() === b.hash.toLowerCase();
}

export function memoryStore(): GuardianAuditStore {
    let checkpoint: Checkpoint | null = null;
    const open = new Map<string, UnresolvedAction>();
    const attributed = new Map<string, AttributedAction>();
    return {
        async getCheckpoint() {
            return checkpoint ? { block: checkpoint.block, hash: checkpoint.hash } : null;
        },
        async setCheckpoint(next, expected) {
            if (!sameCursor(checkpoint, expected)) throw new CheckpointConflictError();
            checkpoint = { block: next.block, hash: next.hash };
        },
        async putUnresolved(items) { for (const item of items) open.set(item.id.toLowerCase(), item); },
        async listUnresolved() { return [...open.values()]; },
        async resolveUnresolved(id) { open.delete(id.toLowerCase()); },
        async putAttributed(items) {
            for (const item of items) attributed.set(item.id.toLowerCase(), { ...item, id: item.id.toLowerCase() });
        },
        async listAttributed() { return [...attributed.values()].map((item) => ({ ...item })); },
    };
}
