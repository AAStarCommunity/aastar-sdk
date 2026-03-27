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
  /** Enable verbose debug logging */
  debug?: boolean;
}

// Map: WebSocket → (subscriptionId → filters)
type SubMap = Map<string, EventFilter[]>;

export class SporeRelayNode {
  private wss: WebSocketServer;
  private subscriptions = new Map<WebSocket, SubMap>();
  private config: Required<Pick<SporeRelayConfig, 'port' | 'host' | 'store' | 'maxEventSize' | 'debug'>> &
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
      debug: rawConfig.debug ?? false,
    };

    this.operator = new SporeRelayOperator();
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.subscriptions.set(ws, new Map());
      this.log(`Client connected. Total: ${this.wss.clients.size}`);

      ws.on('message', (data) => {
        try {
          this.handleMessage(ws, data.toString());
        } catch (err) {
          this.sendNotice(ws, `internal error: ${String(err)}`);
        }
      });

      ws.on('close', () => {
        this.subscriptions.delete(ws);
        this.log(`Client disconnected. Total: ${this.wss.clients.size}`);
      });

      ws.on('error', (err) => {
        this.log(`WebSocket error: ${err.message}`);
        this.subscriptions.delete(ws);
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
    if (raw.length > this.config.maxEventSize * 2) {
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
    const event = rawEvent as NostrEvent;

    // Basic shape check
    if (!event || typeof event.id !== 'string' || typeof event.pubkey !== 'string') {
      this.sendOk(ws, event?.id ?? '', false, 'invalid: malformed event');
      return;
    }

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
    if (typeof subId !== 'string' || subId.length === 0) {
      this.sendNotice(ws, 'invalid subscription id');
      return;
    }

    // Register subscription
    const subMap = this.subscriptions.get(ws) ?? new Map<string, EventFilter[]>();
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
