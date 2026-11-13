/**
 * Live keeper loop against a fake chain and a fake cast.
 * Dry-run is not used: Sender is constructed and signs.
 */
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeFunctionResult, getAddress, keccak256, parseAbi, toFunctionSelector, type Address, type Hex } from 'viem';
import { signTransaction } from 'viem/accounts';
import { UPDATE_PRICE_DATA } from './sender.js';
import { CANONICAL_ADDRESSES } from '../../packages/core/src/addresses.js';
import { acquireKeeperLock, Journal } from './journal.js';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
const VIEM_ACCOUNTS = join(process.cwd(), 'node_modules', 'viem', '_esm', 'accounts', 'index.js');
const BOOK = CANONICAL_ADDRESSES[11155111];
if (!BOOK) throw new Error('sepolia canonical addresses missing');
const SP = getAddress(BOOK.superPaymaster);
const REG = getAddress(BOOK.registry);
const FEED = getAddress(BOOK.priceFeed);
const SIGNER = getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
const OWNER = getAddress('0x9999999999999999999999999999999999999999');
const T0 = 1_700_000_000_000;
const SIX_H = 6 * 60 * 60 * 1000;
const HOUR = 3_600_000;

const dirs: string[] = [];
const servers: Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, 30_000);

function block(number = '0x10'): Record<string, string | string[]> {
    return {
        number, hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32),
        timestamp: '0x1', baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0',
        transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20),
        difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32),
        sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32),
        transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0',
    };
}

function listen(opts: {
    phaseFile: string;
    clockFile: string;
    onSend: () => void;
    hangCount?: boolean;
    onCount?: () => void;
    /** Leave both nonce tags unchanged. A broadcast must not look mined inside the same tick. */
    holdCount?: boolean;
}): Promise<string> {
    const ownerAbi = parseAbi(['function owner() view returns (address)']);
    const roundAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']);
    const decAbi = parseAbi(['function decimals() view returns (uint8)']);
    const thresholdAbi = parseAbi(['function priceStalenessThreshold() view returns (uint256)']);
    const cacheAbi = parseAbi(['function cachedPrice() view returns (int256, uint256, uint80, uint8)']);
    const ownerSel = toFunctionSelector('function owner()');
    let nonce = 0;
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const parsed = JSON.parse(body) as { id: unknown; method: string; params?: unknown[] } | { id: unknown; method: string; params?: unknown[] }[];
            const msgs = Array.isArray(parsed) ? parsed : [parsed];
            let hang = false;
            const replies = msgs.map((msg) => {
                const phase = JSON.parse(readFileSync(opts.phaseFile, 'utf8')) as { phase: string; jumpTo?: number };
                const method = msg.method;
                let result: unknown = '0x0';
                let error: { code: number; message: string } | null = null;
                if (method === 'eth_chainId') result = '0xaa36a7';
                else if (method === 'eth_blockNumber') result = '0x10';
                else if (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') result = block();
                else if (method === 'eth_getBalance') result = '0x' + (10n ** 18n).toString(16);
                else if (method === 'eth_getCode') result = '0x6080';
                else if (method === 'eth_getTransactionCount') {
                    opts.onCount?.();
                    if (opts.hangCount) hang = true;
                    else result = '0x' + nonce.toString(16);
                }
                else if (method === 'eth_estimateGas') result = '0x186a0';
                else if (method === 'eth_maxPriorityFeePerGas' || method === 'eth_gasPrice') result = '0x3b9aca00';
                else if (method === 'eth_sendRawTransaction') {
                    if (!opts.holdCount) nonce += 1;
                    opts.onSend();
                    result = '0x' + 'ab'.repeat(32);
                } else if (method === 'eth_getTransactionReceipt') {
                    result = {
                        transactionHash: (msg.params?.[0] as string) ?? ('0x' + 'ab'.repeat(32)),
                        status: '0x1', gasUsed: '0x5208', blockHash: '0x' + '11'.repeat(32), blockNumber: '0x10',
                        cumulativeGasUsed: '0x5208', logs: [], from: SIGNER, to: SP, contractAddress: null, type: '0x2',
                    };
                } else if (method === 'eth_call') {
                    const tx = (msg.params?.[0] && typeof msg.params[0] === 'object') ? msg.params[0] as { to?: string; data?: string } : {};
                    const data = String(tx.data ?? '').slice(0, 10).toLowerCase();
                    const to = String(tx.to ?? '').toLowerCase();
                    if (data === ownerSel && phase.phase === 'read-fail') error = { code: -32000, message: 'fake: owner unavailable' };
                    else if (data === ownerSel && phase.phase === 'jump') {
                        writeFileSync(opts.clockFile, String(phase.jumpTo ?? (T0 + SIX_H + 1)));
                        error = { code: -32000, message: 'fake: owner unavailable' };
                    } else if (data === ownerSel) {
                        const who: Address = phase.phase === 'privileged' ? SIGNER : OWNER;
                        result = encodeFunctionResult({ abi: ownerAbi, functionName: 'owner', result: who });
                    } else if (data === toFunctionSelector('function latestRoundData()')) {
                        result = encodeFunctionResult({ abi: roundAbi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, 1n, 1n, 1n] });
                    } else if (data === toFunctionSelector('function decimals()')) {
                        result = encodeFunctionResult({ abi: decAbi, functionName: 'decimals', result: 8 });
                    } else if (data === toFunctionSelector('function priceStalenessThreshold()')) {
                        result = encodeFunctionResult({ abi: thresholdAbi, functionName: 'priceStalenessThreshold', result: 3600n });
                    } else if (data === toFunctionSelector('function cachedPrice()')) {
                        result = encodeFunctionResult({ abi: cacheAbi, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, 0n, 1n, 8] });
                    } else if (to === FEED.toLowerCase() || to === SP.toLowerCase() || to === REG.toLowerCase()) {
                        error = { code: 3, message: 'fake: unexpected call' };
                    }
                } else error = { code: -32601, message: 'fake: unexpected method' };
                return error ? { jsonrpc: '2.0', id: msg.id, error } : { jsonrpc: '2.0', id: msg.id, result };
            });
            if (hang) return;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(Array.isArray(parsed) ? replies : replies[0]));
        });
    });
    servers.push(server);
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
    });
}

