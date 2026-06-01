// SporeRelayNode: NIP-01 compliant WebSocket relay with optional EIP-3009 payment gating

import { WebSocketServer, WebSocket } from 'ws';
import { sha256 } from '@noble/hashes/sha256';
// schnorr is used for Nostr (BIP-340) Schnorr signature verification
// secp256k1 is kept for EIP-3009 ECDSA recovery in PaymentValidator
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { EventStore, NostrEvent, EventFilter } from './storage/EventStore.js';
import type { PaymentValidator } from './middleware/PaymentValidator.js';
import { SporeRelayOperator } from './SporeRelayOperator.js';
import type { SettlementClientLike } from './SporeRelayOperator.js';

export interface SporeRelayConfig {
  /** WebSocket server port. Default: 7777 */
  port?: number;
  /** Bind host. Default: '0.0.0.0' */
  host?: string;
  /** Event persistence store */
  store: EventStore;
  /** If set, events must carry a kind:23405 payment commitment in their tags */
  paymentValidator?: PaymentValidator;
  /** Specific event kinds that require payment. If omitted with paymentValidator set, all kinds require payment */
  requirePaymentForKinds?: number[];
  /** Maximum event size in bytes. Default: 65536 (64 KB) */
  maxEventSize?: number;
  /**
   * Maximum EVENT messages per client per second.
   * Clients exceeding this rate receive NOTICE and the event is dropped.
   * Default: 20. Set to 0 to disable rate limiting.
   */
  maxEventsPerSecond?: number;
  /**
   * Maximum number of REQ filters per message. Default: 10.
   * Prevents CPU/DB DoS from clients submitting thousands of filters.
   */
  maxFiltersPerReq?: number;
  /**
   * Maximum number of concurrent subscriptions per client. Default: 20.
   * Prevents memory DoS from clients opening unlimited subscriptions.
   */
  maxSubscriptionsPerClient?: number;
  /** Injectable on-chain settlement client for SporeRelayOperator. */
  settlementClient?: SettlementClientLike;
  /** Enable verbose debug logging */
  debug?: boolean;
}

// Map: WebSocket → (subscriptionId → filters)
type SubMap = Map<string, EventFilter[]>;

// Per-client rate limit state
interface RateState {
  count: number;
  windowStart: number; // ms timestamp
}

export class SporeRelayNode {
  private wss: WebSocketServer;
  private subscriptions = new Map<WebSocket, SubMap>();
  /** Per-client rate limit counters (only used when maxEventsPerSecond > 0) */
  private rateState = new Map<WebSocket, RateState>();
  private config: Required<Pick<SporeRelayConfig, 'port' | 'host' | 'store' | 'maxEventSize' | 'maxEventsPerSecond' | 'maxFiltersPerReq' | 'maxSubscriptionsPerClient' | 'debug'>> &
    Pick<SporeRelayConfig, 'paymentValidator' | 'requirePaymentForKinds'>;
  readonly operator: SporeRelayOperator;

