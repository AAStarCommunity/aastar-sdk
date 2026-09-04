/**
 * The committee path resolved end-to-end against the LIVE v0.33.0 validator.
 *
 * WHY A SEPARATE FILE FROM committee.test.ts
 * ------------------------------------------
 * That file drives stubs, and it is right to: it pins the SHAPE of the logic (perSignerBytes is
 * derived from a chain-read TREE_DEPTH rather than a constant — CC-103 Q4) and can assert cases the
 * chain will not produce on demand, like `committeeActive: false`. What a stub cannot tell you is
 * whether the values it feeds still match the validator that is actually mounted today.
 *
 * T5.2.1 moved the router from v0.31.0 to v0.33.0, and with it the validator behind algId 0x01
 * (0x1A8Db639… → 0x7ac7E9d4…). The encoder is validator-agnostic by construction, so nothing in
 * the SDK needed to change — but "nothing needed to change" is a claim about the live contract, and
 * the only way to hold it is to read the live contract.
 *
 * THE FAILURE THIS GUARDS
 * -----------------------
 * SDK 0.44.1 encoded legacy framing against an armed committee validator. It did not throw
 * anywhere in the SDK; every UserOperation was rejected on chain with validateUserOp=1. So the
 * question these tests ask is not "does the encoder run" — it always ran — but "do the values the
 * encoder derives still match what the mounted validator expects".
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from '../addresses.js';
import { getMountedDvtValidator, getCommitteeState, ALG_ID_DVT } from './committee.js';

const SEPOLIA = 11155111;
const a = CANONICAL_ADDRESSES[SEPOLIA];

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const client = () => createPublicClient({ transport: http(RPC) }) as never;

describe('committee path against the live v0.33.0 stack', () => {
  it.runIf(RUN_ONCHAIN)('the router resolves algId 0x01 to the pinned validator', async () => {
    // The SDK never hardcodes the validator — it asks the router. This asserts that the resolver
    // and the address book agree about the SAME contract, which is what actually breaks when a
    // router bump lands in canonical but the validator pin is left behind (or vice versa).
    const mounted = (await getMountedDvtValidator(client(), a.aaStarValidator as Address)) as string;
    expect(mounted.toLowerCase()).toBe(a.aaStarBLSAlgorithm.toLowerCase());
    expect(ALG_ID_DVT).toBe(0x01);
  });

  it.runIf(RUN_ONCHAIN)('the live validator is armed, so committee framing is the required encoding', async () => {
    const state = await getCommitteeState(client(), a.aaStarBLSAlgorithm as Address);
    // `active` tracks epochLength != 0 — a governance setting, stable between deliberate changes.
    expect(state.active).toBe(true);
    // The derivation, not the value. perSignerBytes must follow the depth this very call read.
    expect(state.perSignerBytes).toBe(64 + state.treeDepth * 32);
  });

  it.runIf(RUN_ONCHAIN)('quorumUsable is derived from requiredQuorum, and is NOT asserted as a value', async () => {
    // A first draft asserted `quorumUsable === true`. It passed, then failed 15 minutes later on an
    // unchanged tree: `requiredQuorum` had become the fail-closed sentinel type(uint256).max because
    // the epoch rolled and no snapshot was pinned for the previous one. That assertion was pinning a
    // TRANSIENT operational state, so it could only ever be flaky.
    //
    // What IS time-independent is the SDK's own derivation, and that is worth holding: if
    // quorumUsable ever stopped tracking the sentinel, callers would submit payloads that cannot
    // succeed and get no warning from the SDK.
    //
    // (Also dropped: `expect(requiredQuorum).toBeGreaterThan(0n)` — the sentinel is 2^256-1, so
    // that assertion passed hardest exactly when the validator was least usable.)
    const SENTINEL = (1n << 256n) - 1n;
    const state = await getCommitteeState(client(), a.aaStarBLSAlgorithm as Address);
    expect(state.quorumUsable).toBe(state.requiredQuorum !== SENTINEL);
    if (!state.quorumUsable) {
      console.warn(
        `[committee] live validator ${a.aaStarBLSAlgorithm} currently reports requiredQuorum = sentinel: ` +
          'committee validation CANNOT succeed right now (no usable pinned snapshot for the previous epoch). ' +
          'That is an operational state of the DVT side, not an SDK defect — but a payload submitted now is rejected.',
      );
    }
  });

  it.runIf(RUN_ONCHAIN)('perSignerBytes derived from the LIVE depth is 512 on this validator', async () => {
    // Two assertions doing different jobs: the one above proves the FORMULA tracks the chain; this
    // one records what that formula currently yields, so a silent depth change on the mounted
    // validator shows up as a diff here rather than as malformed calldata later.
    const state = await getCommitteeState(client(), a.aaStarBLSAlgorithm as Address);
    expect(state.treeDepth).toBe(14);
    expect(state.perSignerBytes).toBe(512);
  });

  it.runIf(RUN_ONCHAIN)('the v0.31.0 validator is ALSO armed — so "armed" cannot prove freshness', async () => {
    // The negative control that matters. A stale pin at 0x1A8Db639… keeps answering
    // committeeActive()==true, so any check that only asks "is it armed" stays green against a
    // superseded validator. What separates them is the router: it mounts exactly one.
    const stale = '0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64' as Address;
    const staleState = await getCommitteeState(client(), stale);
    expect(staleState.active).toBe(true);
    expect(stale.toLowerCase()).not.toBe(a.aaStarBLSAlgorithm.toLowerCase());

    const mounted = (await getMountedDvtValidator(client(), a.aaStarValidator as Address)) as string;
    expect(mounted.toLowerCase()).not.toBe(stale.toLowerCase());
  });
});
