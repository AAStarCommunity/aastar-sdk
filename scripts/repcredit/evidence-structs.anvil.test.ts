/**
 * REAL viem + REAL anvil regression for the `guardianSlashCases` arity hazard (CC-50 round-10 HIGH;
 * re-polarised to 7 -> 8 by CC-115 B4, and again by SP rc.8, when the shipped ABI and the reviewed
 * constant both moved to the 8-word BLSAggregator-4.13.0 shape).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Round-9's decoder was checked only against hand-built JS values, and that is precisely why it
 * shipped broken: the bug lives in what VIEM does with returndata the ABI does not describe, and no
 * hand-built array can express that. An independent reviewer reproduced it by hand; this file makes
 * the reproduction a regression.
 *
 * The chain here is real: `anvil_setCode` installs contracts that always return fixed static words,
 * one with the 4.13.0 struct (8 words) and one with the deployed 4.11.0 struct (7 words), and the
 * reads below go through real viem against them.
 *
 *   - `publicClient.readContract` with the 4.11.0 ABI (`scripts/repcredit/abis/`, the deployed
 *     artifact) against the 8-word contract is shown to succeed and to hand back slashBps in the
 *     `verifier` slot. That is the bypass, measured, not described: viem drops trailing words in
 *     silence. If viem ever starts rejecting it, this assertion fails and the comment stops being
 *     true.
 *   - `readNamedStruct`, on the SAME address with the SAME ABI, is shown to THROW before decoding.
 *   - the SHIPPED (4.13.0) ABI + reviewed constant reads the 8-word contract correctly: no false
 *     positive on the rc.8 shape.
 *   - the shipped pair REFUSES the 7-word (deployed 4.11.0) contract by word count, which is what an
 *     rc.8 build pointed at today's Sepolia aggregator must do.
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

// This file's import graph reaches child_process (directly, through a helper, or via a
// non-literal import()). execFileSync / spawn block the event loop vitest's timer runs on,
// so this bounds the verdict, not a hung child. A describe timeout does not cover hooks.
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

const REQUIRED = process.env.REPCREDIT_ANVIL_TEST === '1';
const PORT = Number(process.env.REPCREDIT_STRUCT_ANVIL_PORT ?? 18_994);
const RPC = `http://127.0.0.1:${PORT}`;

const SDK_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The SHIPPED ABI (BLSAggregator-4.13.0, 8 outputs) — the same file `check:abi-drift` pins by sha256. */
const SHIPPED_BLS_ABI = JSON.parse(
  readFileSync(join(SDK_REPO, 'packages/core/src/abis/BLSAggregator.json'), 'utf8'),
).abi as Abi;
/** The DEPLOYED 4.11.0 artifact (7 outputs), as vendored for the deployed-stack check. */
const DEPLOYED_4110_ABI = JSON.parse(
  readFileSync(join(SDK_REPO, 'scripts/repcredit/abis/BLSAggregator-4.11.0.deployed.json'), 'utf8'),
).abi as Abi;

/** The 4.11.0 outputs, as a literal: a build pinned to the deployed stack would review exactly these. */
const DEPLOYED_SEVEN_OUTPUTS = [
  { name: 'guardiansHash', type: 'bytes32' },
  { name: 'fraudProofHash', type: 'bytes32' },
  { name: 'deadline', type: 'uint64' },
  { name: 'status', type: 'uint8' },
  { name: 'guardianCount', type: 'uint16' },
  { name: 'resolvedCount', type: 'uint16' },
  { name: 'verifier', type: 'address' },
] as const;
const DEPLOYED_SEVEN_SPEC = { ...GUARDIAN_SLASH_CASE, outputs: [...DEPLOYED_SEVEN_OUTPUTS] };

/** Distinctive values, so every mis-slotting is identifiable. */
const GUARDIANS_HASH = `0x${'aa'.repeat(32)}` as Hex;
const FRAUD_PROOF_HASH = `0x${'bb'.repeat(32)}` as Hex;
const DEADLINE = 1_900_000_000n;
const STATUS = 2;
const GUARDIAN_COUNT = 3;
const RESOLVED_COUNT = 3;
const VERIFIER = `0x${'cc'.repeat(20)}` as Address;

const SLASH_BPS = 500;

