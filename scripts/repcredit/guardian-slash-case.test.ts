/**
 * The `guardianSlashCases` 5 -> 7 tuple hazard (CC-50 B2, [from:docs] round-9).
 *
 * Upstream inserts `fraudProofHash` at index 1 and appends `verifier` in SuperPaymaster
 * BLSAggregator 4.8.0. Every member of the struct is statically sized, so a call made with the
 * 5-output ABI against the 7-output contract does NOT revert — it decodes the first five words and
 * hands back `deadline` where `fraudProofHash` belongs. The evidence runner used to write that
 * array into `security-controls.json` verbatim, where nothing records what any slot meant.
 *
 * These are the falsifiable halves of the fix: the shipped ABI still declares the reviewed names in
 * the reviewed order, and a decoder handed the reshaped ABI or a mis-sized value refuses instead of
 * relabelling.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Abi } from 'viem';
import {
  GUARDIAN_SLASH_CASE_FIELDS,
  declaredGuardianSlashCaseFields,
  decodeGuardianSlashCase,
} from './guardian-slash-case.js';

/**
 * The SHIPPED ABI, read from the same file `@aastar/core` re-exports as `BLSAggregatorABI`
 * (`packages/core/src/abis/index.ts:140`) and the same file `check:abi-drift` pins by sha256.
 * Read from disk rather than imported: `scripts/` is not a workspace package, so the `@aastar/*`
 * tsconfig path alias that `repcredit-e2e.ts` resolves through tsx is not available under vitest.
 */
const SDK_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHIPPED_ABI = JSON.parse(
  readFileSync(join(SDK_REPO, 'packages/core/src/abis/BLSAggregator.json'), 'utf8'),
).abi as Abi;

/** The upstream 4.8.0 shape, as reported by repo:sp on CC-50 (fraudProofHash @1, verifier appended). */
const RESHAPED_ABI = [
  {
    type: 'function',
    name: 'guardianSlashCases',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'guardiansHash', type: 'bytes32' },
      { name: 'fraudProofHash', type: 'bytes32' },
      { name: 'deadline', type: 'uint64' },
      { name: 'status', type: 'uint8' },
      { name: 'guardianCount', type: 'uint16' },
      { name: 'resolvedCount', type: 'uint16' },
      { name: 'verifier', type: 'address' },
    ],
  },
] as unknown as Abi;

const FIVE = [`0x${'11'.repeat(32)}`, 1234n, 2, 3, 4];

describe('guardianSlashCases named decode', () => {
  it('the SHIPPED BLSAggregator ABI still declares the reviewed outputs in the reviewed order', () => {
    // If this fails, the ABI was re-vendored: review the new layout and the evidence readers in the
    // same commit rather than making the constant follow the ABI.
    expect(declaredGuardianSlashCaseFields(SHIPPED_ABI)).toEqual([...GUARDIAN_SLASH_CASE_FIELDS]);
  });

  it('decodes the reviewed tuple into NAMED fields, so evidence never carries a bare array', () => {
    const decoded = decodeGuardianSlashCase(SHIPPED_ABI, FIVE);
    expect(decoded).toEqual({
      guardiansHash: FIVE[0],
      deadline: FIVE[1],
      status: FIVE[2],
      guardianCount: FIVE[3],
      resolvedCount: FIVE[4],
    });
    expect(Array.isArray(decoded)).toBe(false);
  });

  it('REFUSES the 4.8.0 reshaped ABI instead of silently re-labelling the fields', () => {
    // The regression in one line: with the reshaped ABI, index 1 is fraudProofHash, not deadline.
    expect(() => decodeGuardianSlashCase(RESHAPED_ABI, FIVE)).toThrow(/reviewed \[guardiansHash, deadline/);
    expect(() => decodeGuardianSlashCase(RESHAPED_ABI, FIVE)).toThrow(/would NOT revert/);
  });

  it('REFUSES a value whose arity disagrees with the vendored ABI', () => {
    const sevenWords = [...FIVE, 5, `0x${'22'.repeat(20)}`];
    expect(() => decodeGuardianSlashCase(SHIPPED_ABI, sevenWords)).toThrow(
      /returned 7 member\(s\), but the vendored ABI declares 5/,
    );
    expect(() => decodeGuardianSlashCase(SHIPPED_ABI, undefined)).toThrow(/not the 5-member tuple/);
  });

  it('REFUSES an ABI with no guardianSlashCases at all', () => {
    expect(() => decodeGuardianSlashCase([] as unknown as Abi, FIVE)).toThrow(/declares no guardianSlashCases/);
  });
});
