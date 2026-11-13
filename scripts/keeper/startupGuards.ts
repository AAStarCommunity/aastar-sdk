/**
 * Startup checks for the env file and the cast binary.
 * Messages name the check. They do not include file contents or the path value.
 */

export interface ModeStat {
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    uid: number;
    mode: number;
}

export function envFileRefusal(file: ModeStat, parent: ModeStat, uid: number | undefined): string | null {
    if (uid === undefined) return 'keeper: env file refused: owner';
    if (!file.isFile || file.isSymbolicLink) return 'keeper: env file refused: not a regular file';
    if (file.uid !== uid) return 'keeper: env file refused: owner';
    if ((file.mode & 0o777) !== 0o600) return 'keeper: env file refused: mode';
    if (!parent.isDirectory || parent.isSymbolicLink) return 'keeper: env file refused: parent';
    if (parent.uid !== uid) return 'keeper: env file refused: parent owner';
    if ((parent.mode & 0o022) !== 0) return 'keeper: env file refused: parent writable';
    return null;
}

/** Target after one realpath. Root (uid 0) or the process uid. Not group or world writable. */
export function castBinRefusal(target: ModeStat, uid: number | undefined): string | null {
    if (!target.isFile || target.isSymbolicLink) return 'keeper: cast bin refused: not a regular file';
    if (uid === undefined) return 'keeper: cast bin refused: owner';
    if (target.uid !== uid && target.uid !== 0) return 'keeper: cast bin refused: owner';
    if ((target.mode & 0o022) !== 0) return 'keeper: cast bin refused: writable';
    return null;
}
