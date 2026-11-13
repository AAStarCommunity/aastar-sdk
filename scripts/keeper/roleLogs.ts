/**
 * Incremental RoleConfigured scan. The cursor moves only after a chunk validates.
 * The unfinalized tail is read every check and is not stored.
 */
import { readFileSync, statSync } from 'node:fs';
import { encodeEventTopics, getAddress, isAddress, type Address, type Hex } from 'viem';
import { atomicWriteFile } from './journal.js';
import type { PauseChain, PauseLog } from './pauseDuty.js';
import { REGISTRY_PAUSE_ABI } from './spPausePin.js';

export const ROLE_SYNC_MAX_CALLS = 8;
export const ROLE_SYNC_CHUNK = 5_000n;
const MAX_CALLS = ROLE_SYNC_MAX_CALLS;
const MAX_LOGS = 2_000;
const MAX_ROLES = 5_000;
const CHUNK = ROLE_SYNC_CHUNK;

export const ROLE_TOPIC: Hex = encodeEventTopics({
    abi: REGISTRY_PAUSE_ABI,
    eventName: 'RoleConfigured',
})[0];

interface RoleState {
    chainId: number;
    registry: Address;
    registryStartBlock: bigint;
    cursor: bigint | null;
    roleIds: Hex[];
}

function hex32(value: unknown): value is Hex {
    if (typeof value !== 'string' || value.length !== 66) return false;
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return true;
}

export function validRoleLog(log: PauseLog, registry: Address, from: bigint, to: bigint): boolean {
    if (!log || log.removed) return false;
    if (typeof log.address !== 'string' || log.address.toLowerCase() !== registry.toLowerCase()) return false;
    if (!Array.isArray(log.topics) || log.topics.length < 2 || log.topics.length > 4) return false;
    if (!hex32(log.topics[0]) || log.topics[0].toLowerCase() !== ROLE_TOPIC.toLowerCase()) return false;
    if (typeof log.blockNumber !== 'bigint' || log.blockNumber < from || log.blockNumber > to) return false;
    return hex32(log.topics[1]);
}

function empty(chainId: number, registry: Address, registryStartBlock: bigint): RoleState {
    return { chainId, registry, registryStartBlock, cursor: null, roleIds: [] };
}

function parseState(text: string, chainId: number, registry: Address, registryStartBlock: bigint): RoleState | 'mismatch' | null {
    if (text.length > 1_000_000) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const body = parsed as Record<string, unknown>;
    if (body.version !== 1) return null;
    if (body.chainId !== chainId) return 'mismatch';
    if (typeof body.registry !== 'string' || !isAddress(body.registry)) return null;
    if (body.registry.toLowerCase() !== registry.toLowerCase()) return 'mismatch';
    if (typeof body.registryStartBlock !== 'string' || body.registryStartBlock !== registryStartBlock.toString()) return 'mismatch';
    let cursor: bigint | null = null;
    if (body.cursor !== null) {
        if (typeof body.cursor !== 'string' || !/^\d+$/.test(body.cursor)) return null;
        cursor = BigInt(body.cursor);
    }
    if (!Array.isArray(body.roleIds) || body.roleIds.length > MAX_ROLES) return null;
    const roleIds: Hex[] = [];
    for (const id of body.roleIds) {
        if (!hex32(id)) return null;
        roleIds.push(id.toLowerCase() as Hex);
    }
    return { chainId, registry: getAddress(body.registry), registryStartBlock, cursor, roleIds };
}

function load(path: string, chainId: number, registry: Address, start: bigint): { ok: true; state: RoleState; missing: boolean } | { ok: false; reason: string } {
    try {
        const size = statSync(path).size;
        if (size < 0 || size > 1_000_000) return { ok: false, reason: 'role log state corrupt' };
        const parsed = parseState(readFileSync(path, 'utf8'), chainId, registry, start);
        if (parsed === 'mismatch') return { ok: false, reason: 'role log state belongs to another registry' };
        if (!parsed) return { ok: false, reason: 'role log state corrupt' };
        return { ok: true, state: parsed, missing: false };
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, state: empty(chainId, registry, start), missing: true };
        return { ok: false, reason: 'role log state corrupt' };
    }
}

async function save(path: string, state: RoleState): Promise<boolean> {
    const body = JSON.stringify({
        version: 1,
        chainId: state.chainId,
        registry: state.registry,
        registryStartBlock: state.registryStartBlock.toString(),
        cursor: state.cursor === null ? null : state.cursor.toString(),
        roleIds: [...state.roleIds],
    });
    try {
        await atomicWriteFile(path, body);
        return true;
    } catch {
        return false;
    }
}

function addRole(state: RoleState, id: Hex): boolean {
    const key = id.toLowerCase() as Hex;
    if (state.roleIds.includes(key)) return true;
    if (state.roleIds.length >= MAX_ROLES) return false;
    state.roleIds.push(key);
    return true;
}

