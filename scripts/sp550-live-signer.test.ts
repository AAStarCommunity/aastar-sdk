import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { bytesToHex, keccak256 } from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { decryptKeystoreV3, isPublicTestAccount, liveKeySourceProblem, loadLiveSigner, promptHidden } from './sp550-live-signer.js';
import { SP550_LIVE_APPROVED_SIGNERS, liveSignerApprovalProblem } from './sp550-live-approved-signers.js';

// Web3 Secret Storage Definition, the published PBKDF2-SHA-256 test vector (password "testpassword").
const SPEC_VECTOR = {
    version: 3,
    crypto: {
        cipher: 'aes-128-ctr', cipherparams: { iv: '6087dab2f9fdbbfaddc31a909735c1e6' },
        ciphertext: '5318b4d5bcd28de64ee5559e671353e16f075ecae9f99c7a79a38af5f869aa46',
        kdf: 'pbkdf2', kdfparams: { c: 262144, dklen: 32, prf: 'hmac-sha256', salt: 'ae3cd4e7013836a3df6bd7241b12db061dbe2c6785853cce422d148a624ce0bd' },
        mac: '517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2',
    },
};
// The vector's key, pinned by its address (the spec lists both) so no key literal sits in the repo.
const SPEC_ADDRESS = '0x008AeEda4D805471dF9b2A5B0f38A0C3bCBA786b';

const KEY = ('0x' + '5a'.repeat(31) + '01') as `0x${string}`;
const PASSWORD = 'correct horse battery staple ✓';

/** A scrypt v3 keystore (small N so the test is fast), built with node:crypto, not the module under test. */
function scryptKeystore(key: `0x${string}`, password: string, withAddress = true) {
    const salt = randomBytes(32), iv = randomBytes(16);
    const dk = scryptSync(Buffer.from(password.normalize('NFKD')), salt, 32, { N: 1024, r: 8, p: 1 });
    const c = createCipheriv('aes-128-ctr', dk.subarray(0, 16), iv);
    const ciphertext = Buffer.concat([c.update(Buffer.from(key.slice(2), 'hex')), c.final()]);
    const mac = keccak256(Buffer.concat([dk.subarray(16, 32), ciphertext])).slice(2);
    return {
        version: 3,
        ...(withAddress ? { address: privateKeyToAccount(key).address.slice(2).toLowerCase() } : {}),
        crypto: {
            cipher: 'aes-128-ctr', cipherparams: { iv: iv.toString('hex') }, ciphertext: ciphertext.toString('hex'),
            kdf: 'scrypt', kdfparams: { n: 1024, r: 8, p: 1, dklen: 32, salt: salt.toString('hex') }, mac,
        },
    };
}

const tmp = (json: unknown) => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ks-')), 'keystore.json');
    fs.writeFileSync(f, JSON.stringify(json));
    return f;
};

/** Everything written to the console or stdout/stderr while `fn` runs. */
async function captured(fn: () => Promise<unknown>) {
    const out: string[] = [];
    const grab = (...a: unknown[]) => { out.push(a.map(String).join(' ')); return true; };
    const spies = [
        vi.spyOn(console, 'log').mockImplementation(grab), vi.spyOn(console, 'error').mockImplementation(grab),
        vi.spyOn(console, 'warn').mockImplementation(grab), vi.spyOn(process.stdout, 'write').mockImplementation(grab as any),
        vi.spyOn(process.stderr, 'write').mockImplementation(grab as any),
    ];
    let error: unknown;
    try { await fn(); } catch (e) { error = e; } finally { spies.forEach((s) => s.mockRestore()); }
    return { out: out.join('\n'), error };
}
const leaks = (text: string) => [KEY, KEY.slice(2), PASSWORD].filter((s) => text.toLowerCase().includes(s.toLowerCase()));

// This file spawns the E2E script (execFileSync blocks vitest's timer loop): every hook and suite names its timeout.
const SPAWN_VERDICT_TIMEOUT_MS = 60_000;
afterEach(() => { delete process.env.SP550_TEST_LEAKED_KEY; delete process.env.PRIVATE_KEY; }, SPAWN_VERDICT_TIMEOUT_MS);

