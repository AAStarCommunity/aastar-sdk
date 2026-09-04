/**
 * Strict, raw-returndata reads for the struct getters the RepCredit evidence runner records.
 *
 * WHY THIS EXISTS (CC-50 B2 / round-10 HIGH)
 * ------------------------------------------
 * Round-9 replaced the bare arrays in `security-controls.json` with a named decode, but it still
 * obtained the value through `publicClient.readContract(<old vendored ABI>)` and then checked the
 * DECODED result. An independent reviewer measured that this cannot see the hazard it documents:
 *
 *   - upstream reshapes `BLSAggregator.guardianSlashCases` from 5 outputs to 7 (SuperPaymaster
 *     BLSAggregator 4.8.0, CC-48: `fraudProofHash` inserted at index 1, `verifier` appended);
 *   - every member is statically sized, so the node returns SEVEN 32-byte words and viem, holding
 *     the five-output ABI, decodes the first five and returns without error;
 *   - the ABI-shape check then compares the OLD ABI against the OLD reviewed names — it matches,
 *     because the ABI is exactly what this repo reviewed. The contract is what changed;
 *   - the arity check then compares viem's already-truncated 5-member result against 5 — it
 *     matches too.
 *
 * Both guards passed and the evidence file got `fraudProofHash`'s bytes under the name `deadline`,
 * `deadline`'s under `status`, and so on — worse than the bare array, because now the wrong values
 * carry authoritative names. And it is not hypothetical: the runner deploys via `forge script` from
 * the sibling `../SuperPaymaster` working tree, which already carries the 7-output struct.
 *
 * The fix is to stop asking viem for a shape and start measuring the one the chain sent:
 *
 *   1. `encodeFunctionData` + `publicClient.call` — RAW returndata, no ABI applied yet;
 *   2. the returndata must be a whole number of 32-byte words;
 *   3. the vendored ABI's outputs must still be exactly the reviewed names AND types, in order
 *      (a literal in this file — deriving it from the ABI would make an upstream reshuffle
 *      self-approving);
 *   4. when every reviewed output is statically sized — true for all three getters below — the
 *      word count must EXACTLY equal the number of words those outputs occupy. Five expected
 *      against seven received is a hard failure here, before any decoding happens, and it
 *      propagates out of the runner rather than into the evidence file;
 *   5. only then `decodeFunctionResult`, mapped into a named object, with each member checked
 *      against its declared type and value domain.
 *
 * Step 4 is the load-bearing one for the arity hazard, and for an all-static tuple it is exact: the
 * ABI encoding of N static outputs is exactly N words, so any other length means the contract is not
 * the one this ABI describes.
 *
 * A tuple containing a dynamic member (`roleLocks.metadata`) has no such total-length equality, and
 * this file used to stop there — leaving that getter with NO arity gate at all. Measured (pr-daemon,
 * PR #329): the reviewed 5-output spec decoded a 6-output payload, returned five members, and
 * dropped the appended word in silence. "There is no exact word count" was true; "so nothing can be
 * checked" was not.
 *
 * 4b covers it. The ABI head is exactly one word per top-level output — static members inline,
 * dynamic members an offset — and the dynamic section follows the head in order, so the FIRST
 * dynamic member's offset MUST equal `outputs.length * 32`. Append an output and the head grows a
 * word and the offset moves with it; drop one and the slot stops being a 32-byte boundary at all.
 * Both are equalities on values the encoder is required to produce, not heuristics, and both have
 * paired red tests. Nested/array dynamic members are refused outright rather than under-checked.
 */
import {
  decodeFunctionResult,
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex,
} from 'viem';

/** One output of a reviewed getter: the name AND the type this repo reviewed, in order. */
export type ReviewedOutput = { readonly name: string; readonly type: string };

/** A struct getter whose result is written into the evidence bundle. */
export type ReviewedStruct = {
  /** function name on the vendored ABI */
  readonly functionName: string;
  /** human label used in error messages */
  readonly label: string;
  /** the reviewed outputs, in declaration order */
  readonly outputs: readonly ReviewedOutput[];
};

/**
 * `BLSAggregator.guardianSlashCases(uint256)` as REVIEWED in this repo.
 *
 * Kept as a literal, not derived from the vendored ABI: deriving it would make any upstream
 * reshuffle self-approving, which is the exact failure this guards. When the three-way re-vendor
 * lands (B2), this constant and the readers of `security-controls.json` must be updated in the
 * same commit — the run refuses until they are.
 */
