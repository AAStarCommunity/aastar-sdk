/**
 * Pin a path once. Spawn or open that absolute path. Do not look it up again.
 *
 * The target and every ancestor directory up to `/` must be owned by root or the keeper uid,
 * must not be group- or world-writable, and must not be sticky. `/tmp` is refused.
 *
 * The keeper's uid is inside the trust boundary because it can read the keystore and the
 * password file anyway. Anything able to run as that uid can sign. These checks stop other
 * users from substituting the signer or the journal directory.
 */
import { lstatSync, realpathSync, type Stats } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REFUSED = 'keeper: cast bin refused';
const PATH_REFUSED = 'keeper: path refused';
const NAME_MAX = 64;
const PATH_MAX = 65_536;
const DIR_MAX = 4_096;
const ENTRIES_MAX = 128;
const HOPS_MAX = 64;
const ARG_MAX = 64;

export interface PinnedExecutable {
    readonly path: string;
    readonly dev: number;
    readonly ino: number;
    recheck(): void;
}

/** Closed over by `recheck`. Mutating these fields, or passing a lookalike, fails closed. */
export interface PathPin {
    readonly path: string;
    readonly dev: number;
    readonly ino: number;
}

export interface TrustedExecutableOptions {
    /** Defaults to the process uid. Tests pass another uid to refuse a foreign owner. */
    uid?: number;
    /** Defaults to `process.env.PATH`. Read once, here, and never at spawn. */
    pathEnv?: string;
}

type PathKind = 'file' | 'dir';

interface PinRecord {
    path: string;
    dev: number;
    ino: number;
    uid: number;
    kind: PathKind;
}

const issued = new WeakMap<object, PinRecord>();

function refuse(reason: string): never {
    throw new Error(`${REFUSED}: ${reason}`);
}

function refusePath(reason: string): never {
    throw new Error(`${PATH_REFUSED}: ${reason}`);
}

function keeperUid(override: number | undefined, deny: (reason: string) => never): number {
    if (override !== undefined) {
        if (!Number.isInteger(override) || override < 0) deny('owner');
        return override;
    }
    const uid = process.getuid?.();
    if (uid === undefined) deny('owner');
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

function assertNode(st: Stats, uid: number, kind: PathKind, deny: (reason: string) => never): void {
    if (kind === 'file') {
        if (!st.isFile() || st.isSymbolicLink()) deny('not a regular file');
        if (st.uid !== uid && st.uid !== 0) deny('owner');
        if ((st.mode & 0o022) !== 0) deny('writable');
        return;
    }
    if (!st.isDirectory() || st.isSymbolicLink()) deny('directory');
    if (st.uid !== uid && st.uid !== 0) deny('directory owner');
    if ((st.mode & 0o1000) !== 0) deny('sticky');
    if ((st.mode & 0o022) !== 0) deny('directory writable');
}

function assertAncestors(filePath: string, uid: number, deny: (reason: string) => never): void {
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
            deny('directory');
        }
        assertNode(st, uid, 'dir', deny);
        if (dir === '/') return;
        dir = dirname(dir);
    }
    deny('directory');
}

function statChecked(
    filePath: string,
    uid: number,
    kind: PathKind,
    deny: (reason: string) => never,
    pin?: { dev: number; ino: number },
): { dev: number; ino: number } {
    let st: Stats;
    try {
        st = lstatSync(filePath);
    } catch {
        deny('unreadable');
    }
    if (pin && (st.dev !== pin.dev || st.ino !== pin.ino)) deny('changed');
    assertNode(st, uid, kind, deny);
    assertAncestors(filePath, uid, deny);
    return { dev: st.dev, ino: st.ino };
}

/** Resolve `pathOrName` once. A bare name is looked up on PATH here and nowhere else. */
export function trustedExecutable(pathOrName: string, options?: TrustedExecutableOptions): PinnedExecutable {
    if (typeof pathOrName !== 'string') refuse('unreadable');
    const uid = keeperUid(options?.uid, refuse);
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
    const found = statChecked(resolved, uid, 'file', refuse);
    const path = resolved;
    const dev = found.dev;
    const ino = found.ino;
    const pinned: PinnedExecutable = {
        path,
        dev,
        ino,
        recheck() {
            statChecked(path, uid, 'file', refuse, { dev, ino });
        },
    };
    return Object.freeze(pinned);
}

/**
 * Pin `target` once. `recheck` uses the object identity of the returned pin.
 * A copied `{path, dev, ino}` is not a pin this function issued.
 */
export function trustedPath(target: string, kind: PathKind, options?: { uid?: number }): PathPin {
    if (kind !== 'file' && kind !== 'dir') refusePath('kind');
    if (typeof target !== 'string' || target.length === 0 || target.length > DIR_MAX || target.includes('\0')) {
        refusePath('unreadable');
    }
    if (!isAbsolute(target)) refusePath('not absolute');
    const uid = keeperUid(options?.uid, refusePath);
    let resolved: string;
    try {
        resolved = realpathSync(target);
    } catch {
        refusePath('unreadable');
    }
    if (!isAbsolute(resolved) || resolved.length > DIR_MAX || resolved.includes('\0')) refusePath('unreadable');
    const found = statChecked(resolved, uid, kind, refusePath);
    const pin: PathPin = { path: resolved, dev: found.dev, ino: found.ino };
    issued.set(pin, { path: resolved, dev: found.dev, ino: found.ino, uid, kind });
    return Object.freeze(pin);
}

/** Re-verify the issued pin. Dev, inode, owner and mode must still match. */
export function recheck(pin: PathPin): void {
    const record = typeof pin === 'object' && pin !== null ? issued.get(pin) : undefined;
    if (!record) refusePath('unreadable');
    statChecked(record.path, record.uid, record.kind, refusePath, { dev: record.dev, ino: record.ino });
}

function fileFromImport(spec: string): string | null {
    if (spec.length === 0 || spec.length > DIR_MAX || spec.includes('\0')) return null;
    if (spec.startsWith('file:')) {
        try {
            const filePath = fileURLToPath(spec);
            return isAbsolute(filePath) ? filePath : null;
        } catch {
            return null;
        }
    }
    if (spec.startsWith('http:') || spec.startsWith('https:') || spec.startsWith('data:')) return null;
    return isAbsolute(spec) ? spec : null;
}

/** Absolute path of the first `--import` / `--import=` loader. Null when it is not a local file. */
export function loaderPathFromArgv(argv: readonly string[]): string | null {
    if (!Array.isArray(argv) || argv.length > ARG_MAX) return null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (typeof arg !== 'string' || arg.length > DIR_MAX || arg.includes('\0')) return null;
        if (arg === '--import') {
            const next = argv[i + 1];
            if (typeof next !== 'string') return null;
            return fileFromImport(next);
        }
        if (arg.startsWith('--import=')) return fileFromImport(arg.slice('--import='.length));
    }
    return null;
}

/** Absolute file from `import.meta.url`, else from `process.argv[1]`. */
export function entryPathFrom(metaUrl: string, argv1: string | undefined): string | null {
    if (typeof metaUrl === 'string' && metaUrl.startsWith('file:')) {
        const fromMeta = fileFromImport(metaUrl);
        if (fromMeta) return fromMeta;
    }
    if (typeof argv1 === 'string' && isAbsolute(argv1) && argv1.length <= DIR_MAX && !argv1.includes('\0')) return argv1;
    return null;
}
