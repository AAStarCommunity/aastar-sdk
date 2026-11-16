/**
 * run-keeper.sh argument assembly: which baked addresses reach keeper.ts for a given command line.
 *
 * The REAL script runs under bash, copied into an empty temp dir (it cds to its own directory, so
 * no .env.<network> file is reachable) with a fake `node` first on PATH that prints its argv and
 * exits. Nothing starts: keeper.ts is never executed. The script execs that node under `env -i`.
 *
 * A live invocation is refused. `--dry-run` still execs node. PaymasterV4 is not baked.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIVE = 'live runs must start from the plist with absolute ProgramArguments; see docs/guide/keeper.md';
const dir = mkdtempSync(join(tmpdir(), 'run-keeper-'));
const bin = join(dir, 'bin');
mkdirSync(bin);
copyFileSync(join(process.cwd(), 'run-keeper.sh'), join(dir, 'run-keeper.sh'));
mkdirSync(join(dir, 'node_modules', 'tsx', 'dist'), { recursive: true });
writeFileSync(join(dir, 'node_modules', 'tsx', 'dist', 'loader.mjs'), '// test loader\n');
writeFileSync(
    join(bin, 'node'),
    '#!/bin/sh\nenv | grep -E \'^(KEEPER_PRIVATE_KEY|PRIVATE_KEY|RPC_URL|UNLISTED)=\' | sed \'s/^/ENV_/\'\nfor a in "$@"; do printf "%s\\n" "$a"; done\n',
);
writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\necho "pnpm should not run" >&2\nexit 99\n',
);
writeFileSync(
    join(bin, 'env'),
    '#!/bin/sh\nfor a in "$@"; do printf "ENVARG %s\\n" "$a"; done\nexec /usr/bin/env "$@"\n',
);
chmodSync(join(bin, 'node'), 0o755);
chmodSync(join(bin, 'pnpm'), 0o755);
chmodSync(join(bin, 'env'), 0o755);
afterAll(() => rmSync(dir, { recursive: true, force: true }), 30_000);

const SIGN = ['--keystore', '/tmp/ks', '--password-file', '/tmp/pw', '--signer', '0x0000000000000000000000000000000000000001'];

function run(args: string[], opts: { sign?: boolean; env?: NodeJS.ProcessEnv } = {}) {
    const full = opts.sign === false ? args : [...args, ...SIGN];
    const r = spawnSync('bash', [join(dir, 'run-keeper.sh'), ...full], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, ...opts.env },
    });
    const lines = r.stdout.split('\n').filter((l) => l && !l.startsWith('keeper: '));
    const envLines = lines.filter((l) => l.startsWith('ENV_'));
    const envArgs = lines.filter((l) => l.startsWith('ENVARG ')).map((l) => l.slice('ENVARG '.length));
    const argv = lines.filter((l) => !l.startsWith('ENV_') && !l.startsWith('ENVARG '));
    return { status: r.status, stderr: r.stderr, stdout: r.stdout, argv, envLines, envArgs };
}

/** Every value passed for `flag`, in order. */
const valuesOf = (argv: string[], flag: string) => argv.flatMap((a, i) => (a === flag ? [argv[i + 1]] : []));