describe('keystore v3 decryption', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('decrypts the published Web3 Secret Storage PBKDF2 test vector', () => {
        expect(privateKeyToAccount(decryptKeystoreV3(SPEC_VECTOR, 'testpassword')).address).toBe(SPEC_ADDRESS);
    });
    it('decrypts a scrypt keystore produced by a standard tool (foundry cast 1.7.1 `cast wallet new`)', () => {
        // A throwaway key generated for this fixture only, never funded or used; its password is
        // public on purpose. Pinned by address. Cross-checks the in-house KDF/MAC against a
        // keystore this repo did not build.
        const ks = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/keystore/cast-1.7.1-scrypt.json'), 'utf8'));
        expect(ks.crypto.kdf).toBe('scrypt');
        expect(privateKeyToAccount(decryptKeystoreV3(ks, 'throwaway-test-only')).address).toBe('0x2435BfEfe5225Ce043f26449d6c3FE42248CF3aB');
        expect(() => decryptKeystoreV3(ks, 'throwaway-test-onlY')).toThrow(/wrong password/);
    });
    it('decrypts a scrypt keystore built independently with node:crypto', () => {
        expect(decryptKeystoreV3(scryptKeystore(KEY, PASSWORD), PASSWORD)).toBe(KEY);
    });
    it('a wrong password throws one fixed message that contains neither password nor key', () => {
        let msg = '';
        try { decryptKeystoreV3(scryptKeystore(KEY, PASSWORD), PASSWORD + 'x'); } catch (e: any) { msg = String(e.message) + String(e.stack); }
        expect(msg).toMatch(/wrong password, or not a valid encrypted v3 keystore/);
        expect(leaks(msg)).toEqual([]);
        expect(msg).not.toContain(PASSWORD + 'x');
    });
    it('a tampered ciphertext fails the MAC, never decrypts to a different key', () => {
        const ks = scryptKeystore(KEY, PASSWORD);
        ks.crypto.ciphertext = (ks.crypto.ciphertext[0] === '0' ? '1' : '0') + ks.crypto.ciphertext.slice(1);
        expect(() => decryptKeystoreV3(ks, PASSWORD)).toThrow(/wrong password, or not a valid/);
    });
});

describe('live key source: an encrypted keystore and nothing else', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it.each([
        [{ env: 'SP550_TEST_LEAKED_KEY' }, /refusing field\(s\) "env"/],
        [{ keystore: '/k.json', privateKey: KEY }, /refusing field\(s\) "privateKey"/],
        [{ keystore: '/k.json', password: PASSWORD }, /refusing field\(s\) "password"/],
        [{ keystore: '/k.json', passwordEnv: 'X', passwordFile: '/p' }, /"passwordEnv", "passwordFile"/],
        [{ anvilIndex: 3 }, /refusing field\(s\) "anvilIndex"/],
        [undefined, /must be \{ "keystore"/],
        [{ keystore: '' }, /must be a path/],
    ])('%j is refused, naming the field but never its value', (userKey, msg) => {
        const p = liveKeySourceProblem(userKey);
        expect(p).toMatch(msg);
        expect(leaks(p!)).toEqual([]);
    });
    it('{ keystore } is the accepted shape', () => {
        expect(liveKeySourceProblem({ keystore: '/path/k.json' })).toBeUndefined();
    });
});

describe('password prompt: interactive only', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('a non-TTY stdin is refused — there is no non-interactive password path', async () => {
        const input = { isTTY: false, on() {}, removeListener() {}, resume() {}, pause() {} };
        await expect(promptHidden('pw: ', { input, output: { write: () => true } } as any)).rejects.toThrow(/no non-interactive path/);
    });
    it('on a TTY it echoes nothing of what is typed', async () => {
        const written: string[] = [];
        let onData: (c: string) => void = () => {};
        const input = { isTTY: true, setRawMode() {}, on: (_: string, f: any) => { onData = f; }, removeListener() {}, resume() {}, pause() {} };
        const p = promptHidden('pw: ', { input, output: { write: (s: string) => { written.push(s); return true; } } } as any);
        onData(PASSWORD + 'z\u007f\r');
        expect(await p).toBe(PASSWORD);
        expect(written.join('')).toBe('pw: \n');
    });
    it('Ctrl-C aborts', async () => {
        let onData: (c: string) => void = () => {};
        const input = { isTTY: true, setRawMode() {}, on: (_: string, f: any) => { onData = f; }, removeListener() {}, resume() {}, pause() {} };
        const p = promptHidden('pw: ', { input, output: { write: () => true } } as any);
        onData('abc\u0003');
        await expect(p).rejects.toThrow(/aborted/);
    });
    it('loadLiveSigner has no password parameter: its only inputs are the keystore path and the prompt', () => {
        expect(loadLiveSigner.length).toBe(1); // (userKey, prompt = hidden TTY prompt)
    });
});

