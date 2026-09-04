/**
 * Shape/domain regressions for the evidence struct readers (CC-50 round-10 HIGH + LOW).
 *
 * The measured bypass this replaces: round-9 checked the vendored ABI's output NAMES and the
 * arity of the value viem had ALREADY decoded. Against the 7-output upstream contract, viem hands
 * back five members without erroring, so both checks passed and `fraudProofHash`'s bytes were
 * written into the evidence under the name `deadline`.
 *
 * Everything here therefore asserts on RAW returndata — the only place the difference is visible.
 * The companion `evidence-structs.anvil.test.ts` runs the same 5-vs-7 case through a REAL chain
 * and REAL viem, because a hand-built hex string could not have caught the round-9 bug either.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { encodeAbiParameters, getAddress, type Abi, type Hex } from 'viem';
import {
  GUARDIAN_EXIT_REQUEST,
  GUARDIAN_SLASH_CASE,
  ROLE_LOCK,
  assertReviewedAbiShape,
  declaredOutputs,
  decodeNamedStruct,
  readNamedStruct,
  staticReturnWords,
  staticWordCount,
} from './evidence-structs.js';

/**
 * The SHIPPED ABIs, read from the same files `@aastar/core` re-exports and `check:abi-drift` pins
 * by sha256. Read from disk rather than imported: `scripts/` is not a workspace package, so the
 * `@aastar/*` tsconfig path alias that `repcredit-e2e.ts` resolves through tsx is unavailable here.
 */
const SDK_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function shippedAbi(name: string): Abi {
  return JSON.parse(readFileSync(join(SDK_REPO, `packages/core/src/abis/${name}.json`), 'utf8')).abi as Abi;
}
const BLS_ABI = shippedAbi('BLSAggregator');
const STAKING_ABI = shippedAbi('GTokenStaking');

/**
 * The PRE-4.8.0 shape. This is what this repo reviewed until CC-115 B4; it is kept as a literal so
 * the historical direction of the hazard stays covered after the constant moved on to 7.
 */
const LEGACY_FIVE_OUTPUTS = [
  { name: 'guardiansHash', type: 'bytes32' },
  { name: 'deadline', type: 'uint64' },
  { name: 'status', type: 'uint8' },
  { name: 'guardianCount', type: 'uint16' },
  { name: 'resolvedCount', type: 'uint16' },
] as const;

/**
 * The 4.12.0 SOURCE shape (#400 inserted `uint16 slashBps` before `verifier`) — and the live
 * hazard as of CC-115 B4, because it is not hypothetical and it is not distinguishable by
 * selector. SuperPaymaster's `contracts/src` is 4.12.0 while the deployed Sepolia contract is
 * 4.11.0; anyone generating bindings from upstream `out/` gets THIS list and points it at a
 * contract that returns seven words. Every member is statically sized, so the mismatch does not
 * revert — it decodes into the wrong fields, or fails to decode, on the guardian-slash path only.
 */
const RESHAPED_OUTPUTS = [
  { name: 'guardiansHash', type: 'bytes32' },
  { name: 'fraudProofHash', type: 'bytes32' },
  { name: 'deadline', type: 'uint64' },
  { name: 'status', type: 'uint8' },
  { name: 'guardianCount', type: 'uint16' },
  { name: 'resolvedCount', type: 'uint16' },
  { name: 'slashBps', type: 'uint16' },
  { name: 'verifier', type: 'address' },
] as const;
const RESHAPED_ABI = [
  {
    type: 'function',
    name: 'guardianSlashCases',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: RESHAPED_OUTPUTS,
  },
] as unknown as Abi;

/** Distinctive on-chain values: every mis-slotting below is identifiable by eye. */
const GUARDIANS_HASH = `0x${'aa'.repeat(32)}` as Hex;
const FRAUD_PROOF_HASH = `0x${'bb'.repeat(32)}` as Hex;
const DEADLINE = 1_900_000_000n;
const STATUS = 2;
const GUARDIAN_COUNT = 3;
const RESOLVED_COUNT = 3;
const VERIFIER = `0x${'cc'.repeat(20)}`;

const SLASH_BPS = 500;

