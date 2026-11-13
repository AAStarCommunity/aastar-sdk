/**
 * Single in-flight nonce journal. History, pruning and foreign-nonce markers are not stored.
 * A file that fails validation refuses sends. It is never replaced with an empty journal.
 */
import { chmod, mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import type { Address, Hex } from 'viem';

export type IntentKind = 'price-super' | 'price-paymaster' | 'cancel';

export interface InFlight {
    kind: IntentKind;
    nonce: number;
    /** Latest signed bytes. At most JOURNAL_RAW_KEEP. */
    raws: Hex[];
    /** Every hash we broadcast for this nonce, oldest dropped past JOURNAL_HASH_CAP. */
    hashes: Hex[];
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    attempts: number;
    firstSentAt: number;
}

export interface JournalIdentity {
    chainId: number;
    signer: Address;
}

interface JournalState extends JournalIdentity {
    inFlight: InFlight | null;
}

const JOURNAL_VERSION = 2;
const MAX_FILE_BYTES = 1_000_000;
/** Hashes kept for the one in-flight nonce. Older ones are dropped, not refused. */
export const JOURNAL_HASH_CAP = 64;
/** Latest signed bytes kept on disk. */
export const JOURNAL_RAW_KEEP = 3;
/** Decimal digits of a uint256. Writer and parser share this bound. */
export const FEE_DIGIT_MAX = 78;
const MAX_DATA_CHARS = 200_000;

const ROOT_KEYS = ['version', 'chainId', 'signer', 'inFlight'];
const FLIGHT_KEYS = ['kind', 'nonce', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'attempts', 'firstSentAt'];
const KINDS = new Set<IntentKind>(['price-super', 'price-paymaster', 'cancel']);

const OPEN_READ = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const OPEN_WRITE = constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW | constants.O_NONBLOCK | constants.O_WRONLY;
const OPEN_EXCL = constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK | constants.O_WRONLY;

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

async function rejectUnlessRegular(fh: FileHandle): Promise<'ok' | 'unsafe' | 'corrupt'> {
    const st = await fh.stat();
    const owner = process.getuid?.();
    if (!st.isFile() || owner === undefined || st.uid !== owner || (st.mode & 0o777) !== 0o600) return 'unsafe';
    if (st.size < 0 || st.size > MAX_FILE_BYTES) return 'corrupt';
    return 'ok';
}

async function writeDurable(filePath: string, body: string, exclusive: boolean): Promise<void> {
    if (body.length === 0 || body.length > MAX_FILE_BYTES) throw new Error('journal: create failed');
    const dir = dirname(filePath);
    await ensureDir(dir);
    const flags = exclusive ? OPEN_EXCL : OPEN_WRITE;
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
        const kind = await rejectUnlessRegular(fh);
        if (kind !== 'ok') throw new Error('journal: create failed');
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
    for (let i = 0; i < 2; i++) {
        const c = value.charCodeAt(i);
        if (i === 0 && c !== 48) return false;
        if (i === 1 && c !== 120 && c !== 88) return false;
    }
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return true;
}

function isAddress(value: unknown): value is Address {
    return isHex(value, 42, 20);
}

function parseUint(value: unknown): bigint | null {
    if (typeof value !== 'string' || value.length === 0 || value.length > FEE_DIGIT_MAX) return null;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c < 48 || c > 57) return null;
    }
    if (value.length > 1 && value.charCodeAt(0) === 48) return null;
    return BigInt(value);
}

function parseSafeInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
    return value;
}

function keysExact(value: object, expected: readonly string[]): boolean {
    const keys = ownKeysBounded(value, expected.length);
    if (!keys || keys.length !== expected.length) return false;
    for (const key of keys) {
        if (!expected.includes(key)) return false;
    }
    return true;
}

function parseHexList(value: unknown, max: number, bytes?: number): Hex[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
    const out: Hex[] = [];
    for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!isHex(item, bytes === undefined ? MAX_DATA_CHARS : 2 + bytes * 2, bytes)) return null;
        out.push(item);
    }
    return out;
}

function parseFlight(value: unknown): InFlight | null | 'bad' {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'bad';
    if (!keysExact(value, FLIGHT_KEYS)) return 'bad';
    const raw = value as Record<string, unknown>;
    if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind as IntentKind)) return 'bad';
    const nonce = parseSafeInt(raw.nonce);
    const attempts = parseSafeInt(raw.attempts);
    const firstSentAt = parseSafeInt(raw.firstSentAt);
    if (nonce === null || nonce < 0 || attempts === null || attempts < 0 || firstSentAt === null || firstSentAt < 0) return 'bad';
    const raws = parseHexList(raw.raws, JOURNAL_RAW_KEEP);
    const hashes = parseHexList(raw.hashes, JOURNAL_HASH_CAP, 32);
    const gasLimit = parseUint(raw.gasLimit);
    const maxFeePerGas = parseUint(raw.maxFeePerGas);
    const maxPriorityFeePerGas = parseUint(raw.maxPriorityFeePerGas);
    if (!raws || !hashes || gasLimit === null || maxFeePerGas === null || maxPriorityFeePerGas === null) return 'bad';
    return {
        kind: raw.kind as IntentKind,
        nonce,
        raws,
        hashes,
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        attempts,
        firstSentAt,
    };
}

