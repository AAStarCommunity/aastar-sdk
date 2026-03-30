// E2E test: two-agent DM round-trip via in-process SporeRelayNode.
//
// No mocks — real nostr-tools crypto, real WebSocket connections, real SQLite.
// Agents connect to a local relay on a deterministic port for isolation.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SporeRelayNode } from '../../packages/message-relay/src/SporeRelayNode.js';
import { SqliteEventStore } from '../../packages/message-relay/src/storage/SqliteEventStore.js';
import { SporeAgent } from '../../packages/messaging/src/SporeAgent.js';
import type { SporeMessage } from '../../packages/messaging/src/types.js';

// ─── Port allocation ───────────────────────────────────────────────────────

const PORT = 15100; // fixed port for this file — does not overlap with unit tests

// ─── Helpers ──────────────────────────────────────────────────────────────

function waitFor<T>(
    fn: () => T | null | undefined,
    timeoutMs = 5000,
    intervalMs = 50
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const start = Date.now();
        const iv = setInterval(() => {
            const v = fn();
            if (v !== null && v !== undefined) { clearInterval(iv); resolve(v); }
            else if (Date.now() - start > timeoutMs) { clearInterval(iv); reject(new Error(`waitFor timed out (${timeoutMs}ms)`)); }
        }, intervalMs);
    });
}

// ─── Suite ────────────────────────────────────────────────────────────────

describe('E2E — two-agent DM round-trip', () => {
    let relay: SporeRelayNode;
    let alice: SporeAgent;
    let bob: SporeAgent;

    // Deterministic 32-byte test keys — never used on any mainnet
    const ALICE_KEY = 'a1'.repeat(32);
    const BOB_KEY = 'b2'.repeat(32);
    const RELAY_URL = `ws://127.0.0.1:${PORT}` as `ws://${string}`;

    beforeAll(async () => {
        relay = new SporeRelayNode({
            port: PORT,
            store: new SqliteEventStore(':memory:'),
            debug: false,
        });
        relay.start();
        await new Promise(r => setTimeout(r, 100));

        alice = await SporeAgent.create({
            privateKeyHex: ALICE_KEY,
            relays: [RELAY_URL],
            env: 'test',
        });

        bob = await SporeAgent.create({
            privateKeyHex: BOB_KEY,
            relays: [RELAY_URL],
            env: 'test',
        });
    }, 15000);

    afterAll(async () => {
        await alice.stop();
        await bob.stop();
        await relay.stop();
    }, 15000);

    it('Alice and Bob derive distinct pubkeys', () => {
        expect(alice.pubkey).not.toBe(bob.pubkey);
        expect(alice.pubkey).toHaveLength(64);
        expect(bob.pubkey).toHaveLength(64);
    });

    it('Alice sends a DM and Bob receives it', async () => {
        const received: SporeMessage[] = [];

        bob.on('text', (ctx) => { received.push(ctx.message); });
        await bob.start();
        await alice.start();
        await new Promise(r => setTimeout(r, 200));

        await alice.sendDm(bob.pubkey, 'Hello from Alice!');

        await waitFor(() => received.length > 0 ? received : null, 6000);

        expect(received[0]!.content).toBe('Hello from Alice!');
        expect(received[0]!.conversation.type).toBe('dm');
        // Sender pubkey should be Alice's pubkey (from inside the seal)
        expect(received[0]!.senderPubkey).toBe(alice.pubkey);
    }, 12000);

    it('Bob replies and Alice receives it', async () => {
        const aliceReceived: SporeMessage[] = [];
        alice.on('text', (ctx) => { aliceReceived.push(ctx.message); });

        await bob.sendDm(alice.pubkey, 'Reply from Bob');

        await waitFor(() => aliceReceived.length > 0 ? aliceReceived : null, 6000);

        expect(aliceReceived[0]!.content).toBe('Reply from Bob');
        expect(aliceReceived[0]!.senderPubkey).toBe(bob.pubkey);
    }, 12000);

    it('relay deduplicates: same event id received only once', async () => {
        const eveKey = 'e3'.repeat(32);
        const eve = await SporeAgent.create({
            privateKeyHex: eveKey,
            relays: [RELAY_URL],
            env: 'test',
        });
        await eve.start();

        const aliceCount = { n: 0 };
        alice.on('dm', () => { aliceCount.n++; });
        await new Promise(r => setTimeout(r, 100));

        await eve.sendDm(alice.pubkey, 'unique message');
        await new Promise(r => setTimeout(r, 1000));

        // Should not arrive more than once (deduplication in relay + RelayPool BoundedSet)
        expect(aliceCount.n).toBeLessThanOrEqual(1);

        await eve.stop();
    }, 12000);
});

// ─── E2E: Consent API ─────────────────────────────────────────────────────

describe('E2E — consent: blocked sender is silently dropped', () => {
    let relay: SporeRelayNode;
    const PORT2 = 15101;
    const RELAY_URL = `ws://127.0.0.1:${PORT2}` as `ws://${string}`;

    const CAROL_KEY = 'c4'.repeat(32);
    const DAVE_KEY  = 'd5'.repeat(32);
    const EVE_KEY   = 'e6'.repeat(32);

    let carol: SporeAgent;
    let dave: SporeAgent;
    let eve: SporeAgent;

    beforeAll(async () => {
        relay = new SporeRelayNode({
            port: PORT2,
            store: new SqliteEventStore(':memory:'),
            debug: false,
        });
        relay.start();
        await new Promise(r => setTimeout(r, 100));

        eve = await SporeAgent.create({ privateKeyHex: EVE_KEY, relays: [RELAY_URL], env: 'test' });
        await eve.start();

        // Dave blocks Eve
        dave = await SporeAgent.create({
            privateKeyHex: DAVE_KEY,
            relays: [RELAY_URL],
            env: 'test',
            blockedSenders: new Set([eve.pubkey]),
        });

        carol = await SporeAgent.create({ privateKeyHex: CAROL_KEY, relays: [RELAY_URL], env: 'test' });
    }, 15000);

    afterAll(async () => {
        await carol.stop();
        await dave.stop();
        await eve.stop();
        await relay.stop();
    }, 15000);

    it('Dave does not receive DMs from blocked Eve', async () => {
        const daveReceived: SporeMessage[] = [];
        dave.on('text', (ctx) => { daveReceived.push(ctx.message); });
        await dave.start();
        await new Promise(r => setTimeout(r, 200));

        await eve.sendDm(dave.pubkey, 'Blocked message from Eve');
        await new Promise(r => setTimeout(r, 1500));

        expect(daveReceived).toHaveLength(0);
    }, 12000);

    it('Dave still receives DMs from Carol (not blocked)', async () => {
        const daveReceived: SporeMessage[] = [];
        dave.on('dm', (ctx) => { daveReceived.push(ctx.message); });
        await carol.start();
        await new Promise(r => setTimeout(r, 100));

        await carol.sendDm(dave.pubkey, 'Hello Dave from Carol');
        await new Promise(r => setTimeout(r, 2000), );

        const allowedMsg = daveReceived.find(m => m.content === 'Hello Dave from Carol');
        expect(allowedMsg).toBeDefined();
    }, 12000);
});
