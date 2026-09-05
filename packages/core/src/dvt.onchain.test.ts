/**
 * `DVT_CONFIG` held against the chain, and the two node lists held against each other.
 *
 * WHAT WENT STALE, AND WHY NOTHING NOTICED
 * ----------------------------------------
 * `DVT_CONFIG.sepolia.validator` was `0x539B9681…`, above a comment reading
 * "router.getAlgorithm(0x01) on-chain verified". It had been verified — and then the router moved.
 * Measured on Sepolia while writing this file:
 *
 *   router.getAlgorithm(0x01)          = 0x7ac7E9d4…   ← what actually validates today
 *   DVT_CONFIG.sepolia.validator       = 0x539B9681…   ← what the config said
 *   0x539B9681… code size              = 13610 bytes   ← still deployed
 *   0x539B9681….isRegistered(node 1-3) = true × 3      ← still knows our nodes
 *   0x7ac7E9d4….isRegistered(node 1-3) = true × 3
 *
 * So neither "it has code" nor "it recognises our nodes" separates the live validator from the
 * superseded one — both answer, and both answer the same. That is the same shape
 * `addresses.dvt.test.ts` records for the aggregators, and the reason this test starts at the
 * router: the router mounts exactly one.
 *
 * No code read the field, which is why it could go stale in silence. A field nothing consumes is
 * not a field nothing will ever consume; it is a wrong answer waiting for its first caller.
 *
 * WHICH ASSERTION IS ACTUALLY LOAD-BEARING
 * ----------------------------------------
 * Mutating `validator` back to `0x539B9681…` reds two cases — but that does not show the on-chain
 * anchor is doing the work, because the offline case hardcodes `0x539B9681…` and would have caught
 * it alone. And the fault this file exists to prevent is the NEXT one: the router moving to an
 * address no literal here mentions, which the offline case would sail straight through.
 *
 * Measured, three mutations of increasing honesty:
 *
 *   validator → 0x539B (the old value)          4 red — but the offline case hardcodes 0x539B, so
 *                                               this shows nothing about the on-chain anchor.
 *   validator → 0xEaeC (a third address)         4 red — the offline case still catches it, because
 *                                               its second assertion anchors to the address book.
 *   validator AND canonical.aaStarBLSAlgorithm   OFFLINE GREEN, router assertion RED. ← the proof.
 *     → 0xEaeC
 *
 * The third is the one that settles it: every cheap, offline check is satisfied — the config and the
 * address book agree with each other perfectly — and only the read from the router says otherwise.
 * That is the shape the next staleness will actually have, since whoever moves one pin moves both.
 *
 * (Two other cases also red in that run — the superseded-validator and requireStake ones — because
 * `0xEaeC2F51…` is the aggregator and has neither function. Instrument side effects of the address
 * chosen, not evidence; reported so the count is not mistaken for four independent detections.)
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { CANONICAL_ADDRESSES } from './addresses.js';
import { DVT_CONFIG } from './dvt.js';
import { DEFAULT_DVT_NODES, getDefaultDvtNodes } from './crypto/dvtNodes.js';
import { committeeLeavesAt } from './actions/committeeTree.js';

/**
 * Log-replay needs an endpoint that serves `eth_getLogs` over history CONSISTENTLY; the free public
 * one does not (FU-38). Same gate as `committeeTree.test.ts`, same reason: a flaky instrument that
 * fails the way the bug fails cannot be told apart from the bug.
 */
const ARCHIVE_RPC = process.env.AASTAR_ARCHIVE_RPC_URL;
const RUN_LOGS = process.env.AASTAR_ONCHAIN_TEST === '1' && !!ARCHIVE_RPC;
const archiveClient = () => createPublicClient({ transport: http(ARCHIVE_RPC!) }) as never;

const SEPOLIA = 11155111;
const addrs = CANONICAL_ADDRESSES[SEPOLIA];
const sepoliaEnv = DVT_CONFIG.environments.sepolia!;

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const client = () => createPublicClient({ transport: http(RPC) });

/** The validator this config used to name — superseded, still deployed, still answering. */
const SUPERSEDED_VALIDATOR = '0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC';

