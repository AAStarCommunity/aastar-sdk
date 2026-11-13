/**
 * How a price send is reported. Blocked and refused are not broadcasts of this request.
 */
import type { SendResult } from './sender.js';

export type PriceReport =
    | { kind: 'refused'; reason: string }
    | { kind: 'blocked'; hash: string }
    | { kind: 'reverted'; hash: string }
    | { kind: 'receipt'; hash: string }
    | { kind: 'pending'; hash: string };

export function describePriceSend(result: SendResult): PriceReport {
    if (result.status === 'refused') return { kind: 'refused', reason: result.reason };
    if (result.status === 'blocked') return { kind: 'blocked', hash: result.inFlightHash };
    if (result.status === 'pending') return { kind: 'pending', hash: result.hash };
    if (result.receipt.status !== 'success') return { kind: 'reverted', hash: result.hash };
    return { kind: 'receipt', hash: result.hash };
}

/** Old state confirmation: the cache moved forward to the Chainlink round we sent for. */
export function cacheConfirms(beforeUpdatedAt: bigint, expectedUpdatedAt: bigint, observedUpdatedAt: bigint): boolean {
    return observedUpdatedAt > beforeUpdatedAt && observedUpdatedAt >= expectedUpdatedAt;
}

/** Alert a refused reason once, until a later success clears the set. */
export function noteRefusal(seen: Set<string>, reason: string): boolean {
    if (seen.has(reason)) return false;
    seen.add(reason);
    return true;
}

export function loopErrorReport(network: string, error: unknown, kind: 'error' | 'fatal' = 'error'): { telegram: string; stderr: string } {
    const name = error instanceof Error && error.name ? error.name.slice(0, 80) : 'Error';
    const raw = error instanceof Error ? error.message : 'error';
    const stderr = raw.replace(/https?:\/\/\S+/g, '<url>');
    return {
        telegram: `[keeper] ${kind}\nnetwork=${network}\nclass=${name}`,
        stderr,
    };
}
