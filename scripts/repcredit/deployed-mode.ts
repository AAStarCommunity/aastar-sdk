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

/** DSR's ④, as a pure predicate over readings. */
export function checkStackInvariants(r: StackReadings): Check[] {
    return [
        {
            name: 'deployed:defaultThreshold',
            ok: r.defaultThreshold === 2n,
            // Read from Registry.blsAggregator().defaultThreshold(), the same route the reputation
            // path takes — so the paper's m is this number, not the deploy script's 3.
            detail: `defaultThreshold ${r.defaultThreshold}; frozen stack expects 2 (fresh-deploy sets 3)`,
        },
        {
            name: 'deployed:aggregatorVersion',
            ok: r.aggregatorVersion === 'BLSAggregator-4.11.0',
            // `version()`, lowercase. `VERSION()` is on no deployed BLSAggregator — asking for it
            // returns a revert that reads as a fact about the contract instead of about the question.
            detail: `version() "${r.aggregatorVersion}"; expects "BLSAggregator-4.11.0"`,
        },
        {
            name: 'deployed:nodeCount',
            ok: r.nodeCount === 3,
            detail: `N=${r.nodeCount}; the frozen stack is N=3 only (local mode may vary)`,
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
    registeredOperators: readonly Address[],
): Check[] {
    const f = funder.toLowerCase();
    const out: Check[] = governance.map((g) => ({
        name: `deployed:funder:not:${g.label}`,
        ok: g.address.toLowerCase() !== f,
        detail: `funder must not be ${g.label} (${g.address})`,
    }));
    out.push({
        name: 'deployed:funder:not-an-operator',
        ok: !registeredOperators.some((o) => o.toLowerCase() === f),
        detail: `funder must not be one of the ${registeredOperators.length} registered operator(s)`,
    });
    // The list being empty is not evidence that the funder is absent from it.
    out.push({
        name: 'deployed:funder:operator-list-nonempty',
        ok: registeredOperators.length > 0,
        detail: `${registeredOperators.length} operator(s) read; an empty list makes the check above vacuous`,
    });
    return out;
}