describe('loadLiveSigner', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('returns the keystore account; a key in an env var is ignored', async () => {
        process.env.PRIVATE_KEY = bytesToHex(randomBytes(32));
        process.env.SP550_TEST_LEAKED_KEY = bytesToHex(randomBytes(32));
        const f = tmp(scryptKeystore(KEY, PASSWORD));
        const a = await loadLiveSigner({ keystore: f }, async () => PASSWORD);
        expect(a.address).toBe(privateKeyToAccount(KEY).address);
    });
    it('the prompt names the declared address, not the key', async () => {
        let question = '';
        await loadLiveSigner({ keystore: tmp(scryptKeystore(KEY, PASSWORD)) }, async (q) => { question = q; return PASSWORD; });
        expect(question).toContain(privateKeyToAccount(KEY).address);
        expect(leaks(question)).toEqual([]);
    });
    it('neither key nor password reaches any output or the thrown error on a wrong password', async () => {
        const { out, error } = await captured(() => loadLiveSigner({ keystore: tmp(scryptKeystore(KEY, PASSWORD)) }, async () => PASSWORD + '!'));
        const err = error as any;
        expect(err?.message).toMatch(/wrong password/);
        expect(leaks(out + String(err?.message) + String(err?.stack))).toEqual([]);
    });
    it('a key that does not match the declared address is refused', async () => {
        const ks = { ...scryptKeystore(KEY, PASSWORD), address: '11'.repeat(20) };
        await expect(loadLiveSigner({ keystore: tmp(ks) }, async () => PASSWORD)).rejects.toThrow(/does not match the address/);
    });
});

describe('sp550-live-e2e.ts live mode refuses a key from an env var (exit 2, nothing printed)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('userKey { env } with the key set in that env var exits 2 and the key never appears in output', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        const cfg = path.join(dir, 'run.json');
        fs.writeFileSync(cfg, JSON.stringify({
            network: 'sepolia', mode: 'live', rpcUrls: ['https://rpc.invalid'], bundlerUrl: 'https://bundler.invalid',
            operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20), userKey: { env: 'SP550_TEST_LEAKED_KEY' },
        }));
        let status = 0, output = '';
        try {
            output = execFileSync('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg, '--live-go', 'sepolia'], {
                env: { ...process.env, SP550_TEST_LEAKED_KEY: KEY }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e: any) { status = e.status; output = String(e.stdout) + String(e.stderr); }
        expect(status).toBe(2);
        expect(output).toMatch(/refusing field\(s\) "env"/);
        expect(leaks(output)).toEqual([]);
    }, 60_000);
});

