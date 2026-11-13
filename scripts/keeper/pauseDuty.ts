/**
 * Hourly "pause understaked operators" round.
 * Runs only against the named v5.5.0-rc.8 deployment. A failed read fails the round.
 */
import { readFileSync, statSync } from 'node:fs';
import {
    decodeErrorResult,
    decodeFunctionResult,
    encodeEventTopics,
    encodeFunctionData,
    getAddress,
    isAddress,
    keccak256,
    type Address,
    type Hex,
} from 'viem';
import { explainHex } from './hex.js';
import { atomicWriteFile } from './journal.js';
import {
    IMPL_SLOT,
    OPERATOR_IS_CONFIGURED_INDEX,
    OPERATOR_IS_PAUSED_INDEX,
    REGISTRY_PAUSE_ABI,
    ROLE_PAYMASTER_SUPER,
    SUPER_PAYMASTER_PAUSE_ABI,
} from './spPausePin.js';
import type { SendResult } from './sender.js';

const REQUIRED_KEYS = [
    'superPaymaster',
    'registry',
    'startBlock',
    'registryStartBlock',
    'implementation',
    'implementationCodeHash',
    'proxyCodeHash',
    'spRelease',
] as const;

const MAX_CONFIG_CHARS = 64_000;
const MAX_LOGS = 2_000;
const MAX_OPERATORS = 2_000;
const MAX_CHUNKS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RESCAN_BLOCKS = 20_000;
const MAX_RESCAN_BLOCKS = 1_000_000;

export interface PauseDutyConfig {
    superPaymaster: Address;
    registry: Address;
    startBlock: bigint;
    registryStartBlock: bigint;
    implementation: Address;
    implementationCodeHash: Hex;
    proxyCodeHash: Hex;
    spRelease: 'v5.5.0-rc.8';
}

export interface PauseLog {
    address: Address;
    topics: Hex[];
    blockNumber: bigint;
    removed: boolean;
}

export interface PauseCall {
    to: Address;
    data: Hex;
    from?: Address;
    blockHash?: Hex;
    at?: 'latest';
}

export type HexRead = { ok: true; data: Hex } | { ok: false; reason: string };

export interface PauseChain {
    latestHeader(): Promise<{ number: bigint; hash: Hex } | null>;
    blockByNumber(n: bigint): Promise<{ hash: Hex } | null>;
    finalizedBlock(): Promise<bigint | null>;
    getCode(addr: Address, blockHash: Hex): Promise<HexRead>;
    getStorageAt(addr: Address, slot: Hex, blockHash: Hex): Promise<HexRead>;
    call(tx: PauseCall): Promise<{ ok: true; data: Hex } | { ok: false; data?: Hex; reason?: string }>;
    getLogs(q: { address: Address; topic0: Hex; fromBlock: bigint; toBlock: bigint }): Promise<PauseLog[] | null>;
}

export interface PauseSender {
    send(req: { kind: 'pause'; to: Address; data: Hex }): Promise<SendResult>;
}

export type PauseRoundResult =
    | { kind: 'failed'; reasons: string[]; notes: string[] }
    | { kind: 'sp-mismatch'; problem: string; notes: string[] }
    | { kind: 'ok'; checked: number; understaked: Address[]; sent: { operator: Address; hash: Hex }[]; notes: string[] };

/** One alert when the failed reason changes, and one recovery when a failed round becomes ok. */
export function pauseRoundAlert(previousKey: string, outcome: 'ok' | { reasons: string[] }): { key: string; alert: string | null } {
    const previous = typeof previousKey === 'string' ? previousKey : '';
    if (outcome === 'ok') {
        if (previous === '') return { key: '', alert: null };
        return { key: '', alert: 'pause round recovered' };
    }
    const key = outcome.reasons.slice().sort().join('\n');
    if (key === previous) return { key, alert: null };
    return { key, alert: `pause-round=FAILED\n${key}` };
}

export interface PauseRoundContext {
    chain: PauseChain;
    config: PauseDutyConfig;
    chainId: number;
    signer?: Address;
    sender?: PauseSender;
    dryRun: boolean;
    statePath: string;
    nowMs: number;
    chunkBlocks?: number;
    rescanBlocks?: number;
    alert: (msg: string) => void;
    log: (line: string) => void;
}

