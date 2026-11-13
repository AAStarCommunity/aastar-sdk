/**
 * Nonce journal for the single in-process sender.
 * A file that fails validation refuses sends. It is never replaced with an empty journal.
 */
import { chmod, mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { keccak256, type Address, type Hex } from 'viem';

export type JournalKind = 'price-super' | 'price-paymaster' | 'pause' | 'cancel';
export type JournalStatus = 'signed' | 'sent' | 'included';

export interface JournalEntry {
    nonce: number;
    kind: JournalKind;
    to: Hex;
    data: Hex;
    raws: Hex[];
    hashes: Hex[];
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    status: JournalStatus;
    attempts: number;
    createdAt: number;
    /** Set only after this nonce was replaced by a cancel. Absent on older journals. */
    cancelled?: boolean;
}

export interface JournalIdentity {
    chainId: number;
    signer: Address;
}

interface JournalState extends JournalIdentity {
    baseNonce: number;
    entries: JournalEntry[];
    /** Set when a nonce was consumed by a transaction that is not ours. Cleared only by resync. */
    foreignNonce?: number;
}

const MAX_FILE_BYTES = 1_000_000;
const MAX_ENTRIES = 10_000;
/** Attempts may saturate here. Parse accepts every safe integer, so the cap does not reject a file. */
export const JOURNAL_ATTEMPT_CAP = Number.MAX_SAFE_INTEGER;
/** Hashes kept for one nonce. Further bumps are refused. A cancel is still stored. */
export const JOURNAL_HASH_CAP = 1_000;
/** Latest signed bytes kept on disk. Older hashes stay without their raws. */
export const JOURNAL_RAW_KEEP = 3;
/** @deprecated Use JOURNAL_RAW_KEEP. Retained so callers name the stored-raw bound. */
export const JOURNAL_RAW_CAP = JOURNAL_RAW_KEEP;
const MAX_DATA_CHARS = 200_000;
const KEEP_INCLUDED = 16;
const ENTRY_KEYS = ['nonce', 'kind', 'to', 'data', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'status', 'attempts', 'createdAt'];
const ROOT_KEYS = ['version', 'chainId', 'signer', 'baseNonce', 'entries'];

const KINDS = new Set(['price-super', 'price-paymaster', 'pause', 'cancel']);
const STATUSES = new Set(['signed', 'sent', 'included']);

export interface DurabilityHooks {
    write(fh: FileHandle, body: string): Promise<void>;
    fsyncFile(fh: FileHandle): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    fsyncDir(dir: string): Promise<void>;
}

const realDurability: DurabilityHooks = {
    async write(fh, body) {
        await fh.writeFile(body, 'utf8');
    },
    async fsyncFile(fh) {
        await fh.sync();
    },
    async rename(from, to) {
        await rename(from, to);
    },
    async fsyncDir(dir) {
        const dh = await open(dir, 'r');
        try {
            await dh.sync();
        } finally {
            await dh.close();
        }
    },
};

let durability: DurabilityHooks = realDurability;

/** Test hook. Production uses the real filesystem. Pass null to restore it. */
export function setDurabilityHooks(next: DurabilityHooks | null): void {
    durability = next ?? realDurability;
}

function assertExistingDir(dir: string): void {
    let existing: ReturnType<typeof lstatSync>;
    try {
        existing = lstatSync(dir);
    } catch {
        throw new Error('journal: parent unreadable');
    }
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error('journal: parent is not a directory');
    const owner = process.getuid?.();
    if (owner === undefined || existing.uid !== owner) throw new Error('journal: parent not owned by uid');
    if ((existing.mode & 0o022) !== 0) throw new Error('journal: parent is group or world writable');
}

/** Create missing parents and fsync each parent after its new child exists. */
export async function ensureJournalDir(journalPath: string): Promise<void> {
    if (typeof journalPath !== 'string' || journalPath.length === 0) throw new Error('journal: path rejected');
    await ensureDir(dirname(journalPath));
}

async function ensureDir(dir: string): Promise<void> {
    const abs = resolve(dir);
    const missing: string[] = [];
    let cursor = abs;
    let existing: string | null = null;
    while (cursor !== dirname(cursor)) {
        let st: ReturnType<typeof lstatSync> | null = null;
        try {
            st = lstatSync(cursor);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('journal: parent unreadable');
        }
        if (st) {
            if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('journal: parent is not a directory');
            existing = cursor;
            break;
        }
        missing.push(cursor);
        cursor = dirname(cursor);
    }
    if (!existing) throw new Error('journal: parent unreadable');
    if (missing.length === 0) {
        assertExistingDir(abs);
        return;
    }
    let parent = existing;
    for (const next of missing.reverse()) {
        await mkdir(next, { mode: 0o700 });
        try {
            await durability.fsyncDir(parent);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'EPERM' && parent === resolve('/')) continue;
            throw new Error('journal: parent sync failed');
        }
        await chmod(next, 0o700);
        parent = next;
    }
}

