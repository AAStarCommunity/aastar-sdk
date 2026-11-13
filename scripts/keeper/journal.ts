/**
 * Nonce journal for the single in-process sender.
 * A file that fails validation refuses sends. It is never replaced with an empty journal.
 */
import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { lstatSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { basename, dirname, join } from 'node:path';
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
}

const MAX_FILE_BYTES = 1_000_000;
const MAX_ENTRIES = 10_000;
/** Parse rejects a larger attempts count. The sender stops incrementing at this cap. */
export const JOURNAL_ATTEMPT_CAP = 1_000;
/** Parse rejects more replacement raws. The sender rebroadcasts the latest raw once this is full. */
export const JOURNAL_RAW_CAP = 20;
const MAX_RAWS = JOURNAL_RAW_CAP;
const MAX_DATA_CHARS = 200_000;
const KEEP_INCLUDED = 16;
const ENTRY_KEYS = ['nonce', 'kind', 'to', 'data', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'status', 'attempts', 'createdAt'];
const ROOT_KEYS = ['version', 'chainId', 'signer', 'baseNonce', 'entries'];

const KINDS = new Set(['price-super', 'price-paymaster', 'pause', 'cancel']);
const STATUSES = new Set(['signed', 'sent', 'included']);

/** Create a missing journal directory at 0700, or refuse one this uid does not own. */
export async function ensureJournalDir(journalPath: string): Promise<void> {
    if (typeof journalPath !== 'string' || journalPath.length === 0) throw new Error('journal: path rejected');
    await prepareParent(dirname(journalPath));
}

async function prepareParent(dir: string): Promise<void> {
    let existing: ReturnType<typeof lstatSync> | null = null;
    try {
        existing = lstatSync(dir);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('journal: parent unreadable');
    }
    if (!existing) {
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await chmod(dir, 0o700);
    } else {
        if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error('journal: parent is not a directory');
        const owner = process.getuid?.();
        if (owner === undefined || existing.uid !== owner) throw new Error('journal: parent not owned by uid');
        if ((existing.mode & 0o022) !== 0) throw new Error('journal: parent is group or world writable');
    }
}