interface PauseState {
    version: 2;
    chainId: number;
    superPaymaster: Address;
    startBlock: bigint;
    cursor: bigint | null;
    operators: Address[];
    streaks: Record<string, number>;
    /** Kept so a state file from an older round still loads. The pause round does not read or alert on balance. */
    lastLowBalanceAlertMs: number;
    lastBalanceFailAlertMs: number;
    lastFullRescanMs: number;
    alertedUnconfigured: string[];
    /** Next block of the background full rescan. Null means no rescan is in progress. */
    fullCursor: bigint | null;
}

const OPERATOR_TOPIC: Hex = encodeEventTopics({
    abi: SUPER_PAYMASTER_PAUSE_ABI,
    eventName: 'OperatorConfigured',
})[0];

export function assertPageSize(n: number): number {
    if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 5_000) {
        throw new Error('pauseDuty: log chunk size invalid');
    }
    return n;
}

export function assertRescanBlocks(n: number): number {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_RESCAN_BLOCKS) {
        throw new Error('pauseDuty: rescanBlocks invalid');
    }
    return n;
}

function ownKeys(value: object, max: number): string[] | null {
    const keys: string[] = [];
    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        keys.push(key);
        if (keys.length > max) return null;
    }
    return keys;
}

function parseAddr(value: unknown): Address | null {
    if (typeof value !== 'string' || value.length !== 42) return null;
    if (!isAddress(value)) return null;
    const lower = value === value.toLowerCase();
    if (!lower && !isAddress(value, { strict: true })) return null;
    return getAddress(value);
}

function parseHash(value: unknown): Hex | null {
    if (typeof value !== 'string' || value.length !== 66) return null;
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return null;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return null;
    }
    return value.toLowerCase() as Hex;
}

function parseBlock(value: unknown): bigint | null {
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 0) return null;
        return BigInt(value);
    }
    if (typeof value === 'string') {
        if (value.length === 0 || value.length > 16) return null;
        for (let i = 0; i < value.length; i++) {
            const c = value.charCodeAt(i);
            if (c < 48 || c > 57) return null;
        }
        const n = BigInt(value);
        if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        return n;
    }
    return null;
}

/** Synchronous. A partial file, a bad value, or any other release throws. */
export function loadPauseConfig(text: string): PauseDutyConfig {
    if (typeof text !== 'string') throw new Error('pause-config: not text');
    if (text.length === 0 || text.length > MAX_CONFIG_CHARS) throw new Error('pause-config: too large');
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('pause-config: invalid json');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('pause-config: not an object');
    const keys = ownKeys(parsed, REQUIRED_KEYS.length);
    if (!keys) throw new Error('pause-config: too many keys');
    for (const key of keys) {
        if (!REQUIRED_KEYS.includes(key as (typeof REQUIRED_KEYS)[number])) throw new Error(`pause-config: unknown key ${key}`);
    }
    const missing = REQUIRED_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(parsed, key));
    if (missing.length) throw new Error(`pause-config: partial: missing ${missing.join(',')}`);
    const body = parsed as Record<string, unknown>;
    if (body.spRelease !== 'v5.5.0-rc.8') throw new Error('pause-config: spRelease is not v5.5.0-rc.8');
    const superPaymaster = parseAddr(body.superPaymaster);
    const registry = parseAddr(body.registry);
    const implementation = parseAddr(body.implementation);
    const implementationCodeHash = parseHash(body.implementationCodeHash);
    const proxyCodeHash = parseHash(body.proxyCodeHash);
    const startBlock = parseBlock(body.startBlock);
    const registryStartBlock = parseBlock(body.registryStartBlock);
    if (!superPaymaster) throw new Error('pause-config: superPaymaster invalid');
    if (!registry) throw new Error('pause-config: registry invalid');
    if (!implementation) throw new Error('pause-config: implementation invalid');
    if (!implementationCodeHash) throw new Error('pause-config: implementationCodeHash invalid');
    if (!proxyCodeHash) throw new Error('pause-config: proxyCodeHash invalid');
    if (startBlock === null) throw new Error('pause-config: startBlock invalid');
    if (registryStartBlock === null) throw new Error('pause-config: registryStartBlock invalid');
    return Object.freeze({
        superPaymaster,
        registry,
        startBlock,
        registryStartBlock,
        implementation,
        implementationCodeHash,
        proxyCodeHash,
        spRelease: 'v5.5.0-rc.8',
    });
}

