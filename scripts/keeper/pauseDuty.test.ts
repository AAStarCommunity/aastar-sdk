/**
 * Pause-round decisions. The chain is a fake. Removing the stake comparison
 * must stop the understaked-by-stake operator from being sent.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    encodeErrorResult,
    encodeEventTopics,
    encodeFunctionData,
    encodeFunctionResult,
    getAddress,
    keccak256,
    pad,
    type Address,
    type Hex,
} from 'viem';
import { explainHex } from './hex';
import { assertRegistryStart, loadPauseConfig, pauseRoundAlert, runPauseRound, type HexRead, type PauseCall, type PauseChain, type PauseLog, type PauseRoundResult, type PauseSender } from './pauseDuty';
import { REGISTRY_PAUSE_ABI, ROLE_PAYMASTER_SUPER, SUPER_PAYMASTER_PAUSE_ABI } from './spPausePin';

const SP = getAddress('0x1111111111111111111111111111111111111111');
const REG = getAddress('0x2222222222222222222222222222222222222222');
const IMPL = getAddress('0x3333333333333333333333333333333333333333');
const OP = getAddress('0x4444444444444444444444444444444444444444');
const OP2 = getAddress('0x5555555555555555555555555555555555555555');
const SIGNER = getAddress('0x6666666666666666666666666666666666666666');
const OTHER = getAddress('0x7777777777777777777777777777777777777777');
const CODE = '0x6080' as Hex;
const IMPL_CODE = '0x60806040' as Hex;
const HEADER = ('0x' + 'ab'.repeat(32)) as Hex;
const RECEIPT_HASH = ('0x' + 'cd'.repeat(32)) as Hex;
const TOPIC0 = encodeEventTopics({ abi: SUPER_PAYMASTER_PAUSE_ABI, eventName: 'OperatorConfigured' })[0] as Hex;
const HASH = ('0x' + '12'.repeat(32)) as Hex;

const sel = (abi: typeof SUPER_PAYMASTER_PAUSE_ABI, name: string, args: readonly unknown[] = []) =>
    encodeFunctionData({ abi, functionName: name, args: args as never }).slice(0, 10);

const SEL = {
    registry: sel(SUPER_PAYMASTER_PAUSE_ABI, 'REGISTRY'),
    operators: sel(SUPER_PAYMASTER_PAUSE_ABI, 'operators', [OP]),
    hasRole: sel(REGISTRY_PAUSE_ABI, 'hasRole', [ROLE_PAYMASTER_SUPER, OP]),
    role: sel(REGISTRY_PAUSE_ABI, 'getRoleConfig', [ROLE_PAYMASTER_SUPER]),
    stake: sel(REGISTRY_PAUSE_ABI, 'getEffectiveStake', [OP, ROLE_PAYMASTER_SUPER]),
    pause: sel(SUPER_PAYMASTER_PAUSE_ABI, 'pauseUnderstakedOperator', [OP]),
};

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

function configText(over: Record<string, unknown> = {}): string {
    return JSON.stringify({
        superPaymaster: SP,
        registry: REG,
        startBlock: 1,
        registryStartBlock: 1,
        implementation: IMPL,
        implementationCodeHash: keccak256(IMPL_CODE),
        proxyCodeHash: keccak256(CODE),
        spRelease: 'v5.5.0-rc.8',
        ...over,
    });
}

function enabledConfig(over: Record<string, unknown> = {}) {
    return loadPauseConfig(configText(over));
}

function hexRead(value: Hex | null): HexRead {
    if (value === null) return { ok: false, reason: 'unavailable' };
    return explainHex(value, 200_000);
}

function word(addr: Address): Hex {
    return pad(addr, { size: 32 });
}

function opLog(op: Address, blockNumber = 10n): PauseLog {
    return { address: SP, topics: [TOPIC0, word(op)], blockNumber, removed: false };
}

function operatorsHex(configured: boolean, paused: boolean): Hex {
    return encodeFunctionResult({
        abi: SUPER_PAYMASTER_PAUSE_ABI,
        functionName: 'operators',
        result: [0n, configured, paused, OTHER, 0, 0, OTHER, 0n, 0n],
    });
}

function roleHex(minStake: bigint): Hex {
    return encodeFunctionResult({
        abi: REGISTRY_PAUSE_ABI,
        functionName: 'getRoleConfig',
        result: {
            minStake,
            ticketPrice: 0n,
            slashThreshold: 0,
            slashBase: 0,
            slashInc: 0,
            slashMax: 0,
            exitFeePercent: 0,
            isActive: true,
            minExitFee: 0n,
            description: 'role',
            owner: OTHER,
            roleLockDuration: 0n,
        },
    });
}

interface Knobs {
    code?: Hex | null;
    implCode?: Hex | null;
    slot?: Hex | null;
    registry?: Address | null;
    logs?: PauseLog[] | null;
    operatorsFail?: boolean;
    configured?: boolean;
    paused?: boolean;
    hasRole?: boolean;
    minStake?: bigint;
    stake?: bigint;
    stakes?: Record<string, bigint>;
    roles?: Record<string, boolean>;
    canonical?: Hex | null;
    sim?: 'ok' | 'meets' | 'missing' | 'other';
    header?: boolean;
    head?: bigint;
    headHash?: Hex;
    finalizedHash?: Hex;
    finalized?: bigint | null;
    pausedAtReceipt?: boolean;
    fail?: 'hasRole' | 'role' | 'stake';
    codeAt?: (addr: Address, blockHash: Hex) => Hex | null | undefined;
}

function addrAt(data: Hex): Address {
    return getAddress(('0x' + data.slice(-40)) as Address);
}

function world(knobs: Knobs = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'pause-duty-'));
    dirs.push(dir);
    const statePath = join(dir, 'state.json');
    const sent: Address[] = [];
    const alerts: string[] = [];
    const lines: string[] = [];
    let headerCalls = 0;
    let pinnedReads = 0;
    const chain: PauseChain = {
        async latestHeader() {
            headerCalls += 1;
            if (knobs.header === false) return null;
            return { number: knobs.head ?? 100n, hash: knobs.headHash ?? HEADER };
        },
        async blockByNumber(n) {
            pinnedReads += 1;
            if (knobs.canonical === null) return null;
            const finalizedN = knobs.finalized === undefined ? (knobs.head ?? 100n) : knobs.finalized;
            const pinned = knobs.finalizedHash ?? knobs.headHash ?? HEADER;
            if (knobs.canonical && pinnedReads > 1) return { hash: knobs.canonical };
            if (n === finalizedN) return { hash: pinned };
            return { hash: knobs.headHash ?? HEADER };
        },
        async finalizedBlock() {
            if (knobs.finalized === null) return null;
            return knobs.finalized ?? 100n;
        },
        async getCode(addr, blockHash) {
            if (knobs.codeAt) {
                const special = knobs.codeAt(addr, blockHash);
                if (special !== undefined) return hexRead(special);
            }
            if (addr.toLowerCase() === IMPL.toLowerCase()) return hexRead(knobs.implCode === undefined ? IMPL_CODE : knobs.implCode);
            return hexRead(knobs.code === undefined ? CODE : knobs.code);
        },
        async getStorageAt() {
            return hexRead(knobs.slot === undefined ? word(IMPL) : knobs.slot);
        },
        async getLogs() {
            if (knobs.logs === null) return null;
            return knobs.logs ?? [opLog(OP)];
        },
        async call(tx: PauseCall) {
            const id = tx.data.slice(0, 10);
            if (id === SEL.operators) {
                if (knobs.operatorsFail && tx.blockHash === HEADER) return { ok: false as const };
                const paused = tx.blockHash === RECEIPT_HASH ? (knobs.pausedAtReceipt ?? true) : (knobs.paused ?? false);
                const configured = knobs.configured ?? true;
                return { ok: true as const, data: operatorsHex(configured, paused) };
            }
            if (id === SEL.registry) {
                if (knobs.registry === null) return { ok: false as const };
                const who = knobs.registry ?? REG;
                return { ok: true as const, data: encodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'REGISTRY', result: who }) };
            }
            if (id === SEL.hasRole) {
                if (knobs.fail === 'hasRole') return { ok: false as const };
                const op = addrAt(tx.data).toLowerCase();
                const holds = knobs.roles?.[op] ?? knobs.hasRole ?? true;
                return { ok: true as const, data: encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'hasRole', result: holds }) };
            }
            if (id === SEL.role) {
                if (knobs.fail === 'role') return { ok: false as const };
                return { ok: true as const, data: roleHex(knobs.minStake ?? 1000n) };
            }
            if (id === SEL.stake) {
                if (knobs.fail === 'stake') return { ok: false as const };
                const op = addrAt(tx.data).toLowerCase();
                const stake = knobs.stakes?.[op] ?? knobs.stake ?? 1n;
                return { ok: true as const, data: encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getEffectiveStake', result: stake }) };
            }
            if (id === SEL.pause) {
                const sim = knobs.sim ?? 'ok';
                if (sim === 'meets') {
                    return { ok: false as const, data: encodeErrorResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, errorName: 'OperatorMeetsMinimumStake' }) };
                }
                if (sim === 'missing') {
                    return { ok: false as const, data: encodeErrorResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, errorName: 'OperatorNotConfigured' }) };
                }
                if (sim === 'other') return { ok: false as const, data: '0x12345678' as Hex };
                return { ok: true as const, data: '0x' as Hex };
            }
            return { ok: false as const };
        },
    };
    const sender = {
        async send(req: { data: Hex }) {
            sent.push(addrAt(req.data));
            return {
                status: 'included' as const,
                hash: HASH,
                receipt: { status: 'success' as const, gasUsed: 1n, blockHash: RECEIPT_HASH, blockNumber: 100n, transactionHash: HASH },
            };
        },
    };
    return { dir, statePath, chain, sender, sent, alerts, lines, headerCalls: () => headerCalls };
}

async function round(knobs: Knobs = {}, extra: { dryRun?: boolean; nowMs?: number; chunkBlocks?: number; rescanBlocks?: number; statePath?: string; chain?: PauseChain; signer?: Address; sender?: PauseSender } = {}): Promise<{ result: PauseRoundResult; sent: Address[]; alerts: string[]; lines: string[]; statePath: string }> {
    const w = world(knobs);
    const result = await runPauseRound({
        chain: extra.chain ?? w.chain,
        config: enabledConfig(),
        chainId: 11155111,
        signer: extra.signer === undefined ? SIGNER : extra.signer,
        sender: extra.sender ?? w.sender,
        dryRun: extra.dryRun ?? false,
        statePath: extra.statePath ?? w.statePath,
        nowMs: extra.nowMs ?? 1_700_000_000_000,
        chunkBlocks: extra.chunkBlocks,
        rescanBlocks: extra.rescanBlocks,
        alert: (msg) => w.alerts.push(msg),
        log: (line) => w.lines.push(line),
    });
    return { result, sent: w.sent, alerts: w.alerts, lines: w.lines, statePath: extra.statePath ?? w.statePath };
}

describe('pause duty', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('sends when effective stake is below minStake', async () => {
        const r = await round({ hasRole: true, minStake: 1000n, stake: 999n });
        expect(r.result.kind).toBe('ok');
        expect(r.sent).toEqual([OP]);
    });

    it('does not send when effective stake equals minStake', async () => {
        const r = await round({ hasRole: true, minStake: 1000n, stake: 1000n });
        expect(r.result.kind).toBe('ok');
        expect(r.sent).toEqual([]);
    });

    it('sends when the role is missing even if the stake is large', async () => {
        const r = await round({ hasRole: false, minStake: 1000n, stake: 10n ** 30n });
        expect(r.sent).toEqual([OP]);
    });

    it('an identity mismatch sends nothing', async () => {
        for (const knobs of [
            { code: '0x60' as Hex },
            { code: null },
            { slot: word(OTHER) },
            { slot: null },
            { implCode: '0x61' as Hex },
            { implCode: null },
            { registry: OTHER },
            { registry: null },
        ]) {
            const r = await round(knobs);
            expect(r.result.kind, JSON.stringify(knobs)).toBe('failed');
            expect(r.sent, JSON.stringify(knobs)).toEqual([]);
            if (r.result.kind === 'failed') expect(r.result.reasons.join(' ')).not.toMatch(/nothing understaked/);
        }
    });

    it('a failed read is failed, not ok with zero operators', async () => {
        const header = await round({ header: false });
        const logs = await round({ logs: null });
        const ops = await round({ operatorsFail: true, hasRole: true, stake: 1n });
        for (const r of [header, logs, ops]) {
            expect(r.result.kind).toBe('failed');
            expect(r.sent).toEqual([]);
            if (r.result.kind === 'ok') throw new Error('ok with a failed read');
            if (r.result.kind === 'failed') expect(r.result.reasons.join(' ')).not.toMatch(/nothing understaked/);
        }
        expect(logs.result.kind).toBe('failed');
    });

    it('a failed log chunk does not advance the cursor', async () => {
        const w = world({ logs: null });
        const result = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            alert: () => {},
            log: () => {},
        });
        expect(result.kind).toBe('failed');
        expect(() => readFileSync(w.statePath, 'utf8')).toThrow();
    });

    it('an unfinished scan is inventory incomplete, not an empty success', async () => {
        const ahead = await round({ finalized: 0n, logs: [] });
        expect(ahead.result.kind).toBe('failed');
        if (ahead.result.kind === 'failed') expect(ahead.result.reasons).toContain('inventory incomplete');
        const budget = await round({ logs: [], finalized: 100n }, { chunkBlocks: 1 });
        expect(budget.result.kind).toBe('failed');
        if (budget.result.kind === 'failed') expect(budget.result.reasons).toContain('inventory incomplete');
    });

    it('a canonical recheck mismatch sends nothing', async () => {
        const r = await round({ canonical: ('0x' + '11'.repeat(32)) as Hex, hasRole: true, stake: 1n });
        expect(r.result.kind).toBe('failed');
        expect(r.sent).toEqual([]);
    });

    it('inventory and the stake reads use the finalized block hash', async () => {
        const latest = ('0x' + 'ee'.repeat(32)) as Hex;
        const finalHash = ('0x' + 'ff'.repeat(32)) as Hex;
        const w = world({
            head: 200n,
            headHash: latest,
            finalized: 90n,
            finalizedHash: finalHash,
            logs: [opLog(OP, 10n), opLog(OP2, 150n)],
            hasRole: false,
        });
        const ranges: { from: bigint; to: bigint }[] = [];
        const views: { id: string; blockHash?: Hex; at?: 'latest' }[] = [];
        const pinnedHashes: Hex[] = [];
        const chain: PauseChain = {
            ...w.chain,
            async getCode(addr, blockHash) {
                pinnedHashes.push(blockHash);
                return w.chain.getCode(addr, blockHash);
            },
            async getStorageAt(addr, slot, blockHash) {
                pinnedHashes.push(blockHash);
                return w.chain.getStorageAt(addr, slot, blockHash);
            },
            async getLogs(q) {
                ranges.push({ from: q.fromBlock, to: q.toBlock });
                const logs = await w.chain.getLogs(q);
                return (logs ?? []).filter((log) => log.blockNumber >= q.fromBlock && log.blockNumber <= q.toBlock);
            },
            async call(tx) {
                views.push({ id: tx.data.slice(0, 10), blockHash: tx.blockHash, at: tx.at });
                return w.chain.call(tx);
            },
        };
        const result = await runPauseRound({
            chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            alert: () => {},
            log: () => {},
        });
        expect(result.kind).toBe('ok');
        expect(w.sent).toEqual([OP]);
        expect(ranges.length).toBeGreaterThan(0);
        expect(ranges.every((range) => range.to <= 90n)).toBe(true);
        expect(pinnedHashes.length).toBeGreaterThan(0);
        expect(pinnedHashes.some((hash) => hash === finalHash)).toBe(true);
        expect(pinnedHashes.some((hash) => hash === latest)).toBe(true);
        expect(pinnedHashes.every((hash) => hash === finalHash || hash === latest)).toBe(true);
        const qualification = views.filter((view) => view.id !== SEL.pause && view.id !== SEL.registry && view.blockHash !== RECEIPT_HASH);
        expect(qualification.some((view) => view.id === SEL.hasRole)).toBe(true);
        expect(qualification.some((view) => view.id === SEL.stake)).toBe(true);
        expect(qualification.some((view) => view.id === SEL.operators)).toBe(true);
        expect(qualification.every((view) => view.blockHash === finalHash)).toBe(true);
        const registries = views.filter((view) => view.id === SEL.registry);
        expect(registries.some((view) => view.blockHash === finalHash)).toBe(true);
        expect(registries.some((view) => view.blockHash === latest)).toBe(true);
        const sim = views.find((view) => view.id === SEL.pause);
        expect(sim?.at).toBe('latest');
        expect(sim?.blockHash).toBeUndefined();
    });

    it('OperatorMeetsMinimumStake is a note and any other revert fails without a further send', async () => {
        const recovered = await round({ hasRole: true, stake: 1n, sim: 'meets' });
        expect(recovered.sent).toEqual([]);
        expect(recovered.result.kind).toBe('ok');
        if (recovered.result.kind === 'ok') expect(recovered.result.notes.join(' ')).toMatch(/stake recovered/);

        const w = world({
            logs: [opLog(OP, 10n), opLog(OP2, 11n)],
            hasRole: false,
            sim: 'other',
        });
        const failed = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            alert: (msg) => w.alerts.push(msg),
            log: () => {},
        });
        expect(failed.kind).toBe('failed');
        expect(w.sent).toEqual([]);
    });

    it('two consecutive understaked unpaused rounds alert pause timeout', async () => {
        const w = world({ hasRole: true, stake: 1n });
        const ctx = {
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            chunkBlocks: 5000,
            alert: (msg: string) => w.alerts.push(msg),
            log: (line: string) => w.lines.push(line),
        };
        const first = await runPauseRound({ ...ctx, nowMs: 1_700_000_000_000 });
        const second = await runPauseRound({ ...ctx, nowMs: 1_700_000_100_000 });
        expect(first.kind).toBe('ok');
        expect(second.kind).toBe('ok');
        expect(w.alerts).toContain(`pause timeout\noperator=${OP}`);
        expect(w.alerts.some((a) => a.startsWith('[keeper]'))).toBe(false);
        const dry = world({ hasRole: true, stake: 1n });
        const dryResult = await runPauseRound({
            chain: dry.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            dryRun: true,
            statePath: dry.statePath,
            nowMs: 1_700_000_000_000,
            alert: (msg) => dry.alerts.push(msg),
            log: (line) => dry.lines.push(line),
        });
        expect(dryResult.kind).toBe('ok');
        expect(dry.alerts).toEqual([]);
        expect(dry.lines.some((l) => l.includes(`operator=${OP}`) && l.includes('(dry-run)'))).toBe(true);
        expect(() => readFileSync(dry.statePath, 'utf8')).toThrow();
    });

    it('config rejects unknown keys, bad numbers and the wrong release before any read', () => {
        expect(() => loadPauseConfig(configText({ extra: 1 }))).toThrow(/too many keys|unknown key/);
        const swapped = JSON.parse(configText()) as Record<string, unknown>;
        delete swapped.spRelease;
        swapped.extra = 1;
        expect(() => loadPauseConfig(JSON.stringify(swapped))).toThrow(/unknown key/);
        expect(() => loadPauseConfig(configText({ startBlock: -1 }))).toThrow(/startBlock/);
        expect(() => loadPauseConfig(configText({ startBlock: 1.5 }))).toThrow(/startBlock/);
        expect(() => loadPauseConfig(configText({ startBlock: 'nope' }))).toThrow(/startBlock/);
        expect(() => loadPauseConfig('{"superPaymaster":"0x1111111111111111111111111111111111111111"}')).toThrow(/partial/);
        expect(() => loadPauseConfig(configText({ spRelease: 'v5.4.2' }))).toThrow(/spRelease is not v5.5.0-rc.8/);
        const ok = loadPauseConfig(configText());
        expect(Object.isFrozen(ok)).toBe(true);
        expect(() => { (ok as { spRelease: string }).spRelease = 'v5.4.2'; }).toThrow();
        const earlier = loadPauseConfig(configText({ registryStartBlock: 0, startBlock: 50 }));
        expect(() => assertRegistryStart(earlier, 100n)).not.toThrow();
        expect(() => assertRegistryStart(earlier, 0n)).not.toThrow();
        const ahead = loadPauseConfig(configText({ registryStartBlock: 101, startBlock: 50 }));
        expect(() => assertRegistryStart(ahead, 100n)).toThrow(/registryStartBlock after current head/);
    });

    it('page size is rejected before the first chain read', async () => {
        const w = world();
        const chain = w.chain;
        const orig = chain.latestHeader.bind(chain);
        let called = false;
        chain.latestHeader = async () => { called = true; return orig(); };
        await expect(runPauseRound({
            chain,
            config: enabledConfig(),
            chainId: 11155111,
            dryRun: true,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            chunkBlocks: 0,
            alert: () => {},
            log: () => {},
        })).rejects.toThrow(/log chunk size/);
        expect(called).toBe(false);
    });

    it('a corrupt pause state is a failed round and is not overwritten', async () => {
        const w = world();
        writeFileSync(w.statePath, '{');
        const result = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            alert: () => {},
            log: () => {},
        });
        expect(result.kind).toBe('failed');
        if (result.kind === 'failed') expect(result.reasons).toContain('pause state corrupt');
        expect(readFileSync(w.statePath, 'utf8')).toBe('{');
        expect(w.sent).toEqual([]);
    });

    it('a pause state from another deployment is refused and not rewritten', async () => {
        const w = world();
        const foreign = JSON.stringify({
            version: 2,
            chainId: 1,
            superPaymaster: SP,
            startBlock: '1',
            cursor: '2',
            operators: [],
            streaks: {},
            lastLowBalanceAlertMs: 0,
            lastBalanceFailAlertMs: 0,
            lastFullRescanMs: 0,
            alertedUnconfigured: [],
        });
        writeFileSync(w.statePath, foreign);
        const result = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            alert: () => {},
            log: () => {},
        });
        expect(result.kind).toBe('failed');
        if (result.kind === 'failed') {
            expect(result.reasons).toEqual([`pause state belongs to another deployment: chainId differs; move aside ${w.statePath}`]);
        }
        expect(readFileSync(w.statePath, 'utf8')).toBe(foreign);
    });

    it('a lagging empty range is rescanned and a too-big chunk is split', async () => {
        const found = { logs: [] as PauseLog[] };
        const calls: bigint[] = [];
        const w = world();
        w.chain.getLogs = async (q) => {
            calls.push(q.fromBlock);
            if (q.toBlock - q.fromBlock > 2n) throw new Error('response too big');
            return found.logs.filter((log) => log.blockNumber >= q.fromBlock && log.blockNumber <= q.toBlock);
        };
        const first = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            rescanBlocks: 10,
            alert: () => {},
            log: () => {},
        });
        expect(first.kind).toBe('ok');
        if (first.kind === 'ok') expect(first.checked).toBe(0);
        const cursor = JSON.parse(readFileSync(w.statePath, 'utf8')).cursor;
        found.logs = [opLog(OP, 90n)];
        calls.length = 0;
        const second = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            rescanBlocks: 20,
            alert: () => {},
            log: () => {},
        });
        expect(second.kind).toBe('ok');
        expect(calls.some((from) => from < BigInt(cursor))).toBe(true);
        expect(BigInt(JSON.parse(readFileSync(w.statePath, 'utf8')).cursor)).toBeGreaterThanOrEqual(BigInt(cursor));
        expect(w.sent).toEqual([OP]);
    });

    it('a failed second chunk keeps the cursor at the end of the first', async () => {
        const w = world();
        w.chain.getLogs = async (q) => (q.fromBlock >= 11n ? null : [opLog(OP, q.fromBlock)]);
        const result = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            chunkBlocks: 10,
            alert: () => {},
            log: () => {},
        });
        expect(result.kind).toBe('failed');
        expect(JSON.parse(readFileSync(w.statePath, 'utf8')).cursor).toBe('11');
    });

    it('dirty upper bytes, non-hex code, and failed stake reads fail the round', async () => {
        const dirtySlot = ('0x' + '11'.repeat(12) + IMPL.slice(2)) as Hex;
        const dirtyRegistry = ('0x' + 'ab'.repeat(12) + REG.slice(2)) as Hex;
        const slot = await round({ slot: dirtySlot });
        const registryWord = world({ hasRole: true, stake: 1n });
        registryWord.chain.call = async (tx) => {
            if (tx.data.slice(0, 10) === SEL.registry) return { ok: true, data: dirtyRegistry };
            return world().chain.call(tx);
        };
        const registry = await runPauseRound({
            chain: registryWord.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: registryWord.sender,
            dryRun: false,
            statePath: registryWord.statePath,
            nowMs: 1_700_000_000_000,
            alert: () => {},
            log: () => {},
        });
        const notHex = await round({ code: '0xzz' as Hex });
        const has = await round({ fail: 'hasRole', hasRole: true, stake: 1n });
        const role = await round({ fail: 'role', hasRole: true, stake: 1n });
        const stake = await round({ fail: 'stake', hasRole: true, stake: 1n });
        expect(slot.result.kind).toBe('failed');
        if (slot.result.kind === 'failed') expect(slot.result.reasons).toContain('implementation slot not an address');
        expect(registry.kind).toBe('failed');
        if (registry.kind === 'failed') expect(registry.reasons).toContain('REGISTRY() not an address');
        expect(notHex.result.kind).toBe('failed');
        if (notHex.result.kind === 'failed') expect(notHex.result.reasons.join(' ')).toMatch(/not-hex/);
        expect(has.result.kind).toBe('failed');
        if (has.result.kind === 'failed') expect(has.result.reasons.join(' ')).toMatch(/hasRole unavailable/);
        expect(role.result.kind).toBe('failed');
        if (role.result.kind === 'failed') expect(role.result.reasons.join(' ')).toMatch(/getRoleConfig unavailable/);
        expect(stake.result.kind).toBe('failed');
        if (stake.result.kind === 'failed') expect(stake.result.reasons.join(' ')).toMatch(/getEffectiveStake unavailable/);
    });

    it('removed, foreign, mistopic and out-of-range logs fail', async () => {
        const removed = await round({ logs: [{ ...opLog(OP), removed: true }] });
        const foreign = await round({ logs: [{ ...opLog(OP), address: OTHER }] });
        const topic = await round({ logs: [{ ...opLog(OP), topics: [('0x' + '12'.repeat(32)) as Hex, word(OP)] }] });
        const range = await round({ logs: [opLog(OP, 1_000n)] });
        for (const r of [removed, foreign, topic, range]) {
            expect(r.result.kind).toBe('failed');
            if (r.result.kind === 'failed') expect(r.result.reasons).toContain('log chunk invalid');
        }
    });

    it('reverted inclusion, paused-false, refused, pending and blocked are not a successful pause', async () => {
        const reverted = await round({ hasRole: true, stake: 1n }, {
            sender: { async send() {
                return { status: 'included', hash: HASH, receipt: { status: 'reverted', gasUsed: 1n, blockHash: RECEIPT_HASH, blockNumber: 100n, transactionHash: HASH } };
            } },
        });
        const still = await round({ hasRole: true, stake: 1n, pausedAtReceipt: false });
        const refused = await round({ hasRole: true, stake: 1n }, {
            sender: { async send() { return { status: 'refused', reason: 'sender: gate closed' }; } },
        });
        const pending = await round({ hasRole: true, stake: 1n }, {
            sender: { async send() { return { status: 'pending', hash: HASH }; } },
        });
        const blocked = await round({ hasRole: true, stake: 1n }, {
            sender: { async send() { return { status: 'blocked', inFlightHash: HASH }; } },
        });
        const missing = await round({ hasRole: true, stake: 1n, sim: 'missing' });
        expect(reverted.result.kind).toBe('failed');
        if (reverted.result.kind === 'failed') expect(reverted.result.reasons.join(' ')).toMatch(/reverted/);
        expect(still.result.kind).toBe('failed');
        if (still.result.kind === 'failed') expect(still.result.reasons.join(' ')).toMatch(/not paused/);
        expect(refused.result.kind).toBe('failed');
        if (refused.result.kind === 'failed') expect(refused.result.reasons.join(' ')).toMatch(/send refused/);
        expect(pending.result.kind).toBe('ok');
        if (pending.result.kind === 'ok') expect(pending.result.notes.join(' ')).toMatch(/pause pending/);
        expect(blocked.result.kind).toBe('ok');
        if (blocked.result.kind === 'ok') {
            expect(blocked.result.sent).toEqual([]);
            expect(blocked.result.notes.join(' ')).toMatch(/not sent this round/);
        }
        expect(missing.result.kind).toBe('failed');
        if (missing.result.kind === 'failed') expect(missing.result.reasons.join(' ')).toMatch(/OperatorNotConfigured/);
    });

    it('rescanBlocks is rejected before the first chain read', async () => {
        const w = world();
        let called = false;
        const orig = w.chain.latestHeader.bind(w.chain);
        w.chain.latestHeader = async () => { called = true; return orig(); };
        await expect(runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            dryRun: true,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            rescanBlocks: 0,
            alert: () => {},
            log: () => {},
        })).rejects.toThrow(/rescanBlocks invalid/);
        expect(called).toBe(false);
    });

    it('a full rescan runs from startBlock once a day', async () => {
        const w = world({ logs: [opLog(OP, 10n)], hasRole: true, stake: 1n });
        const seen: bigint[] = [];
        const inner = w.chain.getLogs.bind(w.chain);
        w.chain.getLogs = async (q) => {
            seen.push(q.fromBlock);
            const logs = await inner(q);
            return (logs ?? []).filter((log) => log.blockNumber >= q.fromBlock && log.blockNumber <= q.toBlock);
        };
        writeFileSync(w.statePath, JSON.stringify({
            version: 2,
            chainId: 11155111,
            superPaymaster: SP,
            startBlock: '1',
            cursor: '101',
            operators: [],
            streaks: {},
            lastLowBalanceAlertMs: 0,
            lastBalanceFailAlertMs: 0,
            lastFullRescanMs: 1_700_000_000_000,
            alertedUnconfigured: [],
        }));
        const recent = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000,
            rescanBlocks: 5,
            alert: () => {},
            log: () => {},
        });
        expect(recent.kind).toBe('ok');
        expect(seen.every((from) => from >= 96n)).toBe(true);
        expect(w.sent).toEqual([]);
        seen.length = 0;
        const later = await runPauseRound({
            chain: w.chain,
            config: enabledConfig(),
            chainId: 11155111,
            signer: SIGNER,
            sender: w.sender,
            dryRun: false,
            statePath: w.statePath,
            nowMs: 1_700_000_000_000 + 24 * 60 * 60 * 1000,
            rescanBlocks: 5,
            alert: () => {},
            log: () => {},
        });
        expect(later.kind).toBe('ok');
        expect(seen.some((from) => from <= 1n)).toBe(true);
        expect(w.sent).toEqual([OP]);
    });

    it('a range larger than one round budget completes over later rounds and still pauses', async () => {
        const w = world({
            head: 200n,
            finalized: 200n,
            logs: [opLog(OP, 10n)],
            hasRole: false,
            stake: 1n,
        });
        const seen: bigint[][] = [];
        w.chain.getLogs = async (q) => {
            const roundSeen = seen[seen.length - 1];
            if (roundSeen) roundSeen.push(q.fromBlock);
            return [opLog(OP, 10n)].filter((log) => log.blockNumber >= q.fromBlock && log.blockNumber <= q.toBlock);
        };
        writeFileSync(w.statePath, JSON.stringify({
            version: 2,
            chainId: 11155111,
            superPaymaster: SP,
            startBlock: '1',
            cursor: '201',
            operators: [],
            streaks: {},
            lastLowBalanceAlertMs: 0,
            lastBalanceFailAlertMs: 0,
            lastFullRescanMs: 1,
            alertedUnconfigured: [],
        }));
        const now = 1_700_000_000_000;
        for (let round = 0; round < 5; round++) {
            seen.push([]);
            const result = await runPauseRound({
                chain: w.chain,
                config: enabledConfig(),
                chainId: 11155111,
                signer: SIGNER,
                sender: w.sender,
                dryRun: false,
                statePath: w.statePath,
                nowMs: now,
                chunkBlocks: 1,
                rescanBlocks: 5,
                alert: () => {},
                log: () => {},
            });
            expect(result.kind, `round ${round}`).toBe('ok');
            expect(w.sent.length, `round ${round}`).toBe(round + 1);
            const saved = JSON.parse(readFileSync(w.statePath, 'utf8')) as { fullCursor: string | null; lastFullRescanMs: number };
            if (round < 4) {
                expect(result.kind === 'ok' ? result.notes : []).toContain('full rescan incomplete');
                expect(BigInt(saved.fullCursor ?? '0')).toBe(BigInt(1 + 40 * (round + 1)));
                expect(seen[round]!.some((from) => from === 1n)).toBe(round === 0);
            } else {
                expect(saved.fullCursor).toBeNull();
                expect(saved.lastFullRescanMs).toBe(now);
            }
        }
        expect(seen[1]!.every((from) => from > 1n)).toBe(true);
        expect(seen[1]!.some((from) => from >= 41n)).toBe(true);
    });

    it('a latest deployment mismatch sends nothing and closes the pause gate result', async () => {
        const latest = ('0x' + 'ee'.repeat(32)) as Hex;
        const finalHash = ('0x' + 'ff'.repeat(32)) as Hex;
        const r = await round({
            head: 100n,
            headHash: latest,
            finalized: 90n,
            finalizedHash: finalHash,
            hasRole: false,
            stake: 1n,
            codeAt: (_addr, hash) => (hash.toLowerCase() === latest.toLowerCase() ? '0x60' as Hex : undefined),
        });
        expect(r.result.kind).toBe('sp-mismatch');
        expect(r.sent).toEqual([]);
        if (r.result.kind === 'sp-mismatch') expect(r.result.problem).toBe('superpaymaster codehash mismatch');
    });

    it('a failed pause round alerts once and the next ok round sends one recovery', () => {
        const failed = pauseRoundAlert('', { reasons: ['inventory incomplete'] });
        expect(failed.alert).toBe('pause-round=FAILED\ninventory incomplete');
        const again = pauseRoundAlert(failed.key, { reasons: ['inventory incomplete'] });
        expect(again.alert).toBeNull();
        const recovered = pauseRoundAlert(again.key, 'ok');
        expect(recovered.alert).toBe('pause round recovered');
        expect(recovered.key).toBe('');
        expect(pauseRoundAlert('', 'ok').alert).toBeNull();
    });
});
