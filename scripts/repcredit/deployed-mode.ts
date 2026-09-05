/**
 * The decisions the `deployed` network mode makes, as pure functions (CC-115 B6-prep, T6.1.1).
 *
 * ## Why these live here and not in the runner
 *
 * `scripts/repcredit-e2e.ts` has no exports and executes at import time, so anything inside it can
 * only be exercised by standing up a chain. The material passport was extracted for exactly this
 * reason in B4; these are the same shape. **A property that can only be checked by running the
 * thing it protects is not really checked.**
 *
 * The mode itself is new because the author decided (2026-09-05) that B6 runs against the REAL
 * frozen stack rather than an isolated copy. Everything below is therefore about consuming a stack
 * rather than producing one.
 *
 * ## The two assertions that made this necessary
 *
 * The Sepolia mode asserts `defaultThreshold === 3n` and `air.version === "0.31.0"`. Both are
 * artefacts of fresh-deploying: the deploy script sets threshold 3, and the AirAccount deploy
 * emits 0.31.0. Against the frozen stack the true readings are **2** and **v0.33.0**.
 *
 * > So the existing runner, pointed at the real stack, refuses before its first transaction —
 * > with "RepCredit default threshold is not three", about a stack that is correct.
 *
 * That is why this is a third mode and not a flag on the second one: the assertions differ, and
 * silently relaxing them in `sepolia` mode would remove a real check from the path that still
 * deploys.
 *
 * @module
 */
import type { Address } from 'viem';

import type { Check, DeployedStackPin } from './deployed-stack.js';

/** The nine addresses `repcredit-e2e.ts`'s `loadDeployment()` requires. */
export const DEPLOYMENT_KEYS = [
    'entryPoint',
    'registry',
    'gToken',
    'staking',
    'superPaymaster',
    'aPNTs',
    'dvtValidator',
    'blsAggregator',
    'agentIdentityRegistry',
] as const;
export type DeploymentKey = (typeof DEPLOYMENT_KEYS)[number];

export interface ResolvedAddress {
    address: Address;
    /** Which record this value came from. Recorded per key, never merged silently. */
    source: 'pin' | 'book' | 'pin+book';
}

export interface ResolvedDeployment {
    addresses: Record<DeploymentKey, ResolvedAddress>;
    /** One check per key that BOTH records carry, asserting they agree. */
    agreement: Check[];
}

/**
 * Resolve the nine addresses from the frozen pin and the SDK address book.
 *
 * ## Why every key carries its source
 *
 * The two records do not cover the same ground, and pretending otherwise is the failure this
 * function is shaped to avoid. Measured 2026-09-05:
 *
 * ```
 * both, and byte-identical   entryPoint · registry · superPaymaster · dvtValidator · blsAggregator
 * address book only          gToken · staking · aPNTs · agentIdentityRegistry
 * ```
 *
 * The five that appear twice are a **real cross-check** — two records written at different times
 * from different sources agreeing. The four that appear once have no such backing, and a reader of
 * the evidence is entitled to know which kind each address is. Merging them into one flat map
 * would erase precisely that distinction, and the resulting object would look equally trustworthy
 * throughout.
 *
 * Disagreement is NOT resolved here. It is reported as a failed {@link Check}, because a pin and an
 * address book that disagree about a live contract is a question for a human, not a precedence rule.
 */
export function resolveDeployedAddresses(
    pin: DeployedStackPin,
    book: Record<string, string | undefined>,
): ResolvedDeployment {
    const fromPin: Partial<Record<DeploymentKey, Address>> = {
        registry: pin.addresses.registry,
        superPaymaster: pin.addresses.superPaymaster,
        dvtValidator: pin.addresses.dvtValidator,
        blsAggregator: pin.addresses.blsAggregator,
        entryPoint: pin.airAccount.entryPoint,
    };

    const addresses = {} as Record<DeploymentKey, ResolvedAddress>;
    const agreement: Check[] = [];
    const missing: DeploymentKey[] = [];

    for (const key of DEPLOYMENT_KEYS) {
        const p = fromPin[key];
        const b = book[key] as Address | undefined;
        if (p && b) {
            const ok = p.toLowerCase() === b.toLowerCase();
            agreement.push({
                name: `deployed:agree:${key}`,
                ok,
                detail: `pin ${p} vs addresses.ts ${b}`,
            });
            addresses[key] = { address: p, source: 'pin+book' };
        } else if (p) {
            addresses[key] = { address: p, source: 'pin' };
        } else if (b) {
            addresses[key] = { address: b, source: 'book' };
        } else {
            missing.push(key);
        }
    }

    if (missing.length) {
        throw new Error(
            `deployed mode: no address for ${missing.join(', ')} in either the frozen pin or the SDK ` +
            'address book. This mode deploys nothing, so an address it cannot find is not something ' +
            'it can create.',
        );
    }
    return { addresses, agreement };
}

