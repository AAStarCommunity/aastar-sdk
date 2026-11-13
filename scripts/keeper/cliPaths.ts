/**
 * Filesystem paths named on the keeper command line.
 * Resolved against the process cwd before cast changes directory.
 */
import { resolve } from 'node:path';

export function absoluteKeeperPath(cwd: string, value: string): string {
    if (typeof cwd !== 'string' || cwd.length === 0 || cwd.length > 4_096) throw new Error('keeper: path rejected');
    if (typeof value !== 'string' || value.length === 0 || value.length > 4_096) throw new Error('keeper: path rejected');
    return resolve(cwd, value);
}
