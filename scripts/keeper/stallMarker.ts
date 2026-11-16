/**
 * Stall latch file. Journal commits never read or write it.
 * `<journal-dir>/<network>.stalled` holds only {nonce, firstSentAt}.
 */
import { open, unlink, type FileHandle } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';

const OPEN_EXCL = constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY;
const OPEN_READ = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const MAX_BYTES = 512;

export interface StallRecord {
    nonce: number;
    firstSentAt: number;
}

export type MarkerRead = { kind: 'missing' } | { kind: 'unreadable' } | { kind: 'record'; record: StallRecord };

function ownKeysBounded(value: object, max: number): string[] | null {
    const keys: string[] = [];
    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        keys.push(key);
        if (keys.length > max) return null;
    }
    return keys;
}

function safeInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
    return value;
}

function parseMarker(text: string): StallRecord | null {
    if (text.length === 0 || text.length > MAX_BYTES) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const keys = ownKeysBounded(parsed, 2);
    if (!keys || keys.length !== 2 || !keys.includes('nonce') || !keys.includes('firstSentAt')) return null;
    const raw = parsed as Record<string, unknown>;
    const nonce = safeInt(raw.nonce);
    const firstSentAt = safeInt(raw.firstSentAt);
    if (nonce === null || firstSentAt === null) return null;
    return { nonce, firstSentAt };
}

async function fsyncDir(dir: string): Promise<void> {
    const dh = await open(dir, 'r');
    try {
        await dh.sync();
    } finally {
        await dh.close();
    }
}

/** Create the latch. EEXIST is `exists` and the file is left untouched. */
export async function createStallMarker(filePath: string, record: StallRecord): Promise<'created' | 'exists' | 'failed'> {
    if (!safeInt(record.nonce) && record.nonce !== 0) return 'failed';
    if (safeInt(record.nonce) === null || safeInt(record.firstSentAt) === null) return 'failed';
    const body = JSON.stringify({ nonce: record.nonce, firstSentAt: record.firstSentAt });
    if (body.length > MAX_BYTES) return 'failed';
    let fh: FileHandle;
    try {
        fh = await open(filePath, OPEN_EXCL, 0o600);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EEXIST') {
            const read = await readStallMarker(filePath);
            if (read.kind !== 'record') return 'failed';
            try {
                await fsyncDir(dirname(filePath));
            } catch {
                return 'failed';
            }
            return 'exists';
        }
        return 'failed';
    }
    let failed = false;
    try {
        const st = await fh.stat();
        const owner = process.getuid?.();
        if (!st.isFile() || owner === undefined || st.uid !== owner || (st.mode & 0o777) !== 0o600) {
            failed = true;
        } else {
            await fh.chmod(0o600);
            await fh.writeFile(body, 'utf8');
            await fh.sync();
        }
    } catch {
        failed = true;
    } finally {
        await fh.close().catch(() => {});
    }
    if (failed) {
        await unlink(filePath).catch(() => {});
        return 'failed';
    }
    try {
        await fsyncDir(dirname(filePath));
    } catch {
        return 'failed';
    }
    return 'created';
}

/** Any read error, bad mode, or malformed body is unreadable (fail closed). */
export async function readStallMarker(filePath: string): Promise<MarkerRead> {
    let fh: FileHandle;
    try {
        fh = await open(filePath, OPEN_READ);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') return { kind: 'missing' };
        return { kind: 'unreadable' };
    }
    try {
        const st = await fh.stat();
        const owner = process.getuid?.();
        if (!st.isFile() || owner === undefined || st.uid !== owner || (st.mode & 0o777) !== 0o600) {
            return { kind: 'unreadable' };
        }
        if (st.size < 0 || st.size > MAX_BYTES) return { kind: 'unreadable' };
        const text = await fh.readFile({ encoding: 'utf8' });
        const record = parseMarker(text);
        if (!record) return { kind: 'unreadable' };
        return { kind: 'record', record };
    } catch {
        return { kind: 'unreadable' };
    } finally {
        await fh.close().catch(() => {});
    }
}

/** Unlink, then fsync the directory. A missing file is already gone. */
export async function deleteStallMarker(filePath: string): Promise<'deleted' | 'missing' | 'failed'> {
    try {
        await unlink(filePath);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') return 'missing';
        return 'failed';
    }
    try {
        await fsyncDir(dirname(filePath));
    } catch {
        return 'failed';
    }
    return 'deleted';
}