function parseState(text: string, identity: JournalIdentity): JournalState | 'mismatch' | null {
    if (text.length === 0 || text.length > MAX_FILE_BYTES) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!keysExact(parsed, ROOT_KEYS)) return null;
    const root = parsed as Record<string, unknown>;
    if (root.version !== JOURNAL_VERSION) return null;
    const chainId = parseSafeInt(root.chainId);
    if (chainId === null || chainId <= 0 || !isAddress(root.signer)) return null;
    if (chainId !== identity.chainId || root.signer.toLowerCase() !== identity.signer.toLowerCase()) return 'mismatch';
    const flight = parseFlight(root.inFlight);
    if (flight === 'bad') return null;
    return { chainId, signer: root.signer, inFlight: flight };
}

function feeText(value: bigint): string {
    if (value < 0n) throw new Error('journal: fee rejected');
    const text = value.toString();
    if (text.length > FEE_DIGIT_MAX) throw new Error('journal: fee rejected');
    return text;
}

function flightOut(flight: InFlight): Record<string, unknown> {
    const raws = flight.raws.length > JOURNAL_RAW_KEEP ? flight.raws.slice(flight.raws.length - JOURNAL_RAW_KEEP) : flight.raws;
    const hashes = flight.hashes.length > JOURNAL_HASH_CAP ? flight.hashes.slice(flight.hashes.length - JOURNAL_HASH_CAP) : flight.hashes;
    if (raws.length === 0 || hashes.length === 0) throw new Error('journal: in-flight rejected');
    return {
        kind: flight.kind,
        nonce: flight.nonce,
        raws,
        hashes,
        gasLimit: feeText(flight.gasLimit),
        maxFeePerGas: feeText(flight.maxFeePerGas),
        maxPriorityFeePerGas: feeText(flight.maxPriorityFeePerGas),
        attempts: flight.attempts,
        firstSentAt: flight.firstSentAt,
    };
}

function serialize(state: JournalState): string {
    if (!Number.isSafeInteger(state.chainId) || state.chainId <= 0) throw new Error('journal: chainId rejected');
    if (state.inFlight) {
        if (!KINDS.has(state.inFlight.kind)) throw new Error('journal: in-flight rejected');
        if (!Number.isSafeInteger(state.inFlight.nonce) || state.inFlight.nonce < 0) throw new Error('journal: in-flight rejected');
        if (!Number.isSafeInteger(state.inFlight.attempts) || state.inFlight.attempts < 0) throw new Error('journal: in-flight rejected');
        if (!Number.isSafeInteger(state.inFlight.firstSentAt) || state.inFlight.firstSentAt < 0) throw new Error('journal: in-flight rejected');
    }
    return JSON.stringify({
        version: JOURNAL_VERSION,
        chainId: state.chainId,
        signer: state.signer,
        inFlight: state.inFlight ? flightOut(state.inFlight) : null,
    });
}

function copyFlight(flight: InFlight | null): InFlight | null {
    if (!flight) return null;
    return {
        kind: flight.kind,
        nonce: flight.nonce,
        raws: [...flight.raws],
        hashes: [...flight.hashes],
        gasLimit: flight.gasLimit,
        maxFeePerGas: flight.maxFeePerGas,
        maxPriorityFeePerGas: flight.maxPriorityFeePerGas,
        attempts: flight.attempts,
        firstSentAt: flight.firstSentAt,
    };
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

    /**
     * Re-opens the file on every call. A cached copy is not a successful read.
     * missing = no file yet. corrupt and unsafe stick. mismatch does not stick, so a replaced file can be read again.
     */
    async load(): Promise<'missing' | 'ok' | 'corrupt' | 'mismatch' | 'unsafe'> {
        if (this.corrupt) return 'corrupt';
        if (this.unsafe) return 'unsafe';
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

    /** Persist an empty journal. Refuses a file that is already there. */
    async init(): Promise<void> {
        if (this.corrupt || this.unsafe) throw new Error('journal: corrupt');
        if (this.state) throw new Error('journal: already open');
        const next: JournalState = { ...this.identity, inFlight: null };
        await writeDurable(this.path, serialize(next), true);
        this.state = next;
    }

    /** Copy of the last successful load. Null when the file has no in-flight tx. */
    inFlight(): InFlight | null {
        if (!this.state) return null;
        return copyFlight(this.state.inFlight);
    }

    /** Replace the in-flight tx, or clear it. The write is durable before this returns. */
    async writeInFlight(next: InFlight | null): Promise<void> {
        if (!this.state) throw new Error('journal: not open');
        const stored = copyFlight(next);
        if (stored && stored.hashes.length > JOURNAL_HASH_CAP) {
            stored.hashes = stored.hashes.slice(stored.hashes.length - JOURNAL_HASH_CAP);
        }
        if (stored && stored.raws.length > JOURNAL_RAW_KEEP) {
            stored.raws = stored.raws.slice(stored.raws.length - JOURNAL_RAW_KEEP);
        }
        const body = serialize({ ...this.identity, inFlight: stored });
        await atomicWriteFile(this.path, body);
        this.state = { ...this.identity, inFlight: copyFlight(stored) };
    }

    private async readText(): Promise<{ kind: 'missing' | 'unsafe' | 'corrupt' } | { kind: 'text'; text: string }> {
        let fh: FileHandle;
        try {
            fh = await open(this.path, OPEN_READ);
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return { kind: 'missing' };
            return { kind: 'unsafe' };
        }
        try {
            const kind = await rejectUnlessRegular(fh);
            if (kind !== 'ok') return { kind };
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
    const server = createServer((socket: Socket) => {
        socket.destroy();
    });
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
 * Accepted sockets are destroyed immediately. The keeper process does not call the returned
 * release on shutdown: the kernel drops both sockets when the process exits.
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
