/**
 * The password pre-processing EIP-2335 actually specifies.
 *
 * These cases pin the SHAPE of the candidate list and nothing more. The case that actually matters —
 * building a compliant keystore and decrypting it with the password a human pastes in — lives in
 * `scripts/eip2335-keystore.test.ts` instead, because it needs `node:crypto` and this package is
 * compiled under a pinned `@types/node@20.11.5` where `Buffer` does not satisfy `BinaryLike`.
 * `packages/core/tsconfig.json` has `include: ["src"]`, so every `*.test.ts` here goes through the
 * package build; a crypto test placed here breaks `pnpm -r build`, and bumping the pinned types for
 * one test would be a repo-wide change made for a local convenience.
 */
import { describe, expect, it } from 'vitest';
import { eip2335PasswordCandidates } from './eip2335-password.js';

describe('eip2335PasswordCandidates', () => {
  it('a plain ASCII password yields exactly one candidate', () => {
    // The common case must not pay for this fix. Three identical strings would mean three KDF runs,
    // and with scrypt at keystore parameters that is seconds of wall clock per attempt.
    expect(eip2335PasswordCandidates('hunter2')).toEqual(['hunter2']);
  });

  it('strips C0, Delete and C1 — the three ranges the spec names', () => {
    // One representative from each range, so a partial regex fails here rather than in the field.
    const cases: [string, string, string][] = [
      ['C0 tab', 'ab\tcd', 'abcd'],
      ['C0 carriage return', 'ab\rcd', 'abcd'],
      ['Delete', 'ab\u007Fcd', 'abcd'],
      ['C1', 'ab\u0085cd', 'abcd'],
    ];
    for (const [label, raw, stripped] of cases) {
      expect(eip2335PasswordCandidates(raw)[0], `${label} must be stripped in the first candidate`).toBe(stripped);
    }
  });

  it('the spec-correct form comes first, and the older behaviour is still offered', () => {
    // Order is not cosmetic: it decides how much scrypt runs before the right form is reached.
    // Keeping the NFKD-only form is what stops this from breaking keystores that already decrypt —
    // written by encryptors that skipped the stripping step.
    const c = eip2335PasswordCandidates('a\tb');
    expect(c[0]).toBe('ab');
    expect(c).toContain('a\tb');
  });

  it('NFKD normalisation still happens', () => {
    // U+FB01 (ﬁ ligature) decomposes to "fi" — proves step 1 was not dropped while adding step 2.
    expect(eip2335PasswordCandidates('ﬁle')[0]).toBe('file');
  });

  it('never returns an empty list, even for an all-control password', () => {
    // Stripping can empty a string. If that were the only candidate the caller would KDF over "" and
    // report a checksum mismatch with no way to tell that from a genuinely wrong password.
    const c = eip2335PasswordCandidates('\u0001\u0002');
    expect(c.length).toBeGreaterThan(0);
    expect(c).toContain('\u0001\u0002');
  });
});
