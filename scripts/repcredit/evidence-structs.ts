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
 * Step 4 is the load-bearing one for the 5 -> 7 hazard, and it is the only check that can be
 * stated with certainty for an all-static tuple: the ABI encoding of N static outputs is exactly
 * N words, so any other length means the contract is not the one this ABI describes. For a tuple
 * containing a dynamic member (`roleLocks.metadata`) no such equality exists, so that getter is
 * covered by steps 3 and 5 only — and this file says so rather than implying otherwise.
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
  outputs: [
    { name: 'guardiansHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'status', type: 'uint8' },
    { name: 'guardianCount', type: 'uint16' },
    { name: 'resolvedCount', type: 'uint16' },
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