/** What the REVIEWED (= deployed 4.11.0) contract puts on the wire: 7 words. */
const SEVEN_WORDS = encodeAbiParameters(
  GUARDIAN_SLASH_CASE.outputs.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, FRAUD_PROOF_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT, VERIFIER],
);
/** What the pre-4.8.0 contract put on the wire: 5 words. Historical direction of the hazard. */
const FIVE_WORDS = encodeAbiParameters(
  LEGACY_FIVE_OUTPUTS.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT],
);
/** What a 4.12.0 contract WOULD put on the wire: 8 words. Live direction of the hazard. */
const EIGHT_WORDS = encodeAbiParameters(
  RESHAPED_OUTPUTS.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, FRAUD_PROOF_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT, SLASH_BPS, VERIFIER],
);

describe('static word arithmetic', () => {
  it('counts one word per statically sized member and refuses to vouch for dynamic ones', () => {
    expect(staticWordCount('bytes32')).toBe(1);
    expect(staticWordCount('uint64')).toBe(1);
    expect(staticWordCount('uint256')).toBe(1);
    expect(staticWordCount('address')).toBe(1);
    expect(staticWordCount('bool')).toBe(1);
    expect(staticWordCount('uint8[4]')).toBe(4);
    // Dynamic, or shapes this reader deliberately will not guess a width for.
    expect(staticWordCount('bytes')).toBeNull();
    expect(staticWordCount('string')).toBeNull();
    expect(staticWordCount('uint256[]')).toBeNull();
    expect(staticWordCount('tuple')).toBeNull();
    expect(staticWordCount('uint7')).toBeNull();
    expect(staticWordCount('bytes33')).toBeNull();
  });

  it('gives an exact expectation for the two all-static getters and NONE for roleLocks', () => {
    expect(staticReturnWords(GUARDIAN_SLASH_CASE.outputs)).toBe(7);
    expect(staticReturnWords(GUARDIAN_EXIT_REQUEST.outputs)).toBe(2);
    // `metadata` is dynamic: there is no word count to assert, and this file does not pretend
    // otherwise. That getter is covered by the ABI-shape and per-member domain checks instead.
    expect(staticReturnWords(ROLE_LOCK.outputs)).toBeNull();
  });
});

describe('the shipped ABIs still declare the reviewed structs', () => {
  const SHIPPED: [string, Abi, typeof GUARDIAN_SLASH_CASE][] = [
    ['BLSAggregator', BLS_ABI, GUARDIAN_SLASH_CASE],
    ['BLSAggregator', BLS_ABI, GUARDIAN_EXIT_REQUEST],
    ['GTokenStaking', STAKING_ABI, ROLE_LOCK],
  ];
  for (const [abiName, abi, spec] of SHIPPED) {
    it(`${abiName}.${spec.functionName}`, () => {
      // If this fails the ABI was re-vendored: review the new layout and every reader of
      // security-controls.json in the same commit rather than making the constant follow the ABI.
      expect(declaredOutputs(abi, spec)).toEqual([...spec.outputs]);
      expect(() => assertReviewedAbiShape(abi, spec)).not.toThrow();
    });
  }
});