export const GUARDIAN_SLASH_CASE: ReviewedStruct = {
  functionName: 'guardianSlashCases',
  label: 'BLSAggregator.guardianSlashCases',
  // CC-115 B4, 2026-09-04: re-reviewed against the DEPLOYED 4.11.0 artifact
  // (SuperPaymaster@d651646a:abis/BLSAggregator-4.11.0.deployed.json, sha256 df667b4d…06ce) and
  // confirmed against the chain: `cast call 0xEaeC2F51… guardianSlashCases(uint256) 0` returns 224
  // bytes = 7 words, the 7-type list below decodes it, and the 8-type 4.12.0 list raises.
  //
  // Two moves happened between the old 5-output review and this one, and the second is the reason
  // this constant is a literal rather than something derived from the ABI:
  //   5 -> 7  upstream inserted `fraudProofHash` at index 1 and appended `verifier` (SP 4.8.0)
  //   7 -> 8  #400 inserted `uint16 slashBps` before `verifier` — that is 4.12.0, which is on NO
  //           chain, and MUST NOT be adopted here while the deployed contract is 4.11.0.
  // Every member is statically sized, so a wrong list does not revert; it decodes into the wrong
  // fields. The word-count assertion in this module is what turns that into a failure.
  outputs: [
    { name: 'guardiansHash', type: 'bytes32' },
    { name: 'fraudProofHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'status', type: 'uint8' },
    { name: 'guardianCount', type: 'uint16' },
    { name: 'resolvedCount', type: 'uint16' },
    { name: 'verifier', type: 'address' },
  ],
};

/** `BLSAggregator.guardianExitRequests(address)` as reviewed here. All-static, so step 4 applies. */
export const GUARDIAN_EXIT_REQUEST: ReviewedStruct = {
  functionName: 'guardianExitRequests',
  label: 'BLSAggregator.guardianExitRequests',
  outputs: [
    { name: 'readyAt', type: 'uint64' },
    { name: 'expiresAt', type: 'uint64' },
  ],
};

/**
 * `GTokenStaking.roleLocks(address,bytes32)` as reviewed here.
 *
 * `metadata` is dynamically sized, so there is no exact word count to assert (step 4 is skipped
 * for this one, by measurement of the declared types — not by exception). It is still read raw,
 * still checked against the reviewed name/type list, and still range-checked per member; a
 * reordering that moved a static member past the dynamic tail would fail loudly on the offset
 * rather than quietly relabel, which is why the runner's post-slash assertion now reads
 * `lock.amount` instead of `lock[0]`.
 */
export const ROLE_LOCK: ReviewedStruct = {
  functionName: 'roleLocks',
  label: 'GTokenStaking.roleLocks',
  outputs: [
    { name: 'amount', type: 'uint128' },
    { name: 'ticketPrice', type: 'uint128' },
    { name: 'lockedAt', type: 'uint48' },
    { name: 'roleId', type: 'bytes32' },
    { name: 'metadata', type: 'bytes' },
  ],
};

/** A decoded struct, keyed by reviewed output name. Never an array — that is the point. */
export type NamedStruct = Record<string, unknown>;

/** viem decodes int/uint of at most this many bits to `number`, wider ones to `bigint`. */
const VIEM_NUMBER_MAX_BITS = 48;

/**
 * How many 32-byte words a statically sized ABI type occupies, or `null` if it is dynamic
 * (or not a shape this function is willing to vouch for).
 *
 * Deliberately conservative: an unrecognised type returns `null`, which DISABLES the exact-length
 * assertion rather than inventing one. Guessing a width would be the failure mode this file exists
 * to remove.
 */
export function staticWordCount(type: string): number | null {
  const fixedArray = /^(.+)\[(\d+)\]$/.exec(type);
  if (fixedArray) {
    const inner = staticWordCount(fixedArray[1]);
    return inner === null ? null : inner * Number(fixedArray[2]);
  }
  if (type.endsWith('[]')) return null;
  if (type === 'bytes' || type === 'string') return null;
  if (type === 'address' || type === 'bool') return 1;
  const fixedBytes = /^bytes(\d+)$/.exec(type);
  if (fixedBytes) {
    const width = Number(fixedBytes[1]);
    return width >= 1 && width <= 32 ? 1 : null;
  }
  const integer = /^u?int(\d+)$/.exec(type);
  if (integer) {
    const bits = Number(integer[1]);
    return bits >= 8 && bits <= 256 && bits % 8 === 0 ? 1 : null;
  }
  // tuples and everything else: not vouched for.
  return null;
}

/**
 * The total static word count of a reviewed output list, or `null` if ANY member is dynamic.
 * `null` means "no exact-length assertion is available for this getter", not "it passed".
 */
export function staticReturnWords(outputs: readonly ReviewedOutput[]): number | null {
  let total = 0;
  for (const output of outputs) {
    const words = staticWordCount(output.type);
    if (words === null) return null;
    total += words;
  }
  return total;
}

/** The `name:type` pairs the given ABI declares for a function, in declaration order. */
export function declaredOutputs(abi: Abi, spec: ReviewedStruct): ReviewedOutput[] {
  const entries = abi.filter(
    (item): item is AbiFunction => item.type === 'function' && item.name === spec.functionName,
  );
  if (entries.length === 0) {
    throw new Error(
      `${spec.label}: the vendored ABI declares no ${spec.functionName} — it cannot describe the ` +
        'struct this evidence run records',
    );
  }
  if (entries.length > 1) {
    throw new Error(
      `${spec.label}: the vendored ABI declares ${entries.length} overloads of ${spec.functionName}; ` +
        'this reader only vouches for an unambiguous getter',
    );
  }
  return entries[0].outputs.map((output, index) => ({
    name: output.name || `<unnamed #${index}>`,
    type: output.type,
  }));
}

/** `name:type, name:type` — used in every mismatch message so the diff is readable. */
function render(outputs: readonly ReviewedOutput[]): string {
  return outputs.map(output => `${output.name}:${output.type}`).join(', ');
}

/**
 * The vendored ABI must still declare exactly the reviewed outputs — names AND types, in order.
 *
 * Round-9 compared names only. Types are compared too because a same-name widening
 * (`uint64 deadline` -> `uint256 deadline`) changes neither the name list nor, for a
 * single-word type, the word count.
 */
export function assertReviewedAbiShape(abi: Abi, spec: ReviewedStruct): void {
  const declared = declaredOutputs(abi, spec);
  const same =
    declared.length === spec.outputs.length &&
    declared.every((output, i) => output.name === spec.outputs[i].name && output.type === spec.outputs[i].type);
  if (!same) {
    throw new Error(
      `${spec.label} outputs are [${render(declared)}], but this repo has reviewed ` +
        `[${render(spec.outputs)}]. The vendored ABI was reshaped: review the new layout and update ` +
        'the reviewed constant AND the readers of security-controls.json in the same commit. ' +
        '(Upstream SP 4.8.0 inserts fraudProofHash at index 1 of guardianSlashCases and appends ' +
        'verifier; every member is statically sized, so a mismatched pair does NOT revert.)',
    );
  }
}

/** Signed/unsigned integer bounds for a solidity integer type, or null if it is not one. */
function integerDomain(type: string): { bits: number; signed: boolean } | null {
  const match = /^(u?)int(\d+)$/.exec(type);
  if (!match) return null;
  const bits = Number(match[2]);
  if (bits < 8 || bits > 256 || bits % 8 !== 0) return null;
  return { bits, signed: match[1] === '' };
}

/**
 * Assert a decoded member is the runtime type AND inside the value domain its declared ABI type
 * allows. A value outside its own type's range means the bytes were read at the wrong offset.
 */
function assertMemberDomain(label: string, output: ReviewedOutput, value: unknown): void {
  const where = `${label}.${output.name} (${output.type})`;
  const integer = integerDomain(output.type);
  if (integer) {
    const { bits, signed } = integer;
    const asBigInt = (() => {
      if (bits <= VIEM_NUMBER_MAX_BITS) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
          throw new Error(`${where}: expected a safe-integer number (viem decodes <=48-bit ints to number), got ${typeof value}`);
        }
        return BigInt(value);
      }
      if (typeof value !== 'bigint') {
        throw new Error(`${where}: expected bigint (viem decodes >48-bit ints to bigint), got ${typeof value}`);
      }
      return value;
    })();
    const min = signed ? -(2n ** BigInt(bits - 1)) : 0n;
    const max = signed ? 2n ** BigInt(bits - 1) - 1n : 2n ** BigInt(bits) - 1n;
    if (asBigInt < min || asBigInt > max) {
      throw new Error(`${where}: ${asBigInt} is outside the declared range [${min}, ${max}] — the value was read at the wrong offset`);
    }
    return;
  }
  if (output.type === 'address') {
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
      throw new Error(`${where}: expected a 20-byte hex address, got ${JSON.stringify(value)}`);
    }
    return;
  }
  if (output.type === 'bool') {
    if (typeof value !== 'boolean') throw new Error(`${where}: expected boolean, got ${typeof value}`);
    return;
  }
  const fixedBytes = /^bytes(\d+)$/.exec(output.type);
  if (fixedBytes) {
    const width = Number(fixedBytes[1]);
    if (typeof value !== 'string' || !new RegExp(`^0x[0-9a-fA-F]{${width * 2}}$`).test(value)) {
      throw new Error(`${where}: expected ${width}-byte hex, got ${JSON.stringify(value)}`);
    }
    return;
  }
  if (output.type === 'bytes') {
    if (typeof value !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(value)) {
      throw new Error(`${where}: expected even-length hex bytes, got ${JSON.stringify(value)}`);
    }
    return;
  }
  if (output.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${where}: expected string, got ${typeof value}`);
    return;
  }
  // No domain claim for a type `staticWordCount` also refuses to vouch for. Reaching here means
  // the reviewed constant grew a type this file does not model — make that visible.
  throw new Error(`${where}: this reader has no domain check for type ${output.type}; extend assertMemberDomain before reviewing it`);
}

/**
 * Validate RAW returndata against the reviewed shape and decode it into a named object.
 *
 * @param abi        the vendored ABI the call was encoded with
 * @param spec       the reviewed struct
 * @param returnData the bytes `eth_call` returned, BEFORE any ABI is applied
 */
export function decodeNamedStruct(abi: Abi, spec: ReviewedStruct, returnData: Hex): NamedStruct {
  assertReviewedAbiShape(abi, spec);

  if (typeof returnData !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(returnData)) {
    throw new Error(`${spec.label}: returndata is not a hex byte string (${JSON.stringify(returnData)})`);
  }
  const bytes = (returnData.length - 2) / 2;
  if (bytes === 0) {
    throw new Error(
      `${spec.label}: eth_call returned EMPTY returndata — there is no such getter at that address ` +
        '(no code, or a different contract)',
    );
  }
  if (bytes % 32 !== 0) {
    throw new Error(`${spec.label}: returndata is ${bytes} bytes, not a whole number of 32-byte words`);
  }
  const words = bytes / 32;

  // THE 5 -> 7 GATE. Only stated when every reviewed output is statically sized, where the ABI
  // encoding is exactly one word per output and the equality is a fact, not a heuristic.
  const expectedWords = staticReturnWords(spec.outputs);

  // THE SAME GATE, FOR STRUCTS WITH A DYNAMIC MEMBER (pr-daemon, PR #329 [Medium]).
  //
  // `staticReturnWords` returns null as soon as any member is dynamic, and the check above then
  // did nothing at all — so `GTokenStaking.roleLocks` (metadata: bytes) had NO arity gate. Measured
  // on the reviewed 5-output spec against a 6-output payload: it decoded, returned five members,
  // and dropped the appended word silently. Exactly the failure this file exists to stop, in the
  // one struct the original gate could not speak for.
  //
  // What CAN be stated without a total word count: the ABI head is exactly one word per top-level
  // output — static members inline, dynamic members an offset — and Solidity lays the dynamic
  // section out immediately after that head, in order. So the FIRST dynamic member's offset word
  // must equal `outputs.length * 32`. Append an output and the head grows by a word; the offset
  // moves with it and this comparison fails. It is an equality on a value the encoder must produce,
  // not a heuristic.
  if (expectedWords === null) {
    const firstDynamic = spec.outputs.findIndex(o => staticWordCount(o.type) === null);
    const nested = spec.outputs.filter(o => staticWordCount(o.type) === null && o.type !== 'bytes' && o.type !== 'string');
    if (nested.length) {
      // Offsets for nested/array types are still one head word each, but this file has never
      // reviewed such a member and will not guess at one rather than silently under-checking it.
      throw new Error(
        `${spec.label}: reviewed output(s) [${nested.map(o => `${o.name}:${o.type}`).join(', ')}] are dynamic ` +
          'types this gate has not been extended to, so no arity statement can be made. Extend ' +
          'staticWordCount/this branch in the same commit that reviews such a member.',
      );
    }
    const expectedHeadOffset = BigInt(spec.outputs.length * 32);
    const actualOffset = BigInt(`0x${returnData.slice(2 + firstDynamic * 64, 2 + (firstDynamic + 1) * 64)}`);
    if (actualOffset !== expectedHeadOffset) {
      // Report bytes when the offset is not word-aligned: a fractional "word" count reads like a
      // rounding bug in this gate rather than what it is — an offset that is not a head boundary at
      // all, which happens when the deployed struct dropped a member and the slot we read holds
      // data instead of an offset.
      const headDesc =
        actualOffset % 32n === 0n
          ? `${actualOffset / 32n} word(s)`
          : `${actualOffset} byte(s) — not a 32-byte boundary, so that slot is not an offset at all`;
      throw new Error(
        `${spec.label}: the head is ${headDesc} but the vendored ABI declares ` +
          `${spec.outputs.length} output(s) [${render(spec.outputs)}]. The dynamic member ` +
          `'${spec.outputs[firstDynamic].name}' points at byte ${actualOffset}, and a struct with ` +
          `${spec.outputs.length} outputs must point at ${expectedHeadOffset}. The deployed contract returns a ` +
          'DIFFERENT number of outputs than this ABI describes — decoding would succeed and drop, or ' +
          'mislabel, whatever the head gained. Re-vendor the ABI and the reviewed constant together.',
      );
    }
  }

  if (expectedWords !== null && words !== expectedWords) {
    throw new Error(
      `${spec.label}: the chain returned ${words} word(s) but the vendored ABI declares ` +
        `${expectedWords} statically-sized output(s) [${render(spec.outputs)}]. The deployed contract ` +
        'is NOT the one this ABI describes — decoding would silently shift every field ' +
        '(SP BLSAggregator 4.8.0 inserts fraudProofHash at index 1 and appends verifier, taking ' +
        'guardianSlashCases from 5 outputs to 7). Re-vendor the ABI and the reviewed constant, and ' +
        're-review every reader of security-controls.json, before recording this run.',
    );
  }

  const decoded = decodeFunctionResult({ abi, functionName: spec.functionName, data: returnData });
  const members = spec.outputs.length === 1 ? [decoded] : decoded;
  if (!Array.isArray(members)) {
    throw new Error(`${spec.label}: decoded to ${typeof members}, not the ${spec.outputs.length}-member tuple the ABI declares`);
  }
  if (members.length !== spec.outputs.length) {
    throw new Error(
      `${spec.label}: decoded ${members.length} member(s), but the reviewed struct has ${spec.outputs.length} ` +
        `(${render(spec.outputs)})`,
    );
  }
  spec.outputs.forEach((output, i) => assertMemberDomain(spec.label, output, members[i]));
  return Object.fromEntries(spec.outputs.map((output, i) => [output.name, members[i]]));
}

/** The narrow slice of a viem public client this reader needs — keeps the unit tests client-free. */
export type RawCaller = {
  call(args: { to: Address; data: Hex }): Promise<{ data?: Hex }>;
};

/**
 * Read a struct getter through RAW `eth_call` and return the reviewed named object.
 *
 * Deliberately NOT `readContract`: that applies the vendored ABI to the returndata inside viem and
 * hands back an already-truncated tuple, so the length the chain actually sent is unobservable by
 * the time any check runs. Everything this function refuses, it refuses before decoding.
 */
export async function readNamedStruct(params: {
  client: RawCaller;
  address: Address;
  abi: Abi;
  spec: ReviewedStruct;
  args?: readonly unknown[];
}): Promise<NamedStruct> {
  const { client, address, abi, spec, args = [] } = params;
  assertReviewedAbiShape(abi, spec);
  const data = encodeFunctionData({ abi, functionName: spec.functionName, args: args as never });
  const result = await client.call({ to: address, data });
  if (result.data === undefined) {
    throw new Error(
      `${spec.label}: eth_call at ${address} returned no data — the address has no code, or the ` +
        'getter this ABI declares is not on it',
    );
  }
  return decodeNamedStruct(abi, spec, result.data);
}