async function writeDurable(filePath: string, body: string, exclusive: boolean): Promise<void> {
    const dir = dirname(filePath);
    await ensureDir(dir);
    const flags = exclusive
        ? constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY
        : constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW | constants.O_WRONLY;
    const target = exclusive ? filePath : join(dir, `.${basename(filePath)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    let fh: FileHandle;
    try {
        fh = await open(target, flags, 0o600);
    } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (exclusive && (code === 'EEXIST' || code === 'ELOOP')) throw new Error('journal: already exists');
        throw new Error('journal: create failed');
    }
    try {
        await fh.chmod(0o600);
        await durability.write(fh, body);
        await durability.fsyncFile(fh);
    } catch (e) {
        await fh.close().catch(() => {});
        if (!exclusive) await unlink(target).catch(() => {});
        if (e instanceof Error && e.message.startsWith('journal:')) throw e;
        throw new Error('journal: create failed');
    }
    await fh.close();
    if (!exclusive) {
        try {
            await durability.rename(target, filePath);
        } catch (e) {
            await unlink(target).catch(() => {});
            if (e instanceof Error && e.message.startsWith('journal:')) throw e;
            throw new Error('journal: create failed');
        }
    }
    try {
        await durability.fsyncDir(dir);
    } catch {
        throw new Error('journal: parent sync failed');
    }
}

export async function atomicWriteFile(filePath: string, body: string): Promise<void> {
    await writeDurable(filePath, body, false);
}

function ownKeysBounded(value: object, max: number): string[] | null {
    const keys: string[] = [];
    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        keys.push(key);
        if (keys.length > max) return null;
    }
    return keys;
}

function isHex(value: unknown, maxChars: number, bytes?: number): value is Hex {
    if (typeof value !== 'string') return false;
    if (value.length < 2 || value.length > maxChars) return false;
    if (bytes !== undefined && value.length !== 2 + bytes * 2) return false;
    if ((value.length - 2) % 2 !== 0) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return value.charCodeAt(0) === 48 && (value.charCodeAt(1) === 120 || value.charCodeAt(1) === 88);
}

function isAddress(value: unknown): value is Hex {
    return isHex(value, 42, 20);
}

function parseUint(value: unknown, maxLen: number): bigint | null {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) return null;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c < 48 || c > 57) return null;
    }
    return BigInt(value);
}

function parseSafeInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
    return value;
}

function rootKeysOk(value: object): boolean {
    const keys = ownKeysBounded(value, ROOT_KEYS.length + 1);
    if (!keys) return false;
    for (const key of keys) {
        if (key !== 'foreignNonce' && !ROOT_KEYS.includes(key)) return false;
    }
    for (const key of ROOT_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    }
    return true;
}

function parseEntry(value: unknown, index: number, baseNonce: number): JournalEntry | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!hasEntryKeys(value)) return null;
    const e = value as Record<string, unknown>;
    const nonce = parseSafeInt(e.nonce);
    if (nonce === null || nonce < 0 || nonce !== baseNonce + index) return null;
    if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return null;
    if (!isAddress(e.to) || !isHex(e.data, MAX_DATA_CHARS)) return null;
    if (!Array.isArray(e.raws) || !Array.isArray(e.hashes)) return null;
    if (e.raws.length === 0 || e.raws.length > JOURNAL_HASH_CAP || e.hashes.length === 0 || e.hashes.length > JOURNAL_HASH_CAP) return null;
    if (e.raws.length > e.hashes.length) return null;
    const hashes: Hex[] = [];
    for (let i = 0; i < e.hashes.length; i++) {
        const hash = e.hashes[i];
        if (!isHex(hash, 66, 32)) return null;
        hashes.push(hash);
    }
    const offset = hashes.length - e.raws.length;
    const aligned: Hex[] = [];
    for (let i = 0; i < e.raws.length; i++) {
        const raw = e.raws[i];
        if (!isHex(raw, MAX_DATA_CHARS)) return null;
        if (keccak256(raw).toLowerCase() !== hashes[offset + i]!.toLowerCase()) return null;
        aligned.push(raw);
    }
    const raws = aligned.slice(Math.max(0, aligned.length - JOURNAL_RAW_KEEP));
    const gasLimit = parseUint(e.gasLimit, 40);
    const maxFeePerGas = parseUint(e.maxFeePerGas, 40);
    const maxPriorityFeePerGas = parseUint(e.maxPriorityFeePerGas, 40);
    if (gasLimit === null || maxFeePerGas === null || maxPriorityFeePerGas === null) return null;
    if (gasLimit <= 0n || maxFeePerGas < maxPriorityFeePerGas) return null;
    if (typeof e.status !== 'string' || !STATUSES.has(e.status)) return null;
    const attempts = parseSafeInt(e.attempts);
    const createdAt = parseSafeInt(e.createdAt);
    if (attempts === null || attempts < 1) return null;
    if (createdAt === null || createdAt <= 0) return null;
    let cancelled = false;
    if (Object.prototype.hasOwnProperty.call(e, 'cancelled')) {
        if (typeof e.cancelled !== 'boolean') return null;
        cancelled = e.cancelled;
    }
    if ((e.kind === 'cancel') !== cancelled) return null;
    return {
        nonce,
        kind: e.kind as JournalKind,
        to: e.to,
        data: e.data,
        raws,
        hashes,
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        status: e.status as JournalStatus,
        attempts,
        createdAt,
        ...(cancelled ? { cancelled: true } : {}),
    };
}

/** `cancelled` is optional so a journal written before cancel entries still loads. */
function hasEntryKeys(value: object): boolean {
    const keys = ownKeysBounded(value, ENTRY_KEYS.length + 1);
    if (!keys) return false;
    for (const key of keys) {
        if (key !== 'cancelled' && !ENTRY_KEYS.includes(key)) return false;
    }
    for (const key of ENTRY_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    }
    return true;
}

function parseState(text: string, identity: JournalIdentity): JournalState | 'mismatch' | null {
    if (text.length > MAX_FILE_BYTES) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!rootKeysOk(parsed)) return null;
    const root = parsed as Record<string, unknown>;
    if (root.version !== 2) return null;
    const chainId = parseSafeInt(root.chainId);
    if (chainId === null || chainId <= 0) return null;
    if (!isAddress(root.signer)) return null;
    if (chainId !== identity.chainId || root.signer.toLowerCase() !== identity.signer.toLowerCase()) return 'mismatch';
    const baseNonce = parseSafeInt(root.baseNonce);
    if (baseNonce === null || baseNonce < 0) return null;
    if (!Array.isArray(root.entries) || root.entries.length > MAX_ENTRIES) return null;
    let foreignNonce: number | undefined;
    if (Object.prototype.hasOwnProperty.call(root, 'foreignNonce')) {
        const parsedNonce = parseSafeInt(root.foreignNonce);
        if (parsedNonce === null || parsedNonce < 0) return null;
        foreignNonce = parsedNonce;
    }
    const entries: JournalEntry[] = [];
    let opened = false;
    for (let i = 0; i < root.entries.length; i++) {
        const entry = parseEntry(root.entries[i], i, baseNonce);
        if (!entry) return null;
        if (entry.status !== 'included') opened = true;
        else if (opened) return null;
        entries.push(entry);
    }
    return { chainId, signer: root.signer, baseNonce, entries, ...(foreignNonce !== undefined ? { foreignNonce } : {}) };
}

function prune(state: JournalState): JournalState {
    const openAt = state.entries.findIndex((entry) => entry.status !== 'included');
    let included = openAt === -1 ? state.entries.slice() : state.entries.slice(0, openAt);
    const open = openAt === -1 ? [] : state.entries.slice(openAt);
    if (included.length > KEEP_INCLUDED) included = included.slice(included.length - KEEP_INCLUDED);
    const entries = [...included, ...open];
    const foreign = state.foreignNonce;
    if (entries.length === 0) {
        return {
            chainId: state.chainId,
            signer: state.signer,
            baseNonce: state.baseNonce + state.entries.length,
            entries: [],
            ...(foreign !== undefined ? { foreignNonce: foreign } : {}),
        };
    }
    return {
        chainId: state.chainId,
        signer: state.signer,
        baseNonce: entries[0]!.nonce,
        entries,
        ...(foreign !== undefined ? { foreignNonce: foreign } : {}),
    };
}

function serialize(state: JournalState): string {
    return JSON.stringify({
        version: 2,
        chainId: state.chainId,
        signer: state.signer,
        baseNonce: state.baseNonce,
        ...(state.foreignNonce !== undefined ? { foreignNonce: state.foreignNonce } : {}),
        entries: state.entries.map((e) => ({
            nonce: e.nonce,
            kind: e.kind,
            to: e.to,
            data: e.data,
            raws: [...e.raws],
            hashes: [...e.hashes],
            gasLimit: e.gasLimit.toString(),
            maxFeePerGas: e.maxFeePerGas.toString(),
            maxPriorityFeePerGas: e.maxPriorityFeePerGas.toString(),
            status: e.status,
            attempts: e.attempts,
            createdAt: e.createdAt,
            ...(e.cancelled ? { cancelled: true } : {}),
        })),
    });
}

function copyEntry(e: JournalEntry): JournalEntry {
    return { ...e, raws: [...e.raws], hashes: [...e.hashes] };
}

export class Journal {
    private state: JournalState | null = null;
    private corrupt = false;
    private unsafe = false;
    private readonly identity: JournalIdentity;

    constructor(readonly path: string, identity: JournalIdentity) {
        if (typeof path !== 'string' || path.length === 0 || path.length > 4_096) {
            throw new Error('journal: path rejected');
        }
        if (!Number.isInteger(identity.chainId) || identity.chainId <= 0) throw new Error('journal: chainId rejected');
        if (!isAddress(identity.signer)) throw new Error('journal: signer rejected');
        this.identity = { chainId: identity.chainId, signer: identity.signer };
    }

    /** missing = no file yet. corrupt, unsafe and mismatch stick for this object. mismatch is never reused. */
    async load(): Promise<'missing' | 'ok' | 'corrupt' | 'mismatch' | 'unsafe'> {
        if (this.corrupt) return 'corrupt';
        if (this.unsafe) return 'unsafe';
        if (this.state) return 'ok';
        const read = await this.readText();
        if (read.kind !== 'text') {
            if (read.kind === 'missing') return 'missing';
            if (read.kind === 'corrupt') {
                this.corrupt = true;
                return 'corrupt';
            }
            this.unsafe = true;
            return 'unsafe';
        }
        const parsed = parseState(read.text, this.identity);
        if (parsed === 'mismatch') return 'mismatch';
        if (!parsed) {
            this.corrupt = true;
            return 'corrupt';
        }
        this.state = parsed;
        return 'ok';
    }

    /** Persist an empty journal before the first signature. Refuses a file that is already there. */
    async init(baseNonce: number): Promise<void> {
        if (this.corrupt || this.unsafe) throw new Error('journal: corrupt');
        if (this.state) throw new Error('journal: already open');
        if (!Number.isSafeInteger(baseNonce) || baseNonce < 0) throw new Error('journal: base nonce rejected');
        const next: JournalState = { ...this.identity, baseNonce, entries: [] };
        await writeDurable(this.path, serialize(next), true);
        this.state = next;
    }

    nextNonce(): number {
        if (!this.state) throw new Error('journal: not open');
        return this.state.baseNonce + this.state.entries.length;
    }

    /** Earliest signed or sent entry. Copies the object. */
    inFlight(): JournalEntry | null {
        if (!this.state) return null;
        const entry = this.state.entries.find((item) => item.status !== 'included');
        return entry ? copyEntry(entry) : null;
    }

    lastEntry(): JournalEntry | null {
        if (!this.state || this.state.entries.length === 0) return null;
        return copyEntry(this.state.entries[this.state.entries.length - 1]!);
    }

    entries(): JournalEntry[] {
        if (!this.state) throw new Error('journal: not open');
        return this.state.entries.map(copyEntry);
    }

    foreignNonce(): number | null {
        if (!this.state) throw new Error('journal: not open');
        return this.state.foreignNonce ?? null;
    }

    async append(entry: JournalEntry): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        if (this.state.entries.some((item) => item.status !== 'included')) throw new Error('journal: nonce gap');
        if (entry.nonce !== this.nextNonce()) throw new Error('journal: nonce gap');
        const next: JournalState = {
            ...this.state,
            entries: [...this.state.entries, copyEntry(entry)],
        };
        await this.commit(next);
    }

    async updateInFlight(patch: Partial<Pick<JournalEntry, 'status' | 'attempts' | 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'kind' | 'gasLimit' | 'to' | 'data'>> & { raw?: Hex; hash?: Hex; cancelled?: boolean; replaceRaws?: boolean }): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        const entries = this.state.entries.map(copyEntry);
        const index = entries.findIndex((item) => item.status !== 'included');
        const last = index >= 0 ? entries[index] : undefined;
        if (!last) throw new Error('journal: no in-flight entry');
        if (patch.status) last.status = patch.status;
        if (patch.attempts !== undefined) {
            if (!Number.isSafeInteger(patch.attempts) || patch.attempts < 1) throw new Error('journal: attempts rejected');
            last.attempts = patch.attempts;
        }
        if (patch.maxFeePerGas !== undefined) last.maxFeePerGas = patch.maxFeePerGas;
        if (patch.maxPriorityFeePerGas !== undefined) last.maxPriorityFeePerGas = patch.maxPriorityFeePerGas;
        if (patch.kind !== undefined) last.kind = patch.kind;
        if (patch.gasLimit !== undefined) last.gasLimit = patch.gasLimit;
        if (patch.to !== undefined) last.to = patch.to;
        if (patch.data !== undefined) last.data = patch.data;
        if (patch.cancelled !== undefined) last.cancelled = patch.cancelled;
        if (patch.raw && patch.hash) {
            if (keccak256(patch.raw).toLowerCase() !== patch.hash.toLowerCase()) throw new Error('journal: hash mismatch');
            const cancelling = patch.replaceRaws === true;
            if (!cancelling && last.hashes.length >= JOURNAL_HASH_CAP) throw new Error('journal: too many replacements');
            if (cancelling && last.hashes.length >= JOURNAL_HASH_CAP) last.hashes.shift();
            last.hashes.push(patch.hash);
            if (cancelling) last.raws = [patch.raw];
            else {
                last.raws.push(patch.raw);
                while (last.raws.length > JOURNAL_RAW_KEEP) last.raws.shift();
            }
        }
        await this.commit({ ...this.state, entries });
    }

    /** Replace the entry list. `foreignNonce` null clears a recorded foreign nonce. */
    async rewrite(entries: JournalEntry[], foreignNonce: number | null): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        const next: JournalState = {
            chainId: this.state.chainId,
            signer: this.state.signer,
            baseNonce: entries.length > 0 ? entries[0]!.nonce : this.state.baseNonce,
            entries: entries.map(copyEntry),
            ...(foreignNonce !== null ? { foreignNonce } : {}),
        };
        await this.commit(next);
    }

    entryCount(): number {
        if (!this.state) throw new Error('journal: not open');
        return this.state.entries.length;
    }

    /** True when a loaded entry is still signed or sent. */
    hasOpenEntry(): boolean {
        if (!this.state) throw new Error('journal: not open');
        return this.state.entries.some((entry) => entry.status !== 'included');
    }

    /** Drop every entry and set baseNonce to the chain nonce. The caller has already checked the rules. */
    async realign(baseNonce: number, opts?: { allowOpen?: boolean }): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        if (!opts?.allowOpen && this.state.entries.some((entry) => entry.status !== 'included')) {
            throw new Error('journal: resync refused in-flight');
        }
        if (!Number.isSafeInteger(baseNonce) || baseNonce < 0) throw new Error('journal: base nonce rejected');
        await this.commit({ chainId: this.state.chainId, signer: this.state.signer, baseNonce, entries: [] });
    }

    async demoteIncluded(): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        const entries = this.state.entries.map(copyEntry);
        const last = entries[entries.length - 1];
        if (!last || last.status !== 'included') throw new Error('journal: no included entry');
        last.status = 'sent';
        await this.commit({ ...this.state, entries });
    }

    private async commit(next: JournalState): Promise<void> {
        const pruned = prune(next);
        await atomicWriteFile(this.path, serialize(pruned));
        this.state = pruned;
    }

    private async readText(): Promise<{ kind: 'missing' | 'unsafe' | 'corrupt' } | { kind: 'text'; text: string }> {
        let fh: FileHandle;
        try {
            fh = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return { kind: 'missing' };
            return { kind: 'unsafe' };
        }
        try {
            const st = await fh.stat();
            const owner = process.getuid?.();
            if (!st.isFile() || owner === undefined || st.uid !== owner || (st.mode & 0o777) !== 0o600) return { kind: 'unsafe' };
            if (st.size < 0 || st.size > MAX_FILE_BYTES) return { kind: 'corrupt' };
            const text = await fh.readFile({ encoding: 'utf8' });
            return { kind: 'text', text };
        } catch {
            return { kind: 'unsafe' };
        } finally {
            await fh.close();
        }
    }
}

const heldLocks = new Set<Server>();
let lockExitHooked = false;

function hookLockExit(): void {
    if (lockExitHooked) return;
    lockExitHooked = true;
    process.on('exit', () => {
        for (const server of heldLocks) {
            try { server.close(); } catch { /* the process is leaving */ }
        }
        heldLocks.clear();
    });
}

/** Stable loopback port for one chain and signer. The kernel drops it when the process dies. */
export function keeperLockPort(chainId: number, signer: string): number {
    const digest = createHash('sha256').update(`aastar-keeper:${chainId}:${signer.toLowerCase()}`).digest();
    return 20_000 + (digest.readUInt16BE(0) % 25_000);
}

/** Second lock, keyed by the journal's canonical path, so two signers cannot share one file. */
export function journalFileLockPort(realPath: string): number {
    const digest = createHash('sha256').update(`aastar-keeper-file:${realPath}`).digest();
    return 45_000 + (digest.readUInt16BE(0) % 20_000);
}

function listenLoopback(port: number): Promise<Server> {
    const server = createServer();
    hookLockExit();
    return new Promise((resolve, reject) => {
        const fail = (error: NodeJS.ErrnoException) => {
            server.removeListener('listening', ok);
            if (error.code === 'EADDRINUSE') reject(new Error('journal: lock held'));
            else reject(new Error('journal: lock unreadable'));
        };
        const ok = () => {
            server.removeListener('error', fail);
            heldLocks.add(server);
            resolve(server);
        };
        server.once('error', fail);
        server.once('listening', ok);
        server.listen({ port, host: '127.0.0.1', exclusive: true });
    });
}

async function closeServer(server: Server): Promise<void> {
    heldLocks.delete(server);
    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });
}

/**
 * Listening socket on 127.0.0.1, keyed by chain id and signer, plus one keyed by the journal path.
 * The journal directory is created and checked before either socket is bound.
 */
export async function acquireKeeperLock(opts: { journalPath: string; chainId: number; signer: Address }): Promise<() => Promise<void>> {
    if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('journal: chainId rejected');
    if (typeof opts.signer !== 'string' || opts.signer.length !== 42) throw new Error('journal: signer rejected');
    await ensureJournalDir(opts.journalPath);
    const parentReal = realpathSync(dirname(resolve(opts.journalPath)));
    const fileKey = join(parentReal, basename(opts.journalPath));
    const signerServer = await listenLoopback(keeperLockPort(opts.chainId, opts.signer));
    let fileServer: Server;
    try {
        fileServer = await listenLoopback(journalFileLockPort(fileKey));
    } catch (error) {
        await closeServer(signerServer);
        throw error;
    }
    let released = false;
    return async () => {
        if (released) return;
        released = true;
        await closeServer(fileServer);
        await closeServer(signerServer);
    };
}

export interface ResyncResult {
    ok: true;
    from: number;
    to: number;
    dropped: number;
}

/**
 * One-shot realign. An open nonce is allowed only when the caller has shown it was consumed
 * (`consumedOpen`) or the journal already records `foreignNonce`.
 */
export async function resyncJournal(
    journal: Journal,
    latest: bigint,
    pending: bigint,
    opts?: { consumedOpen?: boolean },
): Promise<ResyncResult | { ok: false; reason: string }> {
    const loaded = await journal.load();
    if (loaded === 'missing') return { ok: false, reason: 'journal: resync refused missing' };
    if (loaded === 'corrupt') return { ok: false, reason: 'journal: resync refused corrupt' };
    if (loaded === 'unsafe') return { ok: false, reason: 'journal: resync refused unsafe' };
    if (loaded === 'mismatch') return { ok: false, reason: 'journal: resync refused mismatch' };
    if (typeof latest !== 'bigint' || typeof pending !== 'bigint' || latest < 0n || pending < 0n || latest > BigInt(Number.MAX_SAFE_INTEGER) || pending > BigInt(Number.MAX_SAFE_INTEGER)) {
        return { ok: false, reason: 'journal: resync refused nonce' };
    }
    if (latest !== pending) return { ok: false, reason: 'journal: resync refused unsettled nonce' };
    const consumed = opts?.consumedOpen === true || journal.foreignNonce() !== null;
    if (journal.hasOpenEntry() && !consumed) return { ok: false, reason: 'journal: resync refused in-flight' };
    const from = journal.nextNonce();
    const dropped = journal.entryCount();
    await journal.realign(Number(latest), { allowOpen: consumed });
    return { ok: true, from, to: journal.nextNonce(), dropped };
}
