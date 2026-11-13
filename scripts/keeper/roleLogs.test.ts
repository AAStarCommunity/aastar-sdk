/**
 * Incremental RoleConfigured scan. A bad log does not advance the cursor.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAddress, type Address, type Hex } from 'viem';
import type { PauseChain, PauseLog } from './pauseDuty';
import { ROLE_SYNC_CHUNK, ROLE_SYNC_MAX_CALLS, ROLE_TOPIC, catchUpRoleLogs, syncRoleLogs, validRoleLog } from './roleLogs';

const REG = getAddress('0x2222222222222222222222222222222222222222');
const OTHER = getAddress('0x3333333333333333333333333333333333333333');
const ROLE = ('0x' + 'ab'.repeat(32)) as Hex;
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

function log(over: Partial<PauseLog> = {}): PauseLog {
    return { address: REG, topics: [ROLE_TOPIC, ROLE], blockNumber: 2n, removed: false, ...over };
}

function chain(logs: PauseLog[] | null): PauseChain {
    return {
        async latestHeader() { return null; },
        async blockByNumber() { return null; },
        async finalizedBlock() { return 10n; },
        async getCode() { return { ok: false, reason: 'unavailable' }; },
        async getStorageAt() { return { ok: false, reason: 'unavailable' }; },
        async call() { return { ok: false, reason: 'unavailable' }; },
        async getLogs(q) {
            if (!logs) return null;
            return logs.filter((row) => row.blockNumber >= q.fromBlock && row.blockNumber <= q.toBlock);
        },
    };
}

describe('role logs', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('rejects a removed, foreign, mistopic, or out-of-range log', () => {
        expect(validRoleLog(log(), REG, 1n, 5n)).toBe(true);
        expect(validRoleLog(log({ removed: true }), REG, 1n, 5n)).toBe(false);
        expect(validRoleLog(log({ address: OTHER }), REG, 1n, 5n)).toBe(false);
        expect(validRoleLog(log({ topics: [('0x' + '12'.repeat(32)) as Hex, ROLE] }), REG, 1n, 5n)).toBe(false);
        expect(validRoleLog(log({ blockNumber: 9n }), REG, 1n, 5n)).toBe(false);
        expect(validRoleLog(log({ topics: [ROLE_TOPIC, '0x1234' as Hex] }), REG, 1n, 5n)).toBe(false);
    });

    it('keeps the cursor of a finished chunk and continues the next check', async () => {
        const root = mkdtempSync(join(tmpdir(), 'role-logs-'));
        dirs.push(root);
        const statePath = join(root, 'roles.json');
        const first = await syncRoleLogs({
            chain: chain([log({ blockNumber: 2n })]),
            statePath,
            chainId: 11155111,
            registry: REG,
            registryStartBlock: 1n,
            head: 12_000n,
            finalized: 12_000n,
            maxCalls: 1,
        });
        expect(first).toEqual({ ok: false, reason: 'role logs incomplete' });
        const saved = JSON.parse(readFileSync(statePath, 'utf8')) as { cursor: string; roleIds: string[] };
        expect(saved.cursor).toBe('5000');
        expect(saved.roleIds).toEqual([ROLE]);
        const second = await syncRoleLogs({
            chain: chain([]),
            statePath,
            chainId: 1,
            registry: REG,
            registryStartBlock: 1n,
            head: 12_000n,
            finalized: 12_000n,
            maxCalls: 8,
        });
        expect(second).toEqual({ ok: false, reason: 'role log state belongs to another registry' });
        expect(JSON.parse(readFileSync(statePath, 'utf8')).cursor).toBe('5000');
    });

    it('reads the unfinalized tail every check and does not store it', async () => {
        const root = mkdtempSync(join(tmpdir(), 'role-logs-'));
        dirs.push(root);
        const statePath = join(root, 'roles.json');
        const tail = ('0x' + 'cd'.repeat(32)) as Hex;
        const result = await syncRoleLogs({
            chain: chain([log({ blockNumber: 2n }), log({ blockNumber: 8n, topics: [ROLE_TOPIC, tail] })]),
            statePath,
            chainId: 11155111,
            registry: REG,
            registryStartBlock: 1n,
            head: 9n,
            finalized: 5n,
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.roleIds).toContain(tail);
        const saved = JSON.parse(readFileSync(statePath, 'utf8')) as { cursor: string; roleIds: string[] };
        expect(saved.cursor).toBe('5');
        expect(saved.roleIds).not.toContain(tail);
    });

    it('a startup catch-up finishes a backlog ten times the per-check budget', async () => {
        const root = mkdtempSync(join(tmpdir(), 'role-logs-'));
        dirs.push(root);
        const finalized = ROLE_SYNC_CHUNK * BigInt(ROLE_SYNC_MAX_CALLS) * 10n - 1n;
        const clock = 1_700_000_000_000;
        const one = await syncRoleLogs({
            chain: chain([]),
            statePath: join(root, 'one.json'),
            chainId: 11155111,
            registry: REG,
            registryStartBlock: 0n,
            head: finalized,
            finalized,
        });
        expect(one).toEqual({ ok: false, reason: 'role logs incomplete' });
        const caught = await catchUpRoleLogs({
            chain: chain([]),
            statePath: join(root, 'catch.json'),
            chainId: 11155111,
            registry: REG,
            registryStartBlock: 0n,
            head: finalized,
            finalized,
            budgetMs: 15 * 60 * 1000,
            now: () => clock,
        });
        expect(caught.ok).toBe(true);
    });

    it('halves a rejected role-log range down to one block', async () => {
        const root = mkdtempSync(join(tmpdir(), 'role-logs-'));
        dirs.push(root);
        const calls: Array<{ from: bigint; to: bigint }> = [];
        const slow: PauseChain = {
            ...chain([]),
            async getLogs(q) {
                calls.push({ from: q.fromBlock, to: q.toBlock });
                if (q.toBlock > q.fromBlock) throw new Error('range');
                return [];
            },
        };
        const result = await syncRoleLogs({
            chain: slow,
            statePath: join(root, 'half.json'),
            chainId: 11155111,
            registry: REG,
            registryStartBlock: 1n,
            head: 3n,
            finalized: 2n,
            maxCalls: 8,
        });
        expect(result.ok).toBe(true);
        expect(calls.some((q) => q.to === q.from)).toBe(true);
        expect(JSON.parse(readFileSync(join(root, 'half.json'), 'utf8')).cursor).toBe('2');
    });
});
