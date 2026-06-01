// SporeHttpGateway — HTTP/SSE gateway for the Spore Protocol.
//
// Exposes an XMTP-compatible REST API over a SporeAgent instance.
// External clients (Python, Go, mobile apps) can interact with the Spore
// Protocol over plain HTTP without any Nostr SDK dependency.
//
// API surface:
//   POST /api/v1/messages/send          — send a DM to a recipient
//   GET  /api/v1/conversations          — list known conversations
//   GET  /api/v1/messages?peer=<hex>&limit=<n> — fetch messages with a peer
//   GET  /api/v1/stream                 — SSE stream of incoming messages
//   GET  /api/v1/health                 — liveness probe

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';
import type { SporeAgent } from '../SporeAgent.js';
import type {
  SendMessageRequest,
  SendMessageResponse,
  ConversationsResponse,
  MessagesResponse,
  MessageSummary,
  StreamEvent,
  GatewayErrorResponse,
} from './GatewayTypes.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration for SporeHttpGateway */
export interface SporeHttpGatewayConfig {
  /** The SporeAgent instance to proxy */
  agent: SporeAgent;
  /** TCP port to listen on (default: 7402) */
  port?: number;
  /** Host to bind to (default: '127.0.0.1') */
  host?: string;
  /**
   * Optional bearer token for request authentication.
   * If set, all requests must include `Authorization: Bearer <token>`.
   * Omit only in development / private network deployments.
   */
  authToken?: string;
  /**
   * Maximum bytes to read from a POST request body (default: 65536).
   * Requests exceeding this are rejected with 413.
   */
  maxBodyBytes?: number;
  /**
   * Maximum number of concurrent SSE stream clients (default: 100).
   * New connections beyond this limit are rejected with 429.
   */
  maxSseClients?: number;
  /**
   * Inactivity timeout in milliseconds for all HTTP connections (default: 30000).
   * Prevents slow-client DoS attacks from holding sockets indefinitely.
   */
  requestTimeoutMs?: number;
}

// ─── SporeHttpGateway ────────────────────────────────────────────────────────

/**
 * SporeHttpGateway wraps a SporeAgent and serves an XMTP-compatible REST API.
 *
 * Usage:
 * ```ts
 * const agent = await SporeAgent.createFromEnv();
 * await agent.start();
 *
 * const gateway = new SporeHttpGateway({ agent, port: 7402 });
 * await gateway.start();
 * // Listening on http://127.0.0.1:7402
 * ```
 *
 * External clients call:
 *   POST /api/v1/messages/send   { "to": "<pubkey>", "content": "hello" }
 *   GET  /api/v1/conversations
 *   GET  /api/v1/messages?peer=<pubkey>&limit=20
 *   GET  /api/v1/stream         (SSE)
 */
export class SporeHttpGateway {
  private readonly server: Server;
  private readonly sseClients: Set<ServerResponse> = new Set();
  private readonly config: Required<Omit<SporeHttpGatewayConfig, 'authToken'>> & { authToken?: string };

  constructor(config: SporeHttpGatewayConfig) {
    this.config = {
      port: config.port ?? 7402,
      host: config.host ?? '127.0.0.1',
      maxBodyBytes: config.maxBodyBytes ?? 65536,
      maxSseClients: config.maxSseClients ?? 100,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      agent: config.agent,
      authToken: config.authToken,
    };

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    // Forward agent 'text' events to all active SSE clients
    this.config.agent.on('text', (ctx) => {
      const event: StreamEvent = {
        type: 'message',
        from: ctx.message.senderPubkey,
        content: ctx.message.content,
        id: ctx.message.id,
        sentAt: ctx.message.sentAt,
      };
      this.broadcastSse(event);
    });
  }