describe('sp550-live-e2e.ts live mode refuses the fork-only switches (exit 2, before any network read)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const run = (extra: Record<string, unknown>, flags: string[]) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        const cfg = path.join(dir, 'run.json');
        fs.writeFileSync(cfg, JSON.stringify({
            network: 'sepolia', mode: 'live', rpcUrls: ['https://rpc.invalid'], bundlerUrl: 'https://bundler.invalid',
            operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20), userKey: { keystore: path.join(dir, 'absent.json') }, ...extra,
        }));
        try {
            const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg, '--live-go', 'sepolia', '--live-signer', '0x' + '33'.repeat(20), ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            return { status: 0, output: out };
        } catch (e: any) { return { status: e.status as number, output: String(e.stdout) + String(e.stderr) }; }
    };
    it('gate.switchBook in a live config is refused, even with --live-go and --fork-setup passed', () => {
        const r = run({ gate: { switchBook: true } }, ['--fork-setup']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: --fork-setup impersonates accounts: mode fork only/); // checked first; switchBook alone is the next test
        expect(r.output).not.toMatch(/cutover gate|fork-only SDK book switch/);
    }, 60_000);
    it('gate.deployLiveConfig in a live config is refused (fork-only: a live run is held to the gate and the pins)', () => {
        const r = run({ gate: { deployLiveConfig: 'config.json' } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: gate.deployLiveConfig is fork-only/);
    }, 60_000);
    it('a live run whose --live-signer differs from config.expectSigner is refused (Codex r2 H2)', () => {
        const r = run({ expectSigner: '0x' + '44'.repeat(20) }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode live: --live-signer and config.expectSigner name different addresses/);
    }, 60_000);
    it('a live run without config.expectSigner, or gated at a historical block, is refused (Codex H4 / H3)', () => {
        expect(run({}, []).output).toMatch(/refused: mode live: config.expectSigner \(the author's signer address\) is required/);
        const r = run({ expectSigner: '0x' + '33'.repeat(20), gate: { block: 12345 } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode live: gate.block must be "finalized"/);
    }, 60_000);
    it('a live run whose signer is not in the committed approved table for the chain is refused, before any key is loaded (Daybreak H1)', () => {
        const r = run({ expectSigner: '0x' + '33'.repeat(20) }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode live: 0x3333333333333333333333333333333333333333 is not an approved signer for chain 11155111/);
        expect(r.output).not.toMatch(/keystore password/);
    }, 60_000);
    it('gate.switchBook alone in a live config is refused', () => {
        const r = run({ gate: { switchBook: true } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: gate\.switchBook is fork-only/);
        expect(r.output).not.toMatch(/fork-only SDK book switch/);
    }, 60_000);
    it('gate.pinsFile in a live config is refused (live is held to the shipped pins)', () => {
        const r = run({ gate: { pinsFile: 'docs/sp550-cutover/fork-rehearsal/pins.fork.json' } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: gate\.pinsFile is fork-only/);
    }, 60_000);
    it('the retired gate.bookOverrides is refused in any mode', () => {
        const r = run({ mode: 'fork', rpcUrls: ['http://127.0.0.1:9'], bundlerUrl: 'self', userKey: { anvilIndex: 3 }, gate: { bookOverrides: { aPNTs: '0x' + '33'.repeat(20) } } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: gate\.bookOverrides is gone/);
    }, 60_000);
    it('--fork-setup alone in live mode is refused', () => {
        const r = run({}, ['--fork-setup']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: --fork-setup impersonates accounts: mode fork only/);
    }, 60_000);
});

describe('sp550-live-e2e.ts usage refusals (exit 2 with the usage-stage message)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const run = (cfgOver: Record<string, unknown>, flags: string[]) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        const cfg = path.join(dir, 'run.json');
        fs.writeFileSync(cfg, JSON.stringify({
            network: 'sepolia', mode: 'live', rpcUrls: ['https://rpc.invalid'], bundlerUrl: 'https://bundler.invalid',
            operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20), userKey: { keystore: path.join(dir, 'absent.json') }, ...cfgOver,
        }));
        try {
            const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg, ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            return { status: 0, output: out };
        } catch (e: any) { return { status: e.status as number, output: String(e.stdout) + String(e.stderr) }; }
    };
    const fork = { mode: 'fork', rpcUrls: ['http://127.0.0.1:9'], bundlerUrl: 'self', userKey: { anvilIndex: 3 },
        c12Caps: { maxGas: '1500000', maxFeePerGasWei: '5000000000' }, expectGasParams: { minPostOpGas: '500000', settleGasBound: '450000', cWrap: '5000', cPostop: '450000' } };
    it('live mode without --live-go is refused', () => {
        const r = run({}, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode live sends real ops: pass --live-go sepolia/);
    }, 60_000);
    it('live mode with --live-go naming another network is refused', () => {
        const r = run({}, ['--live-go', 'op-sepolia']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode live sends real ops: pass --live-go sepolia/);
    }, 60_000);
    it('fork mode with a non-loopback RPC is refused', () => {
        const r = run({ ...fork, rpcUrls: ['https://rpc.invalid'] }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode fork: every RPC must be loopback \(a non-loopback anvil fork is accepted only with gate.deployLiveConfig\)/);
    }, 60_000);
    it('fork mode with a non-loopback bundler is refused', () => {
        // Any configured bundler, loopback or not, is refused: the fork run starts its own, bound to the fork (Codex r2 H1).
        for (const bundlerUrl of ['https://bundler.invalid', 'http://127.0.0.1:4337']) {
            const r = run({ ...fork, bundlerUrl }, []);
            expect(r.status).toBe(2);
            expect(r.output).toMatch(/refused: mode fork: bundlerUrl must be "self"/);
        }
    }, 60_000);
    it('gate.deployLiveConfig and taskPlan + taskToken are refused where they do not belong (before any network read)', () => {
        expect(run({ ...fork, gate: { deployLiveConfig: 'c.json', pinsFile: 'p.json' } }, []).output).toMatch(/refused: gate.deployLiveConfig replaces gate.pinsFile/);
        expect(run({ ...fork, taskPlan: { file: 'x', sha256: '0'.repeat(64) }, taskToken: '0x' + '11'.repeat(20) }, []).output).toMatch(/refused: taskPlan and taskToken/);
    }, 60_000);
    it('--preflight with --fork-setup is refused (preflight reads only; Codex M12)', () => {
        const r = run(fork, ['--preflight', '--fork-setup']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: --preflight reads only; run --fork-setup as its own step/);
    }, 60_000);
    it('fork mode with a loopback RPC that is not anvil is refused before any op (Codex H1)', async () => {
        const http = await import('http');
        const srv = http.createServer((req, res) => {
            let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
                const { id, method } = JSON.parse(body || '{}');
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(method === 'web3_clientVersion' ? { jsonrpc: '2.0', id, result: 'Geth/v1.14.0' } : method === 'eth_chainId' ? { jsonrpc: '2.0', id, result: '0xaa36a7' } : { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }));
            });
        });
        await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
        try {
            const port = (srv.address() as any).port;
            const { spawn } = await import('child_process');
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
            const cfg = path.join(dir, 'run.json');
            fs.writeFileSync(cfg, JSON.stringify({ network: 'sepolia', operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20), ...fork, rpcUrls: [`http://127.0.0.1:${port}`] }));
            // async spawn: the in-process fake RPC must keep answering while the script runs.
            const r = await new Promise<{ status: number; output: string }>((ok) => {
                const ch = spawn('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg], { stdio: ['ignore', 'pipe', 'pipe'] });
                let out = ''; ch.stdout.on('data', (d) => { out += d; }); ch.stderr.on('data', (d) => { out += d; });
                ch.on('close', (code) => ok({ status: code ?? -1, output: out }));
            });
            expect(r.status).toBe(2);
            expect(r.output).toMatch(/refused: mode fork: 127\.0\.0\.1:\d+ does not prove it is anvil \(client Geth/);
        } finally { await new Promise<void>((ok) => srv.close(() => ok())); }
    }, 60_000);
    it('fork mode with a key other than { anvilIndex } is refused', () => {
        const r = run({ ...fork, userKey: { keystore: 'k.json' } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: mode fork: userKey must be \{ anvilIndex \}/);
    }, 60_000);
});

describe('public development keys are recognised (a live run refuses to sign with one)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('the anvil / hardhat mnemonic accounts are public; a random key is not', async () => {
        const { isPublicTestAccount } = await import('./sp550-live-signer.js');
        expect(await isPublicTestAccount('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(true);  // index 0
        expect(await isPublicTestAccount('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(true);  // index 1: the rehearsal owner
        expect(await isPublicTestAccount(privateKeyToAccount(bytesToHex(randomBytes(32))).address)).toBe(false);
        expect(await isPublicTestAccount('0x2435BfEfe5225Ce043f26449d6c3FE42248CF3aB')).toBe(true); // the repo keystore fixture
        expect(await isPublicTestAccount(privateKeyToAccount(KEY).address)).toBe(true); // this file's throwaway KEY
        expect(await isPublicTestAccount(SPEC_ADDRESS)).toBe(true); // the PBKDF2 test vector
        expect(await isPublicTestAccount(mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 150 }).address)).toBe(true);
        expect(await isPublicTestAccount(mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 200 }).address)).toBe(true); // Codex r3 H3
        expect(await isPublicTestAccount(mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 9_999 }).address)).toBe(true);
    });
});