/** Everything the mode asserts about the live stack, as read. */
export interface StackReadings {
    /** `Registry.blsAggregator().defaultThreshold()` — the same path reputation uses. */
    defaultThreshold: bigint;
    /** `version()` — lowercase; the deployed aggregator has no `VERSION()`. */
    aggregatorVersion: string;
    /** Node count actually driven this run. */
    nodeCount: number;
}

/**
 * DSR's ④, as a pure predicate over readings.
 *
 * ## Where each expectation comes from, and why that had to change
 *
 * The first version of this function hard-coded `2n` and `'BLSAggregator-4.11.0'`. #387 review
 * pointed out what that means, and it is worse than untidy: **this whole mode exists because the
 * `sepolia` mode hard-codes its expectations** (3n, factory 0.31.0) and therefore silently describes
 * a stack that no longer exists. Writing the same two constants into the new mode reproduces the
 * defect one version later — the next re-deploy would need a fifth mode.
 *
 * Both values are already in the pin (`aggregator.defaultThreshold`, `aggregator.version`), and the
 * rest of this file's on-chain checks read their expectations from there. So does this now.
 *
 * **`nodeCount` is deliberately NOT taken from the pin, because it is not in it and should not be.**
 * N is a property of THIS RUN — how many nodes the runner drove — and the pin describes contracts.
 *
 * That leaves the question of what to compare it against, and the obvious answer is wrong. Passing
 * the runner's own `nodeCount` as the expectation makes this `x === x`: green on every input,
 * including the ones it exists to reject. (I wrote exactly that for a moment while making the two
 * fixes above — removing one hard-coded constant is not the same as replacing it with a *check*.)
 *
 * So the expectation is the **active validator count read from chain**, and this check earns its
 * keep by relating two independent numbers: how many nodes the run drives, and how many slots the
 * aggregator actually has filled. `3 === 3` from two sources is a fact; from one it is a tautology.
 */
export function checkStackInvariants(
    r: StackReadings,
    /** From the pin — `aggregator.defaultThreshold` and `aggregator.version`. */
    expected: { defaultThreshold: number; version: string },
    /**
     * The active validator count READ FROM CHAIN — not the runner's own node count, which would
     * make the third check compare a number to itself. See the note above.
     */
    onChainActiveCount: number,
): Check[] {
    return [
        {
            name: 'deployed:defaultThreshold',
            ok: r.defaultThreshold === BigInt(expected.defaultThreshold),
            // Read from Registry.blsAggregator().defaultThreshold(), the same route the reputation
            // path takes — so the paper's m is this number, not the deploy script's 3.
            detail: `defaultThreshold ${r.defaultThreshold}; pin expects ${expected.defaultThreshold} (fresh-deploy sets 3)`,
        },
        {
            name: 'deployed:aggregatorVersion',
            ok: r.aggregatorVersion === expected.version,
            // `version()`, lowercase. `VERSION()` is on no deployed BLSAggregator — asking for it
            // returns a revert that reads as a fact about the contract instead of about the question.
            detail: `version() "${r.aggregatorVersion}"; pin expects "${expected.version}"`,
        },
        {
            name: 'deployed:nodeCount',
            ok: r.nodeCount === onChainActiveCount,
            detail: `run drives N=${r.nodeCount}; chain has ${onChainActiveCount} active validator slot(s)`,
        },
    ];
}

