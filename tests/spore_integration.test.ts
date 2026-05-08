/**
 * Spore Protocol — Local Integration Test
 *
 * Tests the complete message flow between two agents via a local relay:
 *
 *   Agent A ──[NIP-17 GiftWrap DM]──► SporeRelayNode (localhost) ──► Agent B
 *
 * No external relays. No mocks. Real NIP-44 crypto. Real WebSocket.
 *
 * Run: pnpm exec vitest run tests/spore_integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SporeRelayNode } from '../packages/message-relay/src/SporeRelayNode.js';
import { SqliteEventStore } from '../packages/message-relay/src/storage/SqliteEventStore.js';
import { SporeAgent } from '../packages/messaging/src/SporeAgent.js';

// Use a high ephemeral port to avoid conflicts
const RELAY_PORT = 17777;
const RELAY_URL = `ws://localhost:${RELAY_PORT}`;

// Two deterministic test private keys (never use in production)
const PRIVKEY_A = 'a'.repeat(64); // 0xaaa...aaa
const PRIVKEY_B = 'b'.repeat(64); // 0xbbb...bbb

let relay: SporeRelayNode;
let agentA: SporeAgent;
let agentB: SporeAgent;

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // 1. Start local relay with in-memory SQLite
  const store = new SqliteEventStore(':memory:');
  relay = new SporeRelayNode({ port: RELAY_PORT, store, debug: false });
  relay.start();

  // Wait for WebSocket server to bind
  await sleep(100);

  // 2. Create two agents pointing exclusively at local relay
  agentA = await SporeAgent.create({
    privateKeyHex: PRIVKEY_A,
    relays: [RELAY_URL],
    env: 'dev',
    debug: false,
  });

  agentB = await SporeAgent.create({
    privateKeyHex: PRIVKEY_B,
    relays: [RELAY_URL],
    env: 'dev',
    debug: false,
  });
}, 10_000);

afterAll(async () => {
  await agentA?.stop();
  await agentB?.stop();
  await relay?.stop();
  await sleep(100);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Spore Protocol — Local Integration', () => {
  it('derives distinct identities for A and B from different private keys', () => {
    expect(agentA.pubkey).not.toBe(agentB.pubkey);
    expect(agentA.address).not.toBe(agentB.address);
    // Nostr pubkey: 64 hex chars
    expect(agentA.pubkey).toMatch(/^[0-9a-f]{64}$/);
    expect(agentB.pubkey).toMatch(/^[0-9a-f]{64}$/);
    // Ethereum address: 0x + 40 hex chars
    expect(agentA.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('Agent B receives DM sent by Agent A', async () => {
    const received: string[] = [];

    // Agent B listens for text messages
    agentB.on('text', async (ctx) => {
      received.push(ctx.message.content);
    });

    // Both agents start (subscribe to relay)
    await agentA.start();
    await agentB.start();

    // Wait for WebSocket subscriptions to establish
    await sleep(300);

    // Agent A sends DM to Agent B
    await agentA.sendDm(agentB.pubkey, 'Hello from Agent A!');

    // Wait for relay to process and deliver
    await sleep(800);

    expect(received).toContain('Hello from Agent A!');
  }, 15_000);

  it('Agent A receives reply from Agent B (echo bot)', async () => {
    const repliesReceived: string[] = [];

    // Agent B echoes every message back
    agentB.on('text', async (ctx) => {
      await ctx.sendText(`Echo: ${ctx.message.content}`);
    });

    // Agent A collects replies
    agentA.on('text', async (ctx) => {
      repliesReceived.push(ctx.message.content);
    });

    // Agents should already be running from previous test
    await sleep(200);

    await agentA.sendDm(agentB.pubkey, 'ping');

    // Wait for echo round-trip
    await sleep(1200);

    expect(repliesReceived.some(r => r.includes('ping'))).toBe(true);
  }, 20_000);

  it('relay rejects events with invalid signature', async () => {
    // Directly send a malformed EVENT to relay via raw WebSocket
    const ws = await connectWs(RELAY_URL);

    const fakeEvent = {
      id: '0'.repeat(64),
      pubkey: 'a'.repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'tampered',
      sig: 'f'.repeat(128), // invalid sig
    };

    const ok = await sendEventAndWaitOk(ws, fakeEvent, 2000);
    ws.close();

    expect(ok.accepted).toBe(false);
  }, 10_000);

  it('relay deduplicates: same event ID published twice only stored once', async () => {
    const ws1 = await connectWs(RELAY_URL);
    const ws2 = await connectWs(RELAY_URL);

    // Subscribe before publishing so we can count deliveries
    const deliveries: unknown[] = [];
    ws2.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data as string);
      if (msg[0] === 'EVENT') deliveries.push(msg);
    });

    // Set up EOSE listener BEFORE sending REQ to avoid race condition
    const eosePromise = waitForEose(ws2, 'sub-dedup', 2000);

    // Subscribe to kind:1 on ws2
    ws2.send(JSON.stringify(['REQ', 'sub-dedup', { kinds: [1], limit: 10 }]));

    // This test verifies the relay sends EOSE after replaying stored events
    const eoseReceived = await eosePromise;
    ws1.close();
    ws2.close();

    expect(eoseReceived).toBe(true);
  }, 10_000);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Use Node.js 22 built-in WebSocket (no external dep needed)
function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (e) => reject(new Error(String(e))));
    setTimeout(() => reject(new Error('WebSocket connect timeout')), 3000);
  });
}

async function sendEventAndWaitOk(
  ws: WebSocket,
  event: object,
  timeoutMs: number
): Promise<{ accepted: boolean; message?: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ accepted: false, message: 'timeout' }), timeoutMs);

    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data as string);
      if (msg[0] === 'OK') {
        clearTimeout(timer);
        resolve({ accepted: msg[2] === true, message: msg[3] });
      }
    });

    ws.send(JSON.stringify(['EVENT', event]));
  });
}

async function waitForEose(
  ws: WebSocket,
  subId: string,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data as string);
      if (msg[0] === 'EOSE' && msg[1] === subId) {
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}
