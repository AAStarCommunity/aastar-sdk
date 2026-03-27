// NonceStore — injectable interface for nonce/state persistence.
//
// PRODUCTION WARNING: X402Bridge and UserOpBridge default to InMemoryNonceStore,
// which loses all consumed nonces on process restart, enabling replay attacks.
// Inject a persistent NonceStore in production:
//   - FileNonceStore (exported here) — simple JSON-file persistence, suitable for
//     single-process deployments where the file path is on durable storage.
//   - Implement NonceStore yourself using Redis SETNX or SQL INSERT OR IGNORE for
//     multi-process or high-throughput deployments.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

/** Default in-memory implementation (state lost on restart — NOT safe for production). */
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

/**
 * File-backed nonce store — persists consumed nonces to a JSON file.
 *
 * Suitable for single-process production deployments where the file path is on
 * durable storage (e.g. mounted volume, local SSD). On startup, previously
 * consumed nonces are reloaded, preventing replay attacks across restarts.
 *
 * Limitations:
 *   - Synchronous file I/O on every claim() call — not suitable for high throughput.
 *   - Single-process only: multiple processes writing to the same file will corrupt state.
 *     For multi-process deployments, implement NonceStore with Redis SETNX or SQL.
 *   - File grows unbounded; prune old nonces periodically if needed.
 *
 * @param filePath - Absolute path to the JSON persistence file (created if absent).
 */
export class FileNonceStore implements NonceStore {
  private readonly store: Set<string>;

  constructor(private readonly filePath: string) {
    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as string[];
        this.store = new Set(Array.isArray(data) ? data : []);
      } catch (err) {
        // Corrupted or unreadable file — start with an empty store and log a warning.
        // Existing nonces are lost, which may allow replay attacks for prior sessions.
        // Operators should investigate and restore from backup before accepting payments.
        console.warn(`[FileNonceStore] Failed to load ${filePath}, starting empty:`, err);
        this.store = new Set();
      }
    } else {
      this.store = new Set();
    }
  }

  has(key: string): boolean { return this.store.has(key); }

  add(key: string): void {
    this.store.add(key);
    writeFileSync(this.filePath, JSON.stringify([...this.store]));
  }

  // Synchronous, safe within a single Node.js process (event loop is single-threaded)
  claim(key: string): boolean {
    if (this.store.has(key)) return false;
    this.add(key);
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