function writeCast(path: string, log: string, delayMs: number): void {
    writeFileSync(path, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { signTransaction } from ${JSON.stringify(VIEM_ACCOUNTS)};
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(log)}, argv.join('\\n') + '\\nSIGN\\n');
const flag = (name) => argv[argv.indexOf(name) + 1];
await new Promise((resolve) => setTimeout(resolve, ${delayMs}));
const raw = await signTransaction({
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  transaction: {
    type: 'eip1559',
    chainId: Number(flag('--chain')),
    nonce: Number(flag('--nonce')),
    gas: BigInt(flag('--gas-limit')),
    maxFeePerGas: BigInt(flag('--gas-price')),
    maxPriorityFeePerGas: BigInt(flag('--priority-gas-price')),
    to: argv[argv.length - 2],
    data: argv[argv.length - 1],
    value: 0n,
  },
});
process.stdout.write(raw + '\\n');
`);
    chmodSync(path, 0o755);
}

function preload(path: string): void {
    writeFileSync(path, `'use strict';
const fs = require('fs');
const file = process.env.KEEPER_CLOCK_FILE;
if (file) {
  const orig = Date.now;
  Date.now = () => {
    try {
      const n = Number(fs.readFileSync(file, 'utf8'));
      if (Number.isSafeInteger(n) && n >= 0) return n;
    } catch { /* keep the real clock */ }
    return orig.call(Date);
  };
}
`);
}

function keystore(dir: string): { keystore: string; password: string } {
    const keys = join(dir, 'keys');
    mkdirSync(keys, { mode: 0o700 });
    chmodSync(keys, 0o700);
    const password = join(keys, 'password');
    const ks = join(keys, 'keystore');
    writeFileSync(password, 'not-a-real-password\n');
    writeFileSync(ks, '{}\n');
    chmodSync(password, 0o600);
    chmodSync(ks, 0o600);
    return { keystore: ks, password };
}

describe('live keeper loop', { timeout: 70_000 }, () => {
    it('holds the instance lock until a slow sign has finished writing', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const phase = join(root, 'phase.json');
        const clock = join(root, 'clock');
        const castLog = join(root, 'cast.log');
        writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
        writeFileSync(clock, String(T0));
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 2_000);
        const secrets = keystore(root);
        const url = await listen({ phaseFile: phase, clockFile: clock, onSend: () => {} });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once', '--no-paymaster', '--poll-interval', '30',
            '--keystore', 'keys/keystore', '--password-file', secrets.password, '--signer', SIGNER,
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--cast-bin', cast, '--journal', join(root, 'journal.json'),
            '--superpaymaster', SP, '--registry', REG,
        ], {
            cwd: root,
            env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const sawSign = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 20_000);
            const look = () => {
                if (readFileSync(castLog, 'utf8').includes('SIGN')) {
                    clearInterval(poll);
                    clearTimeout(timer);
                    resolve(true);
                }
            };
            const poll = setInterval(look, 50);
            child.once('exit', () => { clearInterval(poll); clearTimeout(timer); resolve(false); });
        });
        expect(sawSign, out).toBe(true);
        expect(readFileSync(castLog, 'utf8')).toContain(secrets.keystore);
        await expect(acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER })).rejects.toThrow('journal: lock held');
        child.kill('SIGTERM');
        const stolen = await new Promise<boolean>((resolve) => {
            const started = Date.now();
            const tick = async () => {
                if (child.exitCode !== null) {
                    resolve(false);
                    return;
                }
                try {
                    const release = await acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER });
                    await release();
                    resolve(true);
                } catch (error) {
                    if (!String(error).includes('journal: lock held')) {
                        resolve(true);
                        return;
                    }
                    if (Date.now() - started >= 1_500) {
                        resolve(false);
                        return;
                    }
                    setTimeout(tick, 40);
                }
            };
            setTimeout(tick, 40);
        });
        expect(stolen, out).toBe(false);
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        expect(code, out).toBe(0);
        const release = await acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER });
        await release();
    }, 40_000);

    it('stops signing on privilege, keeps price through a read failure until the post-RPC deadline, then resumes', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const phase = join(root, 'phase.json');
        const clock = join(root, 'clock');
        const castLog = join(root, 'cast.log');
        writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
        writeFileSync(clock, String(T0));
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 0);
        const secrets = keystore(root);
        let sends = 0;
        const url = await listen({ phaseFile: phase, clockFile: clock, onSend: () => { sends += 1; } });
        const hook = join(root, 'clock.cjs');
        preload(hook);
        const child = spawn(process.execPath, [
            '--require', hook, '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--no-paymaster', '--poll-interval', '1',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--cast-bin', cast, '--journal', join(root, 'journal.json'),
            '--superpaymaster', SP, '--registry', REG,
        ], {
            cwd: root,
            env: {
                PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url, KEEPER_CLOCK_FILE: clock,
            },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const signs = () => readFileSync(castLog, 'utf8').split('SIGN\n').length - 1;
        const waitSends = async (atLeast: number, ms: number) => {
            const start = Date.now();
            while (sends < atLeast && Date.now() - start < ms) await new Promise((resolve) => setTimeout(resolve, 100));
        };
        const stable = async (ms: number) => {
            const before = sends;
            const beforeSigns = signs();
            await new Promise((resolve) => setTimeout(resolve, ms));
            return sends === before && signs() === beforeSigns;
        };
        try {
            await waitSends(1, 15_000);
            expect(sends, out).toBeGreaterThanOrEqual(1);
            const signedOnce = sends;
            const signsOnce = signs();
            writeFileSync(clock, String(T0 + HOUR + 1));
            writeFileSync(phase, JSON.stringify({ phase: 'privileged' }));
            expect(await stable(2_500), out + `\nsends=${sends} signs=${signs()}`).toBe(true);
            expect(sends).toBe(signedOnce);
            expect(signs()).toBe(signsOnce);
            writeFileSync(clock, String(T0 + HOUR + 2_000));
            writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
            await waitSends(signedOnce + 1, 8_000);
            expect(sends, out).toBeGreaterThan(signedOnce);
            const recovered = sends;
            // One hour later the identity check is due and the six-hour grace is still open.
            writeFileSync(clock, String(T0 + HOUR + 2_000 + HOUR));
            writeFileSync(phase, JSON.stringify({ phase: 'read-fail' }));
            const graceStart = Date.now();
            while ((sends <= recovered || !out.includes('pause-only:read')) && Date.now() - graceStart < 8_000) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            expect(sends, out).toBeGreaterThan(recovered);
            expect(out, out).toContain('pause-only:read');
            writeFileSync(phase, JSON.stringify({ phase: 'jump', jumpTo: T0 + HOUR + 2_000 + SIX_H + 1 }));
            const closedStart = Date.now();
            while (!out.includes('all-closed:read-expired') && Date.now() - closedStart < 8_000) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            expect(out, out).toContain('all-closed:read-expired');
            const closed = sends;
            const signsClosed = signs();
            expect(await stable(2_500), out + `\nsends=${sends} signs=${signs()}`).toBe(true);
            expect(sends).toBe(closed);
            expect(signs()).toBe(signsClosed);
            writeFileSync(clock, String(T0 + HOUR + 2_000 + SIX_H + 2_000));
            writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
            await waitSends(closed + 1, 8_000);
            expect(sends, out).toBeGreaterThan(closed);
        } finally {
            child.kill('SIGKILL');
            await new Promise<void>((resolve) => child.once('exit', () => resolve()));
        }
    }, 60_000);

    it('maintenance runs every tick without a new eligible update', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const phase = join(root, 'phase.json');
        const clock = join(root, 'clock');
        const castLog = join(root, 'cast.log');
        writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
        writeFileSync(clock, String(T0));
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 0);
        const secrets = keystore(root);
        const journalPath = join(root, 'journal.json');
        const journal = new Journal(journalPath, { chainId: 11155111, signer: SIGNER });
        await journal.init();
        const planted = await signTransaction({
            privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            transaction: {
                type: 'eip1559',
                chainId: 11155111,
                nonce: 0,
                gas: 120_000n,
                maxFeePerGas: 2_000_000_000n,
                maxPriorityFeePerGas: 1_000_000_000n,
                to: SP,
                data: UPDATE_PRICE_DATA,
                value: 0n,
            },
        });
        await journal.writeInFlight({
            kind: 'price-super',
            nonce: 0,
            raws: [planted],
            hashes: [keccak256(planted)],
            gasLimit: 120_000n,
            maxFeePerGas: 2_000_000_000n,
            maxPriorityFeePerGas: 1_000_000_000n,
            attempts: 0,
            firstSentAt: Date.now(),
        });
        let sends = 0;
        const url = await listen({ phaseFile: phase, clockFile: clock, onSend: () => { sends += 1; } });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once', '--no-paymaster', '--no-superpaymaster', '--poll-interval', '30',
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--cast-bin', cast, '--journal', journalPath,
            '--superpaymaster', SP, '--registry', REG,
        ], { cwd: root, env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url } });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 25_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        const log = readFileSync(castLog, 'utf8');
        expect(code, out + log).toBe(0);
        expect(log, out).not.toContain('SIGN');
        expect(sends, out).toBe(1);
        const aged = JSON.parse(readFileSync(journalPath, 'utf8')) as { inFlight: { attempts: number; kind: string } | null };
        expect(aged.inFlight?.kind).toBe('price-super');
        expect(aged.inFlight?.attempts).toBe(0);
    });

    it('ages the in-flight raw once on a keeper tick', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const phase = join(root, 'phase.json');
        const clock = join(root, 'clock');
        const castLog = join(root, 'cast.log');
        writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
        writeFileSync(clock, String(T0));
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 0);
        const secrets = keystore(root);
        const journalPath = join(root, 'journal.json');
        const journal = new Journal(journalPath, { chainId: 11155111, signer: SIGNER });
        await journal.init();
        const planted = await signTransaction({
            privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            transaction: {
                type: 'eip1559', chainId: 11155111, nonce: 0, gas: 120_000n,
                maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n,
                to: SP, data: UPDATE_PRICE_DATA, value: 0n,
            },
        });
        await journal.writeInFlight({
            kind: 'price-super', nonce: 0, raws: [planted], hashes: [keccak256(planted)],
            gasLimit: 120_000n, maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n,
            attempts: 0, firstSentAt: Date.now(),
        });
        let sends = 0;
        const url = await listen({ phaseFile: phase, clockFile: clock, onSend: () => { sends += 1; }, holdCount: true });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once', '--no-paymaster', '--no-superpaymaster', '--poll-interval', '30',
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--cast-bin', cast, '--journal', journalPath,
            '--superpaymaster', SP, '--registry', REG,
        ], { cwd: root, env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url } });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 25_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        const body = JSON.parse(readFileSync(journalPath, 'utf8')) as { inFlight: { attempts: number; kind: string } | null };
        expect(code, out).toBe(0);
        expect(sends, out).toBe(1);
        expect(body.inFlight?.attempts).toBe(0);
        expect(body.inFlight?.kind).toBe('price-super');
        expect(readFileSync(castLog, 'utf8')).not.toContain('SIGN');
    });

    it('the lock is not released before process exit', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const phase = join(root, 'phase.json');
        const clock = join(root, 'clock');
        writeFileSync(phase, JSON.stringify({ phase: 'ok' }));
        writeFileSync(clock, String(T0));
        const cast = join(root, 'cast.mjs');
        writeCast(cast, join(root, 'cast.log'), 0);
        const secrets = keystore(root);
        let counts = 0;
        const url = await listen({
            phaseFile: phase, clockFile: clock, onSend: () => {}, hangCount: true, onCount: () => { counts += 1; },
        });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--no-paymaster', '--poll-interval', '30',
            '--max-fee-gwei', '100',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--cast-bin', cast, '--journal', join(root, 'journal.json'),
            '--superpaymaster', SP, '--registry', REG,
        ], {
            cwd: root,
            env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url, KEEPER_DRAIN_MS: '3000' },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const hung = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 20_000);
            const poll = setInterval(() => {
                if (counts > 0) {
                    clearInterval(poll);
                    clearTimeout(timer);
                    resolve(true);
                }
            }, 30);
            child.once('exit', () => { clearInterval(poll); clearTimeout(timer); resolve(false); });
        });
        expect(hung, out).toBe(true);
        const exited = new Promise<number | null>((resolve) => child.once('exit', (status) => resolve(status)));
        child.kill('SIGTERM');
        let stolen = false;
        const started = Date.now();
        while (Date.now() - started < 2_000) {
            let alive = true;
            try { process.kill(child.pid ?? 0, 0); } catch { alive = false; }
            if (!alive) break;
            try {
                const release = await acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER });
                await new Promise((resolve) => setTimeout(resolve, 500));
                try { process.kill(child.pid ?? 0, 0); } catch { alive = false; }
                await release();
                if (alive) stolen = true;
                break;
            } catch (error) {
                if (!String(error).includes('journal: lock held')) {
                    stolen = true;
                    break;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(stolen, out).toBe(false);
        const code = child.exitCode !== null
            ? child.exitCode
            : await Promise.race([
                exited,
                new Promise<null>((resolve) => setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 10_000)),
            ]);
        expect(code, out).toBe(0);
        const release = await acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER });
        await release();
    }, 40_000);

    it('a PaymasterV4 owner discovered after startup does not sign price-paymaster', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const castLog = join(root, 'cast.log');
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 0);
        const secrets = keystore(root);
        const factory = getAddress('0xaC9fCBA56E42d5960f813B9D0387F3D3bC003338');
        const sp = getAddress('0xaC47e91215fb80462139756f43438402998E4A3a');
        const registry = getAddress('0xAD523115cd35a8d4E60B3C0953E0E0ac10418309');
        const feed = getAddress('0x5D42EBdBBa61412295D7b0302d6F50aC449Ddb4F');
        const operator = getAddress('0xb5600060e6de5E11D3636731964218E53caadf0E');
        const v4 = getAddress('0x2222222222222222222222222222222222222222');
        const ownerAbi = parseAbi(['function owner() view returns (address)']);
        const byOpAbi = parseAbi(['function paymasterByOperator(address) view returns (address)']);
        const opByAbi = parseAbi(['function getOperatorByPaymaster(address) view returns (address)']);
        const v4CacheAbi = parseAbi(['function cachedPrice() view returns (uint208, uint48)']);
        const thresholdAbi = parseAbi(['function priceStalenessThreshold() view returns (uint256)']);
        const feedAbi = parseAbi(['function ethUsdPriceFeed() view returns (address)']);
        const roundAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']);
        const decAbi = parseAbi(['function decimals() view returns (uint8)']);
        const ownerSel = toFunctionSelector('function owner()');
        const byOpSel = toFunctionSelector('function paymasterByOperator(address)');
        const opBySel = toFunctionSelector('function getOperatorByPaymaster(address)');
        const cacheSel = toFunctionSelector('function cachedPrice()');
        const thresholdSel = toFunctionSelector('function priceStalenessThreshold()');
        const feedSel = toFunctionSelector('function ethUsdPriceFeed()');
        const roundSel = toFunctionSelector('function latestRoundData()');
        const decSel = toFunctionSelector('function decimals()');
        let derived = 0;
        let v4OwnerCalls = 0;
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const parsed = JSON.parse(body) as { id: unknown; method: string; params?: unknown[] };
                let result: unknown = '0x0';
                let error: { code: number; message: string } | null = null;
                if (parsed.method === 'eth_chainId') result = '0x7a69';
                else if (parsed.method === 'eth_blockNumber') result = '0x10';
                else if (parsed.method === 'eth_getBlockByNumber' || parsed.method === 'eth_getBlockByHash') result = block();
                else if (parsed.method === 'eth_getBalance') result = '0x' + (10n ** 18n).toString(16);
                else if (parsed.method === 'eth_getCode') result = '0x6080';
                else if (parsed.method === 'eth_getTransactionCount') result = '0x0';
                else if (parsed.method === 'eth_estimateGas') result = '0x186a0';
                else if (parsed.method === 'eth_maxPriorityFeePerGas' || parsed.method === 'eth_gasPrice') result = '0x3b9aca00';
                else if (parsed.method === 'eth_call') {
                    const tx = (parsed.params?.[0] && typeof parsed.params[0] === 'object') ? parsed.params[0] as { to?: string; data?: string } : {};
                    const data = String(tx.data ?? '').slice(0, 10).toLowerCase();
                    const to = String(tx.to ?? '').toLowerCase();
                    if (data === byOpSel) {
                        derived += 1;
                        const found = derived === 1 ? '0x0000000000000000000000000000000000000000' : v4;
                        result = encodeFunctionResult({ abi: byOpAbi, functionName: 'paymasterByOperator', result: getAddress(found) });
                    } else if (data === opBySel) {
                        result = encodeFunctionResult({ abi: opByAbi, functionName: 'getOperatorByPaymaster', result: operator });
                    } else if (data === ownerSel) {
                        const who = to === v4.toLowerCase() ? SIGNER : OWNER;
                        if (to === v4.toLowerCase()) v4OwnerCalls += 1;
                        result = encodeFunctionResult({ abi: ownerAbi, functionName: 'owner', result: who });
                    } else if (data === cacheSel && to === v4.toLowerCase()) {
                        result = encodeFunctionResult({ abi: v4CacheAbi, functionName: 'cachedPrice', result: [1n, 0] });
                    } else if (data === thresholdSel) {
                        result = encodeFunctionResult({ abi: thresholdAbi, functionName: 'priceStalenessThreshold', result: 3600n });
                    } else if (data === feedSel) {
                        result = encodeFunctionResult({ abi: feedAbi, functionName: 'ethUsdPriceFeed', result: feed });
                    } else if (data === roundSel) {
                        result = encodeFunctionResult({ abi: roundAbi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, 1n, 1_700_000_000n, 1n] });
                    } else if (data === decSel) {
                        result = encodeFunctionResult({ abi: decAbi, functionName: 'decimals', result: 8 });
                    } else error = { code: 3, message: 'fake: unexpected call' };
                } else error = { code: -32601, message: 'fake: unexpected method' };
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(error ? { jsonrpc: '2.0', id: parsed.id, error } : { jsonrpc: '2.0', id: parsed.id, result }));
            });
        });
        servers.push(server);
        const url = await new Promise<string>((resolve) => {
            server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
        });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'anvil', '--no-logo', '--once', '--no-superpaymaster', '--poll-interval', '30',
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--cast-bin', cast, '--journal', join(root, 'journal.json'),
        ], { cwd: root, env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url } });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 25_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        const log = readFileSync(castLog, 'utf8');
        expect(out, out).toContain('signer-identity=ok');
        expect(v4OwnerCalls, out).toBeGreaterThan(0);
        expect(out).toContain('signer equals paymaster owner');
        expect(log, out + log).not.toContain('SIGN');
        expect(code, out + log).toBe(2);
        expect(factory.toLowerCase()).not.toBe(sp.toLowerCase());
        expect(registry.toLowerCase()).not.toBe(v4.toLowerCase());
    }, 40_000);

    it('a broken SuperPaymaster read still signs a due PaymasterV4 update', async () => {
        const root = mkdtempSync(join(tmpdir(), 'keeper-live-'));
        dirs.push(root);
        const castLog = join(root, 'cast.log');
        writeFileSync(castLog, '');
        const cast = join(root, 'cast.mjs');
        writeCast(cast, castLog, 0);
        const secrets = keystore(root);
        const v4 = getAddress('0xf3948753ff21D33f6A5f516621FFF245B23efa0e');
        const ownerAbi = parseAbi(['function owner() view returns (address)']);
        const v4CacheAbi = parseAbi(['function cachedPrice() view returns (uint208, uint48)']);
        const spCacheAbi = parseAbi(['function cachedPrice() view returns (int256, uint256, uint80, uint8)']);
        const thresholdAbi = parseAbi(['function priceStalenessThreshold() view returns (uint256)']);
        const feedAbi = parseAbi(['function ethUsdPriceFeed() view returns (address)']);
        const roundAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']);
        const decAbi = parseAbi(['function decimals() view returns (uint8)']);
        const ownerSel = toFunctionSelector('function owner()');
        const cacheSel = toFunctionSelector('function cachedPrice()');
        const thresholdSel = toFunctionSelector('function priceStalenessThreshold()');
        const feedSel = toFunctionSelector('function ethUsdPriceFeed()');
        const roundSel = toFunctionSelector('function latestRoundData()');
        const decSel = toFunctionSelector('function decimals()');
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const parsed = JSON.parse(body) as { id: unknown; method: string; params?: unknown[] };
                let result: unknown = '0x0';
                let error: { code: number; message: string } | null = null;
                if (parsed.method === 'eth_chainId') result = '0xaa36a7';
                else if (parsed.method === 'eth_blockNumber') result = '0x10';
                else if (parsed.method === 'eth_getBlockByNumber' || parsed.method === 'eth_getBlockByHash') result = block();
                else if (parsed.method === 'eth_getBalance') result = '0x' + (10n ** 18n).toString(16);
                else if (parsed.method === 'eth_getCode') result = '0x6080';
                else if (parsed.method === 'eth_getTransactionCount') result = '0x0';
                else if (parsed.method === 'eth_estimateGas') result = '0x186a0';
                else if (parsed.method === 'eth_maxPriorityFeePerGas' || parsed.method === 'eth_gasPrice') result = '0x3b9aca00';
                else if (parsed.method === 'eth_sendRawTransaction') result = '0x' + 'ab'.repeat(32);
                else if (parsed.method === 'eth_call') {
                    const tx = (parsed.params?.[0] && typeof parsed.params[0] === 'object') ? parsed.params[0] as { to?: string; data?: string } : {};
                    const data = String(tx.data ?? '').slice(0, 10).toLowerCase();
                    const to = String(tx.to ?? '').toLowerCase();
                    if (to === SP.toLowerCase() && (data === cacheSel || data === thresholdSel)) {
                        error = { code: -32000, message: 'fake: SuperPaymaster read failing' };
                    } else if (data === ownerSel) {
                        result = encodeFunctionResult({ abi: ownerAbi, functionName: 'owner', result: OWNER });
                    } else if (data === cacheSel && to === v4.toLowerCase()) {
                        result = encodeFunctionResult({ abi: v4CacheAbi, functionName: 'cachedPrice', result: [1n, 0] });
                    } else if (data === cacheSel) {
                        result = encodeFunctionResult({ abi: spCacheAbi, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, 0n, 1n, 8] });
                    } else if (data === thresholdSel) {
                        result = encodeFunctionResult({ abi: thresholdAbi, functionName: 'priceStalenessThreshold', result: 3600n });
                    } else if (data === feedSel) {
                        result = encodeFunctionResult({ abi: feedAbi, functionName: 'ethUsdPriceFeed', result: FEED });
                    } else if (data === roundSel) {
                        result = encodeFunctionResult({ abi: roundAbi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, 1n, BigInt(Math.floor(Date.now() / 1000)), 1n] });
                    } else if (data === decSel) {
                        result = encodeFunctionResult({ abi: decAbi, functionName: 'decimals', result: 8 });
                    } else error = { code: 3, message: 'fake: unexpected call' };
                } else error = { code: -32601, message: 'fake: unexpected method' };
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(error ? { jsonrpc: '2.0', id: parsed.id, error } : { jsonrpc: '2.0', id: parsed.id, result }));
            });
        });
        servers.push(server);
        const url = await new Promise<string>((resolve) => {
            server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
        });
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once', '--poll-interval', '30',
            '--max-fee-gwei', '100', '--max-sends-per-hour', '1000',
            '--keystore', secrets.keystore, '--password-file', secrets.password, '--signer', SIGNER,
            '--cast-bin', cast, '--journal', join(root, 'journal.json'),
            '--superpaymaster', SP, '--paymaster', v4, '--registry', REG,
        ], { cwd: root, env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url } });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 25_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        const log = readFileSync(castLog, 'utf8');
        expect(out).toContain('keeper: superpaymaster read failed');
        expect(out).not.toContain('fake: SuperPaymaster read failing');
        expect(log, out + log).toContain('SIGN');
        expect(log.toLowerCase()).toContain(v4.toLowerCase());
        expect(code, out + log).toBe(2);
    }, 40_000);
});
