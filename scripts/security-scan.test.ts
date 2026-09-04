/**
 * The secret scanner's public-data exemption must not become a bypass.
 *
 * FU-4 narrowed the scanner so it stops blocking on P-256 public-key coordinates and tx hashes —
 * six files were flagged, every one of them public-by-definition data sitting next to the word
 * "Key" (`keyX = 0x…`, `getGuardianP256Key(0).x = 0x…`, `setP256Key tx 0x…`). With those firing,
 * the pre-commit hook could never be turned on: it would have blocked every commit forever, which
 * is why FU-3 (rewiring `core.hooksPath`) was gated behind this.
 *
 * The danger in any such narrowing is obvious: an exemption keyed on "the line mentions a public
 * key" is one `privateKeyX = 0x…` away from being a hole. So the exemption carries a veto —
 * private/secret/mnemonic/seed on the line refuses it outright — and this file exists to prove the
 * veto works, because the alternative is a scanner that reports clean because it stopped looking.
 *
 * A file allowlist was rejected for the same reason: it would mute whole directories that also
 * carry real evidence. Keying on the marker means a genuine private key dropped into one of those
 * very files is still caught — which the last case below demonstrates.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCANNER = join(process.cwd(), 'scripts/security-scan.ts');

/** Run the scanner over one throwaway file; true when it reports a leak. */
function flags(content: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'secscan-'));
  const file = join(dir, 'probe.md');
  writeFileSync(file, content);
  try {
    const out = execFileSync('npx', ['tsx', SCANNER, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return /CRITICAL/.test(out);
  } catch (error) {
    // Non-zero exit is how the scanner reports a leak; read its output rather than the code.
    const e = error as { stdout?: string };
    return /CRITICAL/.test(e.stdout ?? '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const HEX = (n: string) => `0x${n.repeat(64).slice(0, 64)}`;

describe('secrets are still caught (the exemption is narrow)', () => {
  // Each of these carries a public-data marker AND a secret word. The veto must win — otherwise
  // the FU-4 narrowing is a hole rather than a filter.
  it('privateKeyX — a coordinate-looking name on an actual private key', () => {
    expect(flags(`privateKeyX = ${HEX('1')}`)).toBe(true);
  });

  it('a passkey line that also says "private key"', () => {
    expect(flags(`my passkey private key ${HEX('3')}`)).toBe(true);
  });

  it('plain secret key', () => {
    expect(flags(`secret key: ${HEX('2')}`)).toBe(true);
  });

  it('deployer pk', () => {
    expect(flags(`deployer pk ${HEX('4')}`)).toBe(true);
  });

  // ── the class my first five cases missed ──────────────────────────────────────────────────
  //
  // Those five were all "secret word + public marker", so they only ever exercised veto terms the
  // veto already knew. The detection regex is `(key|secret|pk|private)` with no word boundary; the
  // veto was narrower. Anything detection recognises but the veto does not, paired with a public
  // marker, walked straight through — and no test could see it, because the tests had the same
  // blind spot as the code. (Found in review, not by me.)
  it('BYPASS CLASS: `pk` — recognised by detection, once unknown to the veto', () => {
    expect(flags(`deployerPk = ${HEX('1')}  // funded via tx ${HEX('2')}`)).toBe(true);
  });

  it('BYPASS CLASS: `signing key` — same shape, different term', () => {
    expect(flags(`signing key ${HEX('3')} for the passkey flow`)).toBe(true);
  });

  it('every detection term is also a veto term (the asymmetry IS the hole)', () => {
    // A structural check rather than another example: pair each word the detector reacts to with a
    // public marker and require a hit. New detection terms added later without a matching veto term
    // fail here instead of quietly opening the next hole.
    for (const word of ['key', 'secret', 'pk', 'private']) {
      expect(flags(`my ${word} ${HEX('7')} // see tx ${HEX('8')}`), `detection term "${word}" escaped`).toBe(true);
    }
  });

  it('a real private key inside a file that ALSO contains exempt public data', () => {
    // The case a file-level allowlist would have missed entirely, and the reason this exemption is
    // keyed on the line rather than the path.
    expect(
      flags(`| p256 passkey x | \`${HEX('a')}\` |\nprivate key = ${HEX('b')}\n`),
    ).toBe(true);
  });
});

describe('public-by-definition data no longer blocks (the six real false positives)', () => {
  // Transcribed from the lines that were actually flagging, so this file fails if the exemption
  // regresses rather than merely if some invented example stops matching.
  it('keyX / keyY coordinates', () => {
    expect(flags(`- \`keyX\` = \`${HEX('5')}\`\n- \`keyY\` = \`${HEX('6')}\``)).toBe(false);
  });

  it('getGuardianP256Key(0).x accessor form', () => {
    expect(flags(`- getGuardianP256Key(0).x = ${HEX('7')}`)).toBe(false);
  });

  it('P-256 guardian pubkey x=/y= form', () => {
    expect(flags(`- **P-256 guardian pubkey:** x=\`${HEX('8')}\` y=\`${HEX('9')}\``)).toBe(false);
  });

  it('markdown-table passkey coordinate', () => {
    expect(flags(`| p256 passkey x | \`${HEX('c')}\` |`)).toBe(false);
  });

  it('setP256Key tx hash', () => {
    expect(flags(`setP256Key tx \`${HEX('d')}\`; validateUserOp(0x05)==0`)).toBe(false);
  });
});
