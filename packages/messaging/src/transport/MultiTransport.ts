// MultiTransport — fan-out adapter that composes multiple SporeTransport instances.
// Sends to all transports concurrently; subscriptions merge with deduplication.

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

/**
 * Bounded deduplication set using a Map for O(1) lookups.
 * Expired entries are pruned lazily on each add() call.
 */
class SeenSet {
  private readonly items = new Map<string, number>(); // id → expiresAt
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** Returns true if this ID has not been seen before (and records it). */
  add(id: string): boolean {
    const now = Date.now();

    // Lazy eviction of expired entries
    for (const [key, expiresAt] of this.items) {
      if (expiresAt <= now) this.items.delete(key);
    }

    if (this.items.has(id)) return false;
    this.items.set(id, now + this.ttlMs);
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
    return this.fanOutSubscribe(onMessage, (deduped) =>
      this.transports.map((t) => t.subscribeToDms(myPubkeyHex, deduped, opts))
    );
  }

  // ─── Subscribe to Groups ─────────────────────────────────────────────────

  subscribeToGroups(
    groupIds: string[],
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    opts?: { signal?: AbortSignal }
  ): () => void {
    return this.fanOutSubscribe(onMessage, (deduped) =>
      this.transports.map((t) => t.subscribeToGroups(groupIds, deduped, opts))
    );
  }

  // ─── Query History ────────────────────────────────────────────────────────

  async queryMessages(
    convId: string,
    opts?: { limit?: number; since?: number }
  ): Promise<SporeMessage[]> {
    const allResults = await Promise.allSettled(
      this.transports.map((t) => t.queryMessages(convId, opts))
    );

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

    return opts?.limit !== undefined ? merged.slice(0, opts.limit) : merged;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** Subscribe across all transports with per-subscription deduplication. */
  private fanOutSubscribe(
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    subscribe: (deduped: (msg: SporeMessage, conv: SporeConversation) => void) => Array<() => void>
  ): () => void {
    const seen = new SeenSet(this.seenTtlMs);
    const deduped = (msg: SporeMessage, conv: SporeConversation): void => {
      if (seen.add(msg.id)) onMessage(msg, conv);
    };
    const unsubs = subscribe(deduped);
    return () => { for (const u of unsubs) u(); };
  }

  /** Fan out a send across all transports; return the first successful hash. */
  private async fanOutSend(op: (t: SporeTransport) => Promise<string>): Promise<string> {
    const results = await Promise.allSettled(this.transports.map(op));
    for (const result of results) {
      if (result.status === 'fulfilled') return result.value;
    }
    const last = results[results.length - 1]!;
    throw (last as PromiseRejectedResult).reason;
  }
}