describe('guardianSlashCases: the 5 -> 7 -> 8 hazard', () => {
  // CC-115 B4 re-polarised this block. The reviewed constant is now 7 (= deployed 4.11.0), so the
  // old "5 is right, 7 is the hazard" assertions would have asserted the opposite of the truth if
  // their numbers had merely been bumped. Both directions are kept: 5 is where we came from, 8 is
  // where upstream source already is.
  it('decodes the reviewed 7-word returndata into NAMED fields', () => {
    const decoded = decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, SEVEN_WORDS);
    expect(decoded).toEqual({
      guardiansHash: GUARDIANS_HASH,
      fraudProofHash: FRAUD_PROOF_HASH,
      deadline: DEADLINE,
      status: STATUS,
      guardianCount: GUARDIAN_COUNT,
      resolvedCount: RESOLVED_COUNT,
      verifier: getAddress(VERIFIER),
    });
    expect(Array.isArray(decoded)).toBe(false);
  });

  it('THE LIVE ONE: refuses 8 words — the 4.12.0 shape — at the same selector', () => {
    // Anyone generating bindings from SuperPaymaster's out/ today gets the 8-output list and
    // points it at a contract that returns seven words. The selector is identical, so nothing
    // upstream of this check can tell the two apart.
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, EIGHT_WORDS)).toThrow(
      /returned 8 word\(s\) but the vendored ABI declares 7 statically-sized output\(s\)/,
    );
  });

  it('refuses 5 words — the pre-4.8.0 shape — against the reviewed 7', () => {
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, FIVE_WORDS)).toThrow(
      /returned 5 word\(s\) but the vendored ABI declares 7 statically-sized output\(s\)/,
    );
  });

  it('it is the WORD COUNT that refuses, not a downstream accident', () => {
    // Pinning WHICH gate fires matters: with the length check removed, the per-member domain check
    // may happen to catch a particular payload too. That is a welcome second net but it is
    // payload-dependent — a shifted value that still fits its slot would sail through it. The
    // 8-word payload is exactly such a case: appending slashBps+verifier shifts nothing that
    // overflows, so ONLY the length check stands between it and a wrong decode.
    let message = '';
    try {
      decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, EIGHT_WORDS);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/returned 8 word\(s\) but the vendored ABI declares 7/);
    // The field it would otherwise mislabel is decidably different from the truth.
    expect(BigInt(SLASH_BPS)).not.toEqual(BigInt(getAddress(VERIFIER)));
  });

  it('REFUSES 7 words against an 8-output ABI (the mirror image: re-vendored to 4.12.0 too early)', () => {
    const reshapedSpec = { ...GUARDIAN_SLASH_CASE, outputs: [...RESHAPED_OUTPUTS] };
    expect(() => decodeNamedStruct(RESHAPED_ABI, reshapedSpec, SEVEN_WORDS)).toThrow(
      /returned 7 word\(s\) but the vendored ABI declares 8/,
    );
  });

  it('the mechanism generalises: a matched 8-output ABI + 8-field constant decodes cleanly', () => {
    // Proves the machinery is not hardcoded to the current reviewed arity — so when 4.12.0 is
    // eventually deployed, adopting it is a constant change, not a rewrite. The shipped constant
    // is NOT changed here.
    const reshapedSpec = { ...GUARDIAN_SLASH_CASE, outputs: [...RESHAPED_OUTPUTS] };
    expect(decodeNamedStruct(RESHAPED_ABI, reshapedSpec, EIGHT_WORDS)).toEqual({
      guardiansHash: GUARDIANS_HASH,
      fraudProofHash: FRAUD_PROOF_HASH,
      deadline: DEADLINE,
      status: STATUS,
      guardianCount: GUARDIAN_COUNT,
      resolvedCount: RESOLVED_COUNT,
      slashBps: SLASH_BPS,
      verifier: getAddress(VERIFIER),
    });
  });

  it('REFUSES an ABI reshaped away from the reviewed constant, naming the difference', () => {
    expect(() => decodeNamedStruct(RESHAPED_ABI, GUARDIAN_SLASH_CASE, EIGHT_WORDS)).toThrow(
      /outputs are \[guardiansHash:bytes32, fraudProofHash:bytes32/,
    );
    expect(() => decodeNamedStruct(RESHAPED_ABI, GUARDIAN_SLASH_CASE, EIGHT_WORDS)).toThrow(
      /this repo has reviewed \[guardiansHash:bytes32, fraudProofHash:bytes32, deadline:uint64/,
    );
  });

  it('REFUSES a same-name TYPE widening that keeps both the names and the word count', () => {
    // Round-9 compared names only, so `uint64 deadline -> uint256 deadline` was invisible to it:
    // same names, same order, same word count. `deadline` is at index 2 in the reviewed 7-list.
    const widened = JSON.parse(JSON.stringify(BLS_ABI)) as Abi;
    const entry = widened.find(i => i.type === 'function' && i.name === 'guardianSlashCases') as unknown as {
      outputs: { name: string; type: string }[];
    };
    expect(entry.outputs[2].name).toBe('deadline');
    entry.outputs[2].type = 'uint256';
    expect(() => decodeNamedStruct(widened, GUARDIAN_SLASH_CASE, SEVEN_WORDS)).toThrow(/deadline:uint256/);
  });

  it('REFUSES empty, ragged and absent returndata', () => {
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, '0x')).toThrow(/EMPTY returndata/);
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, `${SEVEN_WORDS}ab` as Hex)).toThrow(
      /not a whole number of 32-byte words/,
    );
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_SLASH_CASE, 'nothex' as Hex)).toThrow(/not a hex byte string/);
  });

  it('REFUSES an ABI with no guardianSlashCases at all', () => {
    expect(() => decodeNamedStruct([] as unknown as Abi, GUARDIAN_SLASH_CASE, SEVEN_WORDS)).toThrow(
      /declares no guardianSlashCases/,
    );
  });
});