export function loadPauseConfigFile(path: string): PauseDutyConfig {
    if (typeof path !== 'string' || path.length === 0 || path.length > 4_096) throw new Error('pause-config: path rejected');
    const st = statSync(path);
    if (!st.isFile() || st.size <= 0 || st.size > MAX_CONFIG_CHARS) throw new Error('pause-config: file rejected');
    return loadPauseConfig(readFileSync(path, 'utf8'));
}

export function assertStartBlock(config: PauseDutyConfig, current: bigint): void {
    if (typeof current !== 'bigint' || current < 0n || config.startBlock > current) {
        throw new Error('pause-config: startBlock after current head');
    }
}

/** Registry may predate the SuperPaymaster. It still has to be at or before the head. */
export function assertRegistryStart(config: PauseDutyConfig, head: bigint): void {
    if (typeof head !== 'bigint' || head < 0n || config.registryStartBlock > head) {
        throw new Error('pause-config: registryStartBlock after current head');
    }
}

function failed(reasons: string[], notes: string[]): PauseRoundResult {
    return { kind: 'failed', reasons: [...reasons], notes: [...notes] };
}

function emptyState(chainId: number, config: PauseDutyConfig): PauseState {
    return {
        version: 2,
        chainId,
        superPaymaster: config.superPaymaster,
        startBlock: config.startBlock,
        cursor: null,
        operators: [],
        streaks: {},
        lastLowBalanceAlertMs: 0,
        lastBalanceFailAlertMs: 0,
        lastFullRescanMs: 0,
        alertedUnconfigured: [],
        fullCursor: null,
    };
}

const STATE_KEYS = [
    'version',
    'chainId',
    'superPaymaster',
    'startBlock',
    'cursor',
    'operators',
    'streaks',
    'lastLowBalanceAlertMs',
    'lastBalanceFailAlertMs',
    'lastFullRescanMs',
    'alertedUnconfigured',
];

function parseState(text: string, chainId: number, config: PauseDutyConfig): PauseState | { mismatchField: string } | null {
    if (text.length > 1_000_000) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const keys = ownKeys(parsed, STATE_KEYS.length + 1);
    if (!keys) return null;
    for (const key of STATE_KEYS) {
        if (!keys.includes(key)) return null;
    }
    const extra = keys.filter((key) => !STATE_KEYS.includes(key));
    if (extra.length > 1 || (extra.length === 1 && extra[0] !== 'fullCursor')) return null;
    const body = parsed as Record<string, unknown>;
    if (body.version !== 2) return null;
    if (typeof body.chainId !== 'number' || !Number.isSafeInteger(body.chainId) || body.chainId <= 0) return null;
    const sp = parseAddr(body.superPaymaster);
    const startBlock = parseBlock(body.startBlock);
    if (!sp || startBlock === null) return null;
    if (body.chainId !== chainId) return { mismatchField: 'chainId' };
    if (sp.toLowerCase() !== config.superPaymaster.toLowerCase()) return { mismatchField: 'superPaymaster' };
    if (startBlock !== config.startBlock) return { mismatchField: 'startBlock' };
    let cursor: bigint | null = null;
    if (body.cursor !== null) {
        cursor = parseBlock(body.cursor);
        if (cursor === null) return null;
    }
    if (!Array.isArray(body.operators) || body.operators.length > MAX_OPERATORS) return null;
    const operators: Address[] = [];
    for (const item of body.operators) {
        const addr = parseAddr(item);
        if (!addr) return null;
        operators.push(addr);
    }
    if (!body.streaks || typeof body.streaks !== 'object' || Array.isArray(body.streaks)) return null;
    const streakKeys = ownKeys(body.streaks, MAX_OPERATORS);
    if (!streakKeys) return null;
    const streaks: Record<string, number> = {};
    for (const key of streakKeys) {
        if (!parseAddr(key)) return null;
        const n = (body.streaks as Record<string, unknown>)[key];
        if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > 1_000_000) return null;
        streaks[key.toLowerCase()] = n;
    }
    if (!safeMs(body.lastLowBalanceAlertMs) || !safeMs(body.lastBalanceFailAlertMs) || !safeMs(body.lastFullRescanMs)) return null;
    if (!Array.isArray(body.alertedUnconfigured) || body.alertedUnconfigured.length > MAX_OPERATORS) return null;
    const alertedUnconfigured: string[] = [];
    for (const item of body.alertedUnconfigured) {
        const addr = parseAddr(item);
        if (!addr) return null;
        alertedUnconfigured.push(addr.toLowerCase());
    }
    let fullCursor: bigint | null = null;
    if (extra.includes('fullCursor') && body.fullCursor !== null) {
        fullCursor = parseBlock(body.fullCursor);
        if (fullCursor === null) return null;
    }
    return {
        version: 2,
        chainId,
        superPaymaster: config.superPaymaster,
        startBlock,
        cursor,
        operators,
        streaks,
        lastLowBalanceAlertMs: body.lastLowBalanceAlertMs as number,
        lastBalanceFailAlertMs: body.lastBalanceFailAlertMs as number,
        lastFullRescanMs: body.lastFullRescanMs as number,
        alertedUnconfigured,
        fullCursor,
    };
}