/** One account's routing, read from the account itself. */
export interface AccountRouting {
    account: Address;
    validatorRouter: Address;
    algorithm1: Address;
}

/**
 * DSR's account-router invariant, scoped to the accounts THIS RUN created.
 *
 * ## Why the scope matters, and it is not pedantry
 *
 * The spec first said "every account". Measured on Sepolia 2026-09-05, that is false of the chain:
 *
 * ```
 * 0x92EA8b02D34A4D5d10f0Db9Ea894e8bC72e292e8 → 0xe68d6A7B… → 0x539B9681…
 * 0x0985785d1fc37978474C472E39391774DcB1C711 → 0xA97A7527… → 0x7ac7E9d4…
 * ```
 *
 * Two real deployed accounts route to two different validators. The second was pulled out of the
 * committee validator's event topics rather than any address book, which is what makes the pair
 * evidence about **deployments** rather than about two documents disagreeing.
 *
 * > **There is no single "current validator" — only "the current validator for a given account".**
 *
 * So the invariant holds over accounts created by the v0.33.0 factory in this run, and the reading
 * is recorded per account rather than assumed uniform. DSR accepted this narrowing on 2026-09-05.
 */
export function checkAccountRouting(
    accounts: readonly AccountRouting[],
    expected: { validatorRouter: Address; algorithm1: Address },
): Check[] {
    if (accounts.length === 0) {
        // A zero-length pass would be the same green as "all accounts agree", and this repo has
        // paid for that shape more than once in a single day.
        return [{
            name: 'deployed:accounts:none',
            ok: false,
            detail: 'no accounts were checked — an empty set cannot satisfy an invariant about accounts',
        }];
    }
    return accounts.flatMap((a) => [
        {
            name: `deployed:account:${a.account}:router`,
            ok: a.validatorRouter.toLowerCase() === expected.validatorRouter.toLowerCase(),
            detail: `${a.account}.validatorRouter() ${a.validatorRouter}; expects ${expected.validatorRouter}`,
        },
        {
            name: `deployed:account:${a.account}:algId1`,
            ok: a.algorithm1.toLowerCase() === expected.algorithm1.toLowerCase(),
            detail: `router mounts ${a.algorithm1} at algId 0x01; expects ${expected.algorithm1}`,
        },
    ]);
}

/** One validator slot as the aggregator reports it. */
export interface ValidatorSlot {
    slot: number;
    address: Address;
    roleStake: bigint;
    effectiveStake: bigint;
}

/**
 * The active validator set, checked two independent ways (DSR 2026-09-05).
 *
 * ## Why the roster is the aggregator's slot table and not the registry's role count
 *
 * DSR's first version of this criterion asserted `Registry.getRoleUserCount(ROLE_DVT) === N`.
 * Measured on chain: **19 vs 3**. Those are different populations — holding ROLE_DVT is not the
 * same as occupying a slot in the aggregator's active set — and DSR withdrew the equality rather
 * than relax it. `getRoleUserCount` is kept as an OBSERVATION in the passport, never in an equation:
 * loosening a false assertion to `>=` would only have made it vacuously true.
 *
 * ## Two checks, deliberately independent
 *
 * 1. **`slotOrder`, element by element.** The B3 manifest carries the three addresses in plain text
 *    and in order. This comparison assumes no encoding at all.
 * 2. **`orderedAddressSetHash`**, using the convention the manifest itself records under
 *    `hashConventions.validatorSetHash`: `keccak256(abi.encode(address[] slots1To3))`.
 *
 * The second is a real second path only because the convention was WRITTEN DOWN. My first attempt
 * used `encodePacked` and got a different digest; the correct response to that was not to try
 * encodings until one matched — **a hash you reverse-engineer until it agrees proves only that you
 * found a formula that produces those bytes.** (It also cost me a wrong report: I said the manifest
 * did not document the preimage, having read one block of it. FU-81.)
 */