/** What the REVIEWED (= 4.13.0, rc.8) contract returns. */
const EIGHT_WORDS = encodeAbiParameters(
  GUARDIAN_SLASH_CASE.outputs.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, FRAUD_PROOF_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT, SLASH_BPS, VERIFIER],
);
/** What the deployed 4.11.0 contract returns: same selector, one word shorter. */
const SEVEN_WORDS = encodeAbiParameters(
  DEPLOYED_SEVEN_OUTPUTS.map(o => ({ type: o.type })),
  [GUARDIANS_HASH, FRAUD_PROOF_HASH, DEADLINE, STATUS, GUARDIAN_COUNT, RESOLVED_COUNT, VERIFIER],
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
  /** returns the deployed 4.11.0 shape's 7 words */
  deployedSeven: '0x00000000000000000000000000000000000000b1' as Address,
  /** returns the REVIEWED 8 words (= 4.13.0), at the same selector */
  reviewedEight: '0x00000000000000000000000000000000000000b2' as Address,
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

describe('guardianSlashCases 7 -> 8 against a real chain', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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
    await rpc('anvil_setCode', [ADDR.deployedSeven, returnerRuntime(SEVEN_WORDS)]);
    await rpc('anvil_setCode', [ADDR.reviewedEight, returnerRuntime(EIGHT_WORDS)]);
    publicClient = createPublicClient({ chain: foundry, transport: http(RPC) }) as PublicClient;
    booted = true;
  }, 40_000);

  afterAll(() => {
    anvil?.kill('SIGKILL');
  }, SPAWN_VERDICT_TIMEOUT_MS);

  function guard(): boolean {
    if (booted) return true;
    if (REQUIRED) throw new Error(`REPCREDIT_ANVIL_TEST=1 but ${unavailable || 'anvil is unavailable'}`);
    console.warn(`SKIP: ${unavailable || 'anvil is unavailable'}`);
    return false;
  }

  it('THE BYPASS: real viem readContract with the 7-output 4.11.0 ABI silently accepts the 8-word answer', async () => {
    if (!guard()) return;
    // Measured, not asserted in prose: viem does not revert and does not warn. It decodes the
    // first seven words and drops the eighth, so `verifier` comes back holding slashBps and the
    // real verifier address is gone. Nothing downstream can tell.
    const raw = (await publicClient.readContract({
      address: ADDR.reviewedEight,
      abi: DEPLOYED_4110_ABI,
      functionName: 'guardianSlashCases',
      args: [1n],
    })) as readonly unknown[];
    expect(raw).toHaveLength(7);
    expect(raw[0]).toBe(GUARDIANS_HASH);
    // Slot 6 is `verifier` per the 4.11.0 ABI, but the bytes at that offset are slashBps's.
    expect(raw[6]).not.toBe(getAddress(VERIFIER));
  });

  it('THE FIX: readNamedStruct refuses the same call on the same chain, before decoding', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.reviewedEight,
        abi: DEPLOYED_4110_ABI,
        spec: DEPLOYED_SEVEN_SPEC,
        args: [1n],
      }),
    ).rejects.toThrow(/returned 8 word\(s\) but the vendored ABI declares 7 statically-sized output\(s\)/);
  });

  it('NO false positive: the shipped 4.13.0 ABI + reviewed constant read the 8-word contract correctly', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.reviewedEight,
        abi: SHIPPED_BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [1n],
      }),
    ).resolves.toEqual({
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

  it('THE LIVE ONE: the shipped pair refuses the 7-word deployed 4.11.0 contract by word count', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.deployedSeven,
        abi: SHIPPED_BLS_ABI,
        spec: GUARDIAN_SLASH_CASE,
        args: [1n],
      }),
    ).rejects.toThrow(/returned 7 word\(s\) but the vendored ABI declares 8 statically-sized output\(s\)/);
  });

  it('a matched 4.11.0 pair still reads the 7-word contract: the refusal is about the mismatch', async () => {
    if (!guard()) return;
    await expect(
      readNamedStruct({
        client: publicClient,
        address: ADDR.deployedSeven,
        abi: DEPLOYED_4110_ABI,
        spec: DEPLOYED_SEVEN_SPEC,
        args: [1n],
      }),
    ).resolves.toMatchObject({ resolvedCount: RESOLVED_COUNT, verifier: getAddress(VERIFIER) });
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