function safeMs(value: unknown): boolean {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function loadState(path: string, chainId: number, config: PauseDutyConfig): { ok: true; state: PauseState; missing: boolean } | { ok: false; kind: 'corrupt' } | { ok: false; kind: 'mismatch'; field: string } {
    let size = -1;
    try {
        size = statSync(path).size;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, state: emptyState(chainId, config), missing: true };
        return { ok: false, kind: 'corrupt' };
    }
    if (size < 0 || size > 1_000_000) return { ok: false, kind: 'corrupt' };
    let text = '';
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return { ok: false, kind: 'corrupt' };
    }
    const state = parseState(text, chainId, config);
    if (state && 'mismatchField' in state) return { ok: false, kind: 'mismatch', field: state.mismatchField };
    if (!state) return { ok: false, kind: 'corrupt' };
    return { ok: true, state, missing: false };
}

async function saveState(path: string, state: PauseState): Promise<boolean> {
    const body = JSON.stringify({
        version: 2,
        chainId: state.chainId,
        superPaymaster: state.superPaymaster,
        startBlock: state.startBlock.toString(),
        cursor: state.cursor === null ? null : state.cursor.toString(),
        operators: [...state.operators],
        streaks: { ...state.streaks },
        lastLowBalanceAlertMs: state.lastLowBalanceAlertMs,
        lastBalanceFailAlertMs: state.lastBalanceFailAlertMs,
        lastFullRescanMs: state.lastFullRescanMs,
        alertedUnconfigured: [...state.alertedUnconfigured],
        fullCursor: state.fullCursor === null ? null : state.fullCursor.toString(),
    });
    try {
        await atomicWriteFile(path, body);
        return true;
    } catch {
        return false;
    }
}

function flagsOf(decoded: unknown): { isConfigured: boolean; isPaused: boolean } | null {
    if (!Array.isArray(decoded)) return null;
    const isConfigured = decoded[OPERATOR_IS_CONFIGURED_INDEX];
    const isPaused = decoded[OPERATOR_IS_PAUSED_INDEX];
    if (typeof isConfigured !== 'boolean' || typeof isPaused !== 'boolean') return null;
    return { isConfigured, isPaused };
}

function stakeOf(decoded: unknown): bigint | null {
    if (typeof decoded === 'bigint') return decoded;
    return null;
}

function roleConfigOf(decoded: unknown): { minStake: bigint; owner: Address } | null {
    const value = Array.isArray(decoded)
        ? { minStake: decoded[0], owner: decoded[10] }
        : decoded;
    if (!value || typeof value !== 'object') return null;
    const row = value as { minStake?: unknown; owner?: unknown };
    if (typeof row.minStake !== 'bigint' || typeof row.owner !== 'string' || !isAddress(row.owner)) return null;
    return { minStake: row.minStake, owner: getAddress(row.owner) };
}

async function viewAt(chain: PauseChain, to: Address, data: Hex, blockHash: Hex): Promise<HexRead> {
    try {
        const out = await chain.call({ to, data, blockHash });
        if (!out.ok) return { ok: false, reason: out.reason ?? 'unavailable' };
        return explainHex(out.data, 200_000);
    } catch {
        return { ok: false, reason: 'unavailable' };
    }
}

