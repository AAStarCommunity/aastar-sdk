/**
 * Pure decisions for identity scheduling, price confirmation, and env scrub.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chmodSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { encodeFunctionResult, getAddress, toFunctionSelector } from 'viem';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { identityDue, scheduledIdentityAt } from './identitySchedule';
import { cacheConfirms, describePriceSend, loopErrorReport, noteRefusal } from './priceConfirm';
import { scrubSecretEnv } from './secretEnv';
import type { ChainReceipt } from './sender';
import { trustedScratch } from './trustScratch.js';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
// A fake cast in a trusted scratch dir: process.execPath is not always trusted (CI's tool cache can be
// group-writable), and trustedExecutable() rightly refuses that (#447 clestons B1').
const SAFE_CAST_DIR = trustedScratch('units-cast');
const SAFE_CAST = join(SAFE_CAST_DIR, 'cast');
writeFileSync(SAFE_CAST, '#!/bin/sh\nexit 0\n');
chmodSync(SAFE_CAST, 0o755);
const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
const dirs: string[] = [];
afterAll(() => rmSync(SAFE_CAST_DIR, { recursive: true, force: true }), SPAWN_VERDICT_TIMEOUT_MS);
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
        chmodSync(envFile, 0o600);
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
        writeFileSync(allowed, `RPC_URL=http://127.0.0.1:9\nKEEPER_CAST_BIN=${SAFE_CAST}\n`);
        chmodSync(allowed, 0o600);
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
        expect(okOut).not.toContain(SAFE_CAST);
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
        for (const flag of ['--pause-config', '--pause-interval-sec', '--pause-offset-sec', '--role-sync-budget-sec', '--resync-journal']) {
            const rejected = await run([flag]);
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
        const castDir = trustedScratch('partial-cast');
        dirs.push(castDir);
        const cast = join(castDir, 'cast');
        writeFileSync(cast, '#!/bin/sh\nexit 1\n');
        chmodSync(cast, 0o755);
        const noRegistry = await run([
            '--keystore', join(cwd, 'ks'),
            '--password-file', join(cwd, 'pw'),
            '--signer', '0x6666666666666666666666666666666666666666',
            '--max-fee-gwei', '1',
            '--once',
            '--cast-bin', cast,
            '--no-superpaymaster',
            '--disable-paymaster',
        ], { RPC_URL: 'http://127.0.0.1:1' }, 'anvil', false);
        expect(noRegistry.code, noRegistry.out).toBe(1);
        expect(noRegistry.out).toContain('keeper: chain id unreadable');
    });

    it('anvil config path resolves priceFeed from config.anvil.json', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const parsed = JSON.parse(body) as { id: unknown; method: string };
                const result = parsed.method === 'eth_chainId' ? '0x7a69' : '0x0';
                res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result }));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address() as AddressInfo;
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-anvil-'));
        dirs.push(cwd);
        const fifo = join(cwd, 'env.fifo');
        const made = spawn('mkfifo', [fifo]);
        expect(await new Promise<number | null>((resolve) => made.once('exit', resolve))).toBe(0);
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
            '--network', 'anvil', '--dry-run', '--once', '--no-logo', '--disable-paymaster', '--no-superpaymaster',
        ], {
            cwd,
            env: { PATH: process.env.PATH ?? '', HOME: cwd, RPC_URL: `http://127.0.0.1:${address.port}` },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
            child.once('close', (status) => { clearTimeout(timer); resolve(status); });
        });
        server.close();
        expect(out, `code=${code}`).toContain('priceFeed=0x5D42EBdBBa61412295D7b0302d6F50aC449Ddb4F');

        const started = Date.now();
        const fifoChild = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--',
            '--network', 'sepolia', '--dry-run', '--once', '--no-logo', '--env-file', fifo,
        ], { cwd, env: { PATH: process.env.PATH ?? '', HOME: cwd } });
        let fifoOut = '';
        fifoChild.stdout.on('data', (chunk) => { fifoOut += chunk.toString(); });
        fifoChild.stderr.on('data', (chunk) => { fifoOut += chunk.toString(); });
        const fifoCode = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { fifoChild.kill('SIGKILL'); resolve(null); }, 15_000);
            fifoChild.once('close', (status) => { clearTimeout(timer); resolve(status); });
        });
        expect(Date.now() - started, fifoOut).toBeLessThan(10_000);
        expect(fifoCode, fifoOut).toBe(1);
        expect(fifoOut).toContain('keeper: env file refused');
    });

    it('refuses ETH_PASSWORD, CAST_PASSWORD and a passphrase name before startup', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const secret = 'sentinel-signing-secret';
        for (const name of ['ETH_PASSWORD', 'CAST_PASSWORD', 'KEEPER_PASSPHRASE']) {
            const cwd = mkdtempSync(join(tmpdir(), 'keeper-secret-'));
            dirs.push(cwd);
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--probe-env', '--dry-run'], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd, [name]: secret },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            const code = await new Promise<number | null>((resolve) => child.once('close', resolve));
            expect(code, out).toBe(1);
            expect(out).toContain(`keeper: secret env refused: ${name}`);
            expect(out).not.toContain(secret);
        }
    });

    it('rejects unknown options and --name=value forms by name', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const tokens = ['--max-gas=21000', '--max-sends-per-hour=1', '--pause-config=/tmp/pause', '--not-a-keeper-flag'];
        for (const token of tokens) {
            const cwd = mkdtempSync(join(tmpdir(), 'keeper-unknown-'));
            dirs.push(cwd);
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--no-logo', token], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            const code = await new Promise<number | null>((resolve) => child.once('close', resolve));
            expect(code, out).toBe(1);
            const eq = token.indexOf('=');
            const name = eq >= 0 ? token.slice(0, eq) : token;
            expect(out).toContain(`keeper: unrecognized option ${name}`);
            if (eq >= 0) expect(out).not.toContain(token.slice(eq + 1));
        }
    });

    it('a rejected --private-key value is not printed', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const hex = `0x${'ab'.repeat(32)}`;
        const token = `--private-key=${hex}`;
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-key-'));
        dirs.push(cwd);
        const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--no-logo', token, 'positional-sentinel'], {
            cwd,
            env: { PATH: process.env.PATH ?? '', HOME: cwd },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => child.once('close', resolve));
        expect(code, out).toBe(1);
        expect(out).toContain('keeper: unrecognized option --private-key');
        expect(out).not.toContain(hex);
        expect(out).not.toContain('positional-sentinel');
    });

    it('takes KEEPER_CAST_BIN from the env file, and a CLI flag wins', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-castbin-'));
        dirs.push(cwd);
        const binDir = trustedScratch('castbin');
        dirs.push(binDir);
        const file = join(cwd, 'keeper.env');
        const envCast = join(binDir, 'cast-env');
        const cliCast = join(binDir, 'cast-cli');
        writeFileSync(envCast, '#!/bin/sh\nexit 0\n');
        writeFileSync(cliCast, '#!/bin/sh\nexit 0\n');
        chmodSync(envCast, 0o755);
        chmodSync(cliCast, 0o755);
        writeFileSync(file, `KEEPER_CAST_BIN=${envCast}\nRPC_URL=http://127.0.0.1:9\n`);
        chmodSync(file, 0o600);
        const run = (extra: string[]) => {
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--probe-env', '--dry-run', '--env-file', file, ...extra], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            return new Promise<{ code: number | null; out: string }>((resolve) => {
                child.once('close', (code) => resolve({ code, out }));
            });
        };
        const fromEnv = await run([]);
        expect(fromEnv.code, fromEnv.out).toBe(0);
        expect(fromEnv.out).toContain('probe cast-source=env');
        expect(fromEnv.out).not.toContain(envCast);
        const fromCli = await run(['--cast-bin', cliCast]);
        expect(fromCli.code, fromCli.out).toBe(0);
        expect(fromCli.out).toContain('probe cast-source=cli');
        expect(fromCli.out).not.toContain(envCast);
        expect(fromCli.out).not.toContain(cliCast);
    });

    it('uses the anvil deployment registry for signer identity without address flags', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const ownerAbi = [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }] as const;
        const roundAbi = [{ type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
            { name: '', type: 'uint80' }, { name: '', type: 'int256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint80' },
        ] }] as const;
        const cacheAbi = [{ type: 'function', name: 'cachedPrice', stateMutability: 'view', inputs: [], outputs: [
            { name: '', type: 'int256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint80' }, { name: '', type: 'uint8' },
        ] }] as const;
        const thresholdAbi = [{ type: 'function', name: 'priceStalenessThreshold', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }] as const;
        const decAbi = [{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] }] as const;
        const other = getAddress('0x9999999999999999999999999999999999999999');
        const ownerWord = encodeFunctionResult({ abi: ownerAbi, functionName: 'owner', result: other });
        const roundWord = encodeFunctionResult({ abi: roundAbi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, 1n, 1_700_000_000n, 1n] });
        const cacheWord = encodeFunctionResult({ abi: cacheAbi, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, 1_700_000_000n, 1n, 8] });
        const thresholdWord = encodeFunctionResult({ abi: thresholdAbi, functionName: 'priceStalenessThreshold', result: 3600n });
        const decWord = encodeFunctionResult({ abi: decAbi, functionName: 'decimals', result: 8 });
        const ownerSel = toFunctionSelector('function owner()');
        const roundSel = toFunctionSelector('function latestRoundData()');
        const cacheSel = toFunctionSelector('function cachedPrice()');
        const thresholdSel = toFunctionSelector('function priceStalenessThreshold()');
        const decSel = toFunctionSelector('function decimals()');
        const callResult = (data: string): string => {
            if (data === ownerSel) return ownerWord;
            if (data === roundSel) return roundWord;
            if (data === cacheSel) return cacheWord;
            if (data === thresholdSel) return thresholdWord;
            if (data === decSel) return decWord;
            return ownerWord;
        };
        const block = {
            number: '0x1', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32),
            timestamp: '0x1', baseFeePerGas: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0',
            transactions: [] as string[], uncles: [] as string[], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20),
            difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32),
            sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32),
            transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0',
        };
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const parsed = JSON.parse(body) as { id: unknown; method: string; params?: unknown[] };
                let result: unknown = '0x0';
                if (parsed.method === 'eth_chainId') result = '0x7a69';
                else if (parsed.method === 'eth_blockNumber') result = '0x1';
                else if (parsed.method === 'eth_getBlockByNumber' || parsed.method === 'eth_getBlockByHash') result = block;
                else if (parsed.method === 'eth_call') {
                    const tx = (parsed.params?.[0] && typeof parsed.params[0] === 'object') ? parsed.params[0] as { data?: string } : {};
                    result = callResult(String(tx.data ?? '').slice(0, 10).toLowerCase());
                }
                res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result }));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address() as AddressInfo;
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-anvil-id-'));
        dirs.push(cwd);
        const signer = getAddress('0x1111111111111111111111111111111111111111');
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
            '--network', 'anvil', '--dry-run', '--once', '--no-logo', '--disable-paymaster',
            '--signer', signer,
        ], {
            cwd,
            env: { PATH: process.env.PATH ?? '', HOME: cwd, RPC_URL: `http://127.0.0.1:${address.port}` },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
            child.once('close', (status) => { clearTimeout(timer); resolve(status); });
        });
        server.close();
        expect(code, out).toBe(0);
        expect(out).toContain('superPaymaster=0xaC47e91215fb80462139756f43438402998E4A3a');
        expect(out).toContain('signer-identity=ok');
        expect(out).not.toContain('pass --registry');
    });

    it('refuses an unsafe env file or cast bin by the check name', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const run = async (cwd: string, args: string[]) => {
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--probe-env', '--no-logo', ...args], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            const code = await new Promise<number | null>((resolve) => child.once('close', resolve));
            return { code, out };
        };
        const modeDir = mkdtempSync(join(tmpdir(), 'keeper-env-mode-'));
        dirs.push(modeDir);
        const loose = join(modeDir, 'loose.env');
        writeFileSync(loose, 'RPC_URL=http://127.0.0.1:9\n');
        chmodSync(loose, 0o644);
        const mode = await run(modeDir, ['--env-file', loose]);
        expect(mode.code, mode.out).toBe(1);
        expect(mode.out).toContain('keeper: env file refused: mode');
        expect(mode.out).not.toContain('127.0.0.1');

        const parentDir = mkdtempSync(join(tmpdir(), 'keeper-env-parent-'));
        dirs.push(parentDir);
        const tight = join(parentDir, 'tight.env');
        writeFileSync(tight, 'RPC_URL=http://127.0.0.1:9\n');
        chmodSync(tight, 0o600);
        chmodSync(parentDir, 0o777);
        const parent = await run(parentDir, ['--env-file', tight]);
        chmodSync(parentDir, 0o700);
        expect(parent.code, parent.out).toBe(1);
        expect(parent.out).toContain('keeper: env file refused: parent writable');

        const linkDir = mkdtempSync(join(tmpdir(), 'keeper-env-link-'));
        dirs.push(linkDir);
        const real = join(linkDir, 'real.env');
        writeFileSync(real, 'RPC_URL=http://127.0.0.1:9\n');
        chmodSync(real, 0o600);
        const link = join(linkDir, 'link.env');
        symlinkSync(real, link);
        const linked = await run(linkDir, ['--env-file', link]);
        expect(linked.code, linked.out).toBe(1);
        expect(linked.out).toContain('keeper: env file refused: not a regular file');

        const castDir = mkdtempSync(join(tmpdir(), 'keeper-cast-refused-'));
        dirs.push(castDir);
        const relative = await run(castDir, ['--cast-bin', 'cast']);
        expect(relative.code, relative.out).toBe(1);
        expect(relative.out).toContain('keeper: cast bin refused: not absolute');
        const looseBin = join(castDir, 'cast-loose');
        writeFileSync(looseBin, '#!/bin/sh\nexit 0\n');
        chmodSync(looseBin, 0o777);
        const writable = await run(castDir, ['--cast-bin', looseBin]);
        expect(writable.code, writable.out).toBe(1);
        expect(writable.out).toContain('keeper: cast bin refused: writable');
        const target = join(castDir, 'cast-target');
        writeFileSync(target, '#!/bin/sh\nexit 0\n');
        chmodSync(target, 0o777);
        const viaLink = join(castDir, 'cast-link');
        symlinkSync(target, viaLink);
        const followed = await run(castDir, ['--cast-bin', viaLink]);
        expect(followed.code, followed.out).toBe(1);
        expect(followed.out).toContain('keeper: cast bin refused: writable');
        expect(followed.out).not.toContain(viaLink);
    });

    it('a non-numeric option or env value is refused without echoing it', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const sentinel = 'password-sentinel';
        const run = (args: string[], env: NodeJS.ProcessEnv = {}) => {
            const cwd = mkdtempSync(join(tmpdir(), 'keeper-num-'));
            dirs.push(cwd);
            const child = spawn(process.execPath, ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--no-logo', ...args], {
                cwd,
                env: { PATH: process.env.PATH ?? '', HOME: cwd, ...env },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            return new Promise<{ code: number | null; out: string }>((resolve) => {
                child.once('close', (code) => resolve({ code, out }));
            });
        };
        const flag = await run(['--health-interval', sentinel]);
        expect(flag.code, flag.out).toBe(1);
        expect(flag.out).toContain('keeper: --health-interval invalid');
        expect(flag.out).not.toContain(sentinel);
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-num-env-'));
        dirs.push(cwd);
        const file = join(cwd, 'keeper.env');
        writeFileSync(file, `RPC_URL=http://127.0.0.1:9\nKEEPER_HEALTH_INTERVAL_SEC=${sentinel}\n`);
        chmodSync(file, 0o600);
        const fromEnv = await run(['--probe-env', '--env-file', file]);
        expect(fromEnv.code, fromEnv.out).toBe(1);
        expect(fromEnv.out).toContain('keeper: KEEPER_HEALTH_INTERVAL_SEC invalid');
        expect(fromEnv.out).not.toContain(sentinel);
    });

    it('a never-ending external price body does not block the tick', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const roundAbi = [{ type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
            { name: '', type: 'uint80' }, { name: '', type: 'int256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint80' },
        ] }] as const;
        const word = encodeFunctionResult({
            abi: roundAbi,
            functionName: 'latestRoundData',
            result: [1n, 3000n * 10n ** 8n, 1n, 1_700_000_000n, 1n],
        });
        const block = {
            number: '0x1', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32),
            timestamp: '0x1', baseFeePerGas: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0',
            transactions: [] as string[], uncles: [] as string[], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20),
            difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32),
            sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32),
            transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0',
        };
        const drip = createServer((_req, res) => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.write('{"price":"');
        });
        const rpc = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const parsed = JSON.parse(body) as { id: unknown; method: string };
                let result: unknown = '0x0';
                if (parsed.method === 'eth_chainId') result = '0x7a69';
                else if (parsed.method === 'eth_blockNumber') result = '0x1';
                else if (parsed.method === 'eth_getBlockByNumber' || parsed.method === 'eth_getBlockByHash') result = block;
                else if (parsed.method === 'eth_call') result = word;
                res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result }));
            });
        });
        await new Promise<void>((resolve) => drip.listen(0, '127.0.0.1', () => resolve()));
        await new Promise<void>((resolve) => rpc.listen(0, '127.0.0.1', () => resolve()));
        const priceUrl = `http://127.0.0.1:${(drip.address() as AddressInfo).port}/price`;
        const rpcUrl = `http://127.0.0.1:${(rpc.address() as AddressInfo).port}`;
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-drip-'));
        dirs.push(cwd);
        const started = Date.now();
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
            '--network', 'anvil', '--dry-run', '--once', '--no-logo', '--disable-paymaster', '--no-superpaymaster',
            '--volatility-threshold-bps', '150', '--external-ethusd-url', priceUrl,
        ], { cwd, env: { PATH: process.env.PATH ?? '', HOME: cwd, RPC_URL: rpcUrl } });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 12_000);
            child.once('close', (status) => { clearTimeout(timer); resolve(status); });
        });
        drip.close();
        rpc.close();
        expect(Date.now() - started, out).toBeLessThan(10_000);
        expect(code, out).toBe(0);
        expect(out).toContain('keeper: external price skipped');
    });
});
