/**
 * Single in-flight nonce journal. History, pruning and foreign-nonce markers are not stored.
 * A file that fails validation refuses sends. It is never replaced with an empty journal.
 */
import { link, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type { Address, Hex } from 'viem';

/** Device and inode of a journal directory that already existed at startup. */
export interface PathPin {
    readonly path: string;
    readonly dev: number;
    readonly ino: number;
}

export type IntentKind = 'price-super' | 'price-paymaster';

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

/** Last observed mined nonce. The stall latch is a separate marker file, not this object. */
export interface JournalAccount {
    /** Last observed mined nonce. Null until the first successful read. */
    lastLatest: bigint | null;
}

/** Old version-4 journals carried a stall. Startup turns it into a marker file. It is not written back. */
export interface LegacyStall {
    nonce: number;
    firstSentAt: number;
}

export interface JournalIdentity {
    chainId: number;
    signer: Address;
}

interface JournalState extends JournalIdentity, JournalAccount {
    inFlight: InFlight | null;
}

const JOURNAL_VERSION = 5;
const JOURNAL_VERSION_V4 = 4;
const JOURNAL_VERSION_V3 = 3;
const JOURNAL_VERSION_V2 = 2;
const MAX_FILE_BYTES = 1_000_000;
/** Hashes kept for the one in-flight nonce. Older ones are dropped, not refused. */
export const JOURNAL_HASH_CAP = 64;
/** Latest signed bytes kept on disk. */
export const JOURNAL_RAW_KEEP = 3;
/** Decimal digits of a uint256. Writer and parser share this bound. */
export const FEE_DIGIT_MAX = 78;
const MAX_DATA_CHARS = 200_000;

const ROOT_KEYS = ['version', 'chainId', 'signer', 'inFlight', 'lastLatest'];
const ROOT_KEYS_V4 = ['version', 'chainId', 'signer', 'inFlight', 'sentAt', 'ceilingClosed', 'lastLatest', 'stalled', 'stalledNonce'];
const ROOT_KEYS_V3 = ['version', 'chainId', 'signer', 'inFlight', 'sentAt', 'ceilingClosed', 'lastLatest'];
const ROOT_KEYS_V2 = ['version', 'chainId', 'signer', 'inFlight'];
const FLIGHT_KEYS = ['kind', 'nonce', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'attempts', 'firstSentAt'];
const FLIGHT_KEYS_V4 = ['kind', 'nonce', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'attempts', 'firstSentAt', 'broadcastOnce'];
const FLIGHT_KEYS_V2 = ['kind', 'nonce', 'raws', 'hashes', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'attempts', 'firstSentAt'];
/** Old sentAt arrays are ignored. The cap still rejects a huge file before the values are walked. */
const SENT_AT_CAP = 10_000;
const KINDS = new Set<IntentKind>(['price-super', 'price-paymaster']);

const OPEN_READ = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const OPEN_EXCL = constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK | constants.O_WRONLY;

export interface DurabilityHooks {
    write(fh: FileHandle, body: string): Promise<void>;
    fsyncFile(fh: FileHandle): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    /** Publish a new file. Fails if the destination already exists. */
    link(from: string, to: string): Promise<void>;
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
    async link(from, to) {
        await link(from, to);
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

/** Bound on every journal fsync. A stuck filesystem await fails closed instead of hanging the process. */
export const JOURNAL_PROGRESS_MS = 30_000;

export function assertProgressMs(ms: number): number {
    if (!Number.isInteger(ms) || ms <= 0 || ms > 120_000) throw new Error('journal: progress deadline rejected');
    return ms;
}

function withProgress<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('journal: progress deadline')), ms);
        timer.unref?.();
    });
    return Promise.race([work, deadline]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function isProgressDeadline(error: unknown): boolean {
    return error instanceof Error && error.message === 'journal: progress deadline';
}

/** sysexits EX_SOFTWARE. launchd restarts the process; the kernel drops locks and fds. */
export const JOURNAL_EXIT_CODE = 70;

const FIXED_DEADLINE = 'journal: progress deadline';
let deadlineAlert: (message: string) => void = () => {};
let journalExit: (code: number) => never = (code) => process.exit(code);

/** Sync only. The callback is not awaited. Pass null to restore the no-op alert. */
export function setJournalDeadlineAlert(fn: ((message: string) => void) | null): void {
    deadlineAlert = fn ?? (() => {});
}

/** Test hook. Production calls process.exit. */
export function setJournalDeadlineExitForTest(fn: ((code: number) => never) | null): void {
    journalExit = fn ?? ((code) => process.exit(code));
}

function dieDeadline(): never {
    try {
        deadlineAlert(FIXED_DEADLINE);
    } catch {
        // The alert must not replace the deadline, and its error is not forwarded.
    }
    journalExit(JOURNAL_EXIT_CODE);
    throw new Error(FIXED_DEADLINE);
}

async function bounded<T>(work: Promise<T>, ms: number): Promise<T> {
    try {
        return await withProgress(work, ms);
    } catch (error) {
        if (isProgressDeadline(error)) dieDeadline();
        throw error;
    }
}

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

function directoryPinHolds(pin: PathPin): boolean {
    try {
        const st = lstatSync(pin.path);
        return st.isDirectory() && !st.isSymbolicLink() && st.dev === pin.dev && st.ino === pin.ino;
    } catch {
        return false;
    }
}

async function rejectUnlessRegular(fh: FileHandle, progressMs: number): Promise<'ok' | 'unsafe' | 'corrupt'> {
    const st = await bounded(fh.stat(), progressMs);
    const owner = process.getuid?.();
    if (!st.isFile() || owner === undefined || st.uid !== owner || (st.mode & 0o777) !== 0o600) return 'unsafe';
    if (st.size < 0 || st.size > MAX_FILE_BYTES) return 'corrupt';
    return 'ok';
}

async function closeBounded(fh: FileHandle, progressMs: number): Promise<void> {
    await bounded(fh.close(), progressMs);
}

async function unlinkBounded(target: string, progressMs: number): Promise<void> {
    await bounded(unlink(target), progressMs);
}

async function writeDurable(filePath: string, body: string, exclusive: boolean, pin: PathPin | null = null, progressMs = JOURNAL_PROGRESS_MS): Promise<void> {
    if (body.length === 0 || body.length > MAX_FILE_BYTES) throw new Error('journal: create failed');
    const finalPath = pin ? join(pin.path, basename(filePath)) : filePath;
    const dir = dirname(finalPath);
    if (pin) {
        if (!directoryPinHolds(pin)) throw new Error('journal: path substituted');
    } else {
        assertExistingDir(dir);
    }
    const target = join(dir, `.${basename(finalPath)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    let fh: FileHandle | undefined;
    try {
        fh = await bounded(open(target, OPEN_EXCL, 0o600), progressMs);
    } catch (error) {
        if (isProgressDeadline(error)) dieDeadline();
        throw new Error('journal: create failed');
    }
    let published = false;
    try {
        const kind = await rejectUnlessRegular(fh, progressMs);
        if (kind !== 'ok') throw new Error('journal: create failed');
        await bounded(fh.chmod(0o600), progressMs);
        await bounded(durability.write(fh, body), progressMs);
        await bounded(durability.fsyncFile(fh), progressMs);
        await closeBounded(fh, progressMs);
        fh = undefined;
        try {
            if (exclusive) await bounded(durability.link(target, finalPath), progressMs);
            else await bounded(durability.rename(target, finalPath), progressMs);
            published = true;
        } catch (e) {
            if (isProgressDeadline(e)) dieDeadline();
            const code = (e as NodeJS.ErrnoException).code;
            if (exclusive && (code === 'EEXIST' || code === 'ELOOP')) throw new Error('journal: already exists');
            if (e instanceof Error && e.message.startsWith('journal:')) throw e;
            throw new Error('journal: create failed');
        }
    } catch (e) {
        if (isProgressDeadline(e)) dieDeadline();
        if (fh) await closeBounded(fh, progressMs).catch((closeError) => {
            if (isProgressDeadline(closeError)) dieDeadline();
        });
        if (!published) await unlinkBounded(target, progressMs).catch((unlinkError) => {
            if (isProgressDeadline(unlinkError)) dieDeadline();
        });
        if (e instanceof Error && e.message.startsWith('journal:')) throw e;
        throw new Error('journal: create failed');
    }
    await unlinkBounded(target, progressMs).catch((unlinkError) => {
        if (isProgressDeadline(unlinkError)) dieDeadline();
    });
    try {
        await withProgress(durability.fsyncDir(dir), progressMs);
    } catch (error) {
        if (isProgressDeadline(error)) dieDeadline();
        // The new name is visible. Replay stays closed until a later barrier succeeds.
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

function parseHexList(value: unknown, max: number, bytes?: number, allowEmpty = false): Hex[] | null {
    if (!Array.isArray(value) || value.length > max) return null;
    if (!allowEmpty && value.length === 0) return null;
    const out: Hex[] = [];
    for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!isHex(item, bytes === undefined ? MAX_DATA_CHARS : 2 + bytes * 2, bytes)) return null;
        out.push(item);
    }
    return out;
}

function parseSentAt(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length > SENT_AT_CAP) return null;
    const out: number[] = [];
    for (let i = 0; i < value.length; i++) {
        const n = parseSafeInt(value[i]);
        if (n === null || n < 0) return null;
        out.push(n);
    }
    return out;
}

function parseLastLatest(value: unknown): bigint | null | 'bad' {
    if (value === null) return null;
    const parsed = parseUint(value);
    if (parsed === null) return 'bad';
    return parsed;
}

function parseFlight(value: unknown, version: number): InFlight | null | 'bad' {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'bad';
    const keys = version === JOURNAL_VERSION_V2 ? FLIGHT_KEYS_V2 : version === JOURNAL_VERSION ? FLIGHT_KEYS : FLIGHT_KEYS_V4;
    if (!keysExact(value, keys)) return 'bad';
    const raw = value as Record<string, unknown>;
    if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind as IntentKind)) return 'bad';
    const nonce = parseSafeInt(raw.nonce);
    const attempts = parseSafeInt(raw.attempts);
    const firstSentAt = parseSafeInt(raw.firstSentAt);
    if (nonce === null || nonce < 0 || attempts === null || attempts < 0 || firstSentAt === null || firstSentAt < 0) return 'bad';
    const raws = parseHexList(raw.raws, JOURNAL_RAW_KEEP);
    const hashes = parseHexList(raw.hashes, JOURNAL_HASH_CAP, 32);
    // Older files carried broadcastOnce. It is checked so a corrupt list still refuses, then dropped.
    if (version !== JOURNAL_VERSION_V2 && version !== JOURNAL_VERSION) {
        const broadcastOnce = parseHexList(raw.broadcastOnce, JOURNAL_HASH_CAP, 32, true);
        if (!broadcastOnce) return 'bad';
    }
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

function parseState(text: string, identity: JournalIdentity): { state: JournalState; legacy: LegacyStall | null } | 'mismatch' | null {
    if (text.length === 0 || text.length > MAX_FILE_BYTES) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const root = parsed as Record<string, unknown>;
    const version = root.version;
    if (version !== JOURNAL_VERSION && version !== JOURNAL_VERSION_V4 && version !== JOURNAL_VERSION_V3 && version !== JOURNAL_VERSION_V2) return null;
    const rootKeys = version === JOURNAL_VERSION
        ? ROOT_KEYS
        : version === JOURNAL_VERSION_V4
            ? ROOT_KEYS_V4
            : version === JOURNAL_VERSION_V3
                ? ROOT_KEYS_V3
                : ROOT_KEYS_V2;
    if (!keysExact(parsed, rootKeys)) return null;
    const chainId = parseSafeInt(root.chainId);
    if (chainId === null || chainId <= 0 || !isAddress(root.signer)) return null;
    if (chainId !== identity.chainId || root.signer.toLowerCase() !== identity.signer.toLowerCase()) return 'mismatch';
    const flight = parseFlight(root.inFlight, version);
    if (flight === 'bad') return null;
    let lastLatest: bigint | null = null;
    let legacy: LegacyStall | null = null;
    if (version === JOURNAL_VERSION || version === JOURNAL_VERSION_V4 || version === JOURNAL_VERSION_V3) {
        // sentAt and ceilingClosed are accepted on old files and ignored.
        if (version !== JOURNAL_VERSION) {
            const parsedSent = parseSentAt(root.sentAt);
            if (!parsedSent || typeof root.ceilingClosed !== 'boolean') return null;
        }
        const parsedLatest = parseLastLatest(root.lastLatest);
        if (parsedLatest === 'bad') return null;
        lastLatest = parsedLatest;
    }
    if (version === JOURNAL_VERSION_V4) {
        if (typeof root.stalled !== 'boolean') return null;
        let stalledNonce: number | null = null;
        if (root.stalledNonce === null) stalledNonce = null;
        else {
            const parsedNonce = parseSafeInt(root.stalledNonce);
            if (parsedNonce === null || parsedNonce < 0) return null;
            stalledNonce = parsedNonce;
        }
        if (root.stalled !== (stalledNonce !== null)) return null;
        if (root.stalled && stalledNonce !== null) {
            legacy = { nonce: stalledNonce, firstSentAt: flight?.firstSentAt ?? 0 };
        }
    }
    return { state: { chainId, signer: root.signer, inFlight: flight, lastLatest }, legacy };
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
    if (state.lastLatest !== null && (state.lastLatest < 0n || state.lastLatest.toString().length > FEE_DIGIT_MAX)) {
        throw new Error('journal: account rejected');
    }
    return JSON.stringify({
        version: JOURNAL_VERSION,
        chainId: state.chainId,
        signer: state.signer,
        inFlight: state.inFlight ? flightOut(state.inFlight) : null,
        lastLatest: state.lastLatest === null ? null : state.lastLatest.toString(),
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

function blankAccount(): JournalAccount {
    return { lastLatest: null };
}

function copyAccount(account: JournalAccount): JournalAccount {
    return { lastLatest: account.lastLatest };
}

export class Journal {
    private state: JournalState | null = null;
    private corrupt = false;
    private unsafe = false;
    /** Dir fsync failed after the new name was published. Replay stays closed until a barrier succeeds. */
    private needsBarrier = false;
    private readonly progressMs: number;
    /** Alarm-only copy. Set when a barrier read parses, and never used as a replay source. */
    private alarm: { nonce: number; firstSentAt: number } | null = null;
    /** Version-4 stalled:true. Not part of the bytes this process writes. */
    private legacy: LegacyStall | null = null;
    private readonly identity: JournalIdentity;
    private readonly pin: PathPin | null;
    /** Every read and write uses this path. A pin contributes its real directory, not the caller's string. */
    private readonly ioPath: string;

    constructor(readonly path: string, identity: JournalIdentity, pin?: PathPin | null, progressMs = JOURNAL_PROGRESS_MS) {
        this.progressMs = assertProgressMs(progressMs);
        if (typeof path !== 'string' || path.length === 0 || path.length > 4_096 || path.includes('\0')) {
            throw new Error('journal: path rejected');
        }
        if (!Number.isInteger(identity.chainId) || identity.chainId <= 0) throw new Error('journal: chainId rejected');
        if (!isAddress(identity.signer)) throw new Error('journal: signer rejected');
        this.identity = { chainId: identity.chainId, signer: identity.signer };
        this.pin = pin ?? null;
        const base = basename(path);
        if (base.length === 0 || base === '.' || base === '..' || base.length > 255) throw new Error('journal: path rejected');
        this.ioPath = this.pin ? join(this.pin.path, base) : path;
    }

    /** Copy of the flight kept for the stall alarm. Null when the pinned path was substituted. */
    alarmFlight(): { nonce: number; firstSentAt: number } | null {
        if (!this.alarm) return null;
        return { nonce: this.alarm.nonce, firstSentAt: this.alarm.firstSentAt };
    }

    /**
     * Re-opens the file on every call. A cached copy is not a successful read.
     * missing = no file yet. corrupt and unsafe stick. mismatch does not stick, so a replaced file can be read again.
     * barrier = the directory durability barrier has not succeeded. The bytes are not replayed.
     * substituted = the pinned directory changed. The file is not read and the path is not recreated.
     */
    async load(): Promise<'missing' | 'ok' | 'corrupt' | 'mismatch' | 'unsafe' | 'barrier' | 'substituted'> {
        if (this.corrupt) return 'corrupt';
        if (this.unsafe) return 'unsafe';
        if (!this.pinHolds()) return 'substituted';
        const barrierOk = await this.tryBarrier();
        if (!this.pinHolds()) return 'substituted';
        if (!barrierOk) {
            this.needsBarrier = true;
            await this.captureAlarm();
            if (!this.pinHolds()) {
                this.alarm = null;
                return 'substituted';
            }
            return 'barrier';
        }
        this.needsBarrier = false;
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
        this.state = parsed.state;
        this.legacy = parsed.legacy;
        this.alarm = parsed.state.inFlight
            ? { nonce: parsed.state.inFlight.nonce, firstSentAt: parsed.state.inFlight.firstSentAt }
            : null;
        return 'ok';
    }

    /** Stall carried by an old journal. Null after a version-5 load. */
    legacyStall(): LegacyStall | null {
        if (!this.legacy) return null;
        return { nonce: this.legacy.nonce, firstSentAt: this.legacy.firstSentAt };
    }

    /** Persist an empty journal. Refuses a file that is already there. */
    async init(): Promise<void> {
        if (this.corrupt || this.unsafe || this.needsBarrier) throw new Error('journal: corrupt');
        if (this.state) throw new Error('journal: already open');
        const next: JournalState = { ...this.identity, ...blankAccount(), inFlight: null };
        await this.publish(next, true);
        this.state = { ...next, inFlight: null };
    }

    /** Copy of the last successful load. Null when the file has no in-flight tx. */
    inFlight(): InFlight | null {
        if (!this.state || this.needsBarrier) return null;
        return copyFlight(this.state.inFlight);
    }

    /** Copy of the persisted send budget. Empty until a successful load. */
    account(): JournalAccount {
        if (!this.state || this.needsBarrier) return blankAccount();
        return copyAccount(this.state);
    }

    /** Replace the in-flight tx, or clear it. The write is durable before this returns. */
    async writeInFlight(next: InFlight | null): Promise<void> {
        if (!this.state || this.needsBarrier) throw new Error('journal: not open');
        await this.commit({ inFlight: next });
    }

    /**
     * One durable write of the in-flight tx and the send budget.
     * A failed directory barrier leaves the file in place and refuses replay.
     */
    async commit(next: {
        inFlight?: InFlight | null;
        lastLatest?: bigint | null;
    }): Promise<void> {
        if (!this.state || this.needsBarrier) throw new Error('journal: not open');
        const account = copyAccount(this.state);
        if (next.lastLatest !== undefined) account.lastLatest = next.lastLatest;
        const stored = next.inFlight === undefined ? copyFlight(this.state.inFlight) : copyFlight(next.inFlight);
        if (stored && stored.hashes.length > JOURNAL_HASH_CAP) {
            stored.hashes = stored.hashes.slice(stored.hashes.length - JOURNAL_HASH_CAP);
        }
        if (stored && stored.raws.length > JOURNAL_RAW_KEEP) {
            stored.raws = stored.raws.slice(stored.raws.length - JOURNAL_RAW_KEEP);
        }
        const body: JournalState = { ...this.identity, ...account, inFlight: stored };
        await this.publish(body, false);
        this.state = { ...body, inFlight: copyFlight(stored) };
    }

    private async publish(state: JournalState, exclusive: boolean): Promise<void> {
        try {
            await writeDurable(this.ioPath, serialize(state), exclusive, this.pin, this.progressMs);
        } catch (error) {
            if (error instanceof Error && error.message === 'journal: parent sync failed') this.needsBarrier = true;
            throw error;
        }
        this.needsBarrier = false;
    }

    /** Re-run the directory barrier. The directory is never created here. */
    private async tryBarrier(): Promise<boolean> {
        if (this.pin && !this.pinHolds()) return false;
        const dir = this.pin ? this.pin.path : dirname(this.ioPath);
        try {
            await withProgress(durability.fsyncDir(dir), this.progressMs);
            return true;
        } catch (error) {
            if (isProgressDeadline(error)) dieDeadline();
            return false;
        }
    }

    private pinHolds(): boolean {
        if (!this.pin) return true;
        return directoryPinHolds(this.pin);
    }

    /** Parse nonce and firstSentAt for the alarm. Does not open the journal for replay. */
    private async captureAlarm(): Promise<void> {
        if (!this.pinHolds()) {
            this.alarm = null;
            return;
        }
        const read = await this.readText();
        if (read.kind !== 'text') {
            this.alarm = null;
            return;
        }
        const parsed = parseState(read.text, this.identity);
        if (!parsed || parsed === 'mismatch' || !parsed.state.inFlight) {
            this.alarm = null;
            return;
        }
        this.legacy = parsed.legacy;
        this.alarm = { nonce: parsed.state.inFlight.nonce, firstSentAt: parsed.state.inFlight.firstSentAt };
    }

    private async readText(): Promise<{ kind: 'missing' | 'unsafe' | 'corrupt' } | { kind: 'text'; text: string }> {
        let fh: FileHandle | undefined;
        try {
            fh = await bounded(open(this.ioPath, OPEN_READ), this.progressMs);
        } catch (e) {
            if (isProgressDeadline(e)) dieDeadline();
            const code = (e as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return { kind: 'missing' };
            return { kind: 'unsafe' };
        }
        try {
            const kind = await rejectUnlessRegular(fh, this.progressMs);
            if (kind !== 'ok') return { kind };
            const text = await bounded(fh.readFile({ encoding: 'utf8' }), this.progressMs);
            return { kind: 'text', text };
        } catch (error) {
            if (isProgressDeadline(error)) dieDeadline();
            return { kind: 'unsafe' };
        } finally {
            if (fh) await closeBounded(fh, this.progressMs).catch((closeError) => {
                if (isProgressDeadline(closeError)) dieDeadline();
            });
        }
    }
}

/**
 * Pin the directory that already contains `--journal`. Missing directories are not created.
 * Later I/O uses `join(pin.path, basename)`. This pin is mix-up protection for the directory
 * inode. Ownership and mode belong to the operator preflight.
 */
export function pinJournalDirectory(journalPath: string): PathPin {
    if (typeof journalPath !== 'string' || journalPath.length === 0 || journalPath.length > 4_096 || journalPath.includes('\0')) {
        throw new Error('keeper: journal refused: unreadable');
    }
    if (!isAbsolute(journalPath)) throw new Error('keeper: journal refused: not absolute');
    const dir = dirname(resolve(journalPath));
    let listed: ReturnType<typeof lstatSync> | null = null;
    try {
        listed = lstatSync(dir);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('journal directory must exist; run preflight');
        }
        throw new Error('keeper: journal refused: unreadable');
    }
    if (!listed.isDirectory() && !listed.isSymbolicLink()) throw new Error('keeper: journal refused: directory');
    let real: string;
    try {
        real = realpathSync(dir);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('journal directory must exist; run preflight');
        }
        throw new Error('keeper: journal refused: unreadable');
    }
    let st: ReturnType<typeof lstatSync>;
    try {
        st = lstatSync(real);
    } catch {
        throw new Error('keeper: journal refused: unreadable');
    }
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('keeper: journal refused: directory');
    return Object.freeze({ path: real, dev: st.dev, ino: st.ino });
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

/**
 * Stable loopback port for one chain and signer. The kernel drops it when the process dies.
 * Both lock bands sit in 20000-31999, below the Linux (32768+) and macOS (49152+) ephemeral ranges,
 * so an unrelated outgoing connection cannot hold a lock port (#447 clestons N2).
 */
export function keeperLockPort(chainId: number, signer: string): number {
    const digest = createHash('sha256').update(`aastar-keeper:${chainId}:${signer.toLowerCase()}`).digest();
    return 20_000 + (digest.readUInt16BE(0) % 6_000);
}

/** Second lock, keyed by the journal's canonical path, so two signers cannot share one file. */
export function journalFileLockPort(realPath: string): number {
    const digest = createHash('sha256').update(`aastar-keeper-file:${realPath}`).digest();
    return 26_000 + (digest.readUInt16BE(0) % 6_000);
}

function listenLoopback(port: number): Promise<Server> {
    const server = createServer((socket: Socket) => {
        socket.destroy();
    });
    hookLockExit();
    return new Promise((resolve, reject) => {
        const fail = (error: NodeJS.ErrnoException) => {
            server.removeListener('listening', ok);
            if (error.code === 'EADDRINUSE') reject(new Error(`journal: lock held (127.0.0.1:${port})`));
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
export async function acquireKeeperLock(opts: { journalPath: string; chainId: number; signer: Address; pin?: PathPin | null }): Promise<() => Promise<void>> {
    if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('journal: chainId rejected');
    if (typeof opts.signer !== 'string' || opts.signer.length !== 42) throw new Error('journal: signer rejected');
    let parentReal: string;
    if (opts.pin) {
        if (!directoryPinHolds(opts.pin)) throw new Error('journal: path substituted');
        parentReal = opts.pin.path;
    } else {
        const parent = dirname(resolve(opts.journalPath));
        let listed: ReturnType<typeof lstatSync> | null = null;
        try {
            listed = lstatSync(parent);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error('journal directory must exist; run preflight');
            }
            throw new Error('journal: parent unreadable');
        }
        if (!listed.isDirectory() && !listed.isSymbolicLink()) throw new Error('journal: parent is not a directory');
        try {
            parentReal = realpathSync(parent);
        } catch {
            throw new Error('journal directory must exist; run preflight');
        }
    }
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
