/**
 * Named decoding for `BLSAggregator.guardianSlashCases(uint256)`.
 *
 * WHY THIS EXISTS (CC-50 B2 / round-9)
 * ------------------------------------
 * The evidence runner used to write the raw `readContract` result straight into
 * `security-controls.json`:
 *
 *     const slashCase = await publicClient.readContract({ ..., functionName: "guardianSlashCases" });
 *     const evidence = { ..., slashCase, ... };
 *
 * Upstream has since changed that struct from 5 outputs to 7 — `fraudProofHash` inserted at index 1
 * and `verifier` appended (SuperPaymaster BLSAggregator 4.8.0, CC-48). Every field is statically
 * sized, so calling the NEW contract with the OLD vendored ABI does not revert: viem decodes seven
 * words as five and the evidence file silently records `deadline` where `fraudProofHash` is,
 * `status` where `deadline` is, and so on. A positional array in an evidence artifact cannot even be
 * read back to detect that — nothing in the JSON says what any slot meant.
 *
 * So the decode is now BY NAME and it is checked twice, both of which fail closed:
 *
 *   1. the vendored ABI must still declare exactly the reviewed output names, in the reviewed
 *      ORDER — a re-vendored ABI that changes the tuple stops the run instead of re-labelling it;
 *   2. the value the chain returned must have exactly that many members.
 *
 * When the three-way re-vendor lands (B2), this file is the single place that has to be reviewed
 * and updated, and it will refuse to run until it is.
 */
import type { Abi, AbiFunction } from 'viem';

/**
 * `BLSAggregator.guardianSlashCases` outputs as REVIEWED in this repo, in declaration order.
 * Kept as a literal, not derived from the ABI: deriving it would make any upstream reshuffle
 * self-approving, which is the exact failure this guards.
 */
export const GUARDIAN_SLASH_CASE_FIELDS = [
  'guardiansHash',
  'deadline',
  'status',
  'guardianCount',
  'resolvedCount',
] as const;

export type GuardianSlashCaseField = (typeof GUARDIAN_SLASH_CASE_FIELDS)[number];

/** The reviewed struct, keyed by name — what goes into the evidence file. */
export type GuardianSlashCase = Record<GuardianSlashCaseField, unknown>;

/** The output names the given ABI declares for `guardianSlashCases`, in declaration order. */
export function declaredGuardianSlashCaseFields(abi: Abi): string[] {
  const entry = abi.find(
    (item): item is AbiFunction => item.type === 'function' && item.name === 'guardianSlashCases',
  );
  if (!entry) {
    throw new Error(
      'BLSAggregator ABI declares no guardianSlashCases(uint256) — the vendored copy cannot decode the ' +
        'fraud-case struct this evidence run records',
    );
  }
  return entry.outputs.map((output, index) => output.name || `<unnamed #${index}>`);
}

/**
 * Decode the raw tuple into the reviewed named struct, refusing anything that does not match.
 *
 * @param abi   the vendored BLSAggregator ABI the call was made with
 * @param value whatever `readContract` returned
 */
export function decodeGuardianSlashCase(abi: Abi, value: unknown): GuardianSlashCase {
  const declared = declaredGuardianSlashCaseFields(abi);
  const expected = [...GUARDIAN_SLASH_CASE_FIELDS];
  if (declared.length !== expected.length || declared.some((name, i) => name !== expected[i])) {
    throw new Error(
      `BLSAggregator.guardianSlashCases outputs are [${declared.join(', ')}], but this repo has reviewed ` +
        `[${expected.join(', ')}]. Upstream reshaped the struct (SP 4.8.0 inserts fraudProofHash at index 1 ` +
        'and appends verifier): every member is statically sized, so decoding the new layout with the old ' +
        'ABI would NOT revert — it would write mislabelled fields into the evidence. Review the new layout, ' +
        'update GUARDIAN_SLASH_CASE_FIELDS and the readers of security-controls.json in the same commit.',
    );
  }
  if (!Array.isArray(value)) {
    throw new Error(
      `guardianSlashCases returned ${typeof value}, not the ${expected.length}-member tuple the ABI declares`,
    );
  }
  if (value.length !== expected.length) {
    throw new Error(
      `guardianSlashCases returned ${value.length} member(s), but the vendored ABI declares ` +
        `${expected.length} (${expected.join(', ')}) — the on-chain struct is not the one this ABI describes`,
    );
  }
  return Object.fromEntries(expected.map((name, i) => [name, value[i]])) as GuardianSlashCase;
}
