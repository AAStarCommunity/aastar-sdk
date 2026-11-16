/**
 * Metadata-only credential rules shared by preflight and runtime.
 * Neither function reads file bytes. Root-owned parents are refused, same as the runtime uid check.
 */

export interface NodeMeta {
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    uid: number;
    mode: number;
}

function bits(mode: number): number {
    return mode & 0o777;
}

/** Password file 0600, parent directory exactly 0700, both uid-owned, neither a symlink. */
export function passwordRefusal(file: NodeMeta, parent: NodeMeta, uid: number | undefined): string | null {
    if (uid === undefined) return 'secret file: process uid unavailable';
    if (!file.isFile || file.isSymbolicLink) return 'secret file: password file is not a regular file';
    if (bits(file.mode) !== 0o600) return 'secret file: password file mode is not 0600';
    if (file.uid !== uid) return 'secret file: password file owner is not the process uid';
    if (!parent.isDirectory || parent.isSymbolicLink) return 'secret file: password directory mode is not 0700';
    if (bits(parent.mode) !== 0o700) return 'secret file: password directory mode is not 0700';
    if (parent.uid !== uid) return 'secret file: password directory owner is not the process uid';
    return null;
}

/** Keystore exactly 0600 and uid-owned. Parent is a real uid-owned directory and not group or world writable. */
export function keystoreRefusal(file: NodeMeta, parent: NodeMeta, uid: number | undefined): string | null {
    if (uid === undefined) return 'secret file: process uid unavailable';
    if (!file.isFile || file.isSymbolicLink) return 'secret file: keystore is not a regular file';
    if (file.uid !== uid) return 'secret file: keystore owner is not the process uid';
    if (bits(file.mode) !== 0o600) return 'secret file: keystore mode is not 0600';
    if (!parent.isDirectory || parent.isSymbolicLink) return 'secret file: keystore directory is group or world writable';
    if (parent.uid !== uid) return 'secret file: keystore directory owner is not the process uid';
    if ((bits(parent.mode) & 0o022) !== 0) return 'secret file: keystore directory is group or world writable';
    return null;
}
