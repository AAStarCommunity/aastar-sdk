/**
 * REAL viem + REAL anvil regression for `extractRevertData` (CC-50 round-4 HIGH-1).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `negative-control.test.ts` proved the selector matcher with HAND-BUILT error objects
 * (`Object.assign(new Error('execution reverted'), { data })`). Not one of them was a real viem
 * error graph, so the extractor was never evaluated against the shape it meets in production —
 * and it was wrong there. On `publicClient.readContract` it returned the CONTRACT ADDRESS (when
 * the ABI could not decode the revert) or the DECODED ARGUMENT (when it could), never the revert
 * bytes. The `post-slash BLS liveness` control consequently saw selector `0x00000000` and had one
 * of its two accepted outcomes structurally unreachable.
 *
 * So every case below drives a REAL contract on a REAL chain through REAL viem and asserts on the
 * bytes that come back:
 *
 *   - a custom error the ABI CAN decode        (the 0x1111… decoded-argument trap)
 *   - a custom error the ABI CANNOT decode     (the contract-address trap)
 *   - `Error(string)`                          (0x08c379a0)
 *   - `Panic(uint256)`                         (0x4e487b71)
 *   - an EMPTY revert                          (must extract nothing, not "something nearby")
 *   - the same revert through `call` (no ABI), `simulateContract` and `estimateGas`
 *
 * and, for each one, that the extracted value is NOT the contract address, NOT any decoded
 * argument and NOT the transaction calldata.
 *
 * GATING: anvil is required. Without it the suite skips LOUDLY, and REPCREDIT_ANVIL_TEST=1 turns
 * that skip into a failure — the same discipline as the YAAA HTTP pin, and the reason CI installs
 * Foundry for the main job.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  http,
  numberToHex,
  size,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { NegativeControlFailure, errorSelector, expectViewRejected, extractRevertData } from './negative-control.js';

const REQUIRED = process.env.REPCREDIT_ANVIL_TEST === '1';
const PORT = Number(process.env.REPCREDIT_REVERT_ANVIL_PORT ?? 18_993);
const RPC = `http://127.0.0.1:${PORT}`;

/**
 * Runtime bytecode that ALWAYS reverts with `data`, whatever it is called with.
 *
 *   PUSH2 <len> PUSH2 <15> PUSH1 0 CODECOPY   ; copy the appended blob to memory[0]
 *   PUSH2 <len> PUSH1 0 REVERT                ; revert(0, len)
 *
 * The prefix is exactly 15 (0x0f) bytes, so the blob starts at code offset 15. Built by hand
 * instead of compiled so the suite needs anvil but not solc.
 */
function reverterRuntime(data: Hex): Hex {
  const len = size(data);
  const lenWord = numberToHex(len, { size: 2 }).slice(2);
  const prefix = `0x61${lenWord}61000f600039` + `61${lenWord}6000fd`;
  return concatHex([prefix as Hex, data]);
}

/** revert(0, 0) — a revert carrying no data at all. */
const EMPTY_REVERTER: Hex = '0x60006000fd';

/** Published selectors — independent of anything this repo computes. */
const ERROR_STRING_SELECTOR: Hex = '0x08c379a0';
const PANIC_SELECTOR: Hex = '0x4e487b71';

/** `KeyNotActive(address)` — the real shape that broke the post-slash liveness control. */
const KEY_NOT_ACTIVE_ARG: Address = '0x1111111111111111111111111111111111111111';
const PROBE_ABI = [
  { type: 'function', name: 'probe', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'error', name: 'KeyNotActive', inputs: [{ name: 'key', type: 'address' }] },
] as const satisfies Abi;
/** Same functions, but WITHOUT the error declaration: the "ABI cannot decode this revert" case. */
const PROBE_ABI_NO_ERROR = [PROBE_ABI[0]] as unknown as Abi;

const KEY_NOT_ACTIVE_SELECTOR = errorSelector(PROBE_ABI as unknown as Abi, 'KeyNotActive');
const KEY_NOT_ACTIVE_DATA = concatHex([
  KEY_NOT_ACTIVE_SELECTOR,
  encodeAbiParameters([{ type: 'address' }], [KEY_NOT_ACTIVE_ARG]),
]);
const ERROR_STRING_DATA = concatHex([
  ERROR_STRING_SELECTOR,
  encodeAbiParameters([{ type: 'string' }], ['not allowed']),
]);
const PANIC_DATA = concatHex([PANIC_SELECTOR, encodeAbiParameters([{ type: 'uint256' }], [0x11n])]);

