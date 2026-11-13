/**
 * Pure decisions for identity scheduling, price confirmation, env scrub, and the pin check.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { identityDue, scheduledIdentityAt } from './identitySchedule';
import { cacheConfirms, describePriceSend, loopErrorReport, noteRefusal } from './priceConfirm';
import { pinCheckDecision } from './pinCheck';
import { scrubSecretEnv } from './secretEnv';
import type { ChainReceipt } from './sender';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

const receipt = (status: 'success' | 'reverted'): ChainReceipt => ({
    status,
    gasUsed: 1n,
    blockHash: `0x${'ab'.repeat(32)}`,
    blockNumber: 1n,
    transactionHash: `0x${'cd'.repeat(32)}`,
});

describe('keeper pure decisions', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('rechecks identity every hour and on every tick while the gate is closed', () => {
        expect(identityDue(1_000, 5_000, true)).toBe(false);
        expect(identityDue(5_000, 5_000, true)).toBe(true);
        expect(identityDue(1_000, 5_000, false)).toBe(true);
        expect(scheduledIdentityAt(1_000)).toBe(1_000 + 3_600_000);
        expect(() => scheduledIdentityAt(1_000, 1_000)).toThrow(/interval invalid/);
    });

    it('reports a reverted price receipt and confirms a cache move', () => {
        const hash: `0x${string}` = `0x${'11'.repeat(32)}`;
        expect(describePriceSend({ status: 'included', hash, receipt: receipt('reverted') })).toEqual({ kind: 'reverted', hash });
        expect(describePriceSend({ status: 'included', hash, receipt: receipt('success') }).kind).toBe('receipt');
        expect(describePriceSend({ status: 'blocked', inFlightHash: hash }).kind).toBe('blocked');
        expect(describePriceSend({ status: 'refused', reason: 'sender: gate closed' })).toEqual({ kind: 'refused', reason: 'sender: gate closed' });
        expect(cacheConfirms(10n, 20n, 20n)).toBe(true);
        expect(cacheConfirms(10n, 20n, 11n)).toBe(false);
        expect(cacheConfirms(10n, 20n, 10n)).toBe(false);
        const seen = new Set<string>();
        expect(noteRefusal(seen, 'sender: nonce behind journal')).toBe(true);
        expect(noteRefusal(seen, 'sender: nonce behind journal')).toBe(false);
        expect(noteRefusal(seen, 'sender: foreign nonce')).toBe(true);
        seen.clear();
        expect(noteRefusal(seen, 'sender: nonce behind journal')).toBe(true);
        const report = loopErrorReport('sepolia', new Error('boom https://rpc.example/secret'), 'fatal');
        expect(report.telegram).toBe('[keeper] fatal\nnetwork=sepolia\nclass=Error');
        expect(report.stderr).toBe('boom <url>');
        expect(report.telegram).not.toContain('http');
    });

    it('skips the pin check only before the first blob and fails a later gh error', () => {
        expect(pinCheckDecision('unready', [])).toEqual({ exitCode: 0, lines: ['SKIP'] });
        expect(pinCheckDecision('ready', ['match', 'error']).exitCode).toBe(1);
        expect(pinCheckDecision('ready', ['match', 'match'])).toEqual({ exitCode: 0, lines: ['CHECKED', 'CHECKED', 'CHECKED 2'] });
        expect(pinCheckDecision('ready', []).exitCode).toBe(1);
    });

    it('scrubs secret env names and the keeper probe no longer has them', async () => {
        const env: NodeJS.ProcessEnv = {
            PRIVATE_KEY: 'sentinel-private',
            TEST_PRIVATE_KEY: 'sentinel-test',
            MNEMONIC: 'sentinel-words',
            KEYSTORE_PASSWORD: 'sentinel-password',
            KEYSTORE_PATH: '/tmp/keystore',
            KEEPER_CAST_BIN: 'cast',
            RPC_URL: 'http://127.0.0.1',
        };
        expect(scrubSecretEnv(env).sort()).toEqual(['KEYSTORE_PASSWORD', 'MNEMONIC', 'PRIVATE_KEY', 'TEST_PRIVATE_KEY']);
        expect(env.PRIVATE_KEY).toBeUndefined();
        expect(env.KEYSTORE_PATH).toBe('/tmp/keystore');
        expect(env.KEEPER_CAST_BIN).toBe('cast');
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-probe-'));
        dirs.push(cwd);
        writeFileSync(join(cwd, '.env.sepolia'), 'PRIVATE_KEY=file-sentinel\nTEST_PRIVATE_KEY=file-test-sentinel\nMNEMONIC=file-words\nPRIVATE_KEY_SUPPLIER=supplier-sentinel\nKEYSTORE_PASSWORD=pw-sentinel\nRPC_URL=http://127.0.0.1:1\n');
        const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--probe-env', '--dry-run'], {
            cwd,
            env: {
                PATH: process.env.PATH ?? '',
                HOME: cwd,
                PRIVATE_KEY: 'env-sentinel',
                KEEPER_PRIVATE_KEY: 'keeper-sentinel',
                KEYSTORE_PATH: '/tmp/keystore',
                KEEPER_CAST_BIN: 'cast',
            },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            child.once('close', resolve);
        });
        expect(code, out).toBe(0);
        expect(out).toContain('probe secrets=absent');
        expect(out).toContain('probe KEEPER_CAST_BIN=present');
        expect(out).toContain('probe KEYSTORE_PATH=present');
        expect(out).not.toContain('env-sentinel');
        expect(out).not.toContain('file-sentinel');
        expect(out).not.toContain('file-test-sentinel');
        expect(out).not.toContain('Key Length');
        expect(out).not.toContain('supplier-sentinel');
        expect(out).not.toContain('pw-sentinel');
        expect(out).toContain('ignored KEEPER_PRIVATE_KEY from environment; keystore only');
        expect(out).not.toContain('keeper-sentinel');
    });

    it('rejects a pause flag with no value, a short interval, a partial pause config, and a registry-less network', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const run = async (args: string[], env: NodeJS.ProcessEnv = {}, network = 'sepolia', dryRun = true) => {
            const cwd = mkdtempSync(join(tmpdir(), 'keeper-flags-'));
            dirs.push(cwd);
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', network, ...(dryRun ? ['--dry-run'] : []), '--no-logo', ...args], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd, ...env },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            const code = await new Promise<number | null>((resolve) => child.once('close', resolve));
            return { code, out };
        };
        const missingRole = await run(['--role-sync-slice-calls']);
        expect(missingRole.code, missingRole.out).toBe(1);
        expect(missingRole.out).toContain('keeper: --role-sync-slice-calls requires a value');
        const zeroSlice = await run(['--role-sync-slice-calls', '0']);
        expect(zeroSlice.code, zeroSlice.out).toBe(1);
        expect(zeroSlice.out).toContain('keeper: --role-sync-slice-calls invalid');
        const missingInterval = await run(['--pause-interval-sec']);
        expect(missingInterval.code, missingInterval.out).toBe(1);
        expect(missingInterval.out).toContain('keeper: --pause-interval-sec requires a value');
        const flagAsValue = await run(['--pause-offset-sec', '--once']);
        expect(flagAsValue.code, flagAsValue.out).toBe(1);
        expect(flagAsValue.out).toContain('keeper: --pause-offset-sec requires a value');
        const short = await run(['--pause-interval-sec', '599']);
        expect(short.code, short.out).toBe(1);
        expect(short.out).toContain('keeper: --pause-interval-sec invalid');
        const badRegistry = await run(['--registry']);
        expect(badRegistry.code, badRegistry.out).toBe(1);
        expect(badRegistry.out).toContain('keeper: --registry requires a value');
        const invalidRegistry = await run(['--registry', '0x1234']);
        expect(invalidRegistry.code, invalidRegistry.out).toBe(1);
        expect(invalidRegistry.out).toContain('keeper: --registry invalid');
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-partial-'));
        dirs.push(cwd);
        const noRegistry = await run([
            '--keystore', join(cwd, 'ks'),
            '--password-file', join(cwd, 'pw'),
            '--signer', '0x1111111111111111111111111111111111111111',
            '--once',
            '--no-superpaymaster',
            '--disable-paymaster',
        ], { RPC_URL: 'http://127.0.0.1:1' }, 'anvil', false);
        expect(noRegistry.code, noRegistry.out).toBe(1);
        expect(noRegistry.out).toContain('signer identity: anvil has no registry address; pass --registry <address>');
        writeFileSync(join(cwd, 'pause.json'), '{"superPaymaster":"0x1111111111111111111111111111111111111111"}\n');
        const partial = await run(['--pause-config', join(cwd, 'pause.json')]);
        expect(partial.code, partial.out).toBe(1);
        expect(partial.out).toContain('pause-config: partial');
        expect(partial.out).not.toContain('pauseDuty=disabled');
    });
});
