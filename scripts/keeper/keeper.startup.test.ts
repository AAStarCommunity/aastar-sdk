/**
 * Live startup refuses a signer that is the deployer, SP.owner(), or Registry.owner().
 * Dry-run is not used: the identity check has to refuse the process.
 * The RPC answers owner() the way SuperPaymaster 5.4.2 and Registry do. cast is a fake that must not be reached.
 */
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeFunctionResult, getAddress, type Address, type Hex } from 'viem';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DEPLOYER_ADDRESS } from './signerGuard';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
if (!existsSync(TSX_LOADER)) throw new Error(`keeper startup: pinned tsx loader missing at ${TSX_LOADER}`);

const SIGNER = getAddress('0x1111111111111111111111111111111111111111');
const SP = getAddress('0x2222222222222222222222222222222222222222');
const REG = getAddress('0x3333333333333333333333333333333333333333');
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

function listen(owners: { sp: Address; registry: Address }): Promise<{ server: Server; url: string }> {
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
                } else if (method === 'eth_call' && data.slice(0, 10).toLowerCase() === OWNER_SEL) {
                    if (to === SP.toLowerCase()) result = word(owners.sp);
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

async function expectRefuse(signer: Address, owners: { sp: Address; registry: Address }, text: string): Promise<void> {
    const { server, url } = await listen(owners);
    const dir = mkdtempSync(join(tmpdir(), 'keeper-start-'));
    chmodSync(dir, 0o700);
    const pw = join(dir, 'password');
    const ks = join(dir, 'keystore');
    writeFileSync(pw, 'not-a-real-password\n');
    writeFileSync(ks, '{}\n');
    chmodSync(pw, 0o600);
    chmodSync(ks, 0o600);
    const cast = join(dir, 'cast');
    writeFileSync(cast, '#!/bin/sh\nexit 1\n');
    chmodSync(cast, 0o755);
    try {
        const child = spawn(process.execPath, [
            '--import', pathToFileURL(TSX_LOADER).href, KEEPER,
            '--network', 'sepolia', '--no-logo', '--once',
            '--no-superpaymaster', '--disable-paymaster',
            '--keystore', ks, '--password-file', pw, '--signer', signer,
            '--cast-bin', cast, '--journal', join(dir, 'journal.json'),
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
});
