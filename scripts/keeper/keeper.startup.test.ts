/**
 * Live startup refuses a signer that is the deployer, SP.owner(), or Registry.owner().
 * Dry-run is not used: the identity check has to refuse the process.
 * The RPC answers owner() the way SuperPaymaster 5.4.2 and Registry do. cast is a fake that must not be reached.
 */
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeFunctionResult, getAddress, type Address, type Hex } from 'viem';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DEPLOYER_ADDRESS } from './signerGuard';
import { acquireKeeperLock } from './journal';
import { trustedScratch } from './trustScratch.js';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
if (!existsSync(TSX_LOADER)) throw new Error(`keeper startup: pinned tsx loader missing at ${TSX_LOADER}`);

const SIGNER = getAddress('0x1111111111111111111111111111111111111111');
const SP = getAddress('0x2222222222222222222222222222222222222222');
const REG = getAddress('0x3333333333333333333333333333333333333333');
const V4 = getAddress('0x4444444444444444444444444444444444444444');
const OTHER = getAddress('0x9999999999999999999999999999999999999999');
const OWNER_SEL = '0x8da5cb5b';

const OWNER_ABI = [{
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
}] as const;

function word(who: Address): Hex {
    return encodeFunctionResult({ abi: OWNER_ABI, functionName: 'owner', result: who });
}

function listen(owners: { sp: Address; registry: Address; paymaster?: Address; paymasterOwner?: Address }): Promise<{ server: Server; url: string }> {
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            const msg = JSON.parse(body);
            const one = (m: { id: unknown; method: string; params?: unknown[] }) => {
                const method = m.method;
                const tx = (m.params?.[0] && typeof m.params[0] === 'object') ? m.params[0] as { to?: string; data?: string } : {};
                const data = String(tx.data ?? '');
                const to = String(tx.to ?? '').toLowerCase();
                let result = '0x' + '0'.repeat(64);
                if (method === 'eth_chainId') result = '0xaa36a7';
                else if (method === 'eth_blockNumber') result = '0x100';
                else if (method === 'eth_getBlockByNumber') {
                    return {
                        jsonrpc: '2.0',
                        id: m.id,
                        result: {
                            number: '0x100',
                            hash: '0x' + '11'.repeat(32),
                            parentHash: '0x' + '22'.repeat(32),
                            timestamp: '0x1',
                            baseFeePerGas: '0x1',
                            gasLimit: '0x1c9c380',
                            gasUsed: '0x0',
                            transactions: [],
                            uncles: [],
                            logsBloom: '0x' + '00'.repeat(256),
                            miner: '0x' + '00'.repeat(20),
                            difficulty: '0x0',
                            extraData: '0x',
                            nonce: '0x0000000000000000',
                            mixHash: '0x' + '00'.repeat(32),
                            sha3Uncles: '0x' + '00'.repeat(32),
                            stateRoot: '0x' + '00'.repeat(32),
                            receiptsRoot: '0x' + '00'.repeat(32),
                            transactionsRoot: '0x' + '00'.repeat(32),
                            size: '0x0',
                            totalDifficulty: '0x0',
                        },
                    };
                } else if (method === 'eth_getCode') result = '0x6080';
                else if (method === 'eth_call' && data.slice(0, 10).toLowerCase() === OWNER_SEL) {
                    if (owners.paymaster && owners.paymasterOwner && to === owners.paymaster.toLowerCase()) result = word(owners.paymasterOwner);
                    else if (to === SP.toLowerCase()) result = word(owners.sp);
                    else if (to === REG.toLowerCase()) result = word(owners.registry);
                }
                return { jsonrpc: '2.0', id: m.id, result };
            };
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
        });
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
        });
    });
}

const SPAWN_VERDICT_TIMEOUT_MS = 60_000;

function dummyCast(): { dir: string; cast: string } {
    const dir = trustedScratch('start-cast');
    const cast = join(dir, 'cast');
    writeFileSync(cast, '#!/bin/sh\nexit 1\n');
    chmodSync(cast, 0o755);
    return { dir, cast };
}

