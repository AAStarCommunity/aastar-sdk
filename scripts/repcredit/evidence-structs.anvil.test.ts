/**
 * REAL viem + REAL anvil regression for the 5 -> 7 `guardianSlashCases` hazard (CC-50 round-10 HIGH).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Round-9's decoder was checked only against hand-built JS values, and that is precisely why it
 * shipped broken: the bug lives in what VIEM does with returndata the ABI does not describe, and no
 * hand-built array can express that. An independent reviewer reproduced it by hand; this file makes
 * the reproduction a regression.
 *
 * The chain here is real: `anvil_setCode` installs a contract that always returns the SEVEN static
 * words of the upstream BLSAggregator 4.8.0 struct, and the reads below go through real viem
 * against it.
 *
 *   - `publicClient.readContract` with this repo's FIVE-output vendored ABI is shown to succeed and
 *     to hand back `fraudProofHash` in the `deadline` slot. That is the bypass, measured, not
 *     described — if viem ever starts rejecting it, this assertion fails and the comment above it
 *     stops being true.
 *   - `readNamedStruct`, on the SAME address with the SAME ABI, is shown to THROW before decoding.
 *     That is the fix, and it is what aborts the evidence runner.
 *   - a matched pair (7-output ABI + 7-field reviewed constant) is shown to decode the right values
 *     off the same contract, so the refusal is about the mismatch and not about strictness.
 *   - a 5-word contract read with the shipped ABI decodes correctly, so the gate has no false
 *     positive on today's pinned upstream.
 *
 * GATING: anvil is required. Without it the suite skips LOUDLY, and REPCREDIT_ANVIL_TEST=1 turns
 * that skip into a failure — the same discipline as `revert-data.anvil.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  numberToHex,
  size,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { foundry } from 'viem/chains';
import { GUARDIAN_SLASH_CASE, readNamedStruct } from './evidence-structs.js';

const REQUIRED = process.env.REPCREDIT_ANVIL_TEST === '1';
const PORT = Number(process.env.REPCREDIT_STRUCT_ANVIL_PORT ?? 18_994);
const RPC = `http://127.0.0.1:${PORT}`;

const SDK_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The SHIPPED five-output ABI — the same file `check:abi-drift` pins by sha256. */
const SHIPPED_BLS_ABI = JSON.parse(
  readFileSync(join(SDK_REPO, 'packages/core/src/abis/BLSAggregator.json'), 'utf8'),
).abi as Abi;

/** The upstream 4.8.0 outputs (repo:sp, CC-48): fraudProofHash inserted @1, verifier appended. */
const RESHAPED_OUTPUTS = [
  { name: 'guardiansHash', type: 'bytes32' },
  { name: 'fraudProofHash', type: 'bytes32' },
  { name: 'deadline', type: 'uint64' },
  { name: 'status', type: 'uint8' },
  { name: 'guardianCount', type: 'uint16' },
  { name: 'resolvedCount', type: 'uint16' },
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
const RESHAPED_SPEC = { ...GUARDIAN_SLASH_CASE, outputs: [...RESHAPED_OUTPUTS] };

/** Distinctive values, so every mis-slotting is identifiable. */
const GUARDIANS_HASH = `0x${'aa'.repeat(32)}` as Hex;
const FRAUD_PROOF_HASH = `0x${'bb'.repeat(32)}` as Hex;
const DEADLINE = 1_900_000_000n;
const STATUS = 2;
const GUARDIAN_COUNT = 3;
const RESOLVED_COUNT = 3;
const VERIFIER = `0x${'cc'.repeat(20)}` as Address;

const SEVEN_WORDS = encodeAbiParameters(
  RESHAPED_OUTPUTS.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, FRAUD_PROOF_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT, VERIFIER],
);
const FIVE_WORDS = encodeAbiParameters(
  GUARDIAN_SLASH_CASE.outputs.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT],
);

/**
 * Runtime bytecode that ALWAYS returns `data`, whatever it is called with. Same construction as
 * `revert-data.anvil.test.ts`'s reverter, ending in RETURN instead of REVERT:
 *
 *   PUSH2 <len> PUSH2 <0x0f> PUSH1 0 CODECOPY   ; copy the appended blob to memory[0]
 *   PUSH2 <len> PUSH1 0 RETURN                  ; return(0, len)
 *
 * The prefix is exactly 15 (0x0f) bytes, so the blob starts at code offset 15. Hand-built so the
 * suite needs anvil but not solc.
 */
function returnerRuntime(data: Hex): Hex {
  const len = size(data);
  const lenWord = numberToHex(len, { size: 2 }).slice(2);
  const prefix = `0x61${lenWord}61000f600039` + `61${lenWord}6000f3`;
  return concatHex([prefix as Hex, data]);
}