describe('roleLocks: the DYNAMIC-member arity gate (pr-daemon, PR #329)', () => {
  // staticReturnWords returns null the moment a member is dynamic, so before this gate roleLocks
  // had NO arity check at all. Measured then: the reviewed 5-output spec decoded a 6-output
  // payload, returned five members, and dropped the appended word in silence.
  const vendoredRoleLocksAbi = [
    {
      type: 'function',
      name: 'roleLocks',
      stateMutability: 'view',
      inputs: [{ type: 'address' }, { type: 'bytes32' }],
      outputs: ROLE_LOCK.outputs.map(o => ({ name: o.name, type: o.type })),
    },
  ] as unknown as Abi;
  const ROLE_VALUES = [30n * 10n ** 18n, 3n * 10n ** 18n, 1_700_000_000n, `0x${'ab'.repeat(32)}` as Hex, '0xdeadbeef' as Hex];

  it('POSITIVE: a genuine 5-output payload still decodes', () => {
    const payload = encodeAbiParameters(ROLE_LOCK.outputs.map(o => ({ type: o.type })), ROLE_VALUES as never);
    const decoded = decodeNamedStruct(vendoredRoleLocksAbi, ROLE_LOCK, payload) as Record<string, unknown>;
    expect(Object.keys(decoded)).toEqual(ROLE_LOCK.outputs.map(o => o.name));
  });

  it('REFUSES a contract that appended an output, which the word-count gate cannot see', () => {
    const contractOutputs = [...ROLE_LOCK.outputs.map(o => ({ name: o.name, type: o.type })), { name: 'added', type: 'uint256' }];
    const payload = encodeAbiParameters(contractOutputs.map(o => ({ type: o.type })), [...ROLE_VALUES, 999n] as never);
    // staticReturnWords is null here — the total-words gate is silent by construction.
    expect(staticReturnWords(ROLE_LOCK.outputs)).toBeNull();
    expect(() => decodeNamedStruct(vendoredRoleLocksAbi, ROLE_LOCK, payload)).toThrow(
      /the head is 6 word\(s\) but the vendored ABI declares 5 output\(s\)/,
    );
  });

  it('REFUSES a contract that dropped an output too (the other direction)', () => {
    const shorter = ROLE_LOCK.outputs.slice(1).map(o => ({ name: o.name, type: o.type }));
    const payload = encodeAbiParameters(shorter.map(o => ({ type: o.type })), ROLE_VALUES.slice(1) as never);
    // Dropping a member shifts the reviewed spec's dynamic slot onto DATA, so the word we read is
    // not an offset at all — the gate says exactly that rather than reporting a fractional word.
    expect(() => decodeNamedStruct(vendoredRoleLocksAbi, ROLE_LOCK, payload)).toThrow(
      /not a 32-byte boundary, so that slot is not an offset at all/,
    );
  });
});