describe('DVT_CONFIG.validator is what the router mounts', () => {
  it.runIf(RUN_ONCHAIN)('router.getAlgorithm(0x01) == DVT_CONFIG.sepolia.validator', async () => {
    const abi = [
      {
        type: 'function' as const,
        name: 'getAlgorithm',
        inputs: [{ type: 'uint8' as const }],
        outputs: [{ type: 'address' as const }],
        stateMutability: 'view' as const,
      },
    ];
    const mounted = String(
      await client().readContract({ address: addrs.aaStarValidator as Address, abi, functionName: 'getAlgorithm', args: [1] }),
    ).toLowerCase();

    expect(
      mounted,
      `the router mounts ${mounted} at algId 0x01, but DVT_CONFIG.sepolia.validator is ${sepoliaEnv.validator}`,
    ).toBe(sepoliaEnv.validator.toLowerCase());
  });

  it.runIf(RUN_ONCHAIN)('the superseded validator still reports our nodes as registered', async () => {
    // The negative control, and the reason the check above cannot be replaced by something cheaper.
    // `isRegistered` is the intuitive way to ask "is this the right validator?" and it says yes to
    // both. If these two ever start disagreeing, this test fails and the comment above needs
    // revisiting rather than trusting.
    const abi = [
      {
        type: 'function' as const,
        name: 'isRegistered',
        inputs: [{ type: 'bytes32' as const }],
        outputs: [{ type: 'bool' as const }],
        stateMutability: 'view' as const,
      },
    ];
    for (const node of sepoliaEnv.dvtNodes) {
      for (const validator of [SUPERSEDED_VALIDATOR, sepoliaEnv.validator]) {
        const registered = await client().readContract({
          address: validator as Address,
          abi,
          functionName: 'isRegistered',
          args: [node.nodeId as `0x${string}`],
        });
        expect(registered, `${validator} does not know ${node.url} (${node.nodeId})`).toBe(true);
      }
    }
  });


  it.runIf(RUN_ONCHAIN)('requireStake() is ON — the self-chosen-nodeId path stays closed', async () => {
    // FU-34/FU-16. `registerPublicKey(bytes32,bytes)` lets the caller NAME the nodeId, which would
    // allow one BLS key under two ids — and an aggregate that counts one key twice, meeting a
    // threshold it did not actually meet. Nothing in the SDK, the encoder, or the on-chain
    // strictly-ascending rule can see that.
    //
    // Measured, from an unrelated address with a chosen id:
    //   48 / 64 / 192 bytes → "Invalid public key length"
    //   128 bytes           → "Staking on: use registerWithProof"    ← the real gate
    //   requireStake()      → true
    //
    // So the door is argument-shaped but BOLTED, and `registerWithProof` derives
    // `nodeId = keccak256(pubkey)`. The gap is therefore unreachable today — held shut by a
    // governance FLAG, not by the interface. A first draft of this reasoning stopped at the ABI
    // signature and concluded the opposite; the shape of a function says what you may ask for, not
    // what the contract will do.
    //
    // Hence this test watches the flag rather than the code: flipping it leaves every source file
    // in this repo untouched, so a code-level check could never notice.
    const requireStake = await client().readContract({
      // Read off the field under test, not off the address book. The two are pinned equal by the
      // first case in this file, so the old form was correct — but only provably so two hops away,
      // and a reader at this line could not tell. (Raised in review on #345.)
      address: sepoliaEnv.validator as Address,
      abi: [{ type: 'function' as const, name: 'requireStake', inputs: [], outputs: [{ type: 'bool' as const }], stateMutability: 'view' as const }],
      functionName: 'requireStake',
    });
    expect(
      requireStake,
      'requireStake() has been turned OFF on the mounted validator: registerPublicKey now accepts a ' +
        'caller-chosen nodeId, which makes the FU-16 same-key-two-ids gap reachable. This is a ' +
        'governance change, not a code change — re-read FU-34 before dismissing this failure.',
    ).toBe(true);
  });

  it('the config does not point at the superseded validator (offline)', () => {
    expect(sepoliaEnv.validator.toLowerCase()).not.toBe(SUPERSEDED_VALIDATOR.toLowerCase());
    expect(sepoliaEnv.validator.toLowerCase()).toBe(addrs.aaStarBLSAlgorithm.toLowerCase());
  });
});

describe('there is ONE node list (FU-12)', () => {
  it('DEFAULT_DVT_NODES carries the same values as DVT_CONFIG.sepolia', () => {
    // Value equality rather than identity: `DEFAULT_DVT_NODES` maps into frozen copies, so `toBe`
    // would fail on a correct implementation. What must hold is that no second literal exists to
    // drift — a re-forked copy passes this on the day it is written and fails on the day one side
    // is edited, which is exactly when it matters.
    expect(DEFAULT_DVT_NODES[SEPOLIA]).toEqual(
      sepoliaEnv.dvtNodes.map((n) => ({ url: n.url, nodeId: n.nodeId })),
    );
    expect(getDefaultDvtNodes(SEPOLIA)).toHaveLength(sepoliaEnv.dvtNodes.length);
  });

  it('the chain key comes from the config, not from a second hardcoded 11155111', () => {
    expect(Object.keys(DEFAULT_DVT_NODES).map(Number)).toEqual([sepoliaEnv.chainId]);
  });

  it('getDefaultDvtNodes deliberately does NOT follow AASTAR_DVT_ENV', () => {
    // Pinned because it is a real semantic difference and the obvious "cleanup" is to erase it.
    // This export is keyed by CHAIN — "the published always-on nodes for chain N" — while
    // getDvtConfig() answers "which nodes should this run talk to". Routing the env switch through
    // here would silently redirect every chain-keyed caller to localhost.
    const before = process.env.AASTAR_DVT_ENV;
    try {
      process.env.AASTAR_DVT_ENV = 'testnet-local';
      for (const node of getDefaultDvtNodes(SEPOLIA)) {
        expect(node.url).not.toMatch(/127\.0\.0\.1|localhost/);
      }
    } finally {
      if (before === undefined) delete process.env.AASTAR_DVT_ENV;
      else process.env.AASTAR_DVT_ENV = before;
    }
  });
});

