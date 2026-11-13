/**
 * Pin cast once. These cases do not spawn.
 */
import { chmodSync, lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { entryPathFrom, loaderPathFromArgv, recheck, trustedExecutable, trustedPath } from './trustedExecutable.js';
import { trustedScratch } from './trustScratch.js';

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try { chmodSync(dir, 0o700); } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
});

function bin(name: string): { root: string; dir: string; file: string } {
    const root = trustedScratch('pin');
    dirs.push(root);
    const dir = join(root, 'bin');
    mkdirSync(dir, { mode: 0o755 });
    const file = join(dir, name);
    writeFileSync(file, '#!/bin/sh\nexit 0\n');
    chmodSync(file, 0o755);
    return { root, dir, file };
}

describe('trusted executable', () => {
    it('resolves a bare name on PATH once to an absolute pin and refuses a sticky or writable ancestor', () => {
        const first = bin('cast');
        const pin = trustedExecutable('cast', { pathEnv: first.dir });
        expect(pin.path).toBe(realpathSync(first.file));
        expect(pin.path.startsWith('/')).toBe(true);
        const via = join(first.root, 'via');
        symlinkSync(first.file, via);
        expect(trustedExecutable(via).path).toBe(pin.path);
        pin.recheck();
        const frozen = pin as { path: string };
        expect(() => { frozen.path = '/tmp/cast'; }).toThrow();

        const later = bin('cast');
        const other = trustedExecutable('cast', { pathEnv: `${later.dir}:${first.dir}` });
        expect(other.path).toBe(realpathSync(later.file));
        expect(pin.path).toBe(realpathSync(first.file));

        chmodSync(first.dir, 0o1755);
        expect(() => pin.recheck()).toThrow('keeper: cast bin refused: sticky');
        chmodSync(first.dir, 0o755);
        pin.recheck();
        chmodSync(first.dir, 0o777);
        expect(() => pin.recheck()).toThrow('keeper: cast bin refused: directory writable');
        chmodSync(first.dir, 0o755);

        const sneakRoot = trustedScratch('sneak');
        dirs.push(sneakRoot);
        const sneak = join(sneakRoot, 'password-sentinel');
        mkdirSync(sneak, { mode: 0o1755 });
        chmodSync(sneak, 0o1755);
        const loose = join(sneak, 'cast');
        writeFileSync(loose, '#!/bin/sh\nexit 0\n');
        chmodSync(loose, 0o755);
        expect(() => trustedExecutable(loose)).toThrow(/^keeper: cast bin refused: sticky$/);
        try {
            trustedExecutable(loose);
        } catch (error) {
            expect(String(error)).not.toContain('password-sentinel');
            expect(String(error)).not.toContain(loose);
        }
        expect(() => trustedExecutable('cast/bin')).toThrow('keeper: cast bin refused: not absolute');
        expect(() => trustedExecutable(first.file, { uid: 1 })).toThrow('keeper: cast bin refused: owner');
    });

    it('refuses a replaced executable before the next check', () => {
        const first = bin('cast');
        const pin = trustedExecutable(first.file);
        unlinkSync(first.file);
        writeFileSync(first.file, '#!/bin/sh\nexit 1\n');
        chmodSync(first.file, 0o755);
        expect(lstatSync(first.file).ino).not.toBe(pin.ino);
        expect(() => pin.recheck()).toThrow('keeper: cast bin refused: changed');
    });
});

describe('trusted path', () => {
    it('refuses a sticky ancestor that is not group-writable and does not print the path', () => {
        const root = trustedScratch('tpath');
        dirs.push(root);
        const sticky = join(root, 'password-sentinel');
        mkdirSync(sticky, { mode: 0o1755 });
        chmodSync(sticky, 0o1755);
        const file = join(sticky, 'node');
        writeFileSync(file, '#!/bin/sh\nexit 0\n');
        chmodSync(file, 0o755);
        expect(() => trustedPath(file, 'file')).toThrow(/^keeper: path refused: sticky$/);
        try {
            trustedPath(file, 'file');
        } catch (error) {
            expect(String(error)).not.toContain('password-sentinel');
            expect(String(error)).not.toContain(file);
        }
    });

    it('rejects a lookalike pin and a replaced inode', () => {
        const made = bin('node');
        const pin = trustedPath(made.file, 'file');
        expect(Object.isFrozen(pin)).toBe(true);
        expect(() => recheck({ path: pin.path, dev: pin.dev, ino: pin.ino })).toThrow('keeper: path refused: unreadable');
        unlinkSync(made.file);
        writeFileSync(made.file, '#!/bin/sh\nexit 1\n');
        chmodSync(made.file, 0o755);
        expect(() => recheck(pin)).toThrow('keeper: path refused: changed');
    });

    it('reads only an absolute local loader and entry', () => {
        expect(loaderPathFromArgv(['--import', '/usr/local/lib/loader.mjs'])).toBe('/usr/local/lib/loader.mjs');
        expect(loaderPathFromArgv(['--import=file:///usr/local/lib/loader.mjs'])).toBe('/usr/local/lib/loader.mjs');
        expect(loaderPathFromArgv(['--import', 'tsx'])).toBeNull();
        expect(loaderPathFromArgv(['--import', 'https://example.invalid/loader.mjs'])).toBeNull();
        expect(loaderPathFromArgv(['--import'])).toBeNull();
        expect(entryPathFrom('file:///usr/local/lib/keeper.ts', undefined)).toBe('/usr/local/lib/keeper.ts');
        expect(entryPathFrom('http://example.invalid/keeper.ts', '/usr/local/lib/keeper.ts')).toBe('/usr/local/lib/keeper.ts');
        expect(entryPathFrom('not-a-url', 'keeper.ts')).toBeNull();
    });
});
