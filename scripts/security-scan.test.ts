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
 * private/secret/mnemonic/seed ANYWHERE on the line refuses it outright — and this file exists to
 * prove the veto works, because the alternative is a scanner that reports clean because it stopped looking.
 *
 * A file allowlist was rejected for the same reason: it would mute whole directories that also
 * carry real evidence. Keying on the marker means a genuine private key dropped into one of those
 * very files is still caught — which the last case below demonstrates.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCANNER = join(process.cwd(), 'scripts/security-scan.ts');

/**
 * FU-48. Launch `tsx` directly instead of via `npx`. Measured on this machine, scanning a
 * one-file directory:
 *
 *   npx tsx …                    833ms / 628ms
 *   ./node_modules/.bin/tsx …    239ms / 251ms
 *
 * i.e. **`npx`'s own resolution is 60–70% of every spawn here**, and this file spawns ~30 times.
 * That is the whole optimisation: nothing about the scanner or the assertions changes.
 *
 * WHY NOT THE BIGGER REWRITE. The obvious fix was to batch every probe into one directory and
 * scan once. It would be faster still — but it means restructuring all ~30 probe bodies, and the
 * risk of a case silently disappearing in that restructure is not worth the extra second on a
 * suite that is already fast enough after this one line. Measured first, then took the cheap half.
 *
 * WHAT THIS DOES NOT CHANGE: `npx tsx` resolves to this same local binary, so the code executed is
 * identical — only the launcher differs. The subject here is the scanner's logic, not npx. The
 * fallback keeps the suite runnable where the local bin is absent (a checkout without install).
 */
const TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const [LAUNCHER, LAUNCH_ARGS] = existsSync(TSX_BIN) ? [TSX_BIN, []] : ['npx', ['tsx']];

/** Run the scanner over one throwaway file; true when it reports a leak. */
function flags(content: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'secscan-'));
  const file = join(dir, 'probe.md');
  writeFileSync(file, content);
  try {
    const out = execFileSync(LAUNCHER, [...LAUNCH_ARGS, SCANNER, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

/**
 * FU-30's code half. Every test here spawns the scanner at least once, and vitest's default timeout
 * is 5s — so these tests can fail for a reason that has nothing to do with what they assert. That
 * matters more than usual here: **a timeout red and an assertion red are the same `× test name`
 * line**, so a run that fails on machine load reads exactly like the scanner having a hole. #339 lost
 * time to precisely that, and the rule was written down then while the code was left at the default.
 *
 * Note what was already here: ONE test carried `{timeout: 30_000}` — the one that had already hurt.
 * So the state this replaces was not "nobody did it", it was **local painkiller on the case that
 * hurt, while the generalisation went into the docs and never came back for its siblings**. That is
 * the sharper statement, and the one FU-47 records.
 *
 * MEASURED, AND RE-MEASURED AFTER FU-48 (2026-09-05). Leaving the old numbers here would have
 * reproduced exactly the staleness #364 was opened to fix, so both readings are kept:
 *
 *                                        before (npx)   after (direct tsx)
 *   veto-distance (12 spawns)                 9.6s            2.64s
 *   every-term-is-a-veto (4 spawns)           3.2s            0.90s
 *   the remaining twelve                     ~0.8s           ~0.22s each
 *   whole file                                 24s            6.8s
 *
 * The 30s stays anyway, and the reason is not the local numbers. Local margins UNDERSTATE the risk:
 * before FU-48 the first test measured 892ms here and **6607ms on CI — 7.4x** — and it is the one
 * that actually went red on CI. FU-48 removes ~70% of each spawn, not the variance that produced
 * that 7.4x. Keeping the headroom costs a slow failure in the worst case; shrinking it buys nothing
 * and risks a failure that lies about why.
 */
const SPAWN_TIMEOUT_MS = 30_000;

describe('secrets are still caught (the exemption is narrow)', { timeout: SPAWN_TIMEOUT_MS }, () => {
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

  // ── the OTHER axis: distance ──────────────────────────────────────────────────────────────
  //
  // The loop above enumerates one coordinate (which detection term) and holds the other fixed. The
  // seam between the two rules has two coordinates, and the second one is how FAR each word sits
  // from the value. While the veto and the marker shared one 40-char window, evicting the veto word
  // past that edge while leaving a marker inside walked through — twice, in prose that reads
  // completely ordinary for an evidence file:
  //
  //   `deployerPk backup, see the guardian coordinate keyX = 0x…`
  //   `the private key … is stored elsewhere; pubkey = 0x…`
  //
  // So enumerate distance too: every veto term, once adjacent and once pushed beyond the marker
  // window. Both must be caught, which is only true because the veto now reads the whole line.
  // 30s: this case spawns the scanner 12 times and blew the 5s default. Worth naming because the
  // timeout FAILED THE TEST while looking like a detection failure — a red for the wrong reason is
  // as misleading as a green for the wrong reason.
  it('BYPASS CLASS: a veto word far from the value still vetoes (distance is the second axis)', { timeout: 30_000 }, () => {
    const FAR = 'x'.repeat(60); // longer than CONTEXT_BEFORE, so the veto word lands outside it
    for (const word of ['private key', 'secret', 'mnemonic', 'seed phrase', 'privkey', 'signing key']) {
      expect(flags(`${word} ${HEX('1')}`), `"${word}" adjacent`).toBe(true);
      expect(
        flags(`${word} is stored elsewhere ${FAR}; pubkey = ${HEX('2')}`),
        `"${word}" pushed outside the marker window — the veto must still see it`,
      ).toBe(true);
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

describe('public-by-definition data no longer blocks (the six real false positives)', { timeout: SPAWN_TIMEOUT_MS }, () => {
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
