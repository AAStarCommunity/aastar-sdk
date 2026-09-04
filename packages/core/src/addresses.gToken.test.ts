/**
 * `canonical.gToken` is the token the live staking contract actually takes.
 *
 * WHAT FU-1 SAID, AND WHY IT NO LONGER SAYS IT
 * --------------------------------------------
 * The ledger recorded that Sepolia `canonical.gToken` had drifted to `0x8d6Fe002…` while the token
 * the live validator's registry stakes is `0x4c09aE57…`, and `dvt3-register.ts` pinned the second
 * one to route around it. Measured today, `canonical.gToken` IS `0x4c09aE57…` — byte-identical to
 * that pin, so there is nothing left to route around.
 *
 * `0x8d6Fe002…` is real, but it is **op-mainnet's** gToken (`config.op-mainnet.json`). Whatever
 * produced the original reading, the address it named belongs to a different chain, and the note
 * left behind in the script asserted it as a fact about Sepolia. A stale pin is cheap; a comment
 * stating a false fact about the chain is not, because the next reader has no way to tell it from a
 * true one.
 *
 * WHY A TEST RATHER THAN JUST DELETING THE PIN
 * --------------------------------------------
 * Deleting the pin restores the address book as the single source — and removes the only thing that
 * was making the mismatch visible, wrong as it was. If the book drifts for real later, nothing
 * notices. So the pin is replaced by the question it was silently answering: does the live staking
 * contract agree?
 *
 * ROOTED, NOT QUESTION-BEGGING
 * ----------------------------
 *   Registry.GTOKEN_STAKING()  ──►  that contract's GTOKEN()  ──►  must equal canonical.gToken
 *
 * Registry is authoritative and its address does not depend on the pin under test. Reading `GTOKEN()`
 * off a staking contract taken from the address book would assume the half that needs proving —
 * the same shape `addresses.dvt.test.ts` documents for the aggregator. The book's own `staking`
 * entry is then checked against what Registry names, rather than used as the starting point.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from './addresses.js';

const SEPOLIA = 11155111;
const OP_MAINNET = 10;
const addrs = CANONICAL_ADDRESSES[SEPOLIA];

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const client = () => createPublicClient({ transport: http(RPC) });

async function readAddressGetter(to: Address, fn: string): Promise<string> {
  const abi = [
    { type: 'function' as const, name: fn, inputs: [], outputs: [{ type: 'address' as const }], stateMutability: 'view' as const },
  ];
  return String(await client().readContract({ address: to, abi, functionName: fn })).toLowerCase();
}

/** op-mainnet's gToken — the address FU-1 reported as Sepolia's. */
const OP_MAINNET_GTOKEN = '0x8d6Fe002dDacCcFBD377F684EC1825f2E1ab7ef6';

describe('canonical.gToken agrees with the live staking contract', () => {
  it.runIf(RUN_ONCHAIN)('Registry → GTOKEN_STAKING → GTOKEN() == canonical.gToken', async () => {
    // Hop 1 establishes WHICH staking contract is live; hop 2 only means something because it ran.
    const staking = await readAddressGetter(addrs.registry as Address, 'GTOKEN_STAKING');
    const token = await readAddressGetter(staking as Address, 'GTOKEN');

    expect(
      token,
      `the staking contract Registry names (${staking}) takes ${token}, but canonical.gToken is ${addrs.gToken}`,
    ).toBe(addrs.gToken.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('canonical.staking is the staking contract Registry names', async () => {
    // A first draft of this case asserted the OPPOSITE — that the address book had no key for the
    // staking contract — because I probed `addrs.gTokenStaking`, got undefined, and read that as
    // "absent" rather than "I guessed the key name". The key is `staking`. The test went red and
    // that is the only reason the claim did not ship inside a comment as an established fact.
    //
    // An absent lookup has the same three causes as an empty search result: really absent, wrong
    // predicate, or looking at the wrong place. `undefined` distinguishes none of them.
    const staking = await readAddressGetter(addrs.registry as Address, 'GTOKEN_STAKING');
    expect(staking).toBe(addrs.staking.toLowerCase());
  });

  it('Sepolia gToken is not op-mainnet gToken (offline)', () => {
    // The actual confusion behind FU-1: `0x8d6Fe002…` is a genuine gToken, on a different chain.
    // Cheap, no network, and it fails exactly when a cross-chain copy-paste happens again.
    expect(addrs.gToken.toLowerCase()).not.toBe(OP_MAINNET_GTOKEN.toLowerCase());
    const opMainnet = CANONICAL_ADDRESSES[OP_MAINNET];
    if (opMainnet?.gToken) {
      expect(
        opMainnet.gToken.toLowerCase(),
        'op-mainnet and Sepolia must not share a gToken address — if they ever do, one of them was copied',
      ).not.toBe(addrs.gToken.toLowerCase());
    }
  });
});
