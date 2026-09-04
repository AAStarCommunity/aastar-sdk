/**
 * A read client that asks several endpoints and refuses to answer when they disagree.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
 * ----------------------------------------
 * An on-chain gate is only as trustworthy as the endpoint it read from. When those readings become
 * an outward evidence claim — "the deployed aggregator is X, its extcodehash is Y" — a single RPC is
 * a single party that can be wrong, stale, or lying, and nothing downstream can tell which. FU-21
 * records the point that the answer is cross-reading or a keyed endpoint, NOT validating the URL's
 * scheme: `https://` says something about the transport and nothing about the answer.
 *
 * It does not make a lying majority impossible. Three endpoints behind one provider are one party
 * wearing three hats, and this cannot see that. What it does is convert a silent single-source
 * reading into an explicit agreement between named sources, so the assumption is stated where the
 * evidence is produced rather than left implicit.
 *
 * THE FAILURE IT ALREADY CATCHES
 * ------------------------------
 * Disagreement is not hypothetical, and it is not always adversarial. Measured while building the
 * committee-tree gate: the free Sepolia public endpoint answered the same `eth_getLogs` with 0 and
 * with 3 events on consecutive calls. A second endpoint would have turned that into a loud
 * disagreement instead of a confident wrong tree.
 *
 * SHAPED LIKE A PublicClient ON PURPOSE
 * -------------------------------------
 * The gates that need this already take a `PublicClient` and make their reads through it. Giving
 * them a cross-checking client changes nothing at the call sites — the alternative was editing every
 * read to loop, which is the version that gets half-applied and then quietly regresses.
 *
 * @module
 */
import { createPublicClient, http, type PublicClient } from 'viem';

/** The read methods a gate is expected to use. Anything else falls through to the first client. */
const CROSS_CHECKED_METHODS = ['getChainId', 'getCode', 'getBlockNumber', 'readContract', 'call', 'getStorageAt'] as const;

export interface CrossCheckOptions {
    /**
     * How many endpoints must answer before a reading counts. Default: all of them.
     *
     * Lowering this is a real trade and should be a deliberate one: with `quorum` below the endpoint
     * count, an endpoint that is merely unreachable stops blocking, and so does one that is lying
     * while the others are down.
     */
    quorum?: number;
}

/** Stable, order-independent rendering for comparison and for the error message. */
function fingerprint(value: unknown): string {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v));
}

export class CrossCheckDisagreement extends Error {
    constructor(
        readonly method: string,
        readonly answers: { source: string; value?: string; error?: string }[],
    ) {
        super(
            `cross-check: endpoints disagree on ${method} — ` +
            answers.map((a) => `${a.source} → ${a.error ? `ERROR ${a.error}` : a.value}`).join(' | ') +
            '. Refusing to return a reading that its own sources do not agree on.',
        );
        this.name = 'CrossCheckDisagreement';
    }
}

/**
 * Wrap several clients so every read is performed on all of them and must agree.
 *
 * `sources` labels the clients in error messages; without it a disagreement names indices, which
 * tells an operator that something is wrong but not which endpoint to look at.
 */
export function crossCheckedClient(
    clients: readonly PublicClient[],
    sources: readonly string[],
    options: CrossCheckOptions = {},
): PublicClient {
    if (clients.length === 0) throw new Error('crossCheckedClient: no clients supplied');
    if (clients.length !== sources.length) {
        throw new Error(`crossCheckedClient: ${clients.length} clients but ${sources.length} source labels`);
    }
    const quorum = options.quorum ?? clients.length;
    if (quorum < 1 || quorum > clients.length) {
        throw new Error(`crossCheckedClient: quorum ${quorum} is outside 1..${clients.length}`);
    }
    // One client cross-checks nothing. That is a legitimate configuration — it is what a developer
    // running locally has — so it is allowed, and it is the caller's job to say so in its output
    // rather than this returning something that looks corroborated.
    if (clients.length === 1) return clients[0];

    return new Proxy(clients[0], {
        get(target, prop, receiver) {
            if (!(CROSS_CHECKED_METHODS as readonly (string | symbol)[]).includes(prop)) {
                return Reflect.get(target, prop, receiver);
            }
            return async (...args: unknown[]) => {
                const settled = await Promise.allSettled(
                    clients.map((c) => (c as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[prop as string](...args)),
                );
                const answers = settled.map((r, i) => ({
                    source: sources[i],
                    value: r.status === 'fulfilled' ? fingerprint(r.value) : undefined,
                    error: r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason).slice(0, 120) : undefined,
                }));
                const ok = settled.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<unknown>[];
                if (ok.length < quorum) throw new CrossCheckDisagreement(String(prop), answers);

                const distinct = new Set(ok.map((r) => fingerprint(r.value)));
                if (distinct.size !== 1) throw new CrossCheckDisagreement(String(prop), answers);
                return ok[0].value;
            };
        },
    }) as PublicClient;
}

/**
 * Build a cross-checked client from a comma-separated endpoint list.
 *
 * Returns `null` for an empty list so a caller can distinguish "no endpoints configured" from "one
 * endpoint configured" — those are different situations and only the second can produce a reading.
 */
export function crossCheckedClientFromUrls(urls: string, options: CrossCheckOptions = {}): { client: PublicClient; sources: string[] } | null {
    const list = urls.split(',').map((u) => u.trim()).filter(Boolean);
    if (list.length === 0) return null;
    // Endpoints are labelled by host, not by full URL: these strings end up in error messages and in
    // CI logs, and the path of an RPC URL is routinely an API key.
    const sources = list.map((u) => {
        try {
            return new URL(u).host;
        } catch {
            return '<unparseable-url>';
        }
    });
    const clients = list.map((u) => createPublicClient({ transport: http(u) }));
    return { client: crossCheckedClient(clients, sources, options), sources };
}