export function checkValidatorRoster(
    slots: readonly ValidatorSlot[],
    manifest: { slotOrder: readonly string[]; activeCount: number; orderedAddressSetHash: string },
    computedSetHash: string,
): Check[] {
    const out: Check[] = [];
    const addrs = slots.map((s) => s.address);

    out.push({
        name: 'roster:count',
        ok: slots.length === 3 && manifest.activeCount === 3,
        detail: `${slots.length} non-zero slot(s) on chain; manifest activeCount ${manifest.activeCount}; both must be 3`,
    });

    // (1) plain-text, order-sensitive. No encoding assumptions anywhere in this comparison.
    const orderOk =
        addrs.length === manifest.slotOrder.length &&
        addrs.every((a, i) => a.toLowerCase() === manifest.slotOrder[i].toLowerCase());
    out.push({
        name: 'roster:slotOrder',
        ok: orderOk,
        detail: `chain [${addrs.join(', ')}] vs manifest slotOrder [${manifest.slotOrder.join(', ')}]`,
    });

    // (2) the recorded convention, as a second and independent path.
    out.push({
        name: 'roster:setHash',
        ok: computedSetHash.toLowerCase() === manifest.orderedAddressSetHash.toLowerCase(),
        detail: `keccak256(abi.encode(address[])) ${computedSetHash} vs manifest ${manifest.orderedAddressSetHash}`,
    });

    for (const s of slots) {
        out.push({
            name: `roster:stake:slot${s.slot}`,
            ok: s.roleStake > 0n && s.effectiveStake > 0n,
            detail: `${s.address} roleStake ${s.roleStake}, effective ${s.effectiveStake}; both must exceed 0`,
        });
    }
    return out;
}

/**
 * ## B6 spans TWO unrelated registries, and conflating them is the trap
 *
 * DVT's answer (CC-115 `d11681ee`), verified on chain here:
 *
 * | | registry A | registry B |
 * |---|---|---|
 * | what | SP `BLSAggregator` guardian slots | AirAccount validator, nodeId-indexed |
 * | read by | `validatorAtSlot(1..13)` | `nodeOperator(bytes32 nodeId)` |
 * | drives | the reputation path (`defaultThreshold = 2`) | UserOp co-signing |
 * | keys | held by the DVT session, **no HTTP interface** | reachable via `POST /signature/sign` |
 *
 * They are different sets of addresses for the same three nodes. Measured:
 *
 * ```
 * nodeId 0x1f5e41c6…  committee 0x7ac7E9d4… → 0xEcAACb91…   legacy 0x539B9681… → 0xb5600060…
 * nodeId 0xe3a4a3af…  committee            → 0x85744FD1…   legacy              → 0xEcAACb91…
 * nodeId 0x96d64ba8…  committee            → 0xA5924206…   legacy              → 0xF7Bf79Ac…
 * ```
 *
 * **Every operator differs between the two validators, and on the legacy one node1's operator is
 * `0xb5600060…` — which is `Registry.owner()` itself.** So "is this address an operator?" has no
 * answer until you say WHICH registry, and one of the answers is the governance key.
 *
 * That is why {@link checkFunderRole} takes a labelled exclusion set rather than one list: a run
 * that checked only registry A would clear a funder that is a committee operator, and vice versa.
 */

/**
 * The funder is allowed to exist; it is not allowed to be governance or an operator (DSR ruling 2).
 *
 * `REPCREDIT_PRIVATE_KEY` stays in this mode because the run still has to fund the accounts it
 * creates — that is a funder, not a validator operator, and ⑤'s "never load operator keys" is about
 * the latter. What ⑤ would not survive is the funder quietly BEING one of those roles, so that is
 * what this rejects.
 *
 * Addresses are compared, never printed by the caller: the Passport records this key's role as
 * `funder` with the value redacted.
 */
