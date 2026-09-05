/**
 * The whitelist parser, and the line between "verifiable" and "asserted".
 *
 * The audit itself makes no judgement and is not a gate — so what can be tested is the one thing it
 * DOES decide: whether a note lets a third party check the claim. Everything else it prints is a
 * chain reading, and a test that asserted those would be pinning someone else's balance.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseWhitelist } from './audit-secret-whitelist.js';

const entry = (key: string, note: string) => `    '${key}', // ${note}`;
const K = (n: string) => `0x${n.repeat(64).slice(0, 64)}`;

describe('what counts as provenance', () => {
  it('a publicly documented source is self-justifying', () => {
    // Anyone can confirm "Anvil #3" in seconds, from a source outside this repo.
    const [e] = parseWhitelist(entry(K('1'), 'Anvil #3'));
    expect(e.selfJustifying).toBe(true);
  });

  it('"Test Key" is not — it asserts what the key is without letting anyone check', () => {
    // The distinction the whole tool exists for, and the same shape as the remembered path count
    // this repo replaced: a fact that lives only in someone's memory and cannot be re-derived.
    expect(parseWhitelist(entry(K('2'), 'Test Key'))[0].selfJustifying).toBe(false);
    expect(parseWhitelist(entry(K('3'), 'Test/Doc Key'))[0].selfJustifying).toBe(false);
    expect(parseWhitelist(entry(K('4'), 'Dummy Key'))[0].selfJustifying).toBe(false);
  });

  it('recognises the other documented-source spellings', () => {
    for (const note of ['Hardhat #2', 'well-known devnet key', 'Zero Key']) {
      expect(parseWhitelist(entry(K('5'), note))[0].selfJustifying, note).toBe(true);
    }
  });
});

describe('the real whitelist', () => {
  it('parses, and the split is what the report claims', () => {
    // Instrument check: every case above uses synthetic lines, so a change to the whitelist's format
    // would leave them green while the parser stopped recognising anything real.
    const entries = parseWhitelist(readFileSync('scripts/security-scan.ts', 'utf8'));
    expect(entries.length, 'the parser must find the real entries').toBeGreaterThan(15);
    expect(entries.some((e) => e.selfJustifying)).toBe(true);
    expect(entries.some((e) => !e.selfJustifying), 'and the opaque ones this tool was written for').toBe(true);
  });

  it('no private key is ever emitted by the parser consumer surface', () => {
    // The keys stay in the returned objects because deriving an address needs them; what must never
    // happen is one reaching output. Pinned here because "we print addresses only" is a property of
    // the reporting code that a later edit could quietly break.
    const source = readFileSync('scripts/audit-secret-whitelist.ts', 'utf8');
    expect(source, 'the report must never interpolate a key').not.toMatch(/console\.log\([^)]*entry\.key/);
    expect(source).toMatch(/privateKeyToAccount\(entry\.key\)/);
  });
});