function addressFromWord(word: Hex): Address | null {
    if (word.length !== 66) return null;
    for (let i = 2; i < 26; i++) {
        if (word[i] !== '0') return null;
    }
    try {
        const addr = `0x${word.slice(26)}`;
        if (!isAddress(addr)) return null;
        return getAddress(addr);
    } catch {
        return null;
    }
}

function revertName(data: Hex | undefined): string | null {
    if (!data || data.length < 10 || data.length > 8_000) return null;
    const parsed = explainHex(data, 8_000);
    if (!parsed.ok) return null;
    try {
        return decodeErrorResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, data: parsed.data }).errorName;
    } catch {
        return null;
    }
}

function validLog(log: PauseLog, sp: Address, from: bigint, to: bigint): boolean {
    if (!log || log.removed) return false;
    if (typeof log.address !== 'string' || log.address.toLowerCase() !== sp.toLowerCase()) return false;
    if (!Array.isArray(log.topics) || log.topics.length < 2 || log.topics.length > 4) return false;
    const topic0 = explainHex(log.topics[0], 66);
    if (!topic0.ok || topic0.data.length !== 66 || topic0.data.toLowerCase() !== OPERATOR_TOPIC.toLowerCase()) return false;
    if (typeof log.blockNumber !== 'bigint' || log.blockNumber < from || log.blockNumber > to) return false;
    const topic = explainHex(log.topics[1], 66);
    if (!topic.ok || topic.data.length !== 66) return false;
    if (topic.data.slice(0, 26).toLowerCase() !== '0x000000000000000000000000') return false;
    return isAddress(`0x${topic.data.slice(26)}`);
}

function operatorOf(log: PauseLog): Address {
    return getAddress(`0x${log.topics[1]!.slice(26)}`);
}

function emit(ctx: PauseRoundContext, msg: string): void {
    if (ctx.dryRun) ctx.log(msg);
    else ctx.alert(msg);
}

/** Proxy code hash, implementation slot, implementation code hash, and REGISTRY(). Null means the deployment matches. */
export async function verifySpDeployment(chain: PauseChain, config: PauseDutyConfig, blockHash: Hex): Promise<string | null> {
    const code = await chain.getCode(config.superPaymaster, blockHash);
    if (!code.ok) return `superpaymaster code ${code.reason}`;
    if (keccak256(code.data).toLowerCase() !== config.proxyCodeHash.toLowerCase()) return 'superpaymaster codehash mismatch';
    const slot = await chain.getStorageAt(config.superPaymaster, IMPL_SLOT, blockHash);
    if (!slot.ok) return `implementation slot ${slot.reason}`;
    if (slot.data.length !== 66) return 'implementation slot unavailable';
    const impl = addressFromWord(slot.data);
    if (!impl) return 'implementation slot not an address';
    if (impl.toLowerCase() !== config.implementation.toLowerCase()) return 'implementation mismatch';
    const implCode = await chain.getCode(config.implementation, blockHash);
    if (!implCode.ok) return `implementation code ${implCode.reason}`;
    if (keccak256(implCode.data).toLowerCase() !== config.implementationCodeHash.toLowerCase()) return 'implementation codehash mismatch';
    const registryData = encodeFunctionData({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'REGISTRY' });
    const registryRaw = await viewAt(chain, config.superPaymaster, registryData, blockHash);
    if (!registryRaw.ok) return `REGISTRY() ${registryRaw.reason}`;
    if (registryRaw.data.length !== 66) return 'REGISTRY() unavailable';
    const onChainRegistry = addressFromWord(registryRaw.data);
    if (!onChainRegistry) return 'REGISTRY() not an address';
    if (onChainRegistry.toLowerCase() !== config.registry.toLowerCase()) return 'REGISTRY mismatch';
    return null;
}

