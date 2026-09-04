/**
 * EIP-2335 password handling, proved end-to-end against a keystore this file builds.
 *
 * WHY IT LIVES IN scripts/ RATHER THAN NEXT TO THE CODE
 * ----------------------------------------------------
 * `packages/core/tsconfig.json` compiles everything under `src`, `*.test.ts` included, against a
 * repo-wide pinned `@types/node@20.11.5` under which `Buffer` does not satisfy `BinaryLike` — so a
 * `node:crypto` test placed beside the util breaks `pnpm -r build`. `scripts/` is covered by the
 * root vitest run but belongs to no package build, which is also where `security-scan.test.ts` sits.
 *
 * WHY IT EXISTS AT ALL
 * --------------------
 * The unit tests beside the util assert that the stripped form appears in the candidate list. Any
 * function that appends a string satisfies that. This one asserts the KEY COMES BACK: it encrypts
 * under the stripped password, the way a spec-following encryptor does, and decrypts with the
 * unstripped password a human holds. Before the fix that path fails its checksum and reports
 * "wrong secret" about a secret that is correct.
 */
import { describe, expect, it } from 'vitest';
import { pbkdf2Sync, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { eip2335PasswordCandidates } from '../packages/core/src/utils/eip2335-password.js';

// A miniature EIP-2335 v4 encryptor, matching the decrypt path in
// tests/regression/onchain-evidence/dvt3-register.ts: pbkdf2 → checksum over dk[16:32]‖ciphertext →
// aes-128-ctr under dk[0:16]. pbkdf2 rather than scrypt purely so the test runs in milliseconds; the
// password handling under test is identical for both KDFs.
function makeKeystore(secret: Buffer, encryptUnder: string) {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const dk = pbkdf2Sync(Buffer.from(encryptUnder, 'utf8'), salt, 4096, 32, 'sha256');
  const cipher = createCipheriv('aes-128-ctr', dk.subarray(0, 16), iv);
  const message = Buffer.concat([cipher.update(secret), cipher.final()]);
  return {
    kdf: { function: 'pbkdf2', params: { salt: salt.toString('hex'), c: 4096, dklen: 32, prf: 'hmac-sha256' } },
    checksum: { message: createHash('sha256').update(Buffer.concat([dk.subarray(16, 32), message])).digest('hex') },
    cipher: { message: message.toString('hex'), params: { iv: iv.toString('hex') } },
  };
}

/** The decrypt loop as the script performs it: try each candidate, let the checksum decide. */
function decrypt(ks: ReturnType<typeof makeKeystore>, password: string): string | null {
  for (const pw of eip2335PasswordCandidates(password)) {
    const p = ks.kdf.params;
    const dk = pbkdf2Sync(Buffer.from(pw, 'utf8'), Buffer.from(p.salt, 'hex'), p.c, p.dklen, 'sha256');
    const msg = Buffer.from(ks.cipher.message, 'hex');
    if (createHash('sha256').update(Buffer.concat([dk.subarray(16, 32), msg])).digest('hex') !== ks.checksum.message) continue;
    const d = createDecipheriv('aes-128-ctr', dk.subarray(0, 16), Buffer.from(ks.cipher.params.iv, 'hex'));
    return Buffer.concat([d.update(msg), d.final()]).toString('hex');
  }
  return null;
}

describe('a compliant keystore decrypts with the password a human pastes in', () => {
  const secret = Buffer.from('11'.repeat(32), 'hex');

  it('control character in the password: the key comes back', () => {
    // The encryptor followed the spec and used the STRIPPED form; the human still holds the original.
    // This is the case that failed before the fix, and it failed while insisting the secret was wrong.
    //
    // NOTE the two arguments differ, and that difference IS the test. A first draft encrypted under
    // 'my\tpass' and decrypted with 'my\tpass' — same string both sides, so it passed against the
    // pre-fix code too. Its comment said "the encryptor used the stripped form" while the code did
    // not; the assertion was vacuous and the comment is what hid it. Caught by mutation: reverting
    // to NFKD-only left this green.
    const ks = makeKeystore(secret, 'mypass'); // ← stripped, as a spec-following encryptor writes it
    expect(decrypt(ks, 'my\tpass')).toBe(secret.toString('hex')); // ← what the human pastes
  });

  it('an encryptor that did NOT strip still decrypts (no regression)', () => {
    // The reason the older forms stay in the list. Dropping them to be "spec-pure" would break
    // keystores that work today — the opposite failure, and a worse one, since those are in use.
    const ks = makeKeystore(secret, 'my\tpass'.normalize('NFKD'));
    expect(decrypt(ks, 'my\tpass')).toBe(secret.toString('hex'));
  });

  it('a genuinely wrong password is still rejected', () => {
    // Widening the candidate list must not widen what is ACCEPTED. It cannot — the checksum decides
    // and no candidate can forge it — but that is the property the whole change rests on, so it is
    // asserted rather than argued.
    const ks = makeKeystore(secret, 'correct');
    expect(decrypt(ks, 'wrong')).toBeNull();
  });
});
