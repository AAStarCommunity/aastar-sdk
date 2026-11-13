/**
 * Pure decisions for identity scheduling, price confirmation, and env scrub.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { encodeFunctionResult, getAddress } from 'viem';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
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
        const noRegistry = await run([
            '--keystore', join(cwd, 'ks'),
            '--password-file', join(cwd, 'pw'),
            '--signer', '0x6666666666666666666666666666666666666666',
            '--max-fee-gwei', '1',
            '--once',
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
            expect(out).toContain(`keeper: unrecognized option ${token}`);
        }
    });

    it('takes KEEPER_CAST_BIN from the env file, and a CLI flag wins', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const cwd = mkdtempSync(join(tmpdir(), 'keeper-castbin-'));
        dirs.push(cwd);
        const file = join(cwd, 'keeper.env');
        writeFileSync(file, 'KEEPER_CAST_BIN=cast-bin-env-sentinel\nRPC_URL=http://127.0.0.1:9\n');
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
        expect(fromEnv.out).not.toContain('cast-bin-env-sentinel');
        const fromCli = await run(['--cast-bin', 'cast-bin-cli-sentinel']);
        expect(fromCli.code, fromCli.out).toBe(0);
        expect(fromCli.out).toContain('probe cast-source=cli');
        expect(fromCli.out).not.toContain('cast-bin-env-sentinel');
    });

    it('uses the anvil deployment registry for signer identity without address flags', async () => {
        if (!existsSync(TSX_LOADER)) throw new Error('tsx loader missing');
        const ownerAbi = [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }] as const;
        const other = getAddress('0x9999999999999999999999999999999999999999');
        const word = encodeFunctionResult({ abi: ownerAbi, functionName: 'owner', result: other });
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
                else if (parsed.method === 'eth_call') result = word;
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
});