async function ingestLogs(ctx: PauseRoundContext, state: PauseState, sp: Address, from: bigint, to: bigint): Promise<'ok' | 'log chunk failed' | 'log chunk invalid' | 'operator inventory full'> {
    const logs = await readLogs(ctx.chain, sp, from, to);
    if (!logs) return 'log chunk failed';
    for (const log of logs) {
        if (!validLog(log, sp, from, to)) return 'log chunk invalid';
        const op = operatorOf(log);
        if (state.operators.length >= MAX_OPERATORS && !state.operators.some((have) => have.toLowerCase() === op.toLowerCase())) {
            return 'operator inventory full';
        }
        if (!state.operators.some((have) => have.toLowerCase() === op.toLowerCase())) state.operators.push(op);
    }
    return 'ok';
}

async function readLogs(chain: PauseChain, sp: Address, from: bigint, to: bigint): Promise<PauseLog[] | null> {
    const walk = async (a: bigint, b: bigint): Promise<PauseLog[] | null> => {
        let logs: PauseLog[] | null = null;
        let bad = false;
        try {
            logs = await chain.getLogs({ address: sp, topic0: OPERATOR_TOPIC, fromBlock: a, toBlock: b });
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

export async function runPauseRound(ctx: PauseRoundContext): Promise<PauseRoundResult> {
    const chunkBlocks = assertPageSize(ctx.chunkBlocks ?? 5_000);
    const rescanBlocks = assertRescanBlocks(ctx.rescanBlocks ?? DEFAULT_RESCAN_BLOCKS);
    if (typeof ctx.dryRun !== 'boolean') return failed(['pause round rejected'], []);
    if (!Number.isSafeInteger(ctx.nowMs) || ctx.nowMs < 0) return failed(['pause round rejected'], []);
    if (typeof ctx.statePath !== 'string' || ctx.statePath.length === 0) return failed(['pause round rejected'], []);
    if (!Number.isInteger(ctx.chainId) || ctx.chainId <= 0) return failed(['pause round rejected'], []);
    const sp = ctx.config.superPaymaster;
    const registry = ctx.config.registry;
    const startBlock = ctx.config.startBlock;
    const signer = ctx.signer;
    const notes: string[] = [];

    const loaded = loadState(ctx.statePath, ctx.chainId, ctx.config);
    const state = loaded.ok ? loaded.state : null;

    if (!loaded.ok) {
        const reason = loaded.kind === 'mismatch'
            ? `pause state belongs to another deployment: ${loaded.field} differs; move aside ${ctx.statePath}`
            : 'pause state corrupt';
        return failed([reason], notes);
    }
    if (!state) return failed(['pause state corrupt'], notes);
    if (!ctx.dryRun && (!signer || !ctx.sender)) return failed(['signer missing'], notes);

    const header = await ctx.chain.latestHeader();
    if (!header || typeof header.number !== 'bigint' || typeof header.hash !== 'string') return failed(['latest block unavailable'], notes);
    if (startBlock > header.number) return failed(['startBlock after current head'], notes);
    const finalized = await ctx.chain.finalizedBlock();
    if (finalized === null || finalized < 0n || finalized > header.number) return failed(['finalized block unavailable'], notes);
    if (startBlock > finalized) return failed(['inventory incomplete'], notes);
    const pinned = await ctx.chain.blockByNumber(finalized);
    if (!pinned || typeof pinned.hash !== 'string' || pinned.hash.length !== 66) return failed(['finalized block unavailable'], notes);
    const blockHash = pinned.hash;
    const deployment = await verifySpDeployment(ctx.chain, ctx.config, blockHash);
    if (deployment) return failed([deployment], notes);

    const cursorNow = state.cursor ?? startBlock;
    let scanFrom = cursorNow > BigInt(rescanBlocks) ? cursorNow - BigInt(rescanBlocks) : startBlock;
    if (scanFrom < startBlock) scanFrom = startBlock;
    let cursor = scanFrom;
    let chunks = 0;
    while (cursor <= finalized) {
        if (chunks >= MAX_CHUNKS) break;
        const span = BigInt(chunkBlocks);
        const to = cursor + span - 1n > finalized ? finalized : cursor + span - 1n;
        const ingested = await ingestLogs(ctx, state, sp, cursor, to);
        if (ingested !== 'ok') return failed([ingested], notes);
        const next = to + 1n;
        if (state.cursor === null || next > state.cursor) state.cursor = next;
        if (!ctx.dryRun && !await saveState(ctx.statePath, state)) return failed(['pause state write failed'], notes);
        cursor = next;
        chunks++;
    }
    if (cursor <= finalized) return failed(['inventory incomplete'], notes);

    const fullDue = state.fullCursor !== null || state.lastFullRescanMs === 0 || ctx.nowMs - state.lastFullRescanMs >= DAY_MS;
    if (fullDue) {
        let fullFrom = state.fullCursor ?? startBlock;
        if (fullFrom < startBlock) fullFrom = startBlock;
        let fullChunks = 0;
        while (fullFrom <= finalized) {
            if (fullChunks >= MAX_CHUNKS) break;
            const span = BigInt(chunkBlocks);
            const to = fullFrom + span - 1n > finalized ? finalized : fullFrom + span - 1n;
            const ingested = await ingestLogs(ctx, state, sp, fullFrom, to);
            if (ingested !== 'ok') return failed([ingested], notes);
            fullFrom = to + 1n;
            state.fullCursor = fullFrom;
            if (!ctx.dryRun && !await saveState(ctx.statePath, state)) return failed(['pause state write failed'], notes);
            fullChunks++;
        }
        if (fullFrom > finalized) {
            state.lastFullRescanMs = ctx.nowMs;
            state.fullCursor = null;
            if (!ctx.dryRun && !await saveState(ctx.statePath, state)) return failed(['pause state write failed'], notes);
        } else {
            notes.push('full rescan incomplete');
        }
    }

    const understaked: Address[] = [];
    for (const op of state.operators) {
        const data = encodeFunctionData({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'operators', args: [op] });
        const raw = await viewAt(ctx.chain, sp, data, blockHash);
        if (!raw.ok) return failed([`operators() unavailable ${op}`], notes);
        let flags: { isConfigured: boolean; isPaused: boolean } | null = null;
        try {
            flags = flagsOf(decodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'operators', data: raw.data }));
        } catch {
            flags = null;
        }
        if (!flags) return failed([`operators() unavailable ${op}`], notes);
        if (!flags.isConfigured) {
            notes.push(`configured log but not configured ${op}`);
            const key = op.toLowerCase();
            if (!state.alertedUnconfigured.includes(key)) {
                if (state.alertedUnconfigured.length < MAX_OPERATORS) state.alertedUnconfigured.push(key);
                emit(ctx, `configured log but not configured ${op}`);
            }
            continue;
        }
        if (flags.isPaused) continue;
        const hasData = encodeFunctionData({
            abi: REGISTRY_PAUSE_ABI,
            functionName: 'hasRole',
            args: [ROLE_PAYMASTER_SUPER, op],
        });
        const hasRaw = await viewAt(ctx.chain, registry, hasData, blockHash);
        if (!hasRaw.ok) return failed([`hasRole unavailable ${op}`], notes);
        let hasRole: boolean;
        try {
            const decoded = decodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'hasRole', data: hasRaw.data });
            if (typeof decoded !== 'boolean') return failed([`hasRole unavailable ${op}`], notes);
            hasRole = decoded;
        } catch {
            return failed([`hasRole unavailable ${op}`], notes);
        }
        const cfgData = encodeFunctionData({ abi: REGISTRY_PAUSE_ABI, functionName: 'getRoleConfig', args: [ROLE_PAYMASTER_SUPER] });
        const cfgRaw = await viewAt(ctx.chain, registry, cfgData, blockHash);
        if (!cfgRaw.ok) return failed([`getRoleConfig unavailable ${op}`], notes);
        let minStake: bigint;
        try {
            const cfg = roleConfigOf(decodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getRoleConfig', data: cfgRaw.data }));
            if (!cfg) return failed([`getRoleConfig unavailable ${op}`], notes);
            minStake = cfg.minStake;
        } catch {
            return failed([`getRoleConfig unavailable ${op}`], notes);
        }
        const stakeData = encodeFunctionData({
            abi: REGISTRY_PAUSE_ABI,
            functionName: 'getEffectiveStake',
            args: [op, ROLE_PAYMASTER_SUPER],
        });
        const stakeRaw = await viewAt(ctx.chain, registry, stakeData, blockHash);
        if (!stakeRaw.ok) return failed([`getEffectiveStake unavailable ${op}`], notes);
        let effectiveStake: bigint;
        try {
            const decoded = stakeOf(decodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getEffectiveStake', data: stakeRaw.data }));
            if (decoded === null) return failed([`getEffectiveStake unavailable ${op}`], notes);
            effectiveStake = decoded;
        } catch {
            return failed([`getEffectiveStake unavailable ${op}`], notes);
        }
        const stakeShort = effectiveStake < minStake;
        if (!hasRole || stakeShort) understaked.push(op);
    }

    const again = await ctx.chain.blockByNumber(finalized);
    if (!again || again.hash.toLowerCase() !== blockHash.toLowerCase()) return failed(['block no longer canonical'], notes);

    const still = new Set(understaked.map((op) => op.toLowerCase()));
    const streakKeys = ownKeys(state.streaks, MAX_OPERATORS) ?? [];
    for (const key of streakKeys) {
        if (!still.has(key)) delete state.streaks[key];
    }
    for (const op of understaked) {
        const key = op.toLowerCase();
        const prev = state.streaks[key] ?? 0;
        const next = prev + 1;
        state.streaks[key] = next;
        if (next === 2) emit(ctx, `pause timeout\noperator=${op}`);
    }
    if (!ctx.dryRun && !await saveState(ctx.statePath, state)) return failed(['pause state write failed'], notes);

    const sent: { operator: Address; hash: Hex }[] = [];
    for (const op of understaked) {
        const data = encodeFunctionData({
            abi: SUPER_PAYMASTER_PAUSE_ABI,
            functionName: 'pauseUnderstakedOperator',
            args: [op],
        });
        if (ctx.dryRun) {
            notes.push(`would pause ${op}`);
            ctx.log(`action=sendTx kind=pause method=pauseUnderstakedOperator(address) target=${sp} operator=${op} (dry-run)`);
            continue;
        }
        const live = await ctx.chain.latestHeader();
        if (!live || typeof live.hash !== 'string' || live.hash.length !== 66) return failed(['latest block unavailable'], notes);
        const liveDeployment = await verifySpDeployment(ctx.chain, ctx.config, live.hash);
        if (liveDeployment) return { kind: 'sp-mismatch', problem: liveDeployment, notes: [...notes] };
        let sim: { ok: true; data: Hex } | { ok: false; data?: Hex; reason?: string };
        try {
            sim = await ctx.chain.call({ to: sp, data, from: signer, at: 'latest' });
        } catch {
            return failed([`pause call rejected ${op}`], notes);
        }
        if (!sim.ok) {
            const name = revertName(sim.data);
            if (name === 'OperatorMeetsMinimumStake') {
                notes.push(`stake recovered between B and latest ${op}`);
                continue;
            }
            if (name === 'OperatorNotConfigured') return failed([`OperatorNotConfigured ${op}`], notes);
            return failed([`pause call rejected ${op}`], notes);
        }
        const result = await ctx.sender!.send({ kind: 'pause', to: sp, data });
        if (result.status === 'refused') return failed([`send refused ${op}`], notes);
        if (result.status === 'blocked') {
            notes.push(`not sent this round ${op}`);
            break;
        }
        if (result.status === 'pending') {
            notes.push(`pause pending ${op} ${result.hash}`);
            break;
        }
        if (result.receipt.status !== 'success') return failed([`pause tx reverted ${op}`], notes);
        const after = encodeFunctionData({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'operators', args: [op] });
        const raw = await viewAt(ctx.chain, sp, after, result.receipt.blockHash);
        if (!raw.ok) return failed([`post-inclusion operators() unavailable ${op}`], notes);
        let paused = false;
        try {
            const flags = flagsOf(decodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'operators', data: raw.data }));
            if (!flags) return failed([`post-inclusion operators() unavailable ${op}`], notes);
            paused = flags.isPaused;
        } catch {
            return failed([`post-inclusion operators() unavailable ${op}`], notes);
        }
        if (!paused) return failed([`operator not paused after inclusion ${op}`], notes);
        sent.push({ operator: op, hash: result.hash });
        emit(ctx, `paused understaked operator ${op}\ntx=${result.hash}`);
    }

    return {
        kind: 'ok',
        checked: state.operators.length,
        understaked: [...understaked],
        sent: [...sent],
        notes: [...notes],
    };
}