  /** Start the HTTP server. Resolves when the server is listening. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', reject);

      // Global socket timeout: destroy idle/slow connections automatically
      this.server.setTimeout(this.config.requestTimeoutMs);
      this.server.on('timeout', (socket) => { socket.destroy(); });

      this.server.listen(this.config.port, this.config.host, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server and close all SSE connections.
   * Resolves when the server is fully closed.
   */
  stop(): Promise<void> {
    // Close all SSE connections so clients see EOF
    for (const res of this.sseClients) {
      res.end();
    }
    this.sseClients.clear();

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /** The port this gateway is listening on (useful when port = 0 for random assignment). */
  get port(): number {
    const addr = this.server.address();
    if (addr && typeof addr === 'object') return addr.port;
    return this.config.port;
  }

  // ─── Request Dispatch ──────────────────────────────────────────────────────

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Auth check (before any response)
    if (!this.checkAuth(req, res)) return;

    // The http:// scheme here is only used for URL parsing (hostname + path);
    // the actual transport is determined by whether this.server uses TLS.
    const url = new URL(req.url ?? '/', `http://${this.config.host}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      if (path === '/api/v1/health' && method === 'GET') {
        return this.handleHealth(res);
      }
      if (path === '/api/v1/messages/send' && method === 'POST') {
        return await this.handleSend(req, res);
      }
      if (path === '/api/v1/conversations' && method === 'GET') {
        return this.handleConversations(res);
      }
      if (path === '/api/v1/messages' && method === 'GET') {
        return await this.handleGetMessages(url, res);
      }
      if (path === '/api/v1/stream' && method === 'GET') {
        return this.handleStream(res);
      }
      this.sendJson(res, 404, { error: 'not_found' } satisfies GatewayErrorResponse);
    } catch (err) {
      // Do not expose internal error details to clients — log server-side only
      console.error('[SporeHttpGateway] unhandled error:', err);
      this.sendJson(res, 500, { error: 'internal_server_error' } satisfies GatewayErrorResponse);
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Validates the Authorization header when authToken is configured.
   * Uses Node.js crypto.timingSafeEqual to prevent timing oracle attacks.
   * Returns true if the request is authorized.
   */
  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.config.authToken) return true;

    const header = req.headers['authorization'] ?? '';
    const expected = `Bearer ${this.config.authToken}`;
    if (!timingSafeEqual(header, expected)) {
      this.sendJson(res, 401, { error: 'unauthorized' } satisfies GatewayErrorResponse);
      return false;
    }
    return true;
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private handleHealth(res: ServerResponse): void {
    this.sendJson(res, 200, {
      status: 'ok',
      pubkey: this.config.agent.pubkey,
      address: this.config.agent.address,
    });
  }

  private async handleSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    if (body === null) {
      this.sendJson(res, 413, { error: 'request_body_too_large' } satisfies GatewayErrorResponse);
      return;
    }

    let parsed: SendMessageRequest;
    try {
      parsed = JSON.parse(body) as SendMessageRequest;
    } catch {
      this.sendJson(res, 400, { error: 'invalid_json' } satisfies GatewayErrorResponse);
      return;
    }

    if (typeof parsed.to !== 'string' || typeof parsed.content !== 'string') {
      this.sendJson(res, 400, { error: 'missing_fields: to, content' } satisfies GatewayErrorResponse);
      return;
    }

    // Validate recipient pubkey — exactly 64 lowercase/uppercase hex chars (Nostr pubkey)
    if (!/^[0-9a-fA-F]{64}$/.test(parsed.to)) {
      this.sendJson(res, 400, { error: 'invalid_recipient: must be 64-char hex Nostr pubkey' } satisfies GatewayErrorResponse);
      return;
    }

    // Validate optional contentType — must match MIME type pattern if provided
    if (parsed.contentType !== undefined) {
      if (typeof parsed.contentType !== 'string' || !/^[\w-]+\/[\w\-+.]+$/.test(parsed.contentType)) {
        this.sendJson(res, 400, { error: 'invalid_contentType: must be a valid MIME type' } satisfies GatewayErrorResponse);
        return;
      }
    }

    const id = await this.config.agent.sendDm(parsed.to, parsed.content);
    this.sendJson(res, 200, { id } satisfies SendMessageResponse);
  }

  private handleConversations(res: ServerResponse): void {
    const convs = this.config.agent.listConversations();
    const selfPubkey = this.config.agent.pubkey;
    const result: ConversationsResponse = {
      conversations: convs.map((c) => {
        // For DMs, the peer is the other member (not self). For groups, use conversation id.
        const peer = c.type === 'dm'
          ? (c.members.find((m) => m !== selfPubkey) ?? c.id)
          : c.id;
        return { peerAddress: peer };
      }),
    };
    this.sendJson(res, 200, result);
  }

  private async handleGetMessages(url: URL, res: ServerResponse): Promise<void> {
    const peer = url.searchParams.get('peer');
    const limitStr = url.searchParams.get('limit') ?? '20';

    if (!peer || !/^[0-9a-fA-F]{64}$/.test(peer)) {
      this.sendJson(res, 400, { error: 'invalid_peer: must be 64-char hex Nostr pubkey' } satisfies GatewayErrorResponse);
      return;
    }

    // Clamp limit to [1, 200]; treat NaN or negative as default 20
    const limit = Math.max(1, Math.min(parseInt(limitStr, 10) || 20, 200));

    // Conversation ID: sorted pubkey pair joined by ':', matching SporeAgent's internal format.
    // If SporeAgent changes its convention, this must be updated in sync.
    const convId = [this.config.agent.pubkey, peer].sort().join(':');
    const messages = await this.config.agent.getMessages(convId, { limit });

    const summaries: MessageSummary[] = messages.map((m) => ({
      id: m.id,
      senderAddress: m.senderPubkey,
      content: m.content,
      sentAt: m.sentAt,
      contentType: 'text/plain',
    }));

    this.sendJson(res, 200, { messages: summaries } satisfies MessagesResponse);
  }

  private handleStream(res: ServerResponse): void {
    // Reject when SSE client limit is reached to prevent memory exhaustion
    if (this.sseClients.size >= this.config.maxSseClients) {
      this.sendJson(res, 429, { error: 'too_many_streams' } satisfies GatewayErrorResponse);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connected event
    this.writeSseEvent(res, { type: 'connected' });

    this.sseClients.add(res);

    // Clean up when client disconnects
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  // ─── SSE Helpers ──────────────────────────────────────────────────────────

  private broadcastSse(event: StreamEvent): void {
    for (const res of this.sseClients) {
      this.writeSseEvent(res, event);
    }
  }

  private writeSseEvent(res: ServerResponse, event: StreamEvent): void {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client disconnected between our check and write — remove it
      this.sseClients.delete(res);
    }
  }

  // ─── Util ──────────────────────────────────────────────────────────────────

  /** Read request body up to maxBodyBytes. Returns null if body exceeds the limit. */
  private readBody(req: IncomingMessage): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let resolved = false;

      req.on('data', (chunk: Uint8Array) => {
        if (resolved) return;
        totalBytes += chunk.length;
        if (totalBytes > this.config.maxBodyBytes) {
          resolved = true;
          // Drain remaining data so the socket stays healthy for the 413 response
          req.resume();
          resolve(null);
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (resolved) return;
        resolved = true;
        // Concatenate all chunks into a single Uint8Array, then decode as UTF-8
        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(new TextDecoder().decode(merged));
      });

      req.on('error', (err) => {
        if (!resolved) reject(err);
      });
    });
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    const json = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(json);
  }
}

// ─── Timing-Safe Auth Token Comparison ───────────────────────────────────────

/**
 * Constant-time string equality using Node.js crypto.timingSafeEqual.
 * Pads both inputs to equal length before comparison, eliminating any length timing oracle.
 * Returns false when lengths differ (checked separately after the constant-time comparison).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // Pad to the same length so crypto.timingSafeEqual always runs over equal-size buffers.
  // The final && check rejects inputs that differ in length.
  const len = Math.max(aBytes.length, bBytes.length, 1);
  const aBuf = new Uint8Array(len);
  const bBuf = new Uint8Array(len);
  aBuf.set(aBytes);
  bBuf.set(bBytes);
  return cryptoTimingSafeEqual(aBuf, bBuf) && aBytes.length === bBytes.length;
}
