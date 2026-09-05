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
import {
  getAccountDvtValidator,
  getMountedDvtValidator,
  getCommitteeState,
  ALG_ID_DVT,
} from './committee.js';

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

describe('getAccountDvtValidator — the anchor that is a deployment fact (FU-65)', () => {
  /**
   * Two REAL deployed accounts that route to DIFFERENT validators. This pair is the whole reason
   * the function exists, so the test is built around it rather than around the canonical book.
   *
   * The second account's PROVENANCE is what gives this evidentiary weight, and it is worth stating
   * because it is not visible from the address: the DVT repo pulled it out of the indexed topics of
   * ~45k blocks of the committee validator's logs — 482 candidates, filtered. **It did not come from
   * an address book.** Had it, the pair would only show "two documents disagree"; coming from logs,
   * it shows two DEPLOYMENTS disagree, which is a fact no amount of editing config files can fix.
   */
  const ACCOUNTS = [
    {
      account: '0x92EA8b02D34A4D5d10f0Db9Ea894e8bC72e292e8',
      router: '0xe68d6A7Bb60DA4caE62ceC2439722fc5eEF87a5c',
      validator: '0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC',
    },
    {
      account: '0x0985785d1fc37978474C472E39391774DcB1C711',
      router: '0xA97A752779ebfDA58612F6727Ec7C8366c39f897',
      validator: '0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9',
    },
  ] as const;

  for (const { account, router, validator } of ACCOUNTS) {
    it.runIf(RUN_ONCHAIN)(`resolves ${account.slice(0, 10)}… through its own validatorRouter()`, async () => {
      const got = await getAccountDvtValidator(client(), account as Address);
      expect(got.router.toLowerCase()).toBe(router.toLowerCase());
      expect(got.validator.toLowerCase()).toBe(validator.toLowerCase());
    });
  }

  it.runIf(RUN_ONCHAIN)('THE PROPERTY: the two accounts resolve to DIFFERENT validators', async () => {
    // Asserting each account's value one at a time would still pass if both rows were stale copies
    // of the same answer. What this function exists for is that the answers DIFFER — so that is
    // asserted directly, and from freshly-read values rather than from the table above.
    const [a1, a2] = await Promise.all(ACCOUNTS.map((x) => getAccountDvtValidator(client(), x.account as Address)));
    expect(a1.router.toLowerCase()).not.toBe(a2.router.toLowerCase());
    expect(a1.validator.toLowerCase()).not.toBe(a2.validator.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('NEGATIVE CONTROL: the canonical book matches ONE of them, not both', async () => {
    // The precise reason a canonical default cannot be correct-by-construction here. If this ever
    // matched both, the two accounts would have converged and the whole per-account framing would
    // need re-reading rather than trusting.
    const canonical = a.aaStarBLSAlgorithm.toLowerCase();
    const resolved = await Promise.all(
      ACCOUNTS.map((x) => getAccountDvtValidator(client(), x.account as Address).then((r) => r.validator.toLowerCase())),
    );
    expect(resolved.filter((v) => v === canonical)).toHaveLength(1);
  });

  it.runIf(RUN_ONCHAIN)('an EOA has no validatorRouter() — it must fail, not resolve to zero', async () => {
    // The failure mode being closed: two zeros in a row read like data. An EOA returns empty
    // calldata, which viem surfaces as a decode failure rather than a zero — either way it must
    // not come back looking like an answer.
    await expect(
      getAccountDvtValidator(client(), '0x000000000000000000000000000000000000dEaD' as Address),
    ).rejects.toThrow();
  });
});