// run() is spawnSync. That blocks the verdict timer the same way execFileSync does. The script
// itself is a short bash run; 30s is the spawn-verdict budget, not a measurement of this file.
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('run-keeper.sh argument assembly', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('a live run via the wrapper refuses and does not exec node', () => {
        const live = run(['sepolia', '--once']);
        expect(live.status).toBe(1);
        expect(live.stderr).toContain(LIVE);
        expect(live.argv).toEqual([]);
        expect(live.envArgs).toEqual([]);
        const main = spawnSync('bash', [join(dir, 'run-keeper.sh'), 'sepolia'], { cwd: dir, encoding: 'utf8' });
        expect(main.status).toBe(1);
        expect(main.stderr).toContain(LIVE);
    });

    it('dry-run does not bake a PaymasterV4 and still forwards an explicit one', () => {
        const plain = run(['sepolia', '--dry-run', '--once'], { sign: false });
        expect(plain.status, plain.stderr).toBe(0);
        expect(valuesOf(plain.argv, '--paymaster')).toEqual([]);
        const mine = '0x00000000000000000000000000000000000000bb';
        const explicit = run(['sepolia', '--dry-run', '--paymaster', mine], { sign: false });
        expect(explicit.status, explicit.stderr).toBe(0);
        expect(valuesOf(explicit.argv, '--paymaster')).toEqual([mine]);
    });

    it('an explicit --superpaymaster is forwarded on a dry-run', () => {
        const mine = '0x00000000000000000000000000000000000000cc';
        const r = run(['sepolia', '--dry-run', '--superpaymaster', mine], { sign: false });
        expect(valuesOf(r.argv, '--superpaymaster')).toEqual([mine]);
    });

    it('a network with nothing baked starts with no address args (empty array under set -u)', () => {
        const r = run(['op-mainnet', '--dry-run', '--once'], { sign: false });
        expect(r.stderr).not.toMatch(/unbound variable/);
        expect(r.status).toBe(0);
        // The fake node really ran (not an early exit 0): it printed the keeper invocation.
        expect(r.argv.slice(0, 3)).toEqual(['--import', join(dir, 'node_modules', 'tsx', 'dist', 'loader.mjs'), 'scripts/keeper.ts']);
        expect(r.argv.slice(3, 5)).toEqual(['--network', 'op-mainnet']);
        expect(r.argv).not.toContain('--external-ethusd-url');
        expect(r.argv).not.toContain('--cast-bin');
        expect(valuesOf(r.argv, '--paymaster')).toEqual([]);
        expect(valuesOf(r.argv, '--superpaymaster')).toEqual([]);
    });

    it('no keystore flags: a live run refuses; --dry-run is the only pass', () => {
        const missing = run(['sepolia', '--once'], { sign: false });
        expect(missing.status).toBe(1);
        expect(missing.stderr).toContain(LIVE);
        expect(run(['sepolia', '--once', '--keystore', '/tmp/ks'], { sign: false }).stderr).toContain(LIVE);
        expect(run(['sepolia', '--once', '--dry-run-lookalike'], { sign: false }).status).toBe(1);
        expect(run(['sepolia', '--once', '--dry-run'], { sign: false }).status).toBe(0);
    });

    it('PRIVATE_KEY in .env.sepolia is not read and KEEPER_PRIVATE_KEY is not exported', () => {
        const sentinel = 'not-a-real-key-sentinel';
        writeFileSync(join(dir, '.env.sepolia'), `PRIVATE_KEY=${sentinel}\n`);
        const r = run(['sepolia', '--dry-run', '--once'], { sign: false });
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain(sentinel);
        expect(r.envLines.join('\n')).not.toMatch(/KEEPER_PRIVATE_KEY|PRIVATE_KEY/);
        expect(r.argv).not.toContain(sentinel);
    });

    it('no wrapper-spawned process has a secret on argv', () => {
        const token = 'telegram-token-sentinel';
        const url = 'http://rpc-sentinel.example/secret';
        const leaked = run(['sepolia', '--once', '--dry-run'], {
            sign: false,
            env: { RPC_URL: url, TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: 'chat-sentinel' },
        });
        expect(leaked.status, leaked.stderr).toBe(1);
        expect(leaked.stderr).toMatch(/put it in --env-file/);
        expect(leaked.stdout).not.toContain(token);
        expect(leaked.stdout).not.toContain(url);
        expect(leaked.envArgs).toEqual([]);

        const file = join(dir, 'keeper.env');
        writeFileSync(file, `RPC_URL=${url}\nTELEGRAM_BOT_TOKEN=${token}\nTELEGRAM_CHAT_ID=chat-sentinel\n`);
        const clean = run(['sepolia', '--once', '--dry-run', '--env-file', file], { sign: false });
        expect(clean.status, clean.stderr).toBe(1);
        expect(clean.stderr).toContain('a dry-run cannot take --keystore, --password-file, --env-file, or --signer');
        expect(clean.stdout).not.toContain(token);
        expect(clean.stdout).not.toContain(url);
        expect(clean.stdout).not.toContain(file);
        expect(clean.argv).toEqual([]);

        const priced = run(['sepolia', '--once', '--dry-run'], {
            sign: false,
            env: { KEEPER_ETHUSD_URL: 'https://user:ethusd-sentinel@example.test/price' },
        });
        expect(priced.status, priced.stderr).toBe(0);
        expect([...priced.envArgs, ...priced.argv, ...priced.envLines].join('\n')).not.toContain('ethusd-sentinel');
    });

    it('exported ETH_PASSWORD is refused by the wrapper', () => {
        const sentinel = 'password-sentinel';
        for (const name of ['ETH_PASSWORD', 'CAST_PASSWORD', 'KEEPER_PRIVATE_KEY']) {
            const refused = run(['sepolia', '--once', '--dry-run'], { sign: false, env: { [name]: sentinel } });
            expect(refused.status, refused.stderr).toBe(1);
            expect(refused.stderr).toContain(name);
            expect(refused.stderr).toMatch(/put it in --env-file/);
            expect(refused.stdout).not.toContain(sentinel);
            expect(refused.stderr).not.toContain(sentinel);
        }
    });

    it('the wrapper pid is the node pid, so SIGTERM stops the keeper', async () => {
        const home = mkdtempSync(join(tmpdir(), 'run-keeper-pid-'));
        const nodeBin = join(home, 'bin');
        mkdirSync(nodeBin);
        const node = join(nodeBin, 'node');
        writeFileSync(node, `#!/bin/sh
trap 'echo TERM > "$HOME/got"; exit 0' TERM INT
echo $$ > "$HOME/node.pid"
printf '%s\\n' "$@" > "$HOME/argv.txt"
while true; do sleep 0.2; done
`);
        chmodSync(node, 0o755);
        const child = spawn('bash', [join(process.cwd(), 'run-keeper.sh'), 'sepolia', '--dry-run', '--once'], {
            cwd: process.cwd(),
            env: { PATH: `${nodeBin}:${process.env.PATH}`, HOME: home, KEEPER_ETHUSD_URL: 'https://user:ethusd-sentinel@example.test/price' },
        });
        const pidFile = join(home, 'node.pid');
        const started = Date.now();
        let nodePid = 0;
        while (nodePid <= 0 && Date.now() - started < 5_000) {
            if (existsSync(pidFile)) nodePid = Number(readFileSync(pidFile, 'utf8').trim());
            if (nodePid > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(nodePid).toBe(child.pid);
        child.kill('SIGTERM');
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 5_000);
            child.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        expect(code).toBe(0);
        expect(readFileSync(join(home, 'got'), 'utf8')).toContain('TERM');
        const argv = readFileSync(join(home, 'argv.txt'), 'utf8');
        expect(argv).toContain('--import');
        expect(argv).toContain('scripts/keeper.ts');
        expect(argv).not.toContain('ethusd-sentinel');
        expect(argv).not.toContain('pnpm');
        rmSync(home, { recursive: true, force: true });
    });

    it('adds cadence defaults only when the caller omitted them', () => {
        const explicit = run(['sepolia', '--dry-run', '--poll-interval', '3600', '--volatility-threshold-bps', '0'], { sign: false });
        expect(explicit.status, explicit.stderr).toBe(0);
        expect(valuesOf(explicit.argv, '--poll-interval')).toEqual(['3600']);
        expect(valuesOf(explicit.argv, '--volatility-threshold-bps')).toEqual(['0']);
        const omitted = run(['sepolia', '--dry-run'], { sign: false });
        expect(omitted.status, omitted.stderr).toBe(0);
        expect(valuesOf(omitted.argv, '--poll-interval')).toEqual(['180']);
        expect(valuesOf(omitted.argv, '--volatility-threshold-bps')).toEqual(['150']);

        copyFileSync(join(process.cwd(), 'run-keeper-main.sh'), join(dir, 'run-keeper-main.sh'));
        const main = (args: string[]) => {
            const r = spawnSync('bash', [join(dir, 'run-keeper-main.sh'), ...args], {
                cwd: dir,
                encoding: 'utf8',
                env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir },
            });
            const lines = r.stdout.split('\n').filter((l) => l && !l.startsWith('keeper: ') && !l.startsWith('ENV_') && !l.startsWith('ENVARG '));
            return { status: r.status, stderr: r.stderr, argv: lines };
        };
        const mainExplicit = main(['--dry-run', '--poll-interval', '3600', '--volatility-threshold-bps', '0']);
        expect(mainExplicit.status, mainExplicit.stderr).toBe(0);
        expect(valuesOf(mainExplicit.argv, '--poll-interval')).toEqual(['3600']);
        expect(valuesOf(mainExplicit.argv, '--volatility-threshold-bps')).toEqual(['0']);
        const mainOmitted = main(['--dry-run']);
        expect(mainOmitted.status, mainOmitted.stderr).toBe(0);
        expect(valuesOf(mainOmitted.argv, '--poll-interval')).toEqual(['180']);
        expect(valuesOf(mainOmitted.argv, '--volatility-threshold-bps')).toEqual(['150']);
        const mainLive = main([]);
        expect(mainLive.status).toBe(1);
        expect(mainLive.stderr).toContain(LIVE);
        expect(mainLive.argv).toEqual([]);
    });

    it('a dry-run refuses credential flags and does not forward them', () => {
        const cred = 'error: a dry-run cannot take --keystore, --password-file, --env-file, or --signer';
        for (const flag of ['--keystore', '--password-file', '--env-file', '--signer']) {
            const refused = run(['sepolia', '--dry-run', '--once', flag, '/tmp/sentinel-value'], { sign: false });
            expect(refused.status, refused.stderr).toBe(1);
            expect(refused.stderr).toContain(cred);
            expect(refused.stderr).not.toContain('sentinel-value');
            expect(refused.argv).toEqual([]);
            const eq = run(['sepolia', '--dry-run', `${flag}=/tmp/sentinel-value`], { sign: false });
            expect(eq.status).toBe(1);
            expect(eq.stderr).toContain(cred);
            expect(eq.stderr).not.toContain('sentinel-value');
            expect(eq.argv).toEqual([]);
        }
        const live = run(['sepolia', '--keystore', '/tmp/ks'], { sign: false });
        expect(live.stderr).toContain(LIVE);
        expect(live.stderr).not.toContain(cred);
    });
});
