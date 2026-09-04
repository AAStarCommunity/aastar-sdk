/**
 * `canonical.dvtValidator` is the DVT validator the LIVE aggregator actually uses.
 *
 * WHY THIS IS NOT ALREADY COVERED
 * ------------------------------
 * `addresses.threeLegs.test.ts` reads `DVTValidator.BLS_AGGREGATOR()` — that is the DVT → aggregator
 * direction, and it proves the DVT validator agrees about which aggregator is current. It does not
 * prove the reverse: that the aggregator agrees `canonical.dvtValidator` is the one it works with.
 * A canonical entry could name a DVT validator that still points at the right aggregator while the
 * aggregator has moved on to a different one.
 *
 * WHY THE OBVIOUS VERSION OF THIS CHECK IS WORTHLESS
 * --------------------------------------------------
 * Reading `DVT_VALIDATOR()` off the PINNED aggregator proves nothing about freshness. Measured on
 * Sepolia, 2026-09-04 — all three aggregators, live and superseded, answer identically:
 *
 *   0xEaeC2F51…  BLSAggregator-4.11.0  DVT_VALIDATOR() = 0x568b1486…   ← live
 *   0x174b60bB…  BLSAggregator-4.3.0   DVT_VALIDATOR() = 0x568b1486…   ← superseded
 *   0xF51c0298…  BLSAggregator-4.1.0   DVT_VALIDATOR() = 0x568b1486…   ← superseded further
 *
 * So "ask the pinned aggregator" is question-begging in exactly the way the three-legs file
 * documents: it assumes you already hold the right aggregator, which is half of what needs proving.
 *
 * WHAT MAKES IT LOAD-BEARING
 * --------------------------
 * Chain the reads from the one root that presupposes nothing:
 *
 *   Registry.blsAggregator()  ──►  that aggregator's DVT_VALIDATOR()  ──►  must equal canonical
 *
 * The first hop establishes WHICH aggregator is live (Registry is authoritative and does not depend
 * on the pin being right); only then does the second hop mean anything. A superseded aggregator
 * cannot satisfy this chain, because it is never what Registry names.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from './addresses.js';

const SEPOLIA = 11155111;
const addrs = CANONICAL_ADDRESSES[SEPOLIA];

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const client = () => createPublicClient({ transport: http(RPC) });

async function readAddressGetter(to: Address, fn: string): Promise<string> {
  const abi = [
    { type: 'function' as const, name: fn, inputs: [], outputs: [{ type: 'address' as const }], stateMutability: 'view' as const },
  ];
  const v = (await client().readContract({ address: to, abi, functionName: fn })) as unknown as string;
  return v.toLowerCase();
}

/** Aggregators that have been superseded. Each still answers `DVT_VALIDATOR()` with the live value. */
const SUPERSEDED_AGGREGATORS = [
  '0x174b60bB462b00550F0EC7Bc35Fe39dDB6310158', // BLSAggregator-4.3.0
  '0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13', // BLSAggregator-4.1.0
] as const;

describe('canonical.dvtValidator is what the LIVE aggregator uses', () => {
  it.runIf(RUN_ONCHAIN)('Registry → live aggregator → DVT_VALIDATOR() == canonical.dvtValidator', async () => {
    // Hop 1 establishes which aggregator is live. Hop 2 only means something because hop 1 ran.
    const liveAggregator = await readAddressGetter(addrs.registry as Address, 'blsAggregator');
    const dvtFromLive = await readAddressGetter(liveAggregator as Address, 'DVT_VALIDATOR');

    expect(
      dvtFromLive,
      `the aggregator Registry names (${liveAggregator}) works with ${dvtFromLive}, ` +
        `but canonical.dvtValidator is ${addrs.dvtValidator}`,
    ).toBe(addrs.dvtValidator.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('the shortcut version of this check would pass against SUPERSEDED aggregators', async () => {
    // Not a check of the SDK — a check of the CHECK. It records, executably, why the test above
    // starts at Registry: if a future edit "simplifies" hop 1 away, this documents what that costs.
    //
    // FU-22. The expected value is read from the LIVE aggregator here, not taken from
    // `canonical.dvtValidator`. Using the pin dragged it into a claim it has nothing to do with —
    // this case is about whether the aggregators AGREE. Measured: with the pin mutated by one
    // character, BOTH cases went red and this one printed "superseded yet still answers", which
    // answers a question nobody asked. Two reds for one fault, and the second one's message sends
    // the reader somewhere else.
    //
    // Rooted this way the two faults separate cleanly, and both directions were measured:
    //   pin wrong                 → only the case above goes red
    //   aggregators stop agreeing → only this case goes red
    const liveAggregator = await readAddressGetter(addrs.registry as Address, 'blsAggregator');
    const liveDvt = await readAddressGetter(liveAggregator as Address, 'DVT_VALIDATOR');

    for (const superseded of SUPERSEDED_AGGREGATORS) {
      const dvt = await readAddressGetter(superseded as Address, 'DVT_VALIDATOR');
      expect(
        dvt,
        `${superseded} is superseded, yet it answers DVT_VALIDATOR() with the same value as the LIVE ` +
          `aggregator ${liveAggregator} — which is exactly why reading it off the PINNED aggregator ` +
          'cannot tell live from superseded. If this ever stops holding, the shortcut has become ' +
          'distinguishing and the comment above needs revisiting rather than trusting.',
      ).toBe(liveDvt);
    }
  });

  it('canonical.dvtValidator is not one of the superseded aggregators (offline)', () => {
    // Cheap, no network, and catches the copy-paste that would be hardest to see: pasting an
    // aggregator address into the dvtValidator slot.
    for (const superseded of SUPERSEDED_AGGREGATORS) {
      expect(addrs.dvtValidator.toLowerCase()).not.toBe(superseded.toLowerCase());
    }
    expect(addrs.dvtValidator.toLowerCase()).not.toBe(addrs.blsAggregator.toLowerCase());
  });
});