async function expectRefuse(signer: Address, owners: { sp: Address; registry: Address }, text: string): Promise<void> {
    const { server, url } = await listen(owners);
    const dir = trustedScratch('k-start');
    chmodSync(dir, 0o700);
    const pw = join(dir, 'password');
    const ks = join(dir, 'keystore');
    writeFileSync(pw, 'not-a-real-password\n');
    writeFileSync(ks, '{}\n');
    chmodSync(pw, 0o600);
    chmodSync(ks, 0o600);
    const castLay = dummyCast();
    try {
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once',
            '--no-superpaymaster', '--disable-paymaster',
            '--keystore', ks, '--password-file', pw, '--signer', signer, '--max-fee-gwei', '1',
            '--cast-bin', castLay.cast, '--journal', join(dir, 'journal.json'),
            '--superpaymaster', SP, '--registry', REG,
        ], {
            cwd: dir,
            env: {
                PATH: process.env.PATH ?? '',
                HOME: dir,
                RPC_URL: url,
                TELEGRAM_BOT_TOKEN: '',
                TELEGRAM_CHAT_ID: '',
            },
        });
        let out = '';
        child.stdout.on('data', (d) => { out += d.toString(); });
        child.stderr.on('data', (d) => { out += d.toString(); });
        const status = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); }, 40_000);
            child.once('close', (code) => { clearTimeout(timer); resolve(code); });
        });
        expect(status, out).toBe(1);
        expect(out).toContain(text);
        expect(out).not.toContain('signer-identity=ok');
    } finally {
        await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
        rmSync(castLay.dir, { recursive: true, force: true });
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('keeper startup identity', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('refuses to start when --signer is the deployer', async () => {
        await expectRefuse(DEPLOYER_ADDRESS, { sp: OTHER, registry: OTHER }, 'signer equals deployer');
    }, 60_000);

    it('refuses to start when --signer is SP.owner()', async () => {
        await expectRefuse(SIGNER, { sp: SIGNER, registry: OTHER }, 'signer equals superpaymaster owner');
    }, 60_000);

    it('refuses to start when --signer is Registry.owner()', async () => {
        await expectRefuse(SIGNER, { sp: OTHER, registry: SIGNER }, 'signer equals registry owner');
    }, 60_000);

    it('refuses to start when --signer is the PaymasterV4 owner', async () => {
        const { server, url } = await listen({ sp: OTHER, registry: OTHER, paymaster: V4, paymasterOwner: SIGNER });
        const dir = trustedScratch('k-start');
        chmodSync(dir, 0o700);
        const pw = join(dir, 'password');
        const ks = join(dir, 'keystore');
        writeFileSync(pw, 'not-a-real-password\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o600);
        chmodSync(ks, 0o600);
        const castLay = dummyCast();
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'sepolia', '--no-logo', '--once', '--disable-paymaster',
                '--keystore', ks, '--password-file', pw, '--signer', SIGNER, '--max-fee-gwei', '1',
                '--cast-bin', castLay.cast, '--journal', join(dir, 'journal.json'),
                '--superpaymaster', SP, '--paymaster', V4, '--registry', REG,
            ], {
                cwd: dir,
                env: {
                    PATH: process.env.PATH ?? '',
                    HOME: dir,
                    RPC_URL: url,
                    TELEGRAM_BOT_TOKEN: '',
                    TELEGRAM_CHAT_ID: '',
                },
            });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); }, 40_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(1);
            expect(out).toContain('signer equals paymaster owner');
            expect(out).not.toContain('signer-identity=ok');
            expect(out).not.toContain('TICK');
            expect(out).not.toContain('SIGN');
        } finally {
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(castLay.dir, { recursive: true, force: true });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);

    it('exits 1 when the password file is not mode 0600', async () => {
        const { server, url } = await listen({ sp: OTHER, registry: OTHER });
        const dir = trustedScratch('k-pw');
        chmodSync(dir, 0o700);
        const pw = join(dir, 'password');
        const ks = join(dir, 'keystore');
        writeFileSync(pw, 'not-a-real-password\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o644);
        chmodSync(ks, 0o600);
        const castLay = dummyCast();
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'sepolia', '--no-logo', '--once',
                '--no-superpaymaster', '--disable-paymaster',
                '--keystore', ks, '--password-file', pw, '--signer', SIGNER, '--max-fee-gwei', '1',
                '--cast-bin', castLay.cast, '--journal', join(dir, 'journal.json'),
                '--superpaymaster', SP, '--registry', REG,
            ], { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir, RPC_URL: url } });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(1);
            expect(out).toContain('secret file: password file mode is not 0600');
            expect(out).not.toContain('not-a-real-password');
        } finally {
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(castLay.dir, { recursive: true, force: true });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);

    it('exits 1 when the keeper lock is already held', async () => {
        const { server, url } = await listen({ sp: OTHER, registry: OTHER });
        const dir = trustedScratch('k-lock');
        chmodSync(dir, 0o700);
        const pw = join(dir, 'password');
        const ks = join(dir, 'keystore');
        writeFileSync(pw, 'not-a-real-password\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o600);
        chmodSync(ks, 0o600);
        const journal = join(dir, 'journal.json');
        const castLay = dummyCast();
        const release = await acquireKeeperLock({ journalPath: journal, chainId: 11155111, signer: SIGNER });
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'sepolia', '--no-logo', '--once',
                '--no-superpaymaster', '--disable-paymaster',
                '--keystore', ks, '--password-file', pw, '--signer', SIGNER, '--max-fee-gwei', '1',
                '--cast-bin', castLay.cast,
                '--journal', journal, '--superpaymaster', SP, '--registry', REG,
            ], { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir, RPC_URL: url } });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(1);
            expect(out).toContain('journal: lock held');
        } finally {
            await release();
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(castLay.dir, { recursive: true, force: true });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);

    it('exits 1 when the journal directory barrier cannot be completed', async () => {
        const { server, url } = await listen({ sp: OTHER, registry: OTHER });
        const dir = trustedScratch('k-barrier');
        chmodSync(dir, 0o700);
        const pw = join(dir, 'password');
        const ks = join(dir, 'keystore');
        writeFileSync(pw, 'not-a-real-password\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o600);
        chmodSync(ks, 0o600);
        const journalDir = join(dir, 'closed');
        mkdirSync(journalDir, { mode: 0o700 });
        // Execute-only: realpath still resolves, and opening the directory for the barrier fsync fails.
        chmodSync(journalDir, 0o100);
        const castLay = dummyCast();
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'sepolia', '--no-logo', '--once',
                '--no-superpaymaster', '--disable-paymaster',
                '--keystore', ks, '--password-file', pw, '--signer', SIGNER, '--max-fee-gwei', '1',
                '--cast-bin', castLay.cast,
                '--journal', join(journalDir, 'journal.json'),
                '--superpaymaster', SP, '--registry', REG,
            ], { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir, RPC_URL: url } });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(1);
            expect(out).toContain('sender: journal barrier incomplete');
        } finally {
            chmodSync(journalDir, 0o700);
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(castLay.dir, { recursive: true, force: true });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);

    it('alerts an overdue flight at startup when load returns barrier', async () => {
        const { server, url } = await listen({ sp: OTHER, registry: OTHER });
        const dir = trustedScratch('k-barrier-alarm');
        chmodSync(dir, 0o700);
        const pw = join(dir, 'password');
        const ks = join(dir, 'keystore');
        writeFileSync(pw, 'not-a-real-password\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o600);
        chmodSync(ks, 0o600);
        const journalDir = join(dir, 'closed');
        mkdirSync(journalDir, { mode: 0o700 });
        const hash = `0x${'ab'.repeat(32)}`;
        const journal = {
            version: 4,
            chainId: 11155111,
            signer: SIGNER,
            inFlight: {
                kind: 'price-super',
                nonce: 7,
                raws: ['0x02'],
                hashes: [hash],
                gasLimit: '21000',
                maxFeePerGas: '1',
                maxPriorityFeePerGas: '1',
                attempts: 1,
                firstSentAt: 0,
                broadcastOnce: [],
            },
            sentAt: [],
            ceilingClosed: false,
            lastLatest: null,
            stalled: false,
            stalledNonce: null,
        };
        const journalPath = join(journalDir, 'journal.json');
        writeFileSync(journalPath, `${JSON.stringify(journal)}\n`);
        chmodSync(journalPath, 0o600);
        // Execute-only: the file stays readable by name, and the directory barrier fsync fails.
        chmodSync(journalDir, 0o100);
        const castLay = dummyCast();
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'sepolia', '--no-logo', '--once',
                '--no-superpaymaster', '--disable-paymaster',
                '--keystore', ks, '--password-file', pw, '--signer', SIGNER, '--max-fee-gwei', '1',
                '--cast-bin', castLay.cast,
                '--journal', journalPath,
                '--superpaymaster', SP, '--registry', REG,
            ], { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir, RPC_URL: url } });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(1);
            expect(out).toContain('sender: journal barrier incomplete');
            expect(out).toContain('ALL sends closed');
            expect(out).toContain('price-staleness deadline: check on chain');
        } finally {
            chmodSync(journalDir, 0o700);
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(castLay.dir, { recursive: true, force: true });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);

    it('alerts the first oracle, superpaymaster and paymaster read failure and drops provider text', async () => {
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                const msg = JSON.parse(body);
                const one = (m: { id: unknown; method: string }) => {
                    if (m.method === 'eth_chainId') return { jsonrpc: '2.0', id: m.id, result: '0x7a69' };
                    if (m.method === 'eth_getCode') return { jsonrpc: '2.0', id: m.id, result: '0x60806040' };
                    if (m.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: m.id, result: '0x1' };
                    if (m.method === 'eth_getBlockByNumber') {
                        return {
                            jsonrpc: '2.0',
                            id: m.id,
                            result: {
                                number: '0x1',
                                hash: `0x${'11'.repeat(32)}`,
                                parentHash: `0x${'22'.repeat(32)}`,
                                timestamp: '0x1',
                                baseFeePerGas: '0x1',
                                gasLimit: '0x1c9c380',
                                gasUsed: '0x0',
                                transactions: [],
                                uncles: [],
                                logsBloom: `0x${'00'.repeat(256)}`,
                                miner: `0x${'00'.repeat(20)}`,
                                difficulty: '0x0',
                                extraData: '0x',
                                nonce: '0x0000000000000000',
                                mixHash: `0x${'00'.repeat(32)}`,
                                sha3Uncles: `0x${'00'.repeat(32)}`,
                                stateRoot: `0x${'00'.repeat(32)}`,
                                receiptsRoot: `0x${'00'.repeat(32)}`,
                                transactionsRoot: `0x${'00'.repeat(32)}`,
                                size: '0x0',
                                totalDifficulty: '0x0',
                            },
                        };
                    }
                    return { jsonrpc: '2.0', id: m.id, error: { code: -32000, message: 'provider-sentinel-text' } };
                };
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
            });
        });
        const url = await new Promise<string>((resolve) => {
            server.listen(0, '127.0.0.1', () => {
                resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
            });
        });
        const dir = trustedScratch('k-read-alert');
        chmodSync(dir, 0o700);
        const paymaster = getAddress('0x5555555555555555555555555555555555555555');
        try {
            const child = spawn(process.execPath, [
                '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
                '--network', 'anvil', '--dry-run', '--once', '--no-logo',
                '--paymaster', paymaster,
            ], { cwd: dir, env: { PATH: process.env.PATH ?? '', HOME: dir, RPC_URL: url } });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            const status = await new Promise<number | null>((resolve) => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 20_000);
                child.once('close', (code) => { clearTimeout(timer); resolve(code); });
            });
            expect(status, out).toBe(2);
            expect(out).toContain('keeper: oracle read failed');
            expect(out).toContain('keeper: superpaymaster read failed');
            expect(out).toContain('keeper: paymaster read failed');
            expect(out).not.toContain('provider-sentinel-text');
            expect(out.split('keeper: oracle read failed').length - 1).toBe(1);
        } finally {
            await new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30_000);
});
