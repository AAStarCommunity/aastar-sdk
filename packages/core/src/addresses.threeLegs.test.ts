/**
 * The three pointers at the BLS aggregator must agree — asserted from chain, every run.
 *
 * WHY THIS EXISTS
 * ---------------
 * `check:addresses` compares CANONICAL_ADDRESSES against `config.{network}.json`. That is an
 * internal-consistency check: if both sides are wrong in the same way, it stays green. It said
 * nothing while, between 2026-08-26 and 2026-09-01, `Registry.blsAggregator` was repointed to a new
 * aggregator ALONE — `SuperPaymaster.BLS_AGGREGATOR` and `DVTValidator.BLS_AGGREGATOR` still named
 * the old one, and `SuperPaymaster.pendingBLSAgg` was zero, so it was not a timelock window that
 * something would eventually close. It was a settled disagreement, and the reputation path and the
 * slash path were verifying against two different contracts with different thresholds.
 *
 * WHY THE STARTING POINT IS REGISTRY, NOT THE PINNED ADDRESS
 * ----------------------------------------------------------
 * The obvious shortcut — "ask the pinned aggregator who it works with" — cannot tell a live
 * aggregator from a superseded one. Measured on Sepolia, 2026-09-04:
 *
 *   0xEaeC2F51…  BLSAggregator-4.11.0  DVT_VALIDATOR() = 0x568b1486…   ← live
 *   0x174b60bB…  BLSAggregator-4.3.0   DVT_VALIDATOR() = 0x568b1486…   ← superseded
 *   0xF51c0298…  BLSAggregator-4.1.0   DVT_VALIDATOR() = 0x568b1486…   ← superseded further
 *
 * All three answer identically. A check rooted at the pinned aggregator therefore assumes the very
 * thing it is supposed to establish, and would have stayed green through the whole six-day split.
 * `Registry` is the one root that does not: nothing about reading it presupposes that the pin is
 * right. So the chain is Registry → whichever aggregator it names → compare that against the pin
 * and against the other two legs.
 *
 * (Same fail-silent shape the DVT side hit separately: a superseded aggregator also returns the
 * exact same guardians for `validatorAtSlot(1..3)`.)
 *
 * Network reads are opt-in — see the guard below. Skipping is loud, never a silent pass.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from './addresses.js';

const SEPOLIA = 11155111;
const addrs = CANONICAL_ADDRESSES[SEPOLIA];

/**
 * `1` runs the chain reads; unset skips them. Kept opt-in because unit runs must not depend on a
 * public RPC being reachable — but a skip prints why, and CI sets the flag (see ci.yml), so a
 * missing endpoint reads as "not checked here", never as "checked and fine".
 */
const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const ADDRESS_OUT = [{ type: 'address' as const }];

function client() {
  return createPublicClient({ transport: http(RPC) });
}

/** One `() view returns (address)` getter, by name. */
async function readAddressGetter(to: Address, fn: string): Promise<string> {
  const abi = [
    { type: 'function' as const, name: fn, inputs: [], outputs: ADDRESS_OUT, stateMutability: 'view' as const },
  ];
  // viem infers `readonly unknown[]` from a non-const ABI; go through `unknown` rather than
  // widening the ABI type, so the cast stays local to this helper.
  const value = (await client().readContract({ address: to, abi, functionName: fn })) as unknown as string;
  return value.toLowerCase();
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

describe('BLS aggregator: the three legs agree with each other and with the pin', () => {
  it.runIf(RUN_ONCHAIN)('Registry names the aggregator this repo pins', async () => {
    // The root read. Everything below hangs off it precisely because it presupposes nothing.
    const fromRegistry = await readAddressGetter(addrs.registry as Address, 'blsAggregator');
    expect(fromRegistry, `Registry.blsAggregator() must equal CANONICAL_ADDRESSES[${SEPOLIA}].blsAggregator`).toBe(
      addrs.blsAggregator.toLowerCase(),
    );
  });

  it.runIf(RUN_ONCHAIN)('SuperPaymaster and DVTValidator name the SAME one', async () => {
    const fromRegistry = await readAddressGetter(addrs.registry as Address, 'blsAggregator');
    const fromSp = await readAddressGetter(addrs.superPaymaster as Address, 'BLS_AGGREGATOR');
    const fromDvt = await readAddressGetter(addrs.dvtValidator as Address, 'BLS_AGGREGATOR');

    // Reported together on purpose: seeing WHICH leg disagrees is the whole diagnostic. The 2026-08
    // split was exactly one leg moving, and a boolean "legs agree: false" would not have said which.
    const legs = {
      'Registry.blsAggregator': fromRegistry,
      'SuperPaymaster.BLS_AGGREGATOR': fromSp,
      'DVTValidator.BLS_AGGREGATOR': fromDvt,
    };
    expect(new Set(Object.values(legs)).size, `legs disagree: ${JSON.stringify(legs, null, 2)}`).toBe(1);
    expect(fromSp).toBe(addrs.blsAggregator.toLowerCase());
    expect(fromDvt).toBe(addrs.blsAggregator.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('no aggregator rotation is in flight', async () => {
    // A pending rotation means receipts taken now describe neither end of the cutover. Distinct
    // from the legs check: during the 2026-08 split pendingBLSAgg was ZERO, which is what made the
    // split settled rather than transient — so this assertion and the one above catch different states.
    const pending = await readAddressGetter(addrs.superPaymaster as Address, 'pendingBLSAgg');
    expect(pending, 'SuperPaymaster.pendingBLSAgg() is non-zero — the stack is mid-cutover').toBe(
      `0x${'0'.repeat(40)}`,
    );
  });

  it.runIf(RUN_ONCHAIN)('the pinned aggregator really is 4.11.0, not a predecessor', async () => {
    // Version, not just address: a positive control. Without it, the address checks above would
    // still pass against a redeployed contract at the same address (proxy) running something else.
    const version = (await client().readContract({
      address: addrs.blsAggregator as Address,
      abi: [
        { type: 'function' as const, name: 'version', inputs: [], outputs: [{ type: 'string' as const }], stateMutability: 'view' as const },
      ],
      functionName: 'version',
    })) as unknown as string;
    expect(version).toBe('BLSAggregator-4.11.0');
  });

  it('the pin is not one of the superseded aggregators (offline)', () => {
    // Runs without a network, so the most consequential mistake — re-pinning a dead address — is
    // caught even where the chain reads are skipped.
    const superseded: Record<string, string> = {
      '0x174b60bB462b00550F0EC7Bc35Fe39dDB6310158': 'BLSAggregator-4.3.0 (CC-89 production predecessor)',
      '0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13': 'BLSAggregator-4.1.0 (#285/CC-18; has no fraudProofVerifier())',
    };
    for (const [addr, why] of Object.entries(superseded)) {
      expect(eq(addrs.blsAggregator, addr), `blsAggregator is pinned to a superseded aggregator: ${why}`).toBe(false);
    }
  });

  it('skipping the chain reads is loud, not silent', () => {
    // The point of this assertion is the message: a reader scanning output sees either the four
    // on-chain checks or this line, never an unexplained absence.
    if (!RUN_ONCHAIN) {
      console.warn(
        '[three-legs] on-chain assertions SKIPPED — set AASTAR_ONCHAIN_TEST=1 (and SEPOLIA_RPC_URL) to run them. ' +
          'The offline superseded-address check above still ran.',
      );
    }
    expect(typeof RUN_ONCHAIN).toBe('boolean');
  });
});
