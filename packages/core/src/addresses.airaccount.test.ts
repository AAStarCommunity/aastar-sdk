/**
 * AirAccount v0.33.0: the pinned stack is deployed, self-consistent, and is not the previous one.
 *
 * WHY THIS EXISTS
 * ---------------
 * `check:addresses` only compares CANONICAL_ADDRESSES against `config.{network}.json`, and none of
 * the six AirAccount keys below appear in that config — so for these, nothing checked anything at
 * all. The v0.31.0 → v0.33.0 bump was six addresses moving at once; a typo in any one of them would
 * have shipped silently.
 *
 * WHAT "SELF-CONSISTENT" MEANS HERE, AND WHY IT IS THE LOAD-BEARING PART
 * ----------------------------------------------------------------------
 * Checking that each address has code proves only that *something* is deployed there. The stack is
 * a graph, and the edges are what make it the RIGHT stack:
 *
 *   factory.implementation()      must be the pinned impl
 *   router.getAlgorithm(0x01)     must be the pinned committee validator
 *   router.getAlgorithm(0x08)     must be the pinned session-key validator
 *
 * Six addresses that each have code but do not point at each other is exactly what a half-applied
 * bump looks like — and it is the same shape as the aggregator split that `addresses.threeLegs`
 * exists for: every individual read succeeds, and only the relationships between them are wrong.
 *
 * ON TRUNCATED ADDRESSES
 * ----------------------
 * The v0.33.0 router first reached this repo as `0xA97A7527…f897` in a hand-off note. Completing it
 * by guesswork produced an address with `code = 0x`. The values here come from the upstream
 * `.env.sepolia` V0330 block at tag v0.33.0 (0ac628ec), not from any truncated string.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from './addresses.js';

const SEPOLIA = 11155111;
const a = CANONICAL_ADDRESSES[SEPOLIA];

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const client = () => createPublicClient({ transport: http(RPC) });

async function readString(to: Address, fn: string): Promise<string> {
  const abi = [
    { type: 'function' as const, name: fn, inputs: [], outputs: [{ type: 'string' as const }], stateMutability: 'view' as const },
  ];
  return (await client().readContract({ address: to, abi, functionName: fn })) as unknown as string;
}

async function readAddr(to: Address, fn: string, args: unknown[] = []): Promise<string> {
  const inputs = args.map(() => ({ type: 'uint8' as const }));
  const abi = [
    { type: 'function' as const, name: fn, inputs, outputs: [{ type: 'address' as const }], stateMutability: 'view' as const },
  ];
  const v = (await client().readContract({ address: to, abi, functionName: fn, args })) as unknown as string;
  return v.toLowerCase();
}

/** The v0.31.0 stack these six keys moved OFF. Still on chain — that is why it is worth naming. */
const V0310 = {
  aaStarBLSAlgorithm: '0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64',
  aaStarValidator: '0xA15127e8601e77De7C655bf04ca75cccD8C968f0',
  airAccountFactoryV7: '0x25C1E9F9120a406581f93bA82f7Cfd6805512791',
  airAccountV7Impl: '0x4873b7C1c07BE1b52d6583A64F5E902e593BDdad',
  airAccountExtension: '0x79b90Ed6CB97ec48cfDA86399752C58Bbc59D90a',
  agentRegistry: '0x37fc74EaeC81fEdD92876c8713405118Ebc0306e',
} as const;

describe('AirAccount v0.33.0 canonical pins', () => {
  it('none of the six keys is still on the v0.31.0 stack (offline)', () => {
    // Offline on purpose: the single most likely mistake in a six-address bump is leaving one
    // behind, and that must be caught even where the chain reads are skipped.
    for (const [key, old] of Object.entries(V0310)) {
      const current = (a as Record<string, string>)[key];
      expect(current, `${key} is missing from CANONICAL_ADDRESSES[${SEPOLIA}]`).toBeTruthy();
      expect(
        current.toLowerCase(),
        `${key} is still pinned to the v0.31.0 address ${old} — the v0.33.0 bump left it behind`,
      ).not.toBe(old.toLowerCase());
    }
  });

  it('agentRegistry and agentIdentityRegistry stay distinct (offline)', () => {
    // Different contracts with confusable names; conflating them would look like a working pin.
    expect(a.agentRegistry.toLowerCase()).not.toBe(a.agentIdentityRegistry.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('the factory and impl report version 0.33.0', async () => {
    expect(await readString(a.airAccountFactoryV7 as Address, 'FACTORY_VERSION')).toBe('0.33.0');
    expect(await readString(a.airAccountV7Impl as Address, 'ACCOUNT_VERSION')).toBe('0.33.0');
  });

  it.runIf(RUN_ONCHAIN)('the stack points at itself: factory → impl, router → both validators', async () => {
    // The edges, not the nodes. Six deployed-but-unrelated addresses is what a half-applied bump
    // looks like, and every per-address check passes in that state.
    expect(await readAddr(a.airAccountFactoryV7 as Address, 'implementation')).toBe(
      a.airAccountV7Impl.toLowerCase(),
    );
    expect(await readAddr(a.aaStarValidator as Address, 'getAlgorithm', [1])).toBe(
      a.aaStarBLSAlgorithm.toLowerCase(),
    );
    expect(await readAddr(a.aaStarValidator as Address, 'getAlgorithm', [8])).toBe(
      a.sessionKeyValidator.toLowerCase(),
    );
  });

  it.runIf(RUN_ONCHAIN)('the committee validator is armed, so committee framing is the live path', async () => {
    // The SDK must ENCODE per-signer framing when this is true. It is asserted rather than assumed
    // because SDK 0.44.1 shipped legacy framing against an armed validator and every UserOp was
    // rejected on chain with validateUserOp=1 (fixed in 0.45.0).
    const abi = [
      { type: 'function' as const, name: 'committeeActive', inputs: [], outputs: [{ type: 'bool' as const }], stateMutability: 'view' as const },
    ];
    const active = (await client().readContract({
      address: a.aaStarBLSAlgorithm as Address,
      abi,
      functionName: 'committeeActive',
    })) as unknown as boolean;
    expect(active).toBe(true);
  });
});