describe('guardianExitRequests and roleLocks are named objects with checked domains', () => {
  it('guardianExitRequests decodes by name and rejects a third word', () => {
    const two = encodeAbiParameters([{ type: 'uint64' }, { type: 'uint64' }], [1n, 2n]);
    expect(decodeNamedStruct(BLS_ABI, GUARDIAN_EXIT_REQUEST, two)).toEqual({ readyAt: 1n, expiresAt: 2n });
    const three = encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }],
      [1n, 2n, 3n],
    );
    expect(() => decodeNamedStruct(BLS_ABI, GUARDIAN_EXIT_REQUEST, three)).toThrow(
      /returned 3 word\(s\) but the vendored ABI declares 2/,
    );
  });

  it('roleLocks decodes by name, with amount a bigint and metadata hex bytes', () => {
    const encoded = encodeAbiParameters(
      ROLE_LOCK.outputs.map(o => ({ type: o.type })),
      [10n ** 21n, 5n * 10n ** 18n, 1_700_000_000, `0x${'dd'.repeat(32)}`, '0xbeef'],
    );
    const lock = decodeNamedStruct(STAKING_ABI, ROLE_LOCK, encoded);
    expect(lock).toEqual({
      amount: 10n ** 21n,
      ticketPrice: 5n * 10n ** 18n,
      lockedAt: 1_700_000_000,
      roleId: `0x${'dd'.repeat(32)}`,
      metadata: '0xbeef',
    });
    // The runner's post-slash negative control reads `.amount`, never `[0]`.
    expect(typeof lock.amount).toBe('bigint');
    expect(lock.metadata).toMatch(/^0x([0-9a-f]{2})*$/);
    expect(Array.isArray(lock)).toBe(false);
  });

  it('roleLocks REFUSES a reordered ABI even though no word count is available for it', () => {
    const reordered = JSON.parse(JSON.stringify(STAKING_ABI)) as Abi;
    const entry = reordered.find(i => i.type === 'function' && i.name === 'roleLocks') as unknown as {
      outputs: { name: string; type: string }[];
    };
    [entry.outputs[0], entry.outputs[1]] = [entry.outputs[1], entry.outputs[0]];
    expect(staticReturnWords(ROLE_LOCK.outputs)).toBeNull();
    expect(() => decodeNamedStruct(reordered, ROLE_LOCK, '0x')).toThrow(/this repo has reviewed/);
  });

  it('a member outside its declared integer domain is a failure, not a value', () => {
    // uint48 `lockedAt` carrying a 2^200 word: only reachable by reading at the wrong offset.
    const outOfRange = encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'uint64' }],
      [2n ** 63n, 1n],
    );
    const widened = JSON.parse(JSON.stringify(BLS_ABI)) as Abi;
    const entry = widened.find(i => i.type === 'function' && i.name === 'guardianExitRequests') as unknown as {
      outputs: { name: string; type: string }[];
    };
    // Reviewed as uint64 but the chain answers a value that does not fit uint48: force the domain
    // check to be the only thing that can fail by declaring the narrower type on both sides.
    entry.outputs[0].type = 'uint48';
    const narrowSpec = {
      ...GUARDIAN_EXIT_REQUEST,
      outputs: [{ name: 'readyAt', type: 'uint48' }, { name: 'expiresAt', type: 'uint64' }],
    };
    expect(() => decodeNamedStruct(widened, narrowSpec, outOfRange)).toThrow(
      /readyAt \(uint48\): expected a safe-integer number|outside the declared range/,
    );
  });
});

describe('readNamedStruct drives RAW eth_call, not readContract', () => {
  it('encodes the selector, passes the raw returndata through the gate, and returns names', async () => {
    const seen: { to: string; data: string }[] = [];
    const decoded = await readNamedStruct({
      client: {
        call: async ({ to, data }) => {
          seen.push({ to, data });
          return { data: SEVEN_WORDS };
        },
      },
      address: `0x${'11'.repeat(20)}`,
      abi: BLS_ABI,
      spec: GUARDIAN_SLASH_CASE,
      args: [7n],
    });
    expect(seen).toHaveLength(1);
    // 4-byte selector + one word of argument — proof the call was built from the ABI, not faked.
    expect(seen[0].data).toHaveLength(2 + 8 + 64);
    expect(BigInt(`0x${seen[0].data.slice(10)}`)).toBe(7n);
    expect(decoded.deadline).toBe(DEADLINE);
  });

  it('FAILS on an 8-word answer instead of returning a mislabelled object', async () => {
    // The 4.12.0 payload, arriving through the real read path rather than a direct decode call.
    await expect(
      readNamedStruct({
        client: { call: async () => ({ data: EIGHT_WORDS }) },
        address: `0x${'11'.repeat(20)}`,
        abi: BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [7n],
      }),
    ).rejects.toThrow(/returned 8 word\(s\) but the vendored ABI declares 7/);
  });

  it('FAILS when the address answers with no data at all', async () => {
    await expect(
      readNamedStruct({
        client: { call: async () => ({}) },
        address: `0x${'11'.repeat(20)}`,
        abi: BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [7n],
      }),
    ).rejects.toThrow(/returned no data/);
  });
});
