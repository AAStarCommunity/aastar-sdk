/**
 * Pure decisions for identity scheduling, price confirmation, and env scrub.
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
        writeFileSync(join(cwd, '.env.sepolia'), 'PRIVATE_KEY=file-sentinel\nRPC_URL=http://127.0.0.1:9\n');
        const inherited = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--probe-env', '--dry-run'], {
            cwd,
            env: {
                PATH: process.env.PATH ?? '',
                HOME: cwd,
                PRIVATE_KEY: 'env-sentinel',
                KEEPER_CAST_BIN: 'cast',
            },
        });
        let inheritedOut = '';
        inherited.stdout.on('data', (chunk) => { inheritedOut += chunk.toString(); });
        inherited.stderr.on('data', (chunk) => { inheritedOut += chunk.toString(); });
        const inheritedCode = await new Promise<number | null>((resolve) => inherited.once('close', resolve));
        expect(inheritedCode, inheritedOut).toBe(1);
        expect(inheritedOut).toContain('keeper: secret env refused: PRIVATE_KEY');
        expect(inheritedOut).not.toContain('env-sentinel');
        expect(inheritedOut).not.toContain('file-sentinel');
        expect(inheritedOut).not.toContain('Key Length');

        const envFile = join(cwd, 'keeper.env');
        writeFileSync(envFile, 'RPC_URL=http://127.0.0.1:9\nSUPPLIER_TOKEN=supplier-sentinel\n');
        const extra = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--env-file', envFile], {
            cwd,
            env: { PATH: process.env.PATH ?? '', HOME: cwd },
        });
        let extraOut = '';
        extra.stdout.on('data', (chunk) => { extraOut += chunk.toString(); });
        extra.stderr.on('data', (chunk) => { extraOut += chunk.toString(); });
        const extraCode = await new Promise<number | null>((resolve) => extra.once('close', resolve));
        expect(extraCode, extraOut).toBe(1);
        expect(extraOut).toContain('keeper: env file key refused: SUPPLIER_TOKEN');
        expect(extraOut).not.toContain('supplier-sentinel');

        const allowed = join(cwd, 'allowed.env');
        writeFileSync(allowed, 'RPC_URL=http://127.0.0.1:9\nKEEPER_CAST_BIN=cast\n');
        const ok = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--probe-env', '--dry-run', '--env-file', allowed], {
            cwd,
            env: { PATH: process.env.PATH ?? '', HOME: cwd, KEYSTORE_PATH: '/tmp/keystore' },
        });
        let okOut = '';
        ok.stdout.on('data', (chunk) => { okOut += chunk.toString(); });
        ok.stderr.on('data', (chunk) => { okOut += chunk.toString(); });
        const okCode = await new Promise<number | null>((resolve) => ok.once('close', resolve));
        expect(okCode, okOut).toBe(0);
        expect(okOut).toContain('probe secrets=absent');
        expect(okOut).toContain('probe KEEPER_CAST_BIN=present');
        expect(okOut).not.toContain('http://127.0.0.1:9');
    });

    it('rejects pause-duty flags and a registry-less network', async () => {
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
        for (const flag of ['--pause-config', '--pause-interval-sec', '--pause-offset-sec', '--role-sync-budget-sec']) {
            const rejected = await run([flag, '1']);
            expect(rejected.code, rejected.out).toBe(1);
            expect(rejected.out).toContain(`keeper: ${flag} is not part of the price keeper`);
        }
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
    });
});