describe('approved live signers (Daybreak H1): the committed table, not a key scan, is the guarantee', () => {
    it('the anvil / hardhat mnemonic account at index 10,000 (past the scan) is not approved on Sepolia', async () => {
        const { mnemonicToAccount } = await import('viem/accounts');
        const a = mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 10_000 }).address;
        expect(await isPublicTestAccount(a)).toBe(false); // the scan alone would let it through
        expect(liveSignerApprovalProblem(11155111, a)).toMatch(/is not an approved signer for chain 11155111/);
    }, 60_000);
    it('any address outside the table is refused, a listed one passes, and a chain without entries refuses everyone', () => {
        expect(liveSignerApprovalProblem(11155111, '0x' + '12'.repeat(20))).toMatch(/not an approved signer/);
        expect(liveSignerApprovalProblem(11155111, SP550_LIVE_APPROVED_SIGNERS[11155111][0].toLowerCase())).toBeUndefined();
        expect(liveSignerApprovalProblem(10, SP550_LIVE_APPROVED_SIGNERS[11155111][0])).toMatch(/no approved signer for chain 10/);
        expect(liveSignerApprovalProblem(11155111, '0x' + '12'.repeat(20), { 11155111: [] })).toMatch(/no approved signer/);
    });
    it('the table is frozen: a run cannot add to it', () => {
        expect(Object.isFrozen(SP550_LIVE_APPROVED_SIGNERS)).toBe(true);
        expect(Object.isFrozen(SP550_LIVE_APPROVED_SIGNERS[11155111])).toBe(true);
    });
});