/** Distinct address per case so a mixed-up address can never look like a pass. */
const ADDR = {
  sevenWord: '0x00000000000000000000000000000000000000b1' as Address,
  fiveWord: '0x00000000000000000000000000000000000000b2' as Address,
  noCode: '0x00000000000000000000000000000000000000b3' as Address,
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} -> HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(`${method} -> ${body.error.message}`);
  return body.result;
}

async function waitFor(check: () => Promise<boolean>, tries: number, delayMs: number): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      if (await check()) return true;
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

describe('guardianSlashCases 5 -> 7 against a real chain', () => {
  let anvil: ChildProcess | undefined;
  let booted = false;
  let unavailable = '';
  let publicClient: PublicClient;

  beforeAll(async () => {
    anvil = spawn('anvil', ['--port', String(PORT), '--chain-id', '31337', '--silent'], { stdio: 'ignore' });
    anvil.once('error', error => {
      unavailable = `anvil could not be started: ${String(error)}`;
    });
    const up = await waitFor(async () => {
      await rpc('eth_chainId', []);
      return true;
    }, 60, 250);
    if (!up) {
      unavailable ||= `anvil did not answer on ${RPC} within 15s`;
      return;
    }
    await rpc('anvil_setCode', [ADDR.sevenWord, returnerRuntime(SEVEN_WORDS)]);
    await rpc('anvil_setCode', [ADDR.fiveWord, returnerRuntime(FIVE_WORDS)]);
    publicClient = createPublicClient({ chain: foundry, transport: http(RPC) }) as PublicClient;
    booted = true;
  }, 40_000);

  afterAll(() => {
    anvil?.kill('SIGKILL');
  });

  function guard(): boolean {
    if (booted) return true;
    if (REQUIRED) throw new Error(`REPCREDIT_ANVIL_TEST=1 but ${unavailable || 'anvil is unavailable'}`);
    console.warn(`SKIP: ${unavailable || 'anvil is unavailable'}`);
    return false;
  }

  it('THE BYPASS: real viem readContract with the 5-output ABI silently mislabels the 7-word answer', async () => {
    if (!guard()) return;
    // This is the round-9 failure, measured. viem does not revert, does not warn, and hands back
    // five members: guardiansHash, then fraudProofHash under the name deadline, and so on.
    const raw = (await publicClient.readContract({
      address: ADDR.sevenWord,
      abi: SHIPPED_BLS_ABI,
      functionName: 'guardianSlashCases',
      args: [1n],
    })) as readonly unknown[];
    expect(raw).toHaveLength(5);
    expect(raw[0]).toBe(GUARDIANS_HASH);
    // Slot 1 is `deadline` per the vendored ABI, but the bytes are fraudProofHash's.
    expect(raw[1]).toBe(BigInt(FRAUD_PROOF_HASH));
    expect(raw[1]).not.toBe(DEADLINE);
    // Slot 2 is `status`, carrying the real deadline. uint8 truncation makes it unrecognisable.
    expect(raw[2]).not.toBe(STATUS);
  });

  it('THE FIX: readNamedStruct refuses the same call on the same chain, before decoding', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.sevenWord,
        abi: SHIPPED_BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [1n],
      }),
    ).rejects.toThrow(/returned 7 word\(s\) but the vendored ABI declares 5 statically-sized output\(s\)/);
  });

  it('a MATCHED 7-output ABI + reviewed constant reads the right values off that same contract', async () => {
    if (!guard()) return;
    // Proves the refusal above is about the mismatch, not about the reader being unable to read a
    // 7-field struct: this is the positive case the B2 re-vendor will land.
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.sevenWord,
        abi: RESHAPED_ABI,
        spec: RESHAPED_SPEC,
        args: [1n],
      }),
    ).resolves.toEqual({
      guardiansHash: GUARDIANS_HASH,
      fraudProofHash: FRAUD_PROOF_HASH,
      deadline: DEADLINE,
      status: STATUS,
      guardianCount: GUARDIAN_COUNT,
      resolvedCount: RESOLVED_COUNT,
      verifier: getAddress(VERIFIER),
    });
  });

  it('NO false positive: the shipped ABI reads a real 5-word contract correctly', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.fiveWord,
        abi: SHIPPED_BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [1n],
      }),
    ).resolves.toEqual({
      guardiansHash: GUARDIANS_HASH,
      deadline: DEADLINE,
      status: STATUS,
      guardianCount: GUARDIAN_COUNT,
      resolvedCount: RESOLVED_COUNT,
    });
  });

  it('an address with no code is a failure, not an all-zero struct', async () => {
    if (!guard()) return;
    // `readContract` on a codeless address throws a viem decode error; the raw path says why.
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.noCode,
        abi: SHIPPED_BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [1n],
      }),
    ).rejects.toThrow(/EMPTY returndata|returned no data/);
  });
});
