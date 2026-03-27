// RelayPool — manages WebSocket connections to multiple Nostr relays.
//
// Responsibilities:
//   - Connect to all configured relays concurrently
//   - Publish events to ALL connected relays (fan-out)
//   - Subscribe to events from ALL relays with deduplication by event id
//   - Expose a simple EventEmitter-style interface for incoming events
//
// nostr-tools v2 SimplePool API note:
//   - subscribeMany(relays, filter, params) — takes a SINGLE Filter object
//   - publish(relays, event)                — returns Promise<string>[]  (one per relay)
//   - querySync(relays, filter)             — returns Promise<Event[]>

import { SimplePool, type Filter, type NostrEvent } from 'nostr-tools';
import type { SubCloser } from 'nostr-tools/abstract-pool';
import type { RelayUrl } from '../types.js';

/** Default public relays if no override is provided */
export const DEFAULT_RELAYS: RelayUrl[] = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
];

/** Parse SPORE_RELAYS env var ("wss://a,wss://b,...") */
export function parseRelaysFromEnv(): RelayUrl[] {
    const raw = process.env['SPORE_RELAYS'];
    if (!raw) return [];
    return raw
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.startsWith('wss://') || r.startsWith('ws://'));
}

export type RelayEventHandler = (event: NostrEvent) => void;

export interface RelayPoolOptions {
    relays: RelayUrl[];
    debug?: boolean;
}

/**
 * RelayPool wraps nostr-tools SimplePool to provide:
 *  - Fan-out publishing (publish to all relays)
 *  - Multiplexed subscriptions with deduplication
 *  - Optional debug logging
 */
export class RelayPool {
    private readonly pool: SimplePool;
    private readonly relays: RelayUrl[];
    private readonly debug: boolean;
    /** Tracks seen event IDs to deduplicate across relays */
    private readonly seenIds = new Set<string>();
    /** Active subscriptions returned by SimplePool */
    private readonly activeSubs: SubCloser[] = [];

    constructor(options: RelayPoolOptions) {
        this.relays = options.relays.length > 0 ? options.relays : DEFAULT_RELAYS;
        this.debug = options.debug ?? false;
        this.pool = new SimplePool();

        if (this.debug) {
            console.debug('[RelayPool] initialised with relays:', this.relays);
        }
    }

    /** Relay URLs currently in use */
    get connectedRelays(): RelayUrl[] {
        return [...this.relays];
    }

    /**
     * Publish a signed Nostr event to all relays.
     * Returns a settled array of per-relay results (fulfilled = published OK).
     */
    async publish(event: NostrEvent): Promise<PromiseSettledResult<string>[]> {
        if (this.debug) {
            console.debug(`[RelayPool] publishing event kind:${event.kind} id:${event.id}`);
        }

        // publish() returns Promise<string>[] — one promise per relay
        const promises = this.pool.publish(this.relays, event);
        const results = await Promise.allSettled(promises);

        if (this.debug) {
            const ok = results.filter((r) => r.status === 'fulfilled').length;
            console.debug(`[RelayPool] published to ${ok}/${results.length} relays`);
        }

        return results;
    }

    /**
     * Subscribe to events matching the given filter across all relays.
     * The handler is called once per unique event id (deduplication applied).
     *
     * Note: nostr-tools v2 subscribeMany accepts a single Filter, not Filter[].
     * To subscribe with multiple filter conditions, call subscribe() multiple times
     * or use a single merged filter.
     *
     * @param filter   - Nostr subscription filter
     * @param handler  - Called for each unique incoming event
     * @returns A close function to cancel the subscription
     */
    subscribe(filter: Filter, handler: RelayEventHandler): () => void {
        if (this.debug) {
            console.debug('[RelayPool] subscribing with filter:', filter);
        }

        const sub = this.pool.subscribeMany(this.relays, filter, {
            onevent: (event: NostrEvent) => {
                if (this.seenIds.has(event.id)) return; // deduplicate
                this.seenIds.add(event.id);
                handler(event);
            },
        });

        this.activeSubs.push(sub);

        return () => {
            sub.close();
            const idx = this.activeSubs.indexOf(sub);
            if (idx !== -1) this.activeSubs.splice(idx, 1);
        };
    }

    /**
     * Subscribe with multiple filters (runs separate subscriptions).
     * Returns a single closer that cancels all of them.
     */
    subscribeMany(filters: Filter[], handler: RelayEventHandler): () => void {
        const closers = filters.map((f) => this.subscribe(f, handler));
        return () => {
            for (const close of closers) close();
        };
    }

    /**
     * Fetch events matching a filter (one-shot query, no ongoing subscription).
     * Resolves once all relays have returned EOSE (end of stored events).
     *
     * @param filter     - Nostr filter
     * @param timeoutMs  - How long to wait (default: 10 000 ms)
     */
    async fetchEvents(filter: Filter, timeoutMs = 10_000): Promise<NostrEvent[]> {
        const events = await this.pool.querySync(this.relays, filter, {
            maxWait: timeoutMs,
        });
        // Deduplicate by id
        const seen = new Set<string>();
        return events.filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });
    }

    /**
     * Close all active subscriptions and clean up the pool.
     * Should be called when the agent stops.
     */
    async close(): Promise<void> {
        for (const sub of this.activeSubs) {
            sub.close();
        }
        this.activeSubs.length = 0;
        this.pool.close(this.relays);

        if (this.debug) {
            console.debug('[RelayPool] closed all connections');
        }
    }
}