/** anvil's first well-known account — funded, and public by construction. */
const SENDER = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

/** Distinct address per case so a mixed-up address can never look like a pass. */
const ADDR = {
  customDecodable: '0x00000000000000000000000000000000000000a1' as Address,
  customUndecodable: '0x00000000000000000000000000000000000000a2' as Address,
  errorString: '0x00000000000000000000000000000000000000a3' as Address,
  panic: '0x00000000000000000000000000000000000000a4' as Address,
  empty: '0x00000000000000000000000000000000000000a5' as Address,
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

describe('extractRevertData against a real viem error graph (real anvil)', () => {
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
    // `anvil_setCode` installs runtime bytecode directly: no solc, no deploy transaction, and the
    // address is fixed so the "did we extract the ADDRESS instead of the data?" assertion is exact.
    await rpc('anvil_setCode', [ADDR.customDecodable, reverterRuntime(KEY_NOT_ACTIVE_DATA)]);
    await rpc('anvil_setCode', [ADDR.customUndecodable, reverterRuntime(KEY_NOT_ACTIVE_DATA)]);
    await rpc('anvil_setCode', [ADDR.errorString, reverterRuntime(ERROR_STRING_DATA)]);
    await rpc('anvil_setCode', [ADDR.panic, reverterRuntime(PANIC_DATA)]);
    await rpc('anvil_setCode', [ADDR.empty, EMPTY_REVERTER]);
    publicClient = createPublicClient({ chain: foundry, transport: http(RPC) }) as PublicClient;
    booted = true;
  }, 60_000);

  afterAll(() => {
    anvil?.kill('SIGTERM');
  });

  /** Skip loudly, or fail when the gate flag says this suite is required. */
  function requireChain(ctx: { skip: () => void }): boolean {
    if (booted) return true;
    const why = unavailable || 'anvil is not available';
    if (REQUIRED) throw new Error(`REPCREDIT_ANVIL_TEST=1 requires a working anvil, but ${why}`);
    console.warn(`[skip] real-anvil revert-data regression: ${why} (set REPCREDIT_ANVIL_TEST=1 to make this a failure)`);
    ctx.skip();
    return false;
  }

  async function readAndCatch(address: Address, abi: Abi): Promise<unknown> {
    try {
      await publicClient.readContract({ address, abi, functionName: 'probe' });
    } catch (error) {
      return error;
    }
    throw new Error(`readContract on ${address} unexpectedly succeeded`);
  }

  it('states the environment it verified against', ctx => {
    if (!requireChain(ctx)) return;
    console.info(`[anvil] revert-data regression @ ${RPC} (chain 31337, ${Object.keys(ADDR).length} reverters)`);
    expect(booted).toBe(true);
  });

  /**
   * THE REGRESSION. Before the fix this returned `0x…a1` — the contract address itself, scraped
   * out of `ContractFunctionExecutionError.message` ("Contract Call:\n  address: 0x…").
   */
  it('readContract + decodable custom error: extracts the revert bytes, not the decoded argument', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.customDecodable, PROBE_ABI as unknown as Abi);
    const data = extractRevertData(error);
    expect(data).toBe(KEY_NOT_ACTIVE_DATA.toLowerCase());
    expect(data?.slice(0, 10)).toBe(KEY_NOT_ACTIVE_SELECTOR);
    // The two wrong answers the old extractor actually produced:
    expect(data).not.toBe(ADDR.customDecodable.toLowerCase());
    expect(data).not.toContain(KEY_NOT_ACTIVE_ARG.slice(2).toLowerCase() + 'ffff');
    expect(data?.startsWith(KEY_NOT_ACTIVE_ARG.toLowerCase())).toBe(false);
  });

  it('readContract + UNDECODABLE custom error: still extracts the revert bytes, not the address', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.customUndecodable, PROBE_ABI_NO_ERROR);
    const data = extractRevertData(error);
    expect(data?.slice(0, 10)).toBe(KEY_NOT_ACTIVE_SELECTOR);
    expect(data).not.toBe(ADDR.customUndecodable.toLowerCase());
  });

  it('readContract + Error(string): extracts 0x08c379a0…', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.errorString, PROBE_ABI as unknown as Abi);
    const data = extractRevertData(error);
    expect(data).toBe(ERROR_STRING_DATA.toLowerCase());
    expect(data?.slice(0, 10)).toBe(ERROR_STRING_SELECTOR);
  });

  it('readContract + Panic(uint256): extracts 0x4e487b71…', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.panic, PROBE_ABI as unknown as Abi);
    const data = extractRevertData(error);
    expect(data).toBe(PANIC_DATA.toLowerCase());
    expect(data?.slice(0, 10)).toBe(PANIC_SELECTOR);
  });

  /**
   * An empty revert must extract NOTHING. Returning the address here is exactly how a control
   * would end up asserting on a selector the chain never produced.
   */
  it('readContract + empty revert data: extracts nothing at all', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.empty, PROBE_ABI as unknown as Abi);
    expect(extractRevertData(error)).toBeNull();
  });

  it('publicClient.call (no ABI on the path) still works', async ctx => {
    if (!requireChain(ctx)) return;
    let caught: unknown;
    try {
      // Calldata deliberately contains a long 0x run: if the extractor ever scrapes strings again,
      // this is what it would find instead of the revert data.
      await publicClient.call({ to: ADDR.customDecodable, data: `0xdeadbeef${'cd'.repeat(32)}` as Hex });
    } catch (error) {
      caught = error;
    }
    const data = extractRevertData(caught);
    expect(data).toBe(KEY_NOT_ACTIVE_DATA.toLowerCase());
    expect(data).not.toContain('cdcdcdcd');
  });

  it('simulateContract and estimateGas produce the same bytes', async ctx => {
    if (!requireChain(ctx)) return;
    let simulateError: unknown;
    try {
      await publicClient.simulateContract({
        address: ADDR.customDecodable,
        abi: PROBE_ABI as unknown as Abi,
        functionName: 'probe',
        account: SENDER,
      });
    } catch (error) {
      simulateError = error;
    }
    expect(extractRevertData(simulateError)).toBe(KEY_NOT_ACTIVE_DATA.toLowerCase());

    let estimateError: unknown;
    try {
      await publicClient.estimateGas({ account: SENDER, to: ADDR.customDecodable, data: '0x' as Hex });
    } catch (error) {
      estimateError = error;
    }
    expect(extractRevertData(estimateError)).toBe(KEY_NOT_ACTIVE_DATA.toLowerCase());
  });

  /**
   * End-to-end reproduction of the reported failure: the `post-slash BLS liveness` control shape,
   * driven by a real readContract revert. Before the fix this reported
   * "reverted with selector 0x00000000" and the control could not pass.
   */
  it('expectViewRejected accepts the declared selector on a real readContract revert', async ctx => {
    if (!requireChain(ctx)) return;
    const outcome = await expectViewRejected(
      'post-slash BLS liveness',
      () => publicClient.readContract({ address: ADDR.customDecodable, abi: PROBE_ABI as unknown as Abi, functionName: 'probe' }),
      error => (error instanceof Error ? error.message : String(error)),
      { revert: { describe: 'KeyNotActive', selectors: [KEY_NOT_ACTIVE_SELECTOR] } },
    );
    expect(outcome.outcome).toBe('reverted');
  });

  it('…and still FAILS when the chain reverts with a rule the control did not declare', async ctx => {
    if (!requireChain(ctx)) return;
    await expect(
      expectViewRejected(
        'post-slash BLS liveness',
        () => publicClient.readContract({ address: ADDR.panic, abi: PROBE_ABI as unknown as Abi, functionName: 'probe' }),
        error => (error instanceof Error ? error.message : String(error)),
        { revert: { describe: 'KeyNotActive', selectors: [KEY_NOT_ACTIVE_SELECTOR] } },
      ),
    ).rejects.toThrow(NegativeControlFailure);
  });

  /**
   * Mutation check on the extractor itself: the address and the calldata are both valid-looking
   * byte strings, so nothing about their SHAPE rules them out — only never reading those fields
   * does. Assert the two traps are actually present in the error the chain produced, otherwise the
   * cases above would be vacuous.
   */
  it('the traps it must not fall into really are present in the error graph', async ctx => {
    if (!requireChain(ctx)) return;
    const error = await readAndCatch(ADDR.customDecodable, PROBE_ABI as unknown as Abi);
    const rendered = String((error as Error)?.message ?? '');
    expect(rendered.toLowerCase()).toContain(ADDR.customDecodable.toLowerCase());
    // viem's ContractFunctionRevertedError.data is the DECODED object, which is why the old
    // structured branch missed and the string fallback took over.
    const revertedNode = (error as { cause?: { cause?: unknown } })?.cause as
      | { name?: string; data?: unknown; raw?: unknown }
      | undefined;
    expect(revertedNode?.name).toBe('ContractFunctionRevertedError');
    expect(typeof revertedNode?.data).toBe('object');
    expect(revertedNode?.raw).toBe(KEY_NOT_ACTIVE_DATA.toLowerCase());
  });
});
