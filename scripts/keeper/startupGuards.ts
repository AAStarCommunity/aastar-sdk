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
