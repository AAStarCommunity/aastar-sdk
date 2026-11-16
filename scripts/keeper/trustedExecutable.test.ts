/**
 * Cast pin is mix-up protection: an absolute path, then the same device and inode.
 * Ownership, mode, and ancestors are not checked.
 */
import { chmodSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pinCastBin } from './trustedExecutable.js';

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), 'cast-pin-'));
    dirs.push(dir);
    return dir;
}

describe('pinCastBin', () => {
    it('pins an absolute regular file and refuses a relative name without printing it', () => {
        const root = scratch();
        const file = join(root, 'cast');
        writeFileSync(file, '#!/bin/sh\nexit 0\n');
        chmodSync(file, 0o777);
        const pin = pinCastBin(file);
        expect(pin.path).toBe(realpathSync(file));
        expect(() => pin.recheck()).not.toThrow();
        expect(() => pinCastBin('cast')).toThrow(/^keeper: cast bin refused: not absolute$/);
        try {
            pinCastBin('cast');
        } catch (error) {
            expect(String(error)).not.toContain(root);
        }
    });

    it('accepts a group-writable file and a symlink to one', () => {
        const root = scratch();
        const file = join(root, 'cast');
        writeFileSync(file, '#!/bin/sh\nexit 0\n');
        chmodSync(file, 0o777);
        chmodSync(root, 0o777);
        expect(() => pinCastBin(file)).not.toThrow();
        const link = join(root, 'via');
        symlinkSync(file, link);
        const via = pinCastBin(link);
        expect(via.path).toBe(realpathSync(file));
        expect(via.ino).toBe(pinCastBin(file).ino);
    });

    it('refuses a changed inode before the next spawn and does not print the path', () => {
        const root = scratch();
        const file = join(root, 'password-sentinel');
        writeFileSync(file, '#!/bin/sh\nexit 0\n');
        chmodSync(file, 0o755);
        const pin = pinCastBin(file);
        rmSync(file);
        writeFileSync(file, '#!/bin/sh\nexit 1\n');
        chmodSync(file, 0o755);
        expect(() => pin.recheck()).toThrow(/^keeper: cast bin refused: changed$/);
        try {
            pin.recheck();
        } catch (error) {
            expect(String(error)).not.toContain('password-sentinel');
        }
    });
});
