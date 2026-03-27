// NonceStore — injectable interface for nonce/state persistence.
//
// By default, X402Bridge and UserOpBridge use InMemoryNonceStore,
// which loses state on process restart. In production, inject a
// persistent implementation (SQLite, Redis, etc.).

// ─── Nonce Store ──────────────────────────────────────────────────────────────

/**
 * Persistent store for consumed nonces (replay protection).
 *
 * Key format used by bridges: "<chainId>:<nonce>"
 *
 * Production implementations should persist to SQLite/Redis and survive
 * process restarts to prevent replay attacks across restarts.
 */
export interface NonceStore {
  /** Returns true if this nonce key has already been consumed. */
  has(key: string): boolean | Promise<boolean>;
  /** Mark this nonce key as consumed. */
  add(key: string): void | Promise<void>;
  /**
   * Atomic check-and-set: mark key as consumed and return whether it was already consumed.
   * Returns true if the key was NEW (successfully claimed), false if already consumed.
   *
   * Async stores (Redis, DB) MUST implement this as a single atomic operation
   * (e.g. Redis SET NX, SQL INSERT OR IGNORE) to prevent TOCTOU replay attacks
   * under concurrent requests.
   *
   * The default implementation delegates to has()+add(), which is safe for
   * InMemoryNonceStore (Node.js single-threaded) but not for async stores.
   */
  claim(key: string): boolean | Promise<boolean>;
}

/** Default in-memory implementation (state lost on restart). */
export class InMemoryNonceStore implements NonceStore {
  private readonly set = new Set<string>();
  has(key: string): boolean { return this.set.has(key); }
  add(key: string): void { this.set.add(key); }
  // Safe: Node.js single-threaded — no interleaving between has() and add()
  claim(key: string): boolean {
    if (this.set.has(key)) return false;
    this.set.add(key);
    return true;
  }
}

// ─── Voucher Store ────────────────────────────────────────────────────────────

/** Best (highest cumulative) pending voucher for a channel. */
export interface BestVoucher {
  cumulativeAmount: bigint;
  sig: `0x${string}`;
}

/**
 * Persistent store for ChannelBridge voucher state.
 *
 * Production implementations should persist to SQLite/Redis.
 * On graceful shutdown, call forceSettleAll() before exiting.
 */
export interface VoucherStore {
  /** Get the best pending (unsubmitted) voucher for a channel. */
  getBest(channelId: string): BestVoucher | undefined | Promise<BestVoucher | undefined>;
  /** Set the best pending voucher for a channel. */
  setBest(channelId: string, voucher: BestVoucher): void | Promise<void>;
  /** Remove the pending voucher for a channel (after on-chain settlement). */
  deleteBest(channelId: string): void | Promise<void>;
  /** Get the last settled cumulative amount for a channel. */
  getSettled(channelId: string): bigint | Promise<bigint>;
  /** Record a settled amount for a channel. */
  setSettled(channelId: string, amount: bigint): void | Promise<void>;
  /** Return all channels with pending (unsubmitted) vouchers. */
  getAllPending(): Map<string, BestVoucher> | Promise<Map<string, BestVoucher>>;
}

/** Default in-memory implementation (state lost on restart). */
export class InMemoryVoucherStore implements VoucherStore {
  private readonly pending = new Map<string, BestVoucher>();
  private readonly settled = new Map<string, bigint>();

  getBest(channelId: string): BestVoucher | undefined { return this.pending.get(channelId); }
  setBest(channelId: string, voucher: BestVoucher): void { this.pending.set(channelId, voucher); }
  deleteBest(channelId: string): void { this.pending.delete(channelId); }
  getSettled(channelId: string): bigint { return this.settled.get(channelId) ?? 0n; }
  setSettled(channelId: string, amount: bigint): void { this.settled.set(channelId, amount); }
  getAllPending(): Map<string, BestVoucher> { return new Map(this.pending); }
}