  constructor(rawConfig: SporeRelayConfig) {
    this.config = {
      port: rawConfig.port ?? 7777,
      host: rawConfig.host ?? '0.0.0.0',
      store: rawConfig.store,
      paymentValidator: rawConfig.paymentValidator,
      requirePaymentForKinds: rawConfig.requirePaymentForKinds,
      maxEventSize: rawConfig.maxEventSize ?? 65536,
      maxEventsPerSecond: rawConfig.maxEventsPerSecond ?? 20,
      maxFiltersPerReq: rawConfig.maxFiltersPerReq ?? 10,
      maxSubscriptionsPerClient: rawConfig.maxSubscriptionsPerClient ?? 20,
      debug: rawConfig.debug ?? false,
    };

    this.operator = new SporeRelayOperator({ settlementClient: rawConfig.settlementClient });
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.subscriptions.set(ws, new Map());
      if (this.config.maxEventsPerSecond > 0) {
        this.rateState.set(ws, { count: 0, windowStart: Date.now() });
      }
      this.log(`Client connected. Total: ${this.wss.clients.size}`);

      ws.on('message', (data) => {
        try {
          this.handleMessage(ws, data.toString());
        } catch (err) {
          // Log full error server-side; send generic message to client to prevent info leak
          this.log(`handleMessage error: ${String(err)}`);
          this.sendNotice(ws, 'internal error');
        }
      });

      ws.on('close', () => {
        this.subscriptions.delete(ws);
        this.rateState.delete(ws);
        this.log(`Client disconnected. Total: ${this.wss.clients.size}`);
      });

      ws.on('error', (err) => {
        this.log(`WebSocket error: ${err.message}`);
        this.subscriptions.delete(ws);
        this.rateState.delete(ws);
      });
    });

    this.log(`SporeRelayNode listening on ws://${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    // Terminate all open connections first so wss.close() resolves promptly
    for (const client of this.wss.clients) {
      client.terminate();
    }
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ─── NIP-01 message dispatcher ────────────────────────────────────────────

  private handleMessage(ws: WebSocket, raw: string): void {
    if (raw.length > this.config.maxEventSize + 1024) {
      this.sendNotice(ws, 'message too large');
      return;
    }

    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendNotice(ws, 'invalid JSON');
      return;
    }

    if (!Array.isArray(msg) || msg.length < 2) {
      this.sendNotice(ws, 'invalid message format');
      return;
    }

    const [type, ...args] = msg as [string, ...unknown[]];

    switch (type) {
      case 'EVENT':
        this.handleEvent(ws, args[0]);
        break;
      case 'REQ':
        this.handleReq(ws, args[0] as string, args.slice(1) as EventFilter[]);
        break;
      case 'CLOSE':
        this.handleClose(ws, args[0] as string);
        break;
      default:
        this.sendNotice(ws, `unknown message type: ${type}`);
    }
  }

  // ─── EVENT handler ────────────────────────────────────────────────────────

  private handleEvent(ws: WebSocket, rawEvent: unknown): void {
    // Rate limiting — sliding 1-second window per client
    if (this.config.maxEventsPerSecond > 0) {
      const state = this.rateState.get(ws);
      if (state) {
        const now = Date.now();
        if (now - state.windowStart >= 1000) {
          state.count = 0;
          state.windowStart = now;
        }
        state.count++;
        if (state.count > this.config.maxEventsPerSecond) {
          this.sendNotice(ws, 'rate-limited: too many events per second');
          return;
        }
      }
    }

    // Full structural validation before trusting any field
    if (!this.validateEventShape(ws, rawEvent)) return;
    const event = rawEvent as NostrEvent;

    // Size check
    const eventJson = JSON.stringify(event);
    if (eventJson.length > this.config.maxEventSize) {
      this.sendOk(ws, event.id, false, 'invalid: event too large');
      return;
    }

    // Duplicate check
    if (this.config.store.has(event.id)) {
      this.sendOk(ws, event.id, true, 'duplicate: already stored');
      return;
    }

    // Validate event ID (NIP-01: sha256 of serialized event)
    if (!this.validateEventId(event)) {
      this.sendOk(ws, event.id, false, 'invalid: bad event id');
      return;
    }

    // Validate Schnorr signature
    if (!this.validateEventSig(event)) {
      this.sendOk(ws, event.id, false, 'invalid: bad signature');
      return;
    }

    // Payment gating
    if (this.requiresPayment(event.kind)) {
      const paymentResult = this.validatePayment(event);
      if (!paymentResult.valid) {
        this.sendOk(ws, event.id, false, `blocked: ${paymentResult.reason}`);
        return;
      }
    }

    // Persist and fan out
    this.config.store.save(event);
    this.sendOk(ws, event.id, true, '');
    this.fanOut(event);

    this.log(`Stored event id=${event.id} kind=${event.kind}`);
  }

  // ─── REQ handler ──────────────────────────────────────────────────────────

  private handleReq(ws: WebSocket, subId: string, filters: EventFilter[]): void {
    if (typeof subId !== 'string' || subId.length === 0 || subId.length > 128) {
      this.sendNotice(ws, 'invalid subscription id');
      return;
    }

    // Cap filter count per REQ to prevent CPU/DB DoS
    if (filters.length > this.config.maxFiltersPerReq) {
      this.sendNotice(ws, `too many filters: max ${this.config.maxFiltersPerReq}`);
      return;
    }

    // Cap concurrent subscriptions per client to prevent memory DoS
    const subMap = this.subscriptions.get(ws) ?? new Map<string, EventFilter[]>();
    if (!subMap.has(subId) && subMap.size >= this.config.maxSubscriptionsPerClient) {
      this.sendNotice(ws, `subscription limit reached: max ${this.config.maxSubscriptionsPerClient}`);
      return;
    }

    // Register subscription
    subMap.set(subId, filters);
    this.subscriptions.set(ws, subMap);

    // Replay matching stored events
    for (const filter of filters) {
      const events = this.config.store.query(filter);
      for (const ev of events) {
        this.sendEvent(ws, subId, ev);
      }
    }

    // Signal end-of-stored-events
    this.sendEose(ws, subId);
  }

  // ─── CLOSE handler ────────────────────────────────────────────────────────

  private handleClose(ws: WebSocket, subId: string): void {
    const subMap = this.subscriptions.get(ws);
    if (subMap) {
      subMap.delete(subId);
    }
    this.log(`Subscription closed: subId=${subId}`);
  }

  // ─── Fan-out ──────────────────────────────────────────────────────────────

  private fanOut(event: NostrEvent): void {
    for (const [client, subMap] of this.subscriptions.entries()) {
      if (client.readyState !== WebSocket.OPEN) continue;
      for (const [subId, filters] of subMap.entries()) {
        if (filters.some(f => this.matchesFilter(event, f))) {
          this.sendEvent(client, subId, event);
        }
      }
    }
  }

  // ─── Filter matching ──────────────────────────────────────────────────────

  /** Exposed for testing only — do not call from external code. */
  matchesFilter(event: NostrEvent, filter: EventFilter): boolean {
    if (filter.ids?.length && !filter.ids.includes(event.id)) return false;
    if (filter.authors?.length && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds?.length && !filter.kinds.includes(event.kind)) return false;
    if (filter.since !== undefined && event.created_at < filter.since) return false;
    if (filter.until !== undefined && event.created_at > filter.until) return false;
    if (filter['#e']?.length) {
      const eSet = new Set(filter['#e']);
      if (!event.tags.some(t => t[0] === 'e' && eSet.has(t[1]))) return false;
    }
    if (filter['#p']?.length) {
      const pSet = new Set(filter['#p']);
      if (!event.tags.some(t => t[0] === 'p' && pSet.has(t[1]))) return false;
    }
    return true;
  }

  // ─── Full structural validation ────────────────────────────────────────────

  /**
   * Validate the full shape of a raw (unknown) event object before trusting any field.
   * Sends an OK rejection and returns false on any structural violation.
   */
  private validateEventShape(ws: WebSocket, raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') {
      this.sendOk(ws, '', false, 'invalid: malformed event');
      return false;
    }
    const e = raw as Record<string, unknown>;

    if (typeof e['id'] !== 'string' || e['id'].length !== 64) {
      this.sendOk(ws, '', false, 'invalid: malformed event id');
      return false;
    }
    if (typeof e['pubkey'] !== 'string' || e['pubkey'].length !== 64) {
      this.sendOk(ws, e['id'] as string, false, 'invalid: malformed pubkey');
      return false;
    }
    if (typeof e['kind'] !== 'number' || !Number.isInteger(e['kind']) || e['kind'] < 0) {
      this.sendOk(ws, e['id'] as string, false, 'invalid: malformed kind');
      return false;
    }
    if (typeof e['created_at'] !== 'number' || !Number.isInteger(e['created_at'])) {
      this.sendOk(ws, e['id'] as string, false, 'invalid: malformed created_at');
      return false;
    }
    if (!Array.isArray(e['tags'])) {
      this.sendOk(ws, e['id'] as string, false, 'invalid: tags must be array');
      return false;
    }
    if (typeof e['content'] !== 'string') {
      this.sendOk(ws, e['id'] as string, false, 'invalid: content must be string');
      return false;
    }
    if (typeof e['sig'] !== 'string' || e['sig'].length !== 128) {
      this.sendOk(ws, e['id'] as string, false, 'invalid: malformed sig');
      return false;
    }
    return true;
  }

  // ─── Cryptographic validation ─────────────────────────────────────────────

  private validateEventId(event: NostrEvent): boolean {
    try {
      // NIP-01 canonical serialization
      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content,
      ]);
      const hash = sha256(new TextEncoder().encode(serialized));
      return bytesToHex(hash) === event.id;
    } catch {
      return false;
    }
  }

  private validateEventSig(event: NostrEvent): boolean {
    try {
      // NIP-01: Schnorr (BIP-340) signature over the event id (32-byte sha256 hash)
      // schnorr.verify(sig_bytes, msg_bytes, pubkey_bytes)
      // event.pubkey is a 32-byte x-only BIP-340 public key encoded as hex
      return schnorr.verify(
        hexToBytes(event.sig),   // 64-byte Schnorr signature
        hexToBytes(event.id),    // 32-byte message (the pre-computed sha256 hash)
        hexToBytes(event.pubkey) // 32-byte x-only public key
      );
    } catch {
      return false;
    }
  }

  // ─── Payment gating ───────────────────────────────────────────────────────

  private requiresPayment(kind: number): boolean {
    if (!this.config.paymentValidator) return false;
    if (this.config.requirePaymentForKinds) {
      return this.config.requirePaymentForKinds.includes(kind);
    }
    return true; // all kinds require payment when validator is set
  }

  private validatePayment(event: NostrEvent): { valid: boolean; reason?: string } {
    const validator = this.config.paymentValidator!;
    const commitment = validator.parse(event.tags);
    if (!commitment) {
      return { valid: false, reason: 'missing payment commitment' };
    }
    const result = validator.validate(commitment);
    if (result.valid) {
      this.operator.onCommitmentAccepted({
        commitment,
        acceptedAt: Math.floor(Date.now() / 1000),
        eventId: event.id,
      });
    }
    return result;
  }

  // ─── Wire message helpers ─────────────────────────────────────────────────

  private sendOk(ws: WebSocket, eventId: string, ok: boolean, message: string): void {
    ws.send(JSON.stringify(['OK', eventId, ok, message]));
  }

  private sendEvent(ws: WebSocket, subId: string, event: NostrEvent): void {
    ws.send(JSON.stringify(['EVENT', subId, event]));
  }

  private sendEose(ws: WebSocket, subId: string): void {
    ws.send(JSON.stringify(['EOSE', subId]));
  }

  private sendNotice(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify(['NOTICE', message]));
  }

  private log(msg: string): void {
    if (this.config.debug) {
      console.log(`[SporeRelayNode] ${msg}`);
    }
  }

  // ─── Accessors (for testing) ──────────────────────────────────────────────

  get port(): number {
    return this.config.port;
  }

  get clientCount(): number {
    return this.wss.clients.size;
  }
}
