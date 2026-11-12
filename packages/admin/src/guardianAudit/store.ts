import type { Address, Hex } from 'viem';
import type { RawLog } from './rpc.js';

export interface Checkpoint { block: number; hash: Hex }

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

/** Injected persistence (IndexedDB, files, or memory). `putUnresolved` is idempotent by id. */
export interface GuardianAuditStore {
    getCheckpoint(): Promise<Checkpoint | null>;
    setCheckpoint(cp: Checkpoint): Promise<void>;
    putUnresolved(items: UnresolvedAction[]): Promise<void>;
    listUnresolved(): Promise<UnresolvedAction[]>;
    resolveUnresolved(id: string): Promise<void>;
}

export function unresolvedId(blockHash: string, logIndex: number): string {
    return `${blockHash}:${logIndex}`.toLowerCase();
}

export function memoryStore(): GuardianAuditStore {
    let checkpoint: Checkpoint | null = null;
    const open = new Map<string, UnresolvedAction>();
    return {
        async getCheckpoint() {
            return checkpoint ? { block: checkpoint.block, hash: checkpoint.hash } : null;
        },
        async setCheckpoint(cp) { checkpoint = { block: cp.block, hash: cp.hash }; },
        async putUnresolved(items) { for (const item of items) open.set(item.id.toLowerCase(), item); },
        async listUnresolved() { return [...open.values()]; },
        async resolveUnresolved(id) { open.delete(id.toLowerCase()); },
    };
}
