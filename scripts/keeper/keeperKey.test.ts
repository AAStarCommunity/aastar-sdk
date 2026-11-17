import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import {
    KeeperStartupRefusal, assertFlagValues, castSignerArgs, keeperAccountFor, keeperKeyFrom, parseKeeperMode, resolveKeeperSigner,
} from './keeperKey.js';

// This file spawns keeper.ts below; every top-level block states its timeout (check:spawn-timeouts).
const SPAWN_VERDICT_TIMEOUT_MS = 60_000;

// anvil accounts #0 and #1: public test keys, never real ones. #1 stands in for the deployer.
const KEEPER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEPLOYERISH = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const KEEPER_ADDR = privateKeyToAccount(KEEPER).address;
const DEPLOYERISH_ADDR = privateKeyToAccount(DEPLOYERISH).address;

describe('keeper signer: no fallback of any kind', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('privateKey mode reads KEEPER_PRIVATE_KEY only (PRIVATE_KEY_SUPPLIER / PRIVATE_KEY are the deployer on Sepolia)', () => {
        expect(keeperKeyFrom({ PRIVATE_KEY_SUPPLIER: DEPLOYERISH, PRIVATE_KEY: DEPLOYERISH })).toBeUndefined();
        expect(keeperKeyFrom({ KEEPER_PRIVATE_KEY: '', PRIVATE_KEY_SUPPLIER: DEPLOYERISH })).toBeUndefined();
        const s = resolveKeeperSigner({
            mode: 'privateKey', dryRun: false, keystorePath: undefined, castAccount: undefined,
            env: { KEEPER_PRIVATE_KEY: KEEPER, PRIVATE_KEY_SUPPLIER: DEPLOYERISH },
        });
        expect(s).toMatchObject({ mode: 'privateKey', address: KEEPER_ADDR });
        expect(() => resolveKeeperSigner({ mode: 'privateKey', dryRun: false, keystorePath: undefined, castAccount: undefined, env: { PRIVATE_KEY_SUPPLIER: DEPLOYERISH } }))
            .toThrow(KeeperStartupRefusal);
        expect(resolveKeeperSigner({ mode: 'privateKey', dryRun: true, keystorePath: undefined, castAccount: undefined, env: {} })).toMatchObject({ key: undefined });
        expect(() => resolveKeeperSigner({ mode: 'privateKey', dryRun: false, keystorePath: undefined, castAccount: undefined, env: { KEEPER_PRIVATE_KEY: '0x1234' } }))
            .toThrow(/not a valid private key/);
    });

    it('cast mode takes the account from --cast-account / --keystore only (DEPLOYER_ACCOUNT is not read)', () => {
        const env = { DEPLOYER_ACCOUNT: 'optimism-deployer' };
        expect(() => resolveKeeperSigner({ mode: 'cast', dryRun: false, env, keystorePath: undefined, castAccount: undefined })).toThrow(/DEPLOYER_ACCOUNT is not read/);
        expect(() => resolveKeeperSigner({ mode: 'cast', dryRun: true, env, keystorePath: undefined, castAccount: undefined })).toThrow(KeeperStartupRefusal);
        expect(resolveKeeperSigner({ mode: 'cast', dryRun: false, env, keystorePath: undefined, castAccount: 'keeper' })).toMatchObject({ castAccount: 'keeper' });
        // With a keystore and no --cast-account, the env's DEPLOYER_ACCOUNT must not be picked up either.
        expect(resolveKeeperSigner({ mode: 'cast', dryRun: false, env, keystorePath: '/k.json', castAccount: undefined }))
            .toEqual({ mode: 'cast', keystorePath: '/k.json', castAccount: undefined });
        expect(() => resolveKeeperSigner({ mode: 'cast', dryRun: false, env, keystorePath: undefined, castAccount: '0xabc' })).toThrow(/use --keystore/);
    });

    it('a value flag without its value refuses (end of argv, or another --flag next)', () => {
        expect(() => assertFlagValues(['--network', 'sepolia', '--mode'])).toThrow(/--mode needs a value/);
        expect(() => assertFlagValues(['--mode', 'cast', '--cast-account', '--once'])).toThrow(/--cast-account needs a value/);
        expect(() => assertFlagValues(['--poll-interval', '--dry-run'])).toThrow(KeeperStartupRefusal);
        expect(() => assertFlagValues(['--network', 'sepolia', '--mode', 'cast', '--cast-account', 'keeper', '--once', '--dry-run'])).not.toThrow();
    });

    it('the wallet and the cast arguments are built from the resolved signer only', () => {
        const pk = resolveKeeperSigner({ mode: 'privateKey', dryRun: false, keystorePath: undefined, castAccount: undefined, env: { KEEPER_PRIVATE_KEY: KEEPER, PRIVATE_KEY_SUPPLIER: DEPLOYERISH } });
        expect(keeperAccountFor(pk)?.address).toBe(KEEPER_ADDR);
        expect(keeperAccountFor({ mode: 'privateKey', key: undefined, address: undefined })).toBeNull();
        expect(castSignerArgs({ castAccount: 'keeper' })).toEqual(['--account', 'keeper']);
        expect(castSignerArgs({ keystorePath: '/k.json', castAccount: 'keeper' })).toEqual(['--keystore', '/k.json']);
        expect(() => castSignerArgs({})).toThrow(KeeperStartupRefusal);
    });

    it('--mode is parsed canonically: any case of privateKey, cast, else refuse', () => {
        expect(parseKeeperMode(undefined, false)).toBe('privateKey');
        expect(parseKeeperMode('', true)).toBe('cast');
        for (const m of ['privateKey', 'privatekey', 'PRIVATEKEY']) expect(parseKeeperMode(m, false)).toBe('privateKey');
        expect(parseKeeperMode('CAST', false)).toBe('cast');
        for (const m of ['private-key', 'bogus', 'pk']) expect(() => parseKeeperMode(m, false)).toThrow(KeeperStartupRefusal);
    });
});

