/**
 * Pin the cast binary once. Spawn that absolute path. Do not look it up on PATH again.
 *
 * The file and every ancestor directory up to `/` must be owned by root or the keeper uid,
 * must not be group- or world-writable, and must not be sticky. `/tmp` is refused.
 *
 * The keeper's uid is inside the trust boundary because it can read the keystore and the
 * password file anyway. Anything able to run as that uid can sign. These checks stop other
 * users from substituting the signer.
 */
import { lstatSync, realpathSync, type Stats } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

const REFUSED = 'keeper: cast bin refused';
const NAME_MAX = 64;
const PATH_MAX = 65_536;
const DIR_MAX = 4_096;
const ENTRIES_MAX = 128;
const HOPS_MAX = 64;

export interface PinnedExecutable {
    readonly path: string;
    readonly dev: number;
    readonly ino: number;
    recheck(): void;
}

export interface TrustedExecutableOptions {
    /** Defaults to the process uid. Tests pass another uid to refuse a foreign owner. */
    uid?: number;
    /** Defaults to `process.env.PATH`. Read once, here, and never at spawn. */
    pathEnv?: string;
}

function refuse(reason: string): never {
    throw new Error(`${REFUSED}: ${reason}`);
}

function keeperUid(override: number | undefined): number {
    if (override !== undefined) {
        if (!Number.isInteger(override) || override < 0) refuse('owner');
        return override;
    }
    const uid = process.getuid?.();
    if (uid === undefined) refuse('owner');
    return uid;
}

function bareName(value: string): boolean {
    if (value.length === 0 || value.length > NAME_MAX) return false;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 46 || c === 95 || c === 43;
        if (!ok) return false;
    }
    return value !== '.' && value !== '..';
}

function pathEntries(pathEnv: string): string[] {
    if (pathEnv.length > PATH_MAX) refuse('unreadable');
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i <= pathEnv.length; i++) {
        if (i !== pathEnv.length && pathEnv.charCodeAt(i) !== 58) continue;
        if (out.length >= ENTRIES_MAX) refuse('unreadable');
        const part = pathEnv.slice(start, i);
        start = i + 1;
        if (part.length === 0 || part.length > DIR_MAX) continue;
        out.push(part);
    }
    return out;
}

function resolveOnce(pathOrName: string, pathEnv: string): string {
    if (pathOrName.length === 0 || pathOrName.length > DIR_MAX) refuse('unreadable');
    if (pathOrName.includes('\0')) refuse('unreadable');
    if (bareName(pathOrName)) {
        for (const dir of pathEntries(pathEnv)) {
            const candidate = join(dir, pathOrName);
            let st: Stats;
            try {
                st = lstatSync(candidate);
            } catch {
                continue;
            }
            if (st.isFile() || st.isSymbolicLink()) return candidate;
        }
        refuse('unreadable');
    }
    if (!isAbsolute(pathOrName)) refuse('not absolute');
    return pathOrName;
}

function assertNode(st: Stats, uid: number, kind: 'file' | 'directory'): void {
    if (kind === 'file') {
        if (!st.isFile() || st.isSymbolicLink()) refuse('not a regular file');
        if (st.uid !== uid && st.uid !== 0) refuse('owner');
        if ((st.mode & 0o022) !== 0) refuse('writable');
        return;
    }
    if (!st.isDirectory() || st.isSymbolicLink()) refuse('directory');
    if (st.uid !== uid && st.uid !== 0) refuse('directory owner');
    if ((st.mode & 0o1000) !== 0) refuse('sticky');
    if ((st.mode & 0o022) !== 0) refuse('directory writable');
}

function assertAncestors(filePath: string, uid: number): void {
    let dir = dirname(filePath);
    const seen = new Set<string>();
    let hops = 0;
    while (!seen.has(dir) && hops < HOPS_MAX) {
        seen.add(dir);
        hops += 1;
        let st: Stats;
        try {
            st = lstatSync(dir);
        } catch {
            refuse('directory');
        }
        assertNode(st, uid, 'directory');
        if (dir === '/') return;
        dir = dirname(dir);
    }
    refuse('directory');
}

function statPinned(filePath: string, uid: number, pin?: { dev: number; ino: number }): { dev: number; ino: number } {
    let st: Stats;
    try {
        st = lstatSync(filePath);
    } catch {
        refuse('unreadable');
    }
    if (pin && (st.dev !== pin.dev || st.ino !== pin.ino)) refuse('changed');
    assertNode(st, uid, 'file');
    assertAncestors(filePath, uid);
    return { dev: st.dev, ino: st.ino };
}

/** Resolve `pathOrName` once. A bare name is looked up on PATH here and nowhere else. */
export function trustedExecutable(pathOrName: string, options?: TrustedExecutableOptions): PinnedExecutable {
    if (typeof pathOrName !== 'string') refuse('unreadable');
    const uid = keeperUid(options?.uid);
    const pathEnv = options?.pathEnv ?? process.env.PATH ?? '';
    if (typeof pathEnv !== 'string') refuse('unreadable');
    const selected = resolveOnce(pathOrName, pathEnv);
    let resolved: string;
    try {
        resolved = realpathSync(selected);
    } catch {
        refuse('unreadable');
    }
    if (!isAbsolute(resolved) || resolved.length > DIR_MAX) refuse('unreadable');
    const found = statPinned(resolved, uid);
    const path = resolved;
    const dev = found.dev;
    const ino = found.ino;
    const pinned: PinnedExecutable = {
        path,
        dev,
        ino,
        recheck() {
            statPinned(path, uid, { dev, ino });
        },
    };
    return Object.freeze(pinned);
}
