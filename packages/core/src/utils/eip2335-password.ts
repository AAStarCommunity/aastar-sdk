/**
 * EIP-2335 keystore password pre-processing.
 *
 * The spec does not hash the password you typed. It hashes a *processed* form, and names two steps:
 *
 *   1. NFKD normalisation
 *   2. stripping the C0, C1 and Delete control codes
 *
 * The SDK's keystore decrypt did step 1 only, while its comment claimed both — so a compliant
 * keystore whose password contains a control character (a stray tab from a copy-paste, a `\r` that
 * survived a Windows-authored env file) failed its checksum and reported "wrong secret". The
 * failure is fail-closed, never a wrong key, which is why this was filed as a follow-up rather than
 * a defect: the cost is a confident, misleading error message on a password that is in fact correct.
 *
 * WHY A LIST OF CANDIDATES RATHER THAN ONE ANSWER
 * -----------------------------------------------
 * Encryptors disagree in practice. A keystore produced by a tool that skipped the stripping step is
 * still a file people hold, and refusing it in the name of the spec would break decryption that
 * works today. The checksum is what decides — it can only accept the form the encryptor actually
 * used — so offering several forms cannot select a wrong key; it can only turn a spurious failure
 * into a success. What it does cost is KDF work per candidate, and scrypt is deliberately expensive,
 * hence the ordering and the dedup below.
 *
 * ORDER: spec-correct first, then the looser forms. Every candidate that survives the checksum is
 * equally valid, so order is purely about doing the least scrypt work in the common case.
 */

/** C0 (U+0000–U+001F), Delete (U+007F), and C1 (U+0080–U+009F) — exactly what EIP-2335 names. */
const CONTROL_CODES = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * The password forms to try against a keystore checksum, most spec-correct first and deduplicated.
 *
 * For a plain ASCII password with no control characters — the overwhelmingly common case — all
 * three forms are identical and this returns a single candidate, so the fix costs nothing there.
 */
export function eip2335PasswordCandidates(password: string): string[] {
  const nfkd = password.normalize('NFKD');
  const ordered = [
    nfkd.replace(CONTROL_CODES, ''), // 1. the spec: normalise, then strip
    nfkd, // 2. normalised only — what this SDK used to do, and what some encryptors do
    password, // 3. raw — for encryptors that skipped processing entirely
  ];
  // Dedup while keeping order. Without this, an ASCII password would run the KDF three times over
  // three identical strings; with scrypt at the parameters keystores actually use, that is seconds.
  return [...new Set(ordered)];
}