// keeper.ts itself, spawned in an empty temp dir with --network sepolia (its .env.sepolia is read from the cwd, so
// the real repo file is out of reach; addresses come from the SDK address book) against a local JSON-RPC server that counts requests and answers each with an error.
// A refused start must make ZERO requests; a dry run must make some (it got past the guard).
const dir = mkdtempSync(join(tmpdir(), 'keeper-key-'));
let server: Server;
let requests = 0;
let rpcUrl = '';
beforeAll(async () => {
    server = createServer((req, res) => {
        requests++;
        req.resume();
        req.on('end', () => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'test server: no chain here' } }));
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    rpcUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
}, SPAWN_VERDICT_TIMEOUT_MS);
afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

/** Run keeper.ts; stop it as soon as it has reached the RPC (or after `ms`). Returns exit code, output, requests. */
// Every child runs with no-egress.preload.mjs: a connection to any non-loopback host (Telegram, a public RPC) is
// logged and refused. Refusals must log none; no test can reach a public network.
let runs = 0;
function keeper(args: string[], env: Record<string, string> = {}, ms = 20_000): Promise<{ code: number | null; out: string; requests: number; egress: string[] }> {
    const before = requests;
    const egressLog = join(dir, `egress-${++runs}.log`);
    writeFileSync(egressLog, '');
    return new Promise((resolve) => {
        const child = spawn(join(process.cwd(), 'node_modules/.bin/tsx'), [join(process.cwd(), 'scripts/keeper.ts'), ...args], {
            cwd: dir,
            env: {
                PATH: process.env.PATH!, HOME: dir, RPC_URL: rpcUrl, ...env,
                NO_EGRESS_LOG: egressLog, NODE_OPTIONS: `--import=${join(process.cwd(), 'scripts/keeper/no-egress.preload.mjs')}`,
            },
        });
        let out = '';
        child.stdout.on('data', (d) => { out += String(d); });
        child.stderr.on('data', (d) => { out += String(d); });
        const poll = setInterval(() => { if (requests > before) child.kill('SIGTERM'); }, 50);
        const stop = setTimeout(() => child.kill('SIGKILL'), ms);
        child.on('close', (code) => {
            clearInterval(poll);
            clearTimeout(stop);
            resolve({ code, out, requests: requests - before, egress: readFileSync(egressLog, 'utf8').split('\n').filter(Boolean) });
        });
    });
}

describe('keeper.ts refuses before any network request, whatever .env.<network> holds', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const envFile = `PRIVATE_KEY=${DEPLOYERISH}\nPRIVATE_KEY_SUPPLIER=${DEPLOYERISH}\nDEPLOYER_ACCOUNT=optimism-deployer\n` +
        'TELEGRAM_BOT_TOKEN=test-token\nTELEGRAM_CHAT_ID=1\n';

    it.each([
        ['default mode', ['--network', 'sepolia', '--once'], /privateKey mode requires KEEPER_PRIVATE_KEY/],
        ['explicit --mode privateKey', ['--network', 'sepolia', '--once', '--mode', 'privateKey'], /privateKey mode requires KEEPER_PRIVATE_KEY/],
        ['--mode PRIVATEKEY', ['--network', 'sepolia', '--once', '--mode', 'PRIVATEKEY'], /privateKey mode requires KEEPER_PRIVATE_KEY/],
        ['unknown --mode', ['--network', 'sepolia', '--once', '--mode', 'bogus'], /unknown --mode "bogus"/],
        ['cast mode with only DEPLOYER_ACCOUNT in the env file', ['--network', 'sepolia', '--once', '--mode', 'cast'], /DEPLOYER_ACCOUNT is not read/],
        ['a --dry-run lookalike', ['--network', 'sepolia', '--once', '--dry-run-lookalike'], /privateKey mode requires KEEPER_PRIVATE_KEY/],
        ['a trailing --mode with no value', ['--network', 'sepolia', '--once', '--mode'], /--mode needs a value/],
        ['--cast-account followed by another flag', ['--network', 'sepolia', '--mode', 'cast', '--cast-account', '--once'], /--cast-account needs a value/],
        ['an invalid number, before the signer is resolved', ['--network', 'sepolia', '--once', '--poll-interval', 'invalid'], /invalid|Cannot convert/],
    ])('%s: exit 1, refused, zero RPC requests, zero egress (no Telegram), no key printed', async (_name, args, why) => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper([...(args as string[])]);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/refused: /);
        expect(r.out).toMatch(why as RegExp);
        expect(r.requests).toBe(0);
        // Telegram credentials are in the env file: a notification would show up as egress to api.telegram.org.
        expect(r.egress).toEqual([]);
        expect(r.out.toLowerCase()).not.toContain(DEPLOYERISH.slice(2));
    });

    it('a dry run gets past the guard and reaches the RPC', async () => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', '--dry-run']);
        expect(r.out).not.toMatch(/refused: /);
        expect(r.requests).toBeGreaterThan(0);
    });

    it('the signer is KEEPER_PRIVATE_KEY, not the env file\'s PRIVATE_KEY_SUPPLIER', async () => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', '--dry-run'], { KEEPER_PRIVATE_KEY: KEEPER });
        expect(r.out).toContain(`signer (privateKey mode): ${KEEPER_ADDR}`);
        expect(r.out).not.toContain(DEPLOYERISH_ADDR);
        expect(r.out.toLowerCase()).not.toContain(KEEPER.slice(2));
    });
});