export async function atomicWriteFile(filePath: string, body: string): Promise<void> {
    const dir = dirname(filePath);
    await prepareParent(dir);
    const tmp = join(dir, `.${basename(filePath)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    const fh = await open(tmp, 'w', 0o600);
    try {
        await fh.writeFile(body, 'utf8');
        await fh.sync();
    } finally {
        await fh.close();
    }
    await chmod(tmp, 0o600);
    try {
        await rename(tmp, filePath);
    } catch (e) {
        await unlink(tmp).catch(() => {});
        throw e;
    }
    const dh = await open(dir, 'r');
    try {
        await dh.sync();
    } finally {
        await dh.close();
    }
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

function sameKeys(value: object, expected: string[]): boolean {
    const keys = ownKeysBounded(value, expected.length);
    if (!keys || keys.length !== expected.length) return false;
    for (const key of expected) {
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
    if (e.raws.length === 0 || e.raws.length > MAX_RAWS || e.raws.length !== e.hashes.length) return null;
    const raws: Hex[] = [];
    const hashes: Hex[] = [];
    for (let i = 0; i < e.raws.length; i++) {
        const raw = e.raws[i];
        const hash = e.hashes[i];
        if (!isHex(raw, MAX_DATA_CHARS) || !isHex(hash, 66, 32)) return null;
        if (keccak256(raw).toLowerCase() !== hash.toLowerCase()) return null;
        raws.push(raw);
        hashes.push(hash);
    }
    const gasLimit = parseUint(e.gasLimit, 40);
    const maxFeePerGas = parseUint(e.maxFeePerGas, 40);
    const maxPriorityFeePerGas = parseUint(e.maxPriorityFeePerGas, 40);
    if (gasLimit === null || maxFeePerGas === null || maxPriorityFeePerGas === null) return null;
    if (gasLimit <= 0n || maxFeePerGas < maxPriorityFeePerGas) return null;
    if (typeof e.status !== 'string' || !STATUSES.has(e.status)) return null;
    const attempts = parseSafeInt(e.attempts);
    const createdAt = parseSafeInt(e.createdAt);
    if (attempts === null || attempts < 1 || attempts > JOURNAL_ATTEMPT_CAP) return null;
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
    if (!sameKeys(parsed, ROOT_KEYS)) return null;
    const root = parsed as Record<string, unknown>;
    if (root.version !== 2) return null;
    const chainId = parseSafeInt(root.chainId);
    if (chainId === null || chainId <= 0) return null;
    if (!isAddress(root.signer)) return null;
    if (chainId !== identity.chainId || root.signer.toLowerCase() !== identity.signer.toLowerCase()) return 'mismatch';
    const baseNonce = parseSafeInt(root.baseNonce);
    if (baseNonce === null || baseNonce < 0) return null;
    if (!Array.isArray(root.entries) || root.entries.length > MAX_ENTRIES) return null;
    const entries: JournalEntry[] = [];
    let open = 0;
    for (let i = 0; i < root.entries.length; i++) {
        const entry = parseEntry(root.entries[i], i, baseNonce);
        if (!entry) return null;
        if (entry.status !== 'included') {
            open++;
            if (i !== root.entries.length - 1) return null;
        }
        entries.push(entry);
    }
    if (open > 1) return null;
    return { chainId, signer: root.signer, baseNonce, entries };
}

function prune(state: JournalState): JournalState {
    const last = state.entries[state.entries.length - 1];
    const open = last && last.status !== 'included' ? last : null;
    let included = open ? state.entries.slice(0, -1) : state.entries.slice();
    if (included.length > KEEP_INCLUDED) included = included.slice(included.length - KEEP_INCLUDED);
    const entries = open ? [...included, open] : included;
    if (entries.length === 0) {
        return {
            chainId: state.chainId,
            signer: state.signer,
            baseNonce: state.baseNonce + state.entries.length,
            entries: [],
        };
    }
    return { chainId: state.chainId, signer: state.signer, baseNonce: entries[0]!.nonce, entries };
}

function serialize(state: JournalState): string {
    return JSON.stringify({
        version: 2,
        chainId: state.chainId,
        signer: state.signer,
        baseNonce: state.baseNonce,
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
    private readonly identity: JournalIdentity;

    constructor(readonly path: string, identity: JournalIdentity) {
        if (typeof path !== 'string' || path.length === 0 || path.length > 4_096) {
            throw new Error('journal: path rejected');
        }
        if (!Number.isInteger(identity.chainId) || identity.chainId <= 0) throw new Error('journal: chainId rejected');
        if (!isAddress(identity.signer)) throw new Error('journal: signer rejected');
        this.identity = { chainId: identity.chainId, signer: identity.signer };
    }

    /** missing = no file yet. corrupt and mismatch stick. mismatch is never reused. */
    async load(): Promise<'missing' | 'ok' | 'corrupt' | 'mismatch'> {
        if (this.corrupt) return 'corrupt';
        if (this.state) return 'ok';
        let size = -1;
        try {
            size = statSync(this.path).size;
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return 'missing';
            this.corrupt = true;
            return 'corrupt';
        }
        if (size < 0 || size > MAX_FILE_BYTES) {
            this.corrupt = true;
            return 'corrupt';
        }
        let text = '';
        const fh = await open(this.path, 'r').catch(() => null);
        if (!fh) {
            this.corrupt = true;
            return 'corrupt';
        }
        try {
            text = await fh.readFile({ encoding: 'utf8' });
        } catch {
            this.corrupt = true;
            return 'corrupt';
        } finally {
            await fh.close();
        }
        const parsed = parseState(text, this.identity);
        if (parsed === 'mismatch') return 'mismatch';
        if (!parsed) {
            this.corrupt = true;
            return 'corrupt';
        }
        this.state = parsed;
        return 'ok';
    }

    /** Persist an empty journal before the first signature. */
    async init(baseNonce: number): Promise<void> {
        if (this.corrupt) throw new Error('journal: corrupt');
        if (this.state) throw new Error('journal: already open');
        if (!Number.isSafeInteger(baseNonce) || baseNonce < 0) throw new Error('journal: base nonce rejected');
        await this.commit({ ...this.identity, baseNonce, entries: [] });
    }

    nextNonce(): number {
        if (!this.state) throw new Error('journal: not open');
        return this.state.baseNonce + this.state.entries.length;
    }

    inFlight(): JournalEntry | null {
        if (!this.state || this.state.entries.length === 0) return null;
        const last = this.state.entries[this.state.entries.length - 1];
        if (!last || last.status === 'included') return null;
        return copyEntry(last);
    }

    lastEntry(): JournalEntry | null {
        if (!this.state || this.state.entries.length === 0) return null;
        return copyEntry(this.state.entries[this.state.entries.length - 1]!);
    }

    async append(entry: JournalEntry): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        if (entry.nonce !== this.nextNonce()) throw new Error('journal: nonce gap');
        const next: JournalState = {
            ...this.state,
            entries: [...this.state.entries, copyEntry(entry)],
        };
        await this.commit(next);
    }

    async updateInFlight(patch: Partial<Pick<JournalEntry, 'status' | 'attempts' | 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'kind' | 'gasLimit'>> & { raw?: Hex; hash?: Hex; cancelled?: boolean }): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        const entries = this.state.entries.map(copyEntry);
        const last = entries[entries.length - 1];
        if (!last || last.status === 'included') throw new Error('journal: no in-flight entry');
        if (patch.status) last.status = patch.status;
        if (patch.attempts !== undefined) last.attempts = patch.attempts;
        if (patch.maxFeePerGas !== undefined) last.maxFeePerGas = patch.maxFeePerGas;
        if (patch.maxPriorityFeePerGas !== undefined) last.maxPriorityFeePerGas = patch.maxPriorityFeePerGas;
        if (patch.kind !== undefined) last.kind = patch.kind;
        if (patch.gasLimit !== undefined) last.gasLimit = patch.gasLimit;
        if (patch.cancelled !== undefined) last.cancelled = patch.cancelled;
        if (patch.raw && patch.hash) {
            if (last.raws.length >= MAX_RAWS) throw new Error('journal: too many replacements');
            if (keccak256(patch.raw).toLowerCase() !== patch.hash.toLowerCase()) throw new Error('journal: hash mismatch');
            last.raws.push(patch.raw);
            last.hashes.push(patch.hash);
        }
        await this.commit({ ...this.state, entries });
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
    async realign(baseNonce: number): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        if (this.state.entries.some((entry) => entry.status !== 'included')) throw new Error('journal: resync refused in-flight');
        if (!Number.isSafeInteger(baseNonce) || baseNonce < 0) throw new Error('journal: base nonce rejected');
        await this.commit({ ...this.state, baseNonce, entries: [] });
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

/**
 * Listening socket on 127.0.0.1, keyed by chain id and signer, not by the journal path.
 * The journal directory is created and checked before the socket is bound.
 */
export async function acquireKeeperLock(opts: { journalPath: string; chainId: number; signer: Address }): Promise<() => Promise<void>> {
    if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('journal: chainId rejected');
    if (typeof opts.signer !== 'string' || opts.signer.length !== 42) throw new Error('journal: signer rejected');
    await ensureJournalDir(opts.journalPath);
    const port = keeperLockPort(opts.chainId, opts.signer);
    const server = createServer();
    hookLockExit();
    await new Promise<void>((resolve, reject) => {
        const fail = (error: NodeJS.ErrnoException) => {
            server.removeListener('listening', ok);
            if (error.code === 'EADDRINUSE') reject(new Error('journal: lock held'));
            else reject(new Error('journal: lock unreadable'));
        };
        const ok = () => {
            server.removeListener('error', fail);
            resolve();
        };
        server.once('error', fail);
        server.once('listening', ok);
        server.listen(port, '127.0.0.1');
    });
    heldLocks.add(server);
    let released = false;
    return async () => {
        if (released) return;
        released = true;
        heldLocks.delete(server);
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    };
}

export interface ResyncResult {
    ok: true;
    from: number;
    to: number;
    dropped: number;
}

/** One-shot realign. Refuses an unsettled nonce or any entry that is not included. */
export async function resyncJournal(journal: Journal, latest: bigint, pending: bigint): Promise<ResyncResult | { ok: false; reason: string }> {
    const loaded = await journal.load();
    if (loaded === 'missing') return { ok: false, reason: 'journal: resync refused missing' };
    if (loaded === 'corrupt') return { ok: false, reason: 'journal: resync refused corrupt' };
    if (loaded === 'mismatch') return { ok: false, reason: 'journal: resync refused mismatch' };
    if (typeof latest !== 'bigint' || typeof pending !== 'bigint' || latest < 0n || pending < 0n || latest > BigInt(Number.MAX_SAFE_INTEGER) || pending > BigInt(Number.MAX_SAFE_INTEGER)) {
        return { ok: false, reason: 'journal: resync refused nonce' };
    }
    if (latest !== pending) return { ok: false, reason: 'journal: resync refused unsettled nonce' };
    if (journal.hasOpenEntry()) return { ok: false, reason: 'journal: resync refused in-flight' };
    const from = journal.nextNonce();
    const dropped = journal.entryCount();
    await journal.realign(Number(latest));
    return { ok: true, from, to: journal.nextNonce(), dropped };
}