/** A range the node rejects is halved down to one block. One original chunk counts as one call. */
async function readRoleChunk(chain: PauseChain, registry: Address, from: bigint, to: bigint): Promise<PauseLog[] | null> {
    const walk = async (a: bigint, b: bigint): Promise<PauseLog[] | null> => {
        let logs: PauseLog[] | null = null;
        let bad = false;
        try {
            logs = await chain.getLogs({ address: registry, topic0: ROLE_TOPIC, fromBlock: a, toBlock: b });
        } catch {
            bad = true;
        }
        if (bad || !logs || logs.length > MAX_LOGS) {
            if (a === b) return null;
            const mid = a + (b - a) / 2n;
            const left = await walk(a, mid);
            if (!left) return null;
            const right = await walk(mid + 1n, b);
            if (!right) return null;
            if (left.length + right.length > MAX_LOGS) return null;
            return [...left, ...right];
        }
        return logs;
    };
    return walk(from, to);
}

export async function syncRoleLogs(opts: {
    chain: PauseChain;
    statePath: string;
    chainId: number;
    registry: Address;
    registryStartBlock: bigint;
    head: bigint;
    finalized: bigint;
    maxCalls?: number;
}): Promise<{ ok: true; roleIds: Hex[] } | { ok: false; reason: string }> {
    const maxCalls = opts.maxCalls ?? MAX_CALLS;
    if (!Number.isInteger(maxCalls) || maxCalls <= 0 || maxCalls > 100) return { ok: false, reason: 'role logs missing' };
    if (opts.registryStartBlock > opts.head) return { ok: false, reason: 'role logs missing' };
    const loaded = load(opts.statePath, opts.chainId, opts.registry, opts.registryStartBlock);
    if (!loaded.ok) return loaded;
    const state = loaded.state;
    let from = state.cursor === null ? opts.registryStartBlock : state.cursor + 1n;
    let calls = 0;
    let incomplete = false;
    while (from <= opts.finalized) {
        if (calls >= maxCalls) {
            incomplete = true;
            break;
        }
        const to = from + CHUNK - 1n > opts.finalized ? opts.finalized : from + CHUNK - 1n;
        calls++;
        const logs = await readRoleChunk(opts.chain, opts.registry, from, to);
        if (!logs) return { ok: false, reason: 'role logs missing' };
        for (const log of logs) {
            if (!validRoleLog(log, opts.registry, from, to)) return { ok: false, reason: 'role log malformed' };
            if (!addRole(state, log.topics[1] as Hex)) return { ok: false, reason: 'role logs unbounded' };
        }
        state.cursor = to;
        if (!await save(opts.statePath, state)) return { ok: false, reason: 'role log state corrupt' };
        from = to + 1n;
    }
    const tailFrom = opts.finalized + 1n < opts.registryStartBlock ? opts.registryStartBlock : opts.finalized + 1n;
    const tailIds: Hex[] = [];
    if (tailFrom <= opts.head) {
        let cursor = tailFrom;
        while (cursor <= opts.head) {
            if (calls >= maxCalls + 4) return { ok: false, reason: 'role logs incomplete' };
            const to = cursor + CHUNK - 1n > opts.head ? opts.head : cursor + CHUNK - 1n;
            calls++;
            const logs = await readRoleChunk(opts.chain, opts.registry, cursor, to);
            if (!logs) return { ok: false, reason: 'role logs missing' };
            for (const log of logs) {
                if (!validRoleLog(log, opts.registry, cursor, to)) return { ok: false, reason: 'role log malformed' };
                const id = (log.topics[1] as Hex).toLowerCase() as Hex;
                if (!tailIds.includes(id)) tailIds.push(id);
            }
            cursor = to + 1n;
        }
    }
    if (incomplete) return { ok: false, reason: 'role logs incomplete' };
    const roleIds = [...state.roleIds];
    for (const id of tailIds) {
        if (!roleIds.includes(id)) roleIds.push(id);
    }
    if (roleIds.length > MAX_ROLES) return { ok: false, reason: 'role logs unbounded' };
    return { ok: true, roleIds: roleIds.map((id) => ({ roleId: id })).map((row) => row.roleId) };
}

/**
 * Startup keeps scanning until the cursor is caught up or the time budget is spent.
 * Hourly checks call syncRoleLogs once and keep that per-check budget.
 */
export async function catchUpRoleLogs(opts: {
    chain: PauseChain;
    statePath: string;
    chainId: number;
    registry: Address;
    registryStartBlock: bigint;
    head: bigint;
    finalized: bigint;
    maxCalls?: number;
    budgetMs: number;
    now?: () => number;
    log?: (line: string) => void;
}): Promise<{ ok: true; roleIds: Hex[] } | { ok: false; reason: string }> {
    const now = opts.now ?? Date.now;
    const log = opts.log ?? (() => {});
    const start = now();
    if (!Number.isSafeInteger(opts.budgetMs) || opts.budgetMs <= 0) return { ok: false, reason: 'role logs missing' };
    let round = 0;
    for (;;) {
        round += 1;
        const synced = await syncRoleLogs(opts);
        log(`role-sync round=${round} ${synced.ok ? 'complete' : synced.reason}`);
        if (synced.ok || synced.reason !== 'role logs incomplete') return synced;
        if (now() - start >= opts.budgetMs) return synced;
        if (round >= 10_000) return synced;
    }
}