describe('entryPoint is anchored, not just written twice (FU-35)', () => {
  it.runIf(RUN_ONCHAIN)('the factory names the same EntryPoint the config does', async () => {
    // The factory is what deploys accounts, so the EntryPoint it was built with is the one every
    // account ends up talking to — that makes it the rooted answer rather than a second literal.
    //
    // Measured while writing this, and worth recording: `airAccountV7Impl.entryPoint()` and
    // `airAccountExtension.entryPoint()` both return address(0). That is NOT "no EntryPoint
    // configured" — they are implementation contracts, so their storage was never initialised.
    // Reading the field off either would have produced a confident zero and an anchor pointing at
    // nothing.
    const fromFactory = String(
      await client().readContract({
        address: addrs.airAccountFactoryV7 as Address,
        abi: [{ type: 'function' as const, name: 'entryPoint', inputs: [], outputs: [{ type: 'address' as const }], stateMutability: 'view' as const }],
        functionName: 'entryPoint',
      }),
    ).toLowerCase();
    expect(fromFactory).toBe(sepoliaEnv.entryPoint.toLowerCase());
  });

  it('DVT_CONFIG and the address book agree about the EntryPoint (offline)', () => {
    // They are two literals with no derivation between them — the same duplicated-truth shape FU-12
    // removed from the node lists. Deriving one from the other is not available here: `addresses.ts`
    // already imports `dvt.ts`, so the reverse import would close a cycle. Detection is what is
    // left, which is exactly the argument FU-26 settled for the ledger ids.
    expect(sepoliaEnv.entryPoint.toLowerCase()).toBe(String(addrs.entryPoint).toLowerCase());
  });

  it('every environment targets the same EntryPoint (offline)', () => {
    // `testnet-local` changes WHERE the nodes are reached, never what validates or settles. An
    // environment that quietly pointed at another EntryPoint would produce userOpHashes that no
    // account in this stack recognises.
    for (const [name, env] of Object.entries(DVT_CONFIG.environments)) {
      if (!env) continue;
      expect(env.entryPoint.toLowerCase(), `${name} targets a different EntryPoint`).toBe(sepoliaEnv.entryPoint.toLowerCase());
    }
  });
});

describe('the pinned nodeIds are the set the chain actually has (FU-17)', () => {
  // WHY THE PINS NEED A CHECK AT ALL
  // --------------------------------
  // FU-17 was filed as a time bomb — "the day operators re-register, the fallback ids all go stale"
  // — and that turned out to be false: `registerWithProof` derives `nodeId = keccak256(pubkey)`, so
  // re-registration with the same key reproduces the same id. Measured: 3/3 match, and note the
  // hash is over the whole 128-byte EIP-2537 blob (stripping the 16-byte padding to 96 does not).
  //
  // The follow-up survived the correction with a harder reason. `registerPublicKey(bytes32, bytes)`
  // takes the nodeId as an ARGUMENT — so "the id equals keccak of the key" is a CONVENTION the
  // original registrant followed, not something the protocol guarantees. A new node, or the same
  // node registered by someone else, may not match. That moves the risk from a date ("it will break
  // eventually") to a structure ("whether they match depends on who registered").
  //
  // A structural risk cannot be fixed by picking a better literal. It can be turned into a red test.
  it.runIf(RUN_LOGS)('every pinned nodeId is in the live active set', async () => {
    const at = await (archiveClient() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber();
    const leaves = await committeeLeavesAt(archiveClient(), addrs.aaStarBLSAlgorithm as Address, at);
    const active = new Set([...leaves.values()].map((v) => v.toLowerCase()));

    for (const node of sepoliaEnv.dvtNodes) {
      expect(
        active.has(node.nodeId.toLowerCase()),
        `${node.url} is pinned to ${node.nodeId}, which is not in the validator's active set ` +
          `(${[...active].join(', ')}). Either the pin is stale or that node is no longer registered — ` +
          'read the ids from the nodes rather than guessing a new literal.',
      ).toBe(true);
    }
  }, 180_000);

  it.runIf(RUN_LOGS)('and the active set contains nothing the config does not know about', async () => {
    // The other direction, and the one a subset check cannot see: a fourth node joining is not
    // itself a fault, but it means this config no longer describes the signer set, and a caller
    // choosing signers from it is choosing from a stale list.
    const at = await (archiveClient() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber();
    const leaves = await committeeLeavesAt(archiveClient(), addrs.aaStarBLSAlgorithm as Address, at);
    const pinned = new Set(sepoliaEnv.dvtNodes.map((n) => n.nodeId.toLowerCase()));
    const unknown = [...leaves.values()].map((v) => v.toLowerCase()).filter((id) => !pinned.has(id));

    expect(
      unknown,
      `the validator has ${unknown.length} registered node(s) DVT_CONFIG does not list. That is not a ` +
        'defect on its own, but this config is what callers pick signers from, so it is now an ' +
        'incomplete view of the set.',
    ).toEqual([]);
  }, 180_000);
});
