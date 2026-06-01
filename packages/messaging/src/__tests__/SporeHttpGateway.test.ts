// Unit tests for SporeHttpGateway (M10).
//
// Strategy: mock SporeAgent at the module level, spin up a real HTTP server on a
// random port (port: 0), make requests with node:http, assert responses.
// Server is started/stopped per-describe to isolate state between suites.

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import { SporeHttpGateway } from '../gateway/SporeHttpGateway.js';
import type { SporeAgent } from '../SporeAgent.js';

// ─── Minimal SporeAgent stub ──────────────────────────────────────────────────

function makeAgent(overrides: Partial<typeof mockAgent> = {}): SporeAgent {
  return { ...mockAgent, ...overrides } as unknown as SporeAgent;
}

const mockAgent: {
  pubkey: string;
  address: `0x${string}`;
  on: ReturnType<typeof vi.fn>;
  sendDm: ReturnType<typeof vi.fn>;
  listConversations: ReturnType<typeof vi.fn>;
  getMessages: ReturnType<typeof vi.fn>;
} = {
  pubkey: 'a'.repeat(64),
  address: '0x' + 'ab'.repeat(20) as `0x${string}`,
  on: vi.fn(),
  sendDm: vi.fn().mockResolvedValue('sent-event-id'),
  listConversations: vi.fn().mockReturnValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────

interface HttpResult {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

function httpRequest(
  port: number,
  method: string,
  path: string,
  body?: string,
  headers?: Record<string, string>
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        const chunks: Uint8Array[] = [];
        res.on('data', (c: Uint8Array) => chunks.push(c));
        res.on('end', () => {
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const merged = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { merged.set(c, off); off += c.length; }
          resolve({
            status: res.statusCode ?? 0,
            body: new TextDecoder().decode(merged),
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(port: number, path: string, headers?: Record<string, string>): Promise<HttpResult> {
  return httpRequest(port, 'GET', path, undefined, headers);
}

function post(port: number, path: string, body: unknown, headers?: Record<string, string>): Promise<HttpResult> {
  return httpRequest(port, 'POST', path, JSON.stringify(body), headers);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SporeHttpGateway', () => {
  let gateway: SporeHttpGateway;
  let port: number;

  beforeAll(async () => {
    vi.clearAllMocks();
    gateway = new SporeHttpGateway({ agent: makeAgent(), port: 0 });
    await gateway.start();
    port = gateway.port;
  });

  afterAll(async () => {
    await gateway.stop();
  });

  // ─── Health ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns 200 with pubkey and address', async () => {
      const res = await get(port, '/api/v1/health');
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { status: string; pubkey: string; address: string };
      expect(body.status).toBe('ok');
      expect(body.pubkey).toBe('a'.repeat(64));
      expect(body.address).toBe('0x' + 'ab'.repeat(20));
    });
  });

  // ─── 404 ─────────────────────────────────────────────────────────────────

  describe('unknown routes', () => {
    it('returns 404 for unknown path', async () => {
      const res = await get(port, '/unknown/path');
      expect(res.status).toBe(404);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBe('not_found');
    });
  });

  // ─── Send message ─────────────────────────────────────────────────────────

  describe('POST /api/v1/messages/send', () => {
    it('sends DM and returns event id', async () => {
      mockAgent.sendDm.mockResolvedValueOnce('returned-event-id');
      const recipientPubkey = 'b'.repeat(64);
      const res = await post(port, '/api/v1/messages/send', {
        to: recipientPubkey,
        content: 'hello from gateway',
      });
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { id: string };
      expect(body.id).toBe('returned-event-id');
      expect(mockAgent.sendDm).toHaveBeenCalledWith(recipientPubkey, 'hello from gateway');
    });

    it('rejects invalid pubkey (too short)', async () => {
      const res = await post(port, '/api/v1/messages/send', {
        to: 'short',
        content: 'hello',
      });
      expect(res.status).toBe(400);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toContain('invalid_recipient');
    });

    it('rejects missing content field', async () => {
      const res = await post(port, '/api/v1/messages/send', {
        to: 'b'.repeat(64),
      });
      expect(res.status).toBe(400);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toContain('missing_fields');
    });

    it('rejects invalid JSON body', async () => {
      const res = await httpRequest(port, 'POST', '/api/v1/messages/send', 'not-json', {
        'Content-Type': 'application/json',
      });
      expect(res.status).toBe(400);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBe('invalid_json');
    });

    it('rejects non-hex pubkey (has non-hex chars)', async () => {
      const res = await post(port, '/api/v1/messages/send', {
        to: 'z'.repeat(64),
        content: 'hello',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid contentType format', async () => {
      const res = await post(port, '/api/v1/messages/send', {
        to: 'b'.repeat(64),
        content: 'hello',
        contentType: '<script>alert(1)</script>',
      });
      expect(res.status).toBe(400);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toContain('invalid_contentType');
    });

    it('accepts valid contentType', async () => {
      mockAgent.sendDm.mockResolvedValueOnce('ok-id');
      const res = await post(port, '/api/v1/messages/send', {
        to: 'b'.repeat(64),
        content: 'hello',
        contentType: 'text/plain',
      });
      expect(res.status).toBe(200);
    });

    it('response includes X-Content-Type-Options: nosniff header', async () => {
      const res = await get(port, '/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  // ─── Conversations ────────────────────────────────────────────────────────

  describe('GET /api/v1/conversations', () => {
    it('returns empty list when no conversations', async () => {
      mockAgent.listConversations.mockReturnValueOnce([]);
      const res = await get(port, '/api/v1/conversations');
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { conversations: unknown[] };
      expect(body.conversations).toEqual([]);
    });

    it('returns conversation summaries with peer address', async () => {
      const selfPubkey = 'a'.repeat(64);
      const peerPubkey = 'c'.repeat(64);
      mockAgent.listConversations.mockReturnValueOnce([
        {
          id: 'conv1',
          type: 'dm',
          members: [selfPubkey, peerPubkey],
        },
      ]);
      const res = await get(port, '/api/v1/conversations');
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { conversations: { peerAddress: string }[] };
      expect(body.conversations).toHaveLength(1);
      // peer is the non-self member
      expect(body.conversations[0]!.peerAddress).toBe(peerPubkey);
    });

    it('uses conversation id as peerAddress for group conversations', async () => {
      mockAgent.listConversations.mockReturnValueOnce([
        {
          id: 'group-abc',
          type: 'group',
          members: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
        },
      ]);
      const res = await get(port, '/api/v1/conversations');
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { conversations: { peerAddress: string }[] };
      expect(body.conversations[0]!.peerAddress).toBe('group-abc');
    });
  });

  // ─── Get Messages ─────────────────────────────────────────────────────────

  describe('GET /api/v1/messages', () => {
    it('returns messages for a valid peer pubkey', async () => {
      mockAgent.getMessages.mockResolvedValueOnce([
        { id: 'msg1', senderPubkey: 'e'.repeat(64), content: 'test message', sentAt: 1700000000 },
      ]);
      const peer = 'e'.repeat(64);
      const res = await get(port, `/api/v1/messages?peer=${peer}`);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { messages: { id: string; content: string }[] };
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0]!.content).toBe('test message');
      expect(body.messages[0]!.id).toBe('msg1');
    });

    it('rejects missing peer param', async () => {
      const res = await get(port, '/api/v1/messages');
      expect(res.status).toBe(400);
    });

    it('rejects invalid peer pubkey', async () => {
      const res = await get(port, '/api/v1/messages?peer=notahex');
      expect(res.status).toBe(400);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toContain('invalid_peer');
    });

    it('caps limit at 200', async () => {
      mockAgent.getMessages.mockResolvedValueOnce([]);
      const peer = 'f'.repeat(64);
      await get(port, `/api/v1/messages?peer=${peer}&limit=9999`);
      // getMessages called with limit capped to 200
      expect(mockAgent.getMessages).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ limit: 200 })
      );
    });
  });

  // ─── SSE Stream ───────────────────────────────────────────────────────────

  describe('GET /api/v1/stream', () => {
    it('returns SSE headers and initial connected event', async () => {
      const result = await new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; firstLine: string }>((resolve, reject) => {
        const req = http.request(
          { hostname: '127.0.0.1', port, method: 'GET', path: '/api/v1/stream' },
          (res) => {
            const headers = res.headers as Record<string, string | string[] | undefined>;
            let data = '';
            res.on('data', (chunk: Buffer) => {
              data += chunk.toString();
              // Got first SSE line — close and resolve
              if (data.includes('\n\n')) {
                req.destroy();
                const firstLine = data.split('\n')[0] ?? '';
                resolve({ status: res.statusCode ?? 0, headers, firstLine });
              }
            });
            res.on('error', () => { /* expected on destroy */ });
          }
        );
        req.on('error', () => { /* expected on destroy */ });
        req.end();
        setTimeout(() => reject(new Error('SSE timeout')), 3000);
      });

      expect(result.status).toBe(200);
      expect(result.headers['content-type']).toContain('text/event-stream');
      // First SSE data line contains the connected event
      const event = JSON.parse(result.firstLine.replace(/^data: /, '')) as { type: string };
      expect(event.type).toBe('connected');
    });

    it('rejects new SSE connections when maxSseClients is reached', async () => {
      // Create a gateway with maxSseClients: 1 and open one SSE connection to fill the limit
      const limitedGateway = new SporeHttpGateway({
        agent: makeAgent(),
        port: 0,
        maxSseClients: 1,
      });
      await limitedGateway.start();
      const limitedPort = limitedGateway.port;

      // Open one connection (fills the limit)
      const firstReq = http.request(
        { hostname: '127.0.0.1', port: limitedPort, method: 'GET', path: '/api/v1/stream' },
        (res) => { res.resume(); }
      );
      firstReq.on('error', () => { /* ok */ });
      firstReq.end();

      // Wait for the first connection to register
      await new Promise((r) => setTimeout(r, 50));

      // Second connection should be rejected with 429
      const secondRes = await get(limitedPort, '/api/v1/stream');
      expect(secondRes.status).toBe(429);
      const body = JSON.parse(secondRes.body) as { error: string };
      expect(body.error).toBe('too_many_streams');

      firstReq.destroy();
      await limitedGateway.stop();
    });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('auth token enforcement', () => {
    let authGateway: SporeHttpGateway;
    let authPort: number;

    beforeAll(async () => {
      authGateway = new SporeHttpGateway({
        agent: makeAgent(),
        port: 0,
        authToken: 'secret-token-abc',
      });
      await authGateway.start();
      authPort = authGateway.port;
    });

    afterAll(async () => {
      await authGateway.stop();
    });

    it('rejects requests without token', async () => {
      const res = await get(authPort, '/api/v1/health');
      expect(res.status).toBe(401);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBe('unauthorized');
    });

    it('rejects requests with wrong token', async () => {
      const res = await get(authPort, '/api/v1/health', {
        Authorization: 'Bearer wrong-token',
      });
      expect(res.status).toBe(401);
    });

    it('accepts requests with correct token', async () => {
      const res = await get(authPort, '/api/v1/health', {
        Authorization: 'Bearer secret-token-abc',
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Body size limit ──────────────────────────────────────────────────────

  describe('body size limit', () => {
    let smallGateway: SporeHttpGateway;
    let smallPort: number;

    beforeAll(async () => {
      smallGateway = new SporeHttpGateway({
        agent: makeAgent(),
        port: 0,
        maxBodyBytes: 10, // very small limit
      });
      await smallGateway.start();
      smallPort = smallGateway.port;
    });

    afterAll(async () => {
      await smallGateway.stop();
    });

    it('rejects oversized body with 413', async () => {
      const res = await post(
        smallPort,
        '/api/v1/messages/send',
        { to: 'b'.repeat(64), content: 'this content is way too long for the 10-byte limit' }
      );
      expect(res.status).toBe(413);
    });
  });
});
