/**
 * Mix-up pin for the cast binary.
 *
 * The absolute path's device and inode are recorded at startup and checked again
 * before each spawn. A different inode refuses the spawn. Ownership, mode, and
 * ancestors are not examined: this is not a trust boundary. The operator preflight
 * is where those checks belong, and it runs before Node starts.
 */
import { lstatSync, realpathSync, type Stats } from 'node:fs';
import { isAbsolute } from 'node:path';

const REFUSED = 'keeper: cast bin refused';
const PATH_MAX = 4_096;

export interface PinnedExecutable {
    readonly path: string;
    readonly dev: number;
    readonly ino: number;
    recheck(): void;
}

function refuse(reason: 'unreadable' | 'not absolute' | 'not a regular file' | 'changed'): never {
    throw new Error(`${REFUSED}: ${reason}`);
}

/** Pin an absolute cast path. PATH is not searched. The returned object is frozen. */
export function pinCastBin(target: string): PinnedExecutable {
    if (typeof target !== 'string' || target.length === 0 || target.length > PATH_MAX || target.includes('\0')) {
        refuse('unreadable');
    }
    if (!isAbsolute(target)) refuse('not absolute');
    let resolved: string;
    try {
        resolved = realpathSync(target);
    } catch {
        refuse('unreadable');
    }
    if (!isAbsolute(resolved) || resolved.length > PATH_MAX || resolved.includes('\0')) refuse('unreadable');
    let st: Stats;
    try {
        st = lstatSync(resolved);
    } catch {
        refuse('unreadable');
    }
    if (!st.isFile() || st.isSymbolicLink()) refuse('not a regular file');
    const path = resolved;
    const dev = st.dev;
    const ino = st.ino;
    return Object.freeze({
        path,
        dev,
        ino,
        recheck() {
            let now: Stats;
            try {
                now = lstatSync(path);
            } catch {
                refuse('unreadable');
            }
            if (!now.isFile() || now.isSymbolicLink() || now.dev !== dev || now.ino !== ino) refuse('changed');
        },
    });
}
