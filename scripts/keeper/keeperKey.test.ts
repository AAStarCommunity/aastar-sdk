import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import {
    KeeperStartupRefusal, assertFlagValues, parseKeeperArgs, castSignerArgs, keeperAccountFor, keeperKeyFrom, parseKeeperMode, resolveKeeperSigner,
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
        // An explicitly empty value (e.g. `--cast-account "$UNSET"`) is a missing value too.
        for (const empty of ['', ' ']) expect(() => assertFlagValues(['--mode', 'cast', '--cast-account', empty])).toThrow(/--cast-account needs a value/);
        expect(() => assertFlagValues(['--network', 'sepolia', '--mode', 'cast', '--cast-account', 'keeper', '--once', '--dry-run'])).not.toThrow();
    });

    it('the wallet and the cast arguments are built from the resolved signer only', () => {
        const pk = resolveKeeperSigner({ mode: 'privateKey', dryRun: false, keystorePath: undefined, castAccount: undefined, env: { KEEPER_PRIVATE_KEY: KEEPER, PRIVATE_KEY_SUPPLIER: DEPLOYERISH } });
        expect(keeperAccountFor(pk)?.address).toBe(KEEPER_ADDR);
        expect(keeperAccountFor({ mode: 'privateKey', key: undefined, address: undefined })).toBeNull();
        expect(castSignerArgs({ castAccount: 'keeper' })).toEqual(['--account', 'keeper']);
        expect(castSignerArgs({ keystorePath: '/k.json' })).toEqual(['--keystore', '/k.json']);
        // Both at once is an ambiguous signer (DSR 2026-11-17, overrides FU-112 ⑤e): refused, never "keystore wins".
        expect(() => castSignerArgs({ keystorePath: '/k.json', castAccount: 'keeper' })).toThrow(/not both/);
        expect(() => castSignerArgs({})).toThrow(KeeperStartupRefusal);
    });

    it('argv is parsed strictly: unknown, --flag=value, repeated and positional arguments refuse', () => {
        const ok = parseKeeperArgs(['--network', 'sepolia', '--dry-run', '--once', '--poll-interval', '60', '-h']);
        expect(ok.flag('--dry-run')).toBe(true);
        expect(ok.flag('--once')).toBe(true);
        expect(ok.flag('-h')).toBe(true);
        expect(ok.value('--poll-interval')).toBe('60');
        expect(ok.value('--mode')).toBeUndefined();
        expect(parseKeeperArgs(['--network', 'sepolia']).flag('--dry-run')).toBe(false);
        for (const [argv, why] of [
            [['--dry-run=true'], /--dry-run=… is not accepted/],
            [['--network=sepolia'], /--network=… is not accepted/],
            [['--keystore', './-keeper.json', '--bogus-x9'], /unknown option at position 3 \(not shown\)/],
            [['--dryrun'], /unknown option --dryrun/],
            [['--dry-run', '--dry-run'], /--dry-run is given more than once/],
            [['--poll-interval', '60', '--poll-interval', '30'], /--poll-interval is given more than once/],
            [['--bogus'], /unknown option --bogus/],
            [['sepolia'], /unexpected positional argument at position 1 \(not shown\)/],
            [['--cast-account', '-h'], /--cast-account needs a value/],
            [['--network', '-x'], /--network needs a value/],
            [['--network'], /--network needs a value/],
        ] as const) {
            expect(() => parseKeeperArgs(argv as unknown as string[]), JSON.stringify(argv)).toThrow(why as RegExp);
        }
    });

    it('--mode is parsed canonically: any case of privateKey, cast, else refuse', () => {
        expect(parseKeeperMode(undefined, false)).toBe('privateKey');
        expect(parseKeeperMode(undefined, true)).toBe('cast');
        for (const empty of ['', '  ']) expect(() => parseKeeperMode(empty, true)).toThrow(/--mode needs a value/);
        for (const m of ['privateKey', 'privatekey', 'PRIVATEKEY']) expect(parseKeeperMode(m, false)).toBe('privateKey');
        expect(parseKeeperMode('CAST', false)).toBe('cast');
        for (const m of ['private-key', 'bogus', 'pk']) expect(() => parseKeeperMode(m, false)).toThrow(/unknown --mode value \(expected privateKey or cast; the value is not shown\)/);
        // A keystore file whose name starts with '-' is spelled ./-name (a bare '-name' would read as an option).
        expect(parseKeeperArgs(['--keystore', './-keeper.json']).value('--keystore')).toBe('./-keeper.json');
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
// Every child runs with no-egress.preload.mjs, which records and refuses any TCP connection other than to the test
// server, any DNS query other than localhost, UDP, and any subprocess other than node. A refusal must record none.
// This is a guard on this process tree (its own self-test is below), not OS-level isolation.
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
                NO_EGRESS_LOG: egressLog, NO_EGRESS_ALLOW_PORTS: rpcUrl.split(':').pop()!,
                NODE_OPTIONS: `--import=${join(process.cwd(), 'scripts/keeper/no-egress.preload.mjs')}`,
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
        ['unknown --mode', ['--network', 'sepolia', '--once', '--mode', 'bogus'], /unknown --mode value/],
        ['cast mode with only DEPLOYER_ACCOUNT in the env file', ['--network', 'sepolia', '--once', '--mode', 'cast'], /DEPLOYER_ACCOUNT is not read/],
        ['a --dry-run lookalike', ['--network', 'sepolia', '--once', '--dry-run-lookalike'], /unknown option --dry-run-lookalike/],
        ['a trailing --mode with no value', ['--network', 'sepolia', '--once', '--mode'], /--mode needs a value/],
        ['--cast-account followed by another flag', ['--network', 'sepolia', '--mode', 'cast', '--cast-account', '--once'], /--cast-account needs a value/],
        ['an invalid number, before the signer is resolved', ['--network', 'sepolia', '--once', '--poll-interval', 'invalid'], /must be a whole number/],
        ['an explicitly empty --mode', ['--network', 'sepolia', '--once', '--mode', ''], /--mode needs a value/],
        ['an invalid number after the signer, in a dry run', ['--network', 'sepolia', '--once', '--dry-run', '--paymaster-missing-alert', 'invalid'], /must be a whole number/],
        ['an invalid number after the signer, in cast mode', ['--network', 'sepolia', '--once', '--mode', 'cast', '--cast-account', 'keeper', '--paymaster-missing-alert', 'invalid'], /must be a whole number/],
    ])('%s: exit 1, refused, zero RPC requests, zero egress (no Telegram), no key printed', async (_name, args, why) => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        // Telegram credentials are ALSO exported into the child, so errors raised before dotenv runs are covered.
        const r = await keeper([...(args as string[])], { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '1' });
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
        // The wallet the sending path uses, logged where it is built (before the first RPC read).
        expect(r.out).toContain(`wallet signer: ${KEEPER_ADDR}`);
        expect(r.out).not.toContain(DEPLOYERISH_ADDR);
        expect(r.out.toLowerCase()).not.toContain(KEEPER.slice(2));
    });

    it('cast mode passes exactly the given account / keystore to cast, never DEPLOYER_ACCOUNT', async () => {
        writeFileSync(join(dir, '.env.sepolia'), envFile); // envFile sets DEPLOYER_ACCOUNT=optimism-deployer
        const byName = await keeper(['--network', 'sepolia', '--once', '--dry-run', '--mode', 'cast', '--cast-account', 'keeper']);
        expect(byName.out).toContain('cast signer args: --account keeper');
        expect(byName.out).not.toContain('optimism-deployer');
        const byFile = await keeper(['--network', 'sepolia', '--once', '--dry-run', '--keystore', '/nonexistent/k.json']);
        expect(byFile.out).toContain('cast signer args: --keystore /nonexistent/k.json');
    });

    it('the no-egress guard itself records and refuses each kind of attempt', async () => {
        const log = join(dir, 'selftest.log');
        writeFileSync(log, '');
        const out = await new Promise<string>((resolve) => {
            const c = spawn(process.execPath, [join(process.cwd(), 'scripts/keeper/no-egress.selftest.mjs')], {
                env: {
                    PATH: process.env.PATH!, NO_EGRESS_LOG: log, NO_EGRESS_ALLOW_PORTS: rpcUrl.split(':').pop()!,
                    NODE_OPTIONS: `--import=${join(process.cwd(), 'scripts/keeper/no-egress.preload.mjs')}`,
                },
            });
            let o = '';
            c.stdout.on('data', (d) => { o += String(d); });
            c.on('close', () => resolve(o));
        });
        const results = JSON.parse(out.trim()) as Record<string, string>;
        expect(results).toEqual({
            'fetch': 'refused', 'tcp-other-loopback-port': 'refused', 'tcp-custom-lookup': 'refused', 'dns-resolve': 'refused',
            'dns-lookup': 'refused', 'udp': 'refused', 'subprocess': 'refused', 'allowed-loopback': 'SUCCEEDED',
        });
        const logged = readFileSync(log, 'utf8').split('\n').filter(Boolean);
        expect(logged).toHaveLength(7);
        expect(logged).toContain('tcp 192.0.2.1:80');
        expect(logged).toContain('subprocess cast');
    });

    // With a LIVE key present: a dry-run lookalike must refuse, never run live (the operator meant a dry run).
    it.each([
        ['--dry-run=true', ['--dry-run=true'], /--dry-run=… is not accepted/],
        ['--dryrun', ['--dryrun'], /unknown option --dryrun/],
        ['--dry-run --dry-run', ['--dry-run', '--dry-run'], /--dry-run is given more than once/],
        ['an unknown flag', ['--dry-run', '--bogus'], /unknown option --bogus/],
        ['-h swallowed as a value', ['--cast-account', '-h'], /--cast-account needs a value/],
    ])('with KEEPER_PRIVATE_KEY set, %s refuses: exit 1, zero RPC requests, zero egress', async (_name, extra, why) => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', ...(extra as string[])], {
            KEEPER_PRIVATE_KEY: KEEPER, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '1',
        });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/refused: /);
        expect(r.out).toMatch(why as RegExp);
        expect(r.requests).toBe(0);
        expect(r.egress).toEqual([]);
        expect(r.out).not.toContain('wallet signer:');
    });

    it('a key mistyped into an option, an --x=value, or --mode is refused without being printed', () => {
        const key = DEPLOYERISH.slice(2);
        for (const argv of [[`--${key}`], [`--${DEPLOYERISH}`], [`--${key}=x`], [`--x${key}=1`], ['--mode', DEPLOYERISH], ['--mode', key]]) {
            let msg = '';
            try { parseKeeperMode(parseKeeperArgs(argv).value('--mode'), false); } catch (e) { msg = String((e as Error).message); }
            expect(msg, JSON.stringify(argv.map((a) => a.slice(0, 8)))).not.toBe('');
            expect(msg.toLowerCase()).not.toContain(key.slice(0, 16));
        }
    });

    it('a key pasted as a positional argument is refused without being printed', async () => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', DEPLOYERISH]);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/unexpected positional argument at position 4 \(not shown\)/);
        expect(r.out.toLowerCase()).not.toContain(DEPLOYERISH.slice(2));
        expect(r.requests).toBe(0);
        expect(r.egress).toEqual([]);
    });

    // Daybreak 6c240b42 round 1: refusals added for KPR-002 / 003 / 006 / 009 and unattended cast mode (FU-114).
    it.each([
        ['--mode privateKey with a cast signer argument', ['--mode', 'privateKey', '--cast-account', 'keeper'], /the mode is privateKey/],
        ['--keystore and --cast-account together', ['--keystore', '/k.json', '--cast-account', 'keeper'], /not both/],
        ['a key pasted after --paymaster', ['--paymaster', DEPLOYERISH], /--paymaster is not a valid address \(the value is not shown\)/],
        ['a non-numeric --max-updates-per-day (NaN used to disable the daily cap)', ['--max-updates-per-day', 'abc'], /must be a whole number/],
        ['live cast mode without a terminal (unattended cast is not supported, FU-114)', ['--cast-account', 'keeper'], /cast mode needs an interactive terminal/],
    ])('%s: exit 1, refused, zero RPC requests, zero egress', async (_name, extra, why) => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', ...(extra as string[])], {
            KEEPER_PRIVATE_KEY: KEEPER, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '1',
        });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/refused: /);
        expect(r.out).toMatch(why as RegExp);
        expect(r.requests).toBe(0);
        expect(r.egress).toEqual([]);
        expect(r.out.toLowerCase()).not.toContain(DEPLOYERISH.slice(2));
    });

    it('an unknown --network is refused before it is used in a path, and not echoed', async () => {
        const r = await keeper(['--network', `x${DEPLOYERISH}`, '--once'], { KEEPER_PRIVATE_KEY: KEEPER });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/refused: unknown --network value/);
        expect(r.out.toLowerCase()).not.toContain(DEPLOYERISH.slice(2));
        expect(r.requests).toBe(0);
    });

    it('KPR-002: --cast-account alone selects cast mode even with KEEPER_PRIVATE_KEY in the env', async () => {
        writeFileSync(join(dir, '.env.sepolia'), envFile);
        const r = await keeper(['--network', 'sepolia', '--once', '--dry-run', '--cast-account', 'keeper'], { KEEPER_PRIVATE_KEY: KEEPER });
        expect(r.out).toContain('signer (cast mode): account keeper');
        expect(r.out).toContain('cast signer args: --account keeper');
        expect(r.out).not.toContain('wallet signer:');
    });

    it('KPR-003: op-mainnet refuses when .env.optimism and .env.op-mainnet disagree, naming the variable only', async () => {
        const OTHER = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // anvil #2, public
        writeFileSync(join(dir, '.env.optimism'), `KEEPER_PRIVATE_KEY=${DEPLOYERISH}\nRPC_URL=${rpcUrl}\n`);
        writeFileSync(join(dir, '.env.op-mainnet'), `KEEPER_PRIVATE_KEY=${OTHER}\nRPC_URL=${rpcUrl}\n`);
        try {
            const r = await keeper(['--network', 'op-mainnet', '--once', '--dry-run']);
            expect(r.code).toBe(1);
            expect(r.out).toMatch(/refused: \.env\.optimism and \.env\.op-mainnet set KEEPER_PRIVATE_KEY to different values/);
            expect(r.out).not.toMatch(/RPC_URL to/); // equal in both files: not a conflict
            expect(r.out.toLowerCase()).not.toContain(DEPLOYERISH.slice(2));
            expect(r.out.toLowerCase()).not.toContain(OTHER.slice(2));
            expect(r.requests).toBe(0);
            expect(r.egress).toEqual([]);
        } finally {
            rmSync(join(dir, '.env.optimism'), { force: true });
            rmSync(join(dir, '.env.op-mainnet'), { force: true });
        }
    });

    it('KPR-006: a live run on op-mainnet without --hard-max-fee-gwei refuses; a dry run does not', async () => {
        const live = await keeper(['--network', 'op-mainnet', '--once'], { KEEPER_PRIVATE_KEY: KEEPER });
        expect(live.code).toBe(1);
        expect(live.out).toMatch(/refused: a live run on op-mainnet needs --hard-max-fee-gwei/);
        expect(live.requests).toBe(0);
        const dry = await keeper(['--network', 'op-mainnet', '--once', '--dry-run'], { KEEPER_PRIVATE_KEY: KEEPER });
        expect(dry.out).not.toMatch(/hard-max-fee-gwei/);
        expect(dry.requests).toBeGreaterThan(0);
    });
});