describe('sp550-live-e2e.ts config: the release gasParams tuple and C12 caps are required before any network read (Daybreak M1 / M2)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const run = (extra: Record<string, unknown>) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        const cfg = path.join(dir, 'run.json');
        fs.writeFileSync(cfg, JSON.stringify({
            network: 'sepolia', mode: 'fork', rpcUrls: ['http://127.0.0.1:9'], bundlerUrl: 'self', userKey: { anvilIndex: 3 },
            operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20),
            c12Caps: { maxGas: '1500000', maxFeePerGasWei: '5000000000' },
            expectGasParams: { minPostOpGas: '500000', settleGasBound: '450000', cWrap: '5000', cPostop: '450000' }, ...extra,
        }));
        try {
            const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            return { status: 0, output: out };
        } catch (e: any) { return { status: e.status as number, output: String(e.stdout) + String(e.stderr) }; }
    };
    it('the retired expectMinPostOpGas is refused', () => {
        const r = run({ expectMinPostOpGas: '500000' });
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: expectMinPostOpGas is replaced by expectGasParams/);
    }, 60_000);
    it('a gasParams tuple missing a field, or with an unknown one, is refused', () => {
        expect(run({ expectGasParams: { minPostOpGas: '500000', settleGasBound: '450000', cWrap: '5000' } }).output).toMatch(/refused: expectGasParams must give exactly/);
        expect(run({ expectGasParams: { minPostOpGas: '500000', settleGasBound: '450000', cWrap: '5000', cPostop: '450000', x: '1' } }).output).toMatch(/refused: expectGasParams must give exactly/);
    }, 60_000);
    it('C12 caps are required positive decimal strings', () => {
        expect(run({ c12Caps: undefined }).output).toMatch(/refused: c12Caps\.maxGas must be a positive decimal string/);
        expect(run({ c12Caps: { maxGas: '1500000', maxFeePerGasWei: 5 } }).output).toMatch(/refused: c12Caps\.maxFeePerGasWei must be a positive decimal string/);
    }, 60_000);
});

