/**
 * The live signer for scripts/sp550-live-e2e.ts.
 *
 * The author's standing rule: private keys and keystore passwords never go into files, environment
 * variables, arguments or messages. So live mode has exactly ONE key source — an encrypted JSON
 * keystore (Web3 Secret Storage v3), decrypted in-process with a password the author types at a
 * hidden prompt. There is deliberately no other path: no password parameter, no env var, no file,
 * no non-interactive fallback (a non-TTY stdin is refused).
 *
 * Nothing here prints or throws the password or the key. Decryption failures have one fixed message.
 * viem only (no ethers): scrypt / pbkdf2 / aes-128-ctr from node:crypto, keccak256 from viem.
 */
import { createDecipheriv, pbkdf2Sync, scryptSync, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import { type Hex, type LocalAccount, bytesToHex, getAddress, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** The only accepted live `userKey` shape. */
export type LiveUserKey = { keystore: string };

/**
 * Why a live `userKey` config is not acceptable, or undefined when it is. Names offending FIELDS only,
 * never their values (a value might be a key someone pasted in).
 */
export function liveKeySourceProblem(userKey: unknown): string | undefined {
    if (typeof userKey !== 'object' || userKey === null || Array.isArray(userKey)) {
        return 'mode live: userKey must be { "keystore": "<path to an encrypted JSON keystore>" }';
    }
    const extra = Object.keys(userKey).filter((k) => k !== 'keystore');
    if (extra.length) {
        return `mode live: userKey may only name an encrypted keystore; refusing field(s) ${extra.map((k) => JSON.stringify(k)).join(', ')} ` +
            '(keys and passwords never come from env vars, arguments or files)';
    }
    if (typeof (userKey as any).keystore !== 'string' || !(userKey as any).keystore) {
        return 'mode live: userKey.keystore must be a path to an encrypted JSON keystore';
    }
    return undefined;
}

const DECRYPT_FAILED = 'keystore: wrong password, or not a valid encrypted v3 keystore';

const hexBytes = (h: unknown, what: string): Buffer => {
    if (typeof h !== 'string' || !/^(0x)?([0-9a-fA-F]{2})*$/.test(h)) throw new Error(`keystore: ${what} is not hex`);
    return Buffer.from(h.replace(/^0x/, ''), 'hex');
};

/** Decrypt a Web3 Secret Storage v3 keystore. Throws one fixed message on a wrong password. */
export function decryptKeystoreV3(json: unknown, password: string): Hex {
    const ks = json as any;
    const c = ks?.crypto ?? ks?.Crypto;
    if (ks?.version !== 3 || !c) throw new Error('keystore: not a v3 keystore');
    if (c.cipher !== 'aes-128-ctr') throw new Error(`keystore: unsupported cipher ${String(c.cipher)}`);
    const pw = Buffer.from(password.normalize('NFKD'), 'utf8');
    const kp = c.kdfparams ?? {};
    let dk: Buffer;
    if (c.kdf === 'scrypt') {
        const N = Number(kp.n), r = Number(kp.r), p = Number(kp.p), dklen = Number(kp.dklen);
        if (![N, r, p, dklen].every((x) => Number.isSafeInteger(x) && x > 0) || dklen < 32) throw new Error('keystore: bad scrypt params');
        dk = scryptSync(pw, hexBytes(kp.salt, 'salt'), dklen, { N, r, p, maxmem: 256 * N * r * p + 64 * 1024 * 1024 });
    } else if (c.kdf === 'pbkdf2') {
        if (kp.prf !== 'hmac-sha256') throw new Error(`keystore: unsupported prf ${String(kp.prf)}`);
        const iter = Number(kp.c), dklen = Number(kp.dklen);
        if (!Number.isSafeInteger(iter) || iter <= 0 || !Number.isSafeInteger(dklen) || dklen < 32) throw new Error('keystore: bad pbkdf2 params');
        dk = pbkdf2Sync(pw, hexBytes(kp.salt, 'salt'), iter, dklen, 'sha256');
    } else {
        throw new Error(`keystore: unsupported kdf ${String(c.kdf)}`);
    }
    pw.fill(0);
    const ciphertext = hexBytes(c.ciphertext, 'ciphertext');
    const mac = Buffer.from(keccak256(Buffer.concat([dk.subarray(16, 32), ciphertext])).slice(2), 'hex');
    const expected = hexBytes(c.mac, 'mac');
    if (expected.length !== mac.length || !timingSafeEqual(mac, expected)) { dk.fill(0); throw new Error(DECRYPT_FAILED); }
    const decipher = createDecipheriv('aes-128-ctr', dk.subarray(0, 16), hexBytes(c.cipherparams?.iv, 'iv'));
    const key = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    dk.fill(0);
    if (key.length !== 32) { key.fill(0); throw new Error(DECRYPT_FAILED); }
    const hex = bytesToHex(key);
    key.fill(0);
    return hex;
}

export interface PromptIO {
    input: NodeJS.ReadStream | { isTTY?: boolean; setRawMode?: (b: boolean) => unknown; on: Function; removeListener: Function; resume: Function; pause: Function };
    output: { write: (s: string) => unknown };
}

/**
 * Read a password with no echo from an interactive terminal. A non-TTY input is refused: there is
 * no non-interactive password path, by design.
 */
export function promptHidden(question: string, io: PromptIO = { input: process.stdin, output: process.stderr }): Promise<string> {
    const input = io.input as any;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
        return Promise.reject(new Error('mode live: the keystore password is typed at a hidden prompt, so stdin must be an interactive terminal; there is no non-interactive path'));
    }
    io.output.write(question);
    return new Promise((resolve, reject) => {
        let buf = '';
        const done = (err?: Error) => {
            input.setRawMode(false);
            input.removeListener('data', onData);
            input.pause();
            io.output.write('\n');
            if (err) { buf = ''; reject(err); } else { const v = buf; buf = ''; resolve(v); }
        };
        const onData = (chunk: Buffer | string) => {
            for (const ch of chunk.toString('utf8')) {
                if (ch === '\r' || ch === '\n') return done();
                if (ch === '\u0003' || ch === '\u0004') return done(new Error('aborted at the password prompt'));
                if (ch === '\u007f' || ch === '\b') { buf = buf.slice(0, -1); continue; }
                buf += ch;
            }
        };
        input.setRawMode(true);
        input.resume();
        input.on('data', onData);
    });
}

/**
 * Load the live signer: read the encrypted keystore, prompt for its password, decrypt in-process.
 * `prompt` is injectable for tests only; it defaults to the hidden TTY prompt and takes no password.
 */
export async function loadLiveSigner(
    userKey: LiveUserKey,
    prompt: (question: string) => Promise<string> = (q) => promptHidden(q),
): Promise<LocalAccount> {
    let json: any;
    try { json = JSON.parse(fs.readFileSync(userKey.keystore, 'utf8')); } catch { throw new Error(`keystore: cannot read ${userKey.keystore} as JSON`); }
    const declared = typeof json?.address === 'string' ? getAddress('0x' + json.address.replace(/^0x/, '')) : undefined;
    let password = await prompt(`keystore password for ${declared ?? userKey.keystore}: `);
    let key: Hex;
    try { key = decryptKeystoreV3(json, password); } finally { password = ''; }
    const account = privateKeyToAccount(key);
    key = '0x';
    if (declared && account.address !== declared) throw new Error('keystore: decrypted key does not match the address the keystore declares');
    return account;
}
