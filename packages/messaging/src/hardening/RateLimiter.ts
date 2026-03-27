// RateLimiter — token-bucket rate limiter for Spore Protocol message processing.
//
// Used by SporeAgent to limit the rate at which messages from any single sender
// are accepted for processing, preventing DoS via message flooding.
//
// Algorithm: Token Bucket
//   - Each sender gets a bucket with capacity `burstLimit` tokens
//   - Tokens refill at `ratePerSecond` per second (continuous or discrete)
//   - Each accepted message consumes 1 token
//   - When a bucket is empty, the message is rejected (rate limited)
//
// Bucket state is stored in memory. For multi-process deployments,
// inject a persistent RateLimitStore (Redis-backed INCR + EXPIRE).

// ─── Store Interface ───────────────────────────────────────────────────────────

/**
 * Persistent backing store for rate limit state.
 * The default InMemoryRateLimitStore is suitable for single-process deployments.
 * For multi-process, implement using Redis: INCR + EXPIRE or token-bucket scripts.
 */
export interface RateLimitStore {
  /** Get the current token count for a key (returns burstLimit when key is new). */
  getTokens(key: string, burstLimit: number): number | Promise<number>;
  /** Set the token count for a key. */
  setTokens(key: string, tokens: number): void | Promise<void>;
  /** Get the last refill timestamp (ms) for a key. Returns 0 when key is new. */
  getLastRefill(key: string): number | Promise<number>;
  /** Set the last refill timestamp (ms) for a key. */
  setLastRefill(key: string, ts: number): void | Promise<void>;
}

// ─── InMemoryRateLimitStore ───────────────────────────────────────────────────

/** Default in-memory store (single-process only). */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly tokens = new Map<string, number>();
  private readonly lastRefill = new Map<string, number>();

  getTokens(key: string, burstLimit: number): number {
    return this.tokens.get(key) ?? burstLimit;
  }

  setTokens(key: string, t: number): void {
    this.tokens.set(key, t);
  }

  getLastRefill(key: string): number {
    return this.lastRefill.get(key) ?? 0;
  }

  setLastRefill(key: string, ts: number): void {
    this.lastRefill.set(key, ts);
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration for RateLimiter */
export interface RateLimiterConfig {
  /**
   * Token refill rate (tokens per second).
   * A sender can sustain this many messages per second indefinitely.
   * Default: 2
   */
  ratePerSecond?: number;
  /**
   * Maximum burst size (bucket capacity).
   * A sender can send up to this many messages in a single burst.
   * Default: 10
   */
  burstLimit?: number;
  /**
   * Maximum number of distinct sender keys tracked simultaneously.
   * Oldest entries are evicted when limit is reached (LRU approximation).
   * Default: 50_000
   */
  maxKeys?: number;
  /**
   * Backing store for token bucket state.
   * Defaults to InMemoryRateLimitStore.
   */
  store?: RateLimitStore;
}

// ─── RateLimiter ─────────────────────────────────────────────────────────────

/**
 * Token-bucket rate limiter for per-sender Spore message rate limiting.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ ratePerSecond: 5, burstLimit: 20 });
 *
 * agent.on('text', async (ctx) => {
 *   if (!await limiter.allow(ctx.message.senderPubkey)) {
 *     return; // silently drop rate-limited messages
 *   }
 *   await ctx.sendText('Hello!');
 * });
 * ```
 */
export class RateLimiter {
  private readonly ratePerSecond: number;
  private readonly burstLimit: number;
  private readonly maxKeys: number;
  private readonly store: RateLimitStore;

  // Insertion-order key tracking for maxKeys eviction
  private readonly keyOrder: string[] = [];

  constructor(config: RateLimiterConfig = {}) {
    this.ratePerSecond = config.ratePerSecond ?? 2;
    this.burstLimit = config.burstLimit ?? 10;
    this.maxKeys = config.maxKeys ?? 50_000;
    this.store = config.store ?? new InMemoryRateLimitStore();
  }

  /**
   * Check if the given sender key is within rate limits.
   * Consumes one token on success. Returns false when the bucket is exhausted.
   *
   * @param key - Sender identifier (Nostr pubkey hex, IP address, etc.)
   * @returns true if the request should be allowed, false if rate limited
   */
  async allow(key: string): Promise<boolean> {
    const now = Date.now();

    // Track key insertion order for maxKeys eviction
    if (!this.keyOrder.includes(key)) {
      this.keyOrder.push(key);
      // Evict oldest key when limit is reached
      if (this.keyOrder.length > this.maxKeys) {
        const evicted = this.keyOrder.shift();
        if (evicted) {
          await this.store.setTokens(evicted, this.burstLimit);
          await this.store.setLastRefill(evicted, 0);
        }
      }
    }

    const lastRefill = await this.store.getLastRefill(key);
    let tokens = await this.store.getTokens(key, this.burstLimit);

    // Refill tokens based on elapsed time since last refill
    if (lastRefill > 0) {
      const elapsedSec = (now - lastRefill) / 1000;
      const refill = elapsedSec * this.ratePerSecond;
      tokens = Math.min(this.burstLimit, tokens + refill);
    }

    await this.store.setLastRefill(key, now);

    if (tokens < 1) {
      // Bucket exhausted — persist current (possibly fractional) state and reject
      await this.store.setTokens(key, tokens);
      return false;
    }

    // Consume one token and allow
    await this.store.setTokens(key, tokens - 1);
    return true;
  }

  /**
   * Remaining token count for a key (informational; does not consume tokens).
   * Returns burstLimit for unseen keys.
   */
  async remaining(key: string): Promise<number> {
    const tokens = await this.store.getTokens(key, this.burstLimit);
    return Math.floor(Math.max(0, tokens));
  }

  /**
   * Reset the token bucket for a specific key (e.g., after manual review).
   */
  async reset(key: string): Promise<void> {
    await this.store.setTokens(key, this.burstLimit);
    await this.store.setLastRefill(key, 0);
  }
}