export function checkFunderRole(
    funder: Address,
    governance: readonly { label: string; address: Address }[],
    /** Per-registry, because the answer differs by registry — see the note above. */
    registeredOperators: Readonly<Record<string, readonly Address[]>>,
): Check[] {
    const f = funder.toLowerCase();
    const out: Check[] = governance.map((g) => ({
        name: `deployed:funder:not:${g.label}`,
        ok: g.address.toLowerCase() !== f,
        detail: `funder must not be ${g.label} (${g.address})`,
    }));
    // Labelled per registry: "is this an operator" is not answerable without saying which one,
    // and a run that consulted only one of them would clear a funder that sits in the other.
    for (const [label, list] of Object.entries(registeredOperators)) {
        out.push({
            name: `deployed:funder:not-an-operator:${label}`,
            ok: !list.some((o) => o.toLowerCase() === f),
            detail: `funder must not be one of the ${list.length} operator(s) in registry ${label}`,
        });
        // An empty list makes the check above trivially true, and it reads exactly like a real pass.
        out.push({
            name: `deployed:funder:operator-list-nonempty:${label}`,
            ok: list.length > 0,
            detail: `${list.length} operator(s) read from registry ${label}`,
        });
    }
    return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The reads. Everything above is a pure predicate; these three are the I/O that
 * feeds them, and they live here rather than in the runner for one reason: the
 * runner passed EMPTY LISTS to `checkFunderRole` and the checks above were
 * therefore never exercised against a real registry.
 *
 * #387 review measured what that cost. With `{ guardianSlots: [], committee: [] }`
 * the two `operator-list-nonempty` checks fail, ③ throws on `failed.length`, and
 * the ④ boundary error underneath it — the one that states the open question —
 * **is unreachable on every run**. Two exported, unit-tested functions
 * (`checkValidatorRoster`, `checkAccountRouting`) were likewise never called by
 * the runner at all.
 *
 * > A pure function with a passing unit test and no caller is not a delivered
 * > check. It is a check-shaped object, and it reads identically in a diff.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Minimal shape of the viem public client these reads need. */
type Reader = {
    readContract: (args: {
        address: Address;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
    }) => Promise<unknown>;
};

const ZERO: Address = '0x0000000000000000000000000000000000000000';

/**
 * Registry A: the aggregator's guardian slot table, `validatorAtSlot(1..maxSlot)`.
 *
 * Slots are 1-indexed and sparse — the table has room for 13 and the frozen stack fills 3 — so a
 * zero address means "empty slot", not "read failed". They are dropped, and the COUNT of what
 * survives is what `checkStackInvariants` compares the run's N against.
 *
 * Stakes come from the Registry, not the aggregator, via two getters whose argument orders are
 * **reversed with respect to each other**: `getRoleStake(bytes32 role, address who)` and
 * `getEffectiveStake(address who, bytes32 role)`. Swapping them is caught by viem's encoder rather
 * than by a wrong number, since `address` and `bytes32` are not interchangeable there — but it is
 * the kind of pair worth naming at the call site instead of trusting to memory.
 */
export async function readValidatorSlots(
    client: Reader,
    args: {
        aggregator: Address;
        aggregatorAbi: readonly unknown[];
        registry: Address;
        registryAbi: readonly unknown[];
        roleDvt: string;
        maxSlot?: number;
    },
): Promise<ValidatorSlot[]> {
    const maxSlot = args.maxSlot ?? 13;
    const out: ValidatorSlot[] = [];
    for (let slot = 1; slot <= maxSlot; slot++) {
        const address = (await client.readContract({
            address: args.aggregator,
            abi: args.aggregatorAbi,
            functionName: 'validatorAtSlot',
            args: [slot],
        })) as Address;
        if (address === ZERO) continue;
        const [roleStake, effectiveStake] = (await Promise.all([
            client.readContract({
                address: args.registry, abi: args.registryAbi,
                functionName: 'getRoleStake', args: [args.roleDvt, address],
            }),
            client.readContract({
                address: args.registry, abi: args.registryAbi,
                functionName: 'getEffectiveStake', args: [address, args.roleDvt],
            }),
        ])) as [bigint, bigint];
        out.push({ slot, address, roleStake, effectiveStake });
    }
    return out;
}

/** One nodeId's answer from registry B, zero address included rather than dropped. */
export interface CommitteeEntry {
    nodeId: string;
    /** `0x0` means this nodeId is not registered on this validator. */
    operator: Address;
}

/**
 * Registry B: the AirAccount committee validator, `nodeOperator(bytes32 nodeId)`.
 *
 * Zeros are RETURNED, not filtered, and that is the whole design of this function. The nodeIds come
 * from `DVT_CONFIG`, where they are labelled **fallbacks** — the live co-sign path reads them from
 * each node at run time. A fallback that has gone stale answers `0x0`, and a version of this that
 * quietly dropped zeros would hand back a shorter list that still looks like a healthy read.
 *
 * That matters here specifically: the list feeds `checkFunderRole`, whose `not-an-operator` check is
 * a NEGATIVE — "the funder is not in this list". Shrinking the list makes that check easier to pass.
 * **A silent partial read weakens a negative check without failing anything**, which is the failure
 * mode `operator-list-nonempty` was written for and does not cover, because a partial list is not
 * empty. {@link checkCommitteeRegistration} covers it.
 */
export async function readCommitteeOperators(
    client: Reader,
    args: { validator: Address; validatorAbi: readonly unknown[]; nodeIds: readonly string[] },
): Promise<CommitteeEntry[]> {
    return (await Promise.all(
        args.nodeIds.map(async (nodeId) => ({
            nodeId,
            operator: (await client.readContract({
                address: args.validator, abi: args.validatorAbi,
                functionName: 'nodeOperator', args: [nodeId],
            })) as Address,
        })),
    )) satisfies CommitteeEntry[];
}

/** Every queried nodeId must resolve to a real operator on registry B. See above for why. */
export function checkCommitteeRegistration(entries: readonly CommitteeEntry[]): Check[] {
    return entries.map((e) => ({
        name: `committee:registered:${e.nodeId.slice(0, 10)}`,
        ok: e.operator !== ZERO,
        detail:
            e.operator === ZERO
                ? `nodeId ${e.nodeId} has NO operator on the committee validator — the pinned fallback ` +
                  `nodeId is stale, or this node is not registered on this stack`
                : `nodeId ${e.nodeId} → ${e.operator}`,
    }));
}

/**
 * The B3 manifest's validator set — read from the DSR repo, **after** verifying its sha256 against
 * the pin.
 *
 * ## Why the hash check is not ceremony
 *
 * This file lives in another repository on the same machine, and the roster comparison is only
 * evidence if the thing being compared against is the artefact DSR published. Without the digest
 * this reads whatever is at that path today — including a working copy someone is mid-edit on —
 * and would report agreement with it. `checkDeployedAbiPin` computes its hash from the git object
 * for exactly this reason; the same argument applies here, and the same argument is why a MISSING
 * manifest throws instead of degrading to "roster not checked".
 *
 * The digest that must match is `pin.manifest.sha256`, over the raw file bytes.
 */
export function readValidatorSetFromManifest(
    pin: DeployedStackPin,
    read: (path: string) => Uint8Array,
    sha256: (b: Uint8Array) => string,
    dsrRoot: string,
): { slotOrder: readonly string[]; activeCount: number; orderedAddressSetHash: string } {
    const path = `${dsrRoot}/${pin.manifest.path}`;
    let bytes: Uint8Array;
    try {
        bytes = read(path);
    } catch {
        throw new Error(
            `deployed mode needs the B3 manifest and could not read it at ${path}. ` +
                `Set REPCREDIT_DSR_ROOT to the DSR checkout root (the manifest is at ${pin.manifest.path}, ` +
                `produced by ${pin.manifest.producedBy} at commit ${pin.manifest.commit}).`,
        );
    }
    const got = sha256(bytes);
    if (got !== pin.manifest.sha256) {
        throw new Error(
            `B3 manifest at ${path} has sha256 ${got}, pin expects ${pin.manifest.sha256}. ` +
                `Refusing to compare the roster against an artefact that is not the pinned one.`,
        );
    }
    const set = (JSON.parse(new TextDecoder().decode(bytes)) as { validatorSet?: Record<string, unknown> }).validatorSet;
    if (!set) throw new Error(`B3 manifest at ${path} has no validatorSet block.`);
    const { slotOrder, activeCount, orderedAddressSetHash } = set as {
        slotOrder: string[]; activeCount: number; orderedAddressSetHash: string;
    };
    if (!Array.isArray(slotOrder) || typeof activeCount !== 'number' || typeof orderedAddressSetHash !== 'string') {
        throw new Error(`B3 manifest validatorSet is missing slotOrder/activeCount/orderedAddressSetHash.`);
    }
    return { slotOrder, activeCount, orderedAddressSetHash };
}