describe('fork source behind the loopback forwarder (Daybreak M3): no child argv, env or log carries the URL', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('upstream-proxy.sh unsets SP550_FORK_URL, the proxy forwards JSON-RPC, and the secret is in no argv / env / log', async () => {
        const http = await import('node:http');
        const up = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => res.end(JSON.stringify({ jsonrpc: '2.0', id: JSON.parse(b).id, result: '0xaa36a7' }))); });
        await new Promise<void>((ok) => up.listen(0, '127.0.0.1', () => ok()));
        const upPort = (up.address() as any).port;
        const SECRET = 'SECRETKEY' + Date.now();
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-'));
        const port = 29000 + Math.floor(Math.random() * 900);
        // The helper as the scripts use it, with the test-only loopback switch for the fake upstream.
        const script = `set -e
. scripts/sp550-fork/upstream-proxy.sh
start_upstream_proxy() { local port="$1" out="$2" url; url="\${SP550_FORK_URL}"; unset SP550_FORK_URL FORK_URL
  printf '%s\\n' "$url" | node scripts/sp550-fork/upstream-proxy.mjs "$port" --test-loopback-upstream > "$out/upstream-proxy.log" 2>&1 &
  echo $! > "$out/upstream-proxy.pid"; url=''
  for _ in $(seq 1 30); do grep -q "^READY $port\\$" "$out/upstream-proxy.log" 2>/dev/null && break; sleep 0.5; done; UPSTREAM="http://127.0.0.1:$port"; }
start_upstream_proxy ${port} "${dir}"
echo "ENV_AFTER=[\${SP550_FORK_URL:-}]"
echo "CHILD_ENV=[$(env | grep -c SP550_FORK_URL || true)]"
curl -s -X POST "$UPSTREAM" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":7,"method":"eth_chainId","params":[]}'; echo
ps -o command= -p "$(cat "${dir}/upstream-proxy.pid")"
kill "$(cat "${dir}/upstream-proxy.pid")"`;
        // The real helper's body must match the inlined one apart from the test switch (it is the code under test).
        const helper = fs.readFileSync('scripts/sp550-fork/upstream-proxy.sh', 'utf8');
        expect(helper).toMatch(/unset SP550_FORK_URL FORK_URL/);
        expect(helper).toMatch(/printf '%s\\n' "\$url" \| node "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/upstream-proxy\.mjs" "\$port"/);
        // async: the fake upstream lives in this process and must keep answering while the shell runs.
        const { spawn } = await import('node:child_process');
        const out = await new Promise<string>((ok, no) => {
            const ch = spawn('bash', ['-c', script], { env: { ...process.env, SP550_FORK_URL: `http://127.0.0.1:${upPort}/v2/${SECRET}` }, stdio: ['ignore', 'pipe', 'pipe'] });
            let o = ''; ch.stdout.on('data', (d) => (o += d)); ch.stderr.on('data', (d) => (o += d));
            ch.on('close', (code) => (code === 0 ? ok(o) : no(new Error(`exit ${code}: ${o}`))));
        });
        up.close();
        expect(out).toContain('ENV_AFTER=[]');
        expect(out).toContain('CHILD_ENV=[0]');
        expect(out).toMatch(/"id":7,"result":"0xaa36a7"/);
        expect(out).not.toContain(SECRET); // the proxy's argv (ps) included
        expect(fs.readFileSync(path.join(dir, 'upstream-proxy.log'), 'utf8')).not.toContain(SECRET);
    }, 60_000);
    it('a failing upstream answers 502 without the URL, and a loopback upstream is refused without the test switch', async () => {
        const SECRET = 'SECRETKEY' + Date.now();
        const port = 29900 + Math.floor(Math.random() * 90);
        const { spawn } = await import('node:child_process');
        const p = spawn('node', ['scripts/sp550-fork/upstream-proxy.mjs', String(port), '--test-loopback-upstream'], { stdio: ['pipe', 'pipe', 'pipe'] });
        let log = ''; p.stdout.on('data', (c) => (log += c)); p.stderr.on('data', (c) => (log += c));
        p.stdin.end(`http://127.0.0.1:1/v2/${SECRET}\n`);
        for (let i = 0; i < 40 && !log.includes('READY'); i++) await new Promise((ok) => setTimeout(ok, 100));
        const r = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' });
        const body = await r.text();
        p.kill();
        expect(r.status).toBe(502);
        expect(body + log).not.toContain(SECRET);
        const refused = (() => { try { execFileSync('node', ['scripts/sp550-fork/upstream-proxy.mjs', String(port + 1)], { input: 'http://127.0.0.1:8545\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); return ''; } catch (e: any) { return String(e.stderr); } })();
        expect(refused).toMatch(/loopback address/);
    }, 60_000);
});
