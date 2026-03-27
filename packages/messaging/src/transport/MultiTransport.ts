// MultiTransport — fan-out adapter that composes multiple SporeTransport instances.
//
// Sends messages across all configured transports simultaneously for redundancy.
// Incoming subscriptions merge results from all transports with deduplication
// so the caller's onMessage fires exactly once per unique message ID.
//
// Typical usage: Nostr + Waku running in parallel for transport resilience.
//
//   const transport = new MultiTransport({
//     transports: [nostrTransport, wakuTransport],
//   });
//   // All sends go to both; all subscriptions merge from both with dedup.
//
// Send semantics:
//   - sendDm / sendGroupMessage fan out to all transports concurrently.
//   - Returns the hash from the first transport that resolves successfully.
//   - If all transports fail, the last rejection is re-thrown.
//
// Subscribe semantics:
//   - Each message ID is tracked in a per-subscription seen-set.
//   - Duplicate IDs (same message arriving on multiple transports) are silently dropped.
//   - The seen-set is bounded: entries older than seenTtlMs are evicted on each delivery.
//
// Query semantics:
//   - Results from all transports are merged and sorted by sentAt (ascending).
//   - Duplicate message IDs are deduplicated (first occurrence wins).

import type { SporeTransport } from './SporeTransport.js';
import type { SendDmOptions, SendGroupMessageOptions } from './NostrTransport.js';
import type { SporeConversation, SporeMessage } from '../types.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration for MultiTransport */
export interface MultiTransportConfig {
  /** Two or more transports to compose. Order determines priority for send return value. */
  transports: SporeTransport[];
  /**
   * How long (ms) to keep a message ID in the seen-set before evicting it.
   * Prevents unbounded memory growth for long-running subscriptions.
   * Default: 300_000 (5 minutes).
   */
  seenTtlMs?: number;
}

// ─── Seen-set with TTL eviction ────────────────────────────────────────────────

interface SeenEntry {
  id: string;
  expiresAt: number;
}

/**
 * Bounded deduplication set.
 * Records message IDs with an expiry time; expired entries are pruned lazily
 * on each insertion to keep memory bounded without a background timer.
 */
class SeenSet {
  private readonly entries: SeenEntry[] = [];
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** Returns true if this ID has not been seen before (and records it). */
  add(id: string): boolean {
    const now = Date.now();
    // Lazy eviction: remove expired entries on each insertion
    const cutoff = now;
    let i = 0;
    while (i < this.entries.length && this.entries[i]!.expiresAt <= cutoff) i++;
    if (i > 0) this.entries.splice(0, i);

    const found = this.entries.some((e) => e.id === id);
    if (found) return false;

    this.entries.push({ id, expiresAt: now + this.ttlMs });
    return true;
  }
}

// ─── MultiTransport ────────────────────────────────────────────────────────────

/**
 * MultiTransport composes multiple SporeTransport instances into one.
 *
 * @example
 * ```ts
 * import { MultiTransport } from '@aastar/messaging';
 *
 * const multi = new MultiTransport({ transports: [nostrTransport, wakuTransport] });
 * // Use multi anywhere a SporeTransport is accepted.
 * ```
 */
export class MultiTransport implements SporeTransport {
  readonly name = 'multi' as const;

  private readonly transports: SporeTransport[];
  private readonly seenTtlMs: number;

  constructor(config: MultiTransportConfig) {
    if (config.transports.length === 0) {
      throw new Error('MultiTransport requires at least one transport');
    }
    this.transports = config.transports;
    this.seenTtlMs = config.seenTtlMs ?? 300_000;
  }

  // ─── Send DM ─────────────────────────────────────────────────────────────

  async sendDm(opts: SendDmOptions): Promise<string> {
    return this.fanOutSend((t) => t.sendDm(opts));
  }

  // ─── Send Group Message ───────────────────────────────────────────────────

  async sendGroupMessage(opts: SendGroupMessageOptions): Promise<string> {
    return this.fanOutSend((t) => t.sendGroupMessage(opts));
  }

  // ─── Subscribe to DMs ────────────────────────────────────────────────────

  subscribeToDms(
    myPubkeyHex: string,
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    opts?: { signal?: AbortSignal }
  ): () => void {
    const seen = new SeenSet(this.seenTtlMs);
    const deduped = (msg: SporeMessage, conv: SporeConversation) => {
      if (seen.add(msg.id)) onMessage(msg, conv);
    };
    const unsubs = this.transports.map((t) => t.subscribeToDms(myPubkeyHex, deduped, opts));
    return () => { for (const u of unsubs) u(); };
  }

  // ─── Subscribe to Groups ─────────────────────────────────────────────────

  subscribeToGroups(
    groupIds: string[],
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    opts?: { signal?: AbortSignal }
  ): () => void {
    const seen = new SeenSet(this.seenTtlMs);
    const deduped = (msg: SporeMessage, conv: SporeConversation) => {
      if (seen.add(msg.id)) onMessage(msg, conv);
    };
    const unsubs = this.transports.map((t) => t.subscribeToGroups(groupIds, deduped, opts));
    return () => { for (const u of unsubs) u(); };
  }

  // ─── Query History ────────────────────────────────────────────────────────

  async queryMessages(
    convId: string,
    opts?: { limit?: number; since?: number }
  ): Promise<SporeMessage[]> {
    const allResults = await Promise.allSettled(
      this.transports.map((t) => t.queryMessages(convId, opts))
    );

    // Merge results from all transports; deduplicate by message ID; sort by sentAt
    const seen = new Set<string>();
    const merged: SporeMessage[] = [];
    for (const result of allResults) {
      if (result.status !== 'fulfilled') continue;
      for (const msg of result.value) {
        if (!seen.has(msg.id)) {
          seen.add(msg.id);
          merged.push(msg);
        }
      }
    }
    merged.sort((a, b) => a.sentAt - b.sentAt);

    // Respect the limit after merge
    if (opts?.limit !== undefined && merged.length > opts.limit) {
      return merged.slice(0, opts.limit);
    }
    return merged;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Fan out a send operation across all transports concurrently.
   * Returns the hash from the first transport to resolve successfully.
   * Re-throws if all transports fail.
   */
  private async fanOutSend(op: (t: SporeTransport) => Promise<string>): Promise<string> {
    const results = await Promise.allSettled(this.transports.map(op));
    for (const result of results) {
      if (result.status === 'fulfilled') return result.value;
    }
    // All failed — re-throw the last error
    const last = results[results.length - 1]!;
    throw (last as PromiseRejectedResult).reason;
  }
}
