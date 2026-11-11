import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { bytesToHex, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptKeystoreV3, liveKeySourceProblem, loadLiveSigner, promptHidden } from './sp550-live-signer.js';

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

afterEach(() => { delete process.env.SP550_TEST_LEAKED_KEY; delete process.env.PRIVATE_KEY; });

describe('keystore v3 decryption', () => {
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

describe('live key source: an encrypted keystore and nothing else', () => {
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

describe('password prompt: interactive only', () => {
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

describe('loadLiveSigner', () => {
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

describe('sp550-live-e2e.ts live mode refuses a key from an env var (exit 2, nothing printed)', () => {
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

describe('sp550-live-e2e.ts live mode refuses the fork-only switches (exit 2, before any network read)', () => {
    const run = (extra: Record<string, unknown>, flags: string[]) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        const cfg = path.join(dir, 'run.json');
        fs.writeFileSync(cfg, JSON.stringify({
            network: 'sepolia', mode: 'live', rpcUrls: ['https://rpc.invalid'], bundlerUrl: 'https://bundler.invalid',
            operator: '0x' + '11'.repeat(20), account: '0x' + '22'.repeat(20), userKey: { keystore: path.join(dir, 'absent.json') }, ...extra,
        }));
        try {
            const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/sp550-live-e2e.ts', '--config', cfg, '--live-go', 'sepolia', ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            return { status: 0, output: out };
        } catch (e: any) { return { status: e.status as number, output: String(e.stdout) + String(e.stderr) }; }
    };
    it('gate.bookOverrides in a live config is refused, even with --live-go and --fork-setup passed', () => {
        const r = run({ gate: { bookOverrides: { aPNTs: '0x' + '33'.repeat(20) } } }, ['--fork-setup']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: (gate\.bookOverrides is fork-only|--fork-setup impersonates accounts)/);
        expect(r.output).not.toMatch(/cutover gate|fork-only SDK book override/);
    }, 60_000);
    it('gate.bookOverrides alone in a live config is refused', () => {
        const r = run({ gate: { bookOverrides: { aPNTs: '0x' + '33'.repeat(20) } } }, []);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: gate\.bookOverrides is fork-only/);
        expect(r.output).not.toMatch(/fork-only SDK book override/);
    }, 60_000);
    it('--fork-setup alone in live mode is refused', () => {
        const r = run({}, ['--fork-setup']);
        expect(r.status).toBe(2);
        expect(r.output).toMatch(/refused: --fork-setup impersonates accounts: mode fork only/);
    }, 60_000);
});
