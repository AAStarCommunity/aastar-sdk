/**
 * Ownership and mode predicates. A foreign uid is not created with chown.
 */
import { describe, expect, it } from 'vitest';
import { envFileRefusal, type ModeStat } from './startupGuards.js';

const uid = 501;

function stat(over: Partial<ModeStat>): ModeStat {
    return {
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        uid,
        mode: 0o100600,
        ...over,
    };
}

describe('startup guards', () => {
    it('names each env-file check and ignores a foreign uid', () => {
        const file = stat({});
        const parent = stat({ isFile: false, isDirectory: true, mode: 0o040700 });
        expect(envFileRefusal(file, parent, uid)).toBeNull();
        expect(envFileRefusal(file, parent, undefined)).toBe('keeper: env file refused: owner');
        expect(envFileRefusal(stat({ uid: uid + 1 }), parent, uid)).toBe('keeper: env file refused: owner');
        expect(envFileRefusal(stat({ isFile: false }), parent, uid)).toBe('keeper: env file refused: not a regular file');
        expect(envFileRefusal(stat({ isSymbolicLink: true }), parent, uid)).toBe('keeper: env file refused: not a regular file');
        expect(envFileRefusal(stat({ mode: 0o100644 }), parent, uid)).toBe('keeper: env file refused: mode');
        expect(envFileRefusal(file, stat({ isDirectory: false }), uid)).toBe('keeper: env file refused: parent');
        expect(envFileRefusal(file, stat({ isFile: false, isDirectory: true, mode: 0o040700, uid: uid + 1 }), uid)).toBe('keeper: env file refused: parent owner');
        expect(envFileRefusal(file, stat({ isFile: false, isDirectory: true, mode: 0o040777 }), uid)).toBe('keeper: env file refused: parent writable');
    });
});
