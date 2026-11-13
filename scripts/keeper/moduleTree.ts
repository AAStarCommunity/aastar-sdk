/**
 * Live startup check for the code the keeper loads.
 * The repo root, package.json, pnpm-lock.yaml, and every node_modules entry
 * must match the trustedPath ownership and mode rules. Symlink targets are
 * resolved and pinned, including targets outside the repo.
 */
import { lstatSync, opendirSync, realpathSync, type Stats } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { trustedPath } from './trustedExecutable.js';

export const DEFAULT_MAX_MODULE_ENTRIES = 300_000;
const PATH_MAX = 4_096;
const NAME_MAX = 255;

const CHECKS = new Set([
    'unreadable', 'owner', 'writable', 'sticky', 'directory', 'directory owner', 'directory writable',
    'not a regular file', 'changed', 'kind', 'not absolute',
]);

export interface ModuleTreeOptions {
    /** Count of node_modules entries. Default 300000. 1..300000. */
    maxEntries?: number;
    /** Defaults to the process uid. */
    uid?: number;
}

function refuse(check: string, label?: string): never {
    if (check === 'module tree too large to verify') {
        throw new Error('keeper: modules refused: module tree too large to verify');
    }
    const token = CHECKS.has(check) ? check : 'unreadable';
    if (
        label === undefined
        || label.length === 0
        || label.length > PATH_MAX
        || label.includes('\0')
        || isAbsolute(label)
        || label.split('/').includes('..')
    ) {
        throw new Error(`keeper: modules refused: ${token}`);
    }
    throw new Error(`keeper: modules refused: ${token}: ${label}`);
}

function tokenOf(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const mark = message.lastIndexOf(': ');
    const token = mark >= 0 ? message.slice(mark + 2) : '';
    return CHECKS.has(token) ? token : 'unreadable';
}

function labelOf(prefix: string, name: string): string {
    if (name.length === 0 || name.length > NAME_MAX || name.includes('\0') || name === '.' || name === '..') {
        refuse('unreadable', prefix);
    }
    if (prefix.length > PATH_MAX || prefix.length + 1 + name.length > PATH_MAX) refuse('unreadable', prefix);
    return `${prefix}/${name}`;
}

function checkFile(st: Stats, uid: number, label: string): void {
    if (st.uid !== uid && st.uid !== 0) refuse('owner', label);
    if ((st.mode & 0o022) !== 0) refuse('writable', label);
}

function checkDir(st: Stats, uid: number, label: string): void {
    if (st.uid !== uid && st.uid !== 0) refuse('directory owner', label);
    if ((st.mode & 0o1000) !== 0) refuse('sticky', label);
    if ((st.mode & 0o022) !== 0) refuse('directory writable', label);
}

function pinNamed(abs: string, kind: 'file' | 'dir', label: string, uid: number | undefined): void {
    try {
        trustedPath(abs, kind, uid === undefined ? undefined : { uid });
    } catch (error) {
        refuse(tokenOf(error), label);
    }
}

/**
 * Verify `repoRoot` before a live run reads a keystore or spawns cast.
 * Throws a fixed message. The path in that message is relative to the repo.
 */
export function verifyModuleTree(repoRoot: string, options?: ModuleTreeOptions): void {
    const maxEntries = options?.maxEntries ?? DEFAULT_MAX_MODULE_ENTRIES;
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > DEFAULT_MAX_MODULE_ENTRIES) {
        refuse(maxEntries > DEFAULT_MAX_MODULE_ENTRIES ? 'module tree too large to verify' : 'unreadable');
    }
    const uidOpt = options?.uid;
    if (uidOpt !== undefined && (!Number.isInteger(uidOpt) || uidOpt < 0)) refuse('owner');
    if (typeof repoRoot !== 'string' || repoRoot.length === 0 || repoRoot.length > PATH_MAX || repoRoot.includes('\0') || !isAbsolute(repoRoot)) {
        refuse('unreadable');
    }
    const uid = uidOpt ?? process.getuid?.();
    if (uid === undefined) refuse('owner');

    let rootPin;
    try {
        rootPin = trustedPath(repoRoot, 'dir', uidOpt === undefined ? undefined : { uid: uidOpt });
    } catch (error) {
        refuse(tokenOf(error), '.');
    }
    const root = rootPin.path;
    pinNamed(join(root, 'package.json'), 'file', 'package.json', uidOpt);
    pinNamed(join(root, 'pnpm-lock.yaml'), 'file', 'pnpm-lock.yaml', uidOpt);

    const passedTargets = new Set<string>();
    let seen = 0;
    const stack: { dir: string; label: string }[] = [];

    const bump = (): void => {
        seen += 1;
        if (seen > maxEntries) refuse('module tree too large to verify');
    };

    const consider = (full: string, label: string): void => {
        bump();
        let st: Stats;
        try {
            st = lstatSync(full);
        } catch {
            refuse('unreadable', label);
        }
        // Pin the target and its ancestors. Do not walk through the link:
        // a directory link's children are either reached as real entries or live outside this tree.
        if (st.isSymbolicLink()) {
            let resolved: string;
            try {
                resolved = realpathSync(full);
            } catch {
                refuse('unreadable', label);
            }
            if (!isAbsolute(resolved) || resolved.length > PATH_MAX || resolved.includes('\0')) refuse('unreadable', label);
            let target: Stats;
            try {
                target = lstatSync(resolved);
            } catch {
                refuse('unreadable', label);
            }
            const kind = target.isDirectory() && !target.isSymbolicLink()
                ? 'dir'
                : target.isFile() && !target.isSymbolicLink()
                    ? 'file'
                    : null;
            if (!kind) refuse('not a regular file', label);
            const key = `${target.dev}:${target.ino}`;
            if (passedTargets.has(key)) return;
            pinNamed(resolved, kind, label, uidOpt);
            passedTargets.add(key);
            return;
        }
        if (st.isDirectory()) {
            checkDir(st, uid, label);
            stack.push({ dir: full, label });
            return;
        }
        if (st.isFile()) {
            checkFile(st, uid, label);
            return;
        }
        refuse('not a regular file', label);
    };

    consider(join(root, 'node_modules'), 'node_modules');
    while (stack.length > 0) {
        const frame = stack.pop();
        if (!frame) break;
        let dir;
        try {
            dir = opendirSync(frame.dir);
        } catch {
            refuse('unreadable', frame.label);
        }
        try {
            for (;;) {
                let ent;
                try {
                    ent = dir.readSync();
                } catch {
                    refuse('unreadable', frame.label);
                }
                if (!ent) break;
                const name = ent.name;
                if (typeof name !== 'string' || name.length === 0 || name.length > NAME_MAX || name.includes('\0') || name === '.' || name === '..') {
                    refuse('unreadable', frame.label);
                }
                const full = join(frame.dir, name);
                if (full.length > PATH_MAX) refuse('unreadable', frame.label);
                consider(full, labelOf(frame.label, name));
            }
        } finally {
            dir.closeSync();
        }
    }
}
