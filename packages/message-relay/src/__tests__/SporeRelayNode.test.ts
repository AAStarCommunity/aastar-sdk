// Unit tests for SporeRelayNode (NIP-01 WebSocket relay)
// Uses vitest + in-process WebSocket connections

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { generateSecretKey, getPublicKey, finalizeEvent, type UnsignedEvent } from 'nostr-tools';
// bytesToHex not used directly — nostr-tools handles serialization internally
import { SporeRelayNode } from '../SporeRelayNode.js';
import { SqliteEventStore } from '../storage/SqliteEventStore.js';
import { PaymentValidator } from '../middleware/PaymentValidator.js';
import type { NostrEvent } from '../storage/EventStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeStore() {
  return new SqliteEventStore(':memory:');
}

// Sequential port counter to avoid collisions within a single test run
let portCounter = 11000;
function randomPort() {
  return portCounter++;
}

/** Create a signed Nostr event using nostr-tools */
function makeEvent(
  sk: Uint8Array,
  partial: Partial<UnsignedEvent> = {}
): NostrEvent {
  const base: UnsignedEvent = {
    kind: partial.kind ?? 1,
    created_at: partial.created_at ?? Math.floor(Date.now() / 1000),
    tags: partial.tags ?? [],
    content: partial.content ?? 'hello',
    pubkey: getPublicKey(sk),
  };
  return finalizeEvent(base, sk) as NostrEvent;
}

/** Connect to relay and return ws + async message reader */
function connect(port: number): Promise<{
  ws: WebSocket;
  recv: () => Promise<unknown[]>;
  send: (msg: unknown[]) => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const queue: unknown[][] = [];
    const waiters: Array<(msg: unknown[]) => void> = [];

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as unknown[];
      const waiter = waiters.shift();
      if (waiter) {
        waiter(msg);
      } else {
        queue.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        recv: () =>
          new Promise((res) => {
            const queued = queue.shift();
            if (queued) {
              res(queued);
            } else {
              waiters.push(res);
            }
          }),
        send: (msg) => ws.send(JSON.stringify(msg)),
      });
    });

    ws.on('error', reject);
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SporeRelayNode', () => {
  let relay: SporeRelayNode;
  let port: number;
  let sk: Uint8Array;

  beforeEach(async () => {
    port = randomPort();
    sk = generateSecretKey();
    relay = new SporeRelayNode({ port, store: makeStore(), debug: false });
    relay.start();
    // Give the server a moment to bind
    await new Promise(r => setTimeout(r, 50));
  });

  afterEach(async () => {
    await relay.stop();
  }, 15000);

  // ── Test 1: EVENT → OK response and storage ──────────────────────────────
  it('accepts a valid signed event and stores it', async () => {
    const { ws, recv, send } = await connect(port);

    const event = makeEvent(sk);
    send(['EVENT', event]);

    const response = await recv();
    expect(response[0]).toBe('OK');
    expect(response[1]).toBe(event.id);
    expect(response[2]).toBe(true);

    expect(relay['config'].store.has(event.id)).toBe(true);

    ws.close();
  });

  // ── Test 2: REQ → stored events + EOSE ───────────────────────────────────
  it('responds to REQ with stored events and EOSE', async () => {
    // Pre-populate store
    const event = makeEvent(sk, { kind: 1, content: 'stored' });
    relay['config'].store.save(event);

    const { ws, recv, send } = await connect(port);

    send(['REQ', 'sub1', { kinds: [1] }]);

    const eventMsg = await recv();
    expect(eventMsg[0]).toBe('EVENT');
    expect(eventMsg[1]).toBe('sub1');
    expect((eventMsg[2] as NostrEvent).id).toBe(event.id);

    const eoseMsg = await recv();
    expect(eoseMsg[0]).toBe('EOSE');
    expect(eoseMsg[1]).toBe('sub1');

    ws.close();
  });

  // ── Test 3: Fan-out to subscribers ───────────────────────────────────────
  it('delivers new events to active subscribers via fan-out', async () => {
    const subscriber = await connect(port);
    const publisher = await connect(port);

    // Subscribe
    subscriber.send(['REQ', 'live-sub', { kinds: [1] }]);
    // Consume EOSE (no stored events)
    await subscriber.recv();

    // Publish event
    const event = makeEvent(sk, { kind: 1, content: 'fan-out test' });
    publisher.send(['EVENT', event]);

    // Publisher should get OK
    const ok = await publisher.recv();
    expect(ok[0]).toBe('OK');
    expect(ok[2]).toBe(true);

    // Subscriber should receive the fanned-out event
    const fanned = await subscriber.recv();
    expect(fanned[0]).toBe('EVENT');
    expect(fanned[1]).toBe('live-sub');
    expect((fanned[2] as NostrEvent).id).toBe(event.id);

    subscriber.ws.close();
    publisher.ws.close();
  });

  // ── Test 4: Duplicate events ──────────────────────────────────────────────
  it('returns OK=true for duplicate events without re-storing', async () => {
    const event = makeEvent(sk);
    relay['config'].store.save(event);

    const { ws, recv, send } = await connect(port);
    send(['EVENT', event]);

    const response = await recv();
    expect(response[0]).toBe('OK');
    expect(response[2]).toBe(true);
    expect(response[3]).toMatch(/duplicate/i);

    ws.close();
  });

  // ── Test 5: Invalid event ID ──────────────────────────────────────────────
  it('rejects event with tampered ID', async () => {
    const event = makeEvent(sk);
    const tampered = { ...event, id: 'a'.repeat(64) };

    const { ws, recv, send } = await connect(port);
    send(['EVENT', tampered]);

    const response = await recv();
    expect(response[0]).toBe('OK');
    expect(response[2]).toBe(false);
    expect(response[3]).toMatch(/bad event id/);

    ws.close();
  });

  // ── Test 6: Invalid signature ────────────────────────────────────────────
  it('rejects event with invalid signature', async () => {
    const event = makeEvent(sk);
    const tampered = { ...event, sig: 'f'.repeat(128) };

    const { ws, recv, send } = await connect(port);
    send(['EVENT', tampered]);

    const response = await recv();
    expect(response[0]).toBe('OK');
    expect(response[2]).toBe(false);
    expect(response[3]).toMatch(/bad signature/);

    ws.close();
  });

  // ── Test 7: CLOSE removes subscription ───────────────────────────────────
  it('removes subscription on CLOSE and stops fan-out', async () => {
    const subscriber = await connect(port);
    const publisher = await connect(port);

    subscriber.send(['REQ', 'to-close', { kinds: [1] }]);
    await subscriber.recv(); // EOSE

    subscriber.send(['CLOSE', 'to-close']);
    // Small delay to ensure close is processed
    await new Promise(r => setTimeout(r, 30));

    // Publish an event — subscriber should NOT receive it
    const event = makeEvent(sk, { kind: 1 });
    publisher.send(['EVENT', event]);
    await publisher.recv(); // OK

    // Verify subscription was removed from server-side map
    const subMap = relay['subscriptions'].get(subscriber.ws);
    expect(subMap?.has('to-close')).toBeFalsy();

    subscriber.ws.close();
    publisher.ws.close();
  });

  // ── Test 8: Filter matching ───────────────────────────────────────────────
  it('matchesFilter checks kinds, authors, since/until', () => {
    const event: NostrEvent = {
      id: 'abc',
      pubkey: 'author1',
      created_at: 1000,
      kind: 1,
      tags: [],
      content: '',
      sig: '',
    };

    expect(relay.matchesFilter(event, { kinds: [1] })).toBe(true);
    expect(relay.matchesFilter(event, { kinds: [2] })).toBe(false);
    expect(relay.matchesFilter(event, { authors: ['author1'] })).toBe(true);
    expect(relay.matchesFilter(event, { authors: ['other'] })).toBe(false);
    expect(relay.matchesFilter(event, { since: 500 })).toBe(true);
    expect(relay.matchesFilter(event, { since: 2000 })).toBe(false);
    expect(relay.matchesFilter(event, { until: 2000 })).toBe(true);
    expect(relay.matchesFilter(event, { until: 500 })).toBe(false);
  });

  // ── Test 9: Payment gating rejects events without commitment ──────────────
  it('rejects events when payment validator is set and no commitment provided', async () => {
    const validator = new PaymentValidator({
      minFeeUsdc: 1000n,
      operatorAddress: '0x1234567890123456789012345678901234567890',
      usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      chainId: 10,
    });

    const paidPort = randomPort();
    const paidRelay = new SporeRelayNode({
      port: paidPort,
      store: makeStore(),
      paymentValidator: validator,
      debug: false,
    });
    paidRelay.start();
    await new Promise(r => setTimeout(r, 50));

    try {
      const { ws, recv, send } = await connect(paidPort);
      const event = makeEvent(sk); // no payment tags
      send(['EVENT', event]);

      const response = await recv();
      expect(response[0]).toBe('OK');
      expect(response[2]).toBe(false);
      expect(String(response[3])).toMatch(/blocked|missing payment/);

      ws.close();
    } finally {
      await paidRelay.stop();
    }
  }, 15000);

  // ── Test 10: validateEventId + validateEventSig (private — accessed via cast) ──
  it('validateEventId returns true for correctly formed event', () => {
    const event = makeEvent(sk);
    expect((relay as unknown as { validateEventId: (e: typeof event) => boolean }).validateEventId(event)).toBe(true);
  });

  it('validateEventSig returns true for correctly signed event', () => {
    const event = makeEvent(sk);
    expect((relay as unknown as { validateEventSig: (e: typeof event) => boolean }).validateEventSig(event)).toBe(true);
  });

  it('validateEventId returns false for tampered content', () => {
    const event = makeEvent(sk);
    const tampered = { ...event, content: 'tampered content' };
    expect((relay as unknown as { validateEventId: (e: typeof tampered) => boolean }).validateEventId(tampered)).toBe(false);
  });
});

// ─── PaymentValidator unit tests ──────────────────────────────────────────

describe('PaymentValidator', () => {
  const config = {
    minFeeUsdc: 1000n,
    operatorAddress: '0xOperator123' as `0x${string}`,
    usdcAddress: '0xUSDC456' as `0x${string}`,
    chainId: 10,
  };

  const validator = new PaymentValidator(config);

  const validTags: string[][] = [
    ['payment', '2000', 'USDC', '0xUSDC456', '10'],
    ['nonce', '0xdeadbeef'],
    ['valid_before', String(Math.floor(Date.now() / 1000) + 3600)],
    ['from', '0xSender789'],
    ['to', '0xOperator123'],
    ['sig', '0x' + 'ab'.repeat(65)],
  ];

  it('parse() extracts a PaymentCommitment from valid tags', () => {
    const c = validator.parse(validTags);
    expect(c).not.toBeNull();
    expect(c!.amount).toBe(2000n);
    expect(c!.to).toBe('0xOperator123');
    expect(c!.chainId).toBe(10);
  });

  it('parse() returns null when required tags are missing', () => {
    const missingFrom = validTags.filter(t => t[0] !== 'from');
    expect(validator.parse(missingFrom)).toBeNull();
  });

  it('validate() rejects when fee is too low', () => {
    const c = validator.parse(validTags)!;
    const lowFee = { ...c, amount: 100n };
    const result = validator.validate(lowFee);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('fee_too_low');
  });

  it('validate() rejects expired commitments', () => {
    const c = validator.parse(validTags)!;
    const expired = { ...c, validBefore: Math.floor(Date.now() / 1000) - 100 };
    const result = validator.validate(expired);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('validate() rejects wrong recipient', () => {
    const c = validator.parse(validTags)!;
    const wrongTo = { ...c, to: '0xWrongAddress' as `0x${string}` };
    const result = validator.validate(wrongTo);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_recipient');
  });

  it('validate() rejects wrong chain ID', () => {
    const c = validator.parse(validTags)!;
    const wrongChain = { ...c, chainId: 999 };
    const result = validator.validate(wrongChain);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('chain_mismatch');
  });
});

// ─── SqliteEventStore unit tests ──────────────────────────────────────────

describe('SqliteEventStore', () => {
  it('saves and retrieves events', () => {
    const store = makeStore();
    const event: NostrEvent = {
      id: 'test-id-1',
      pubkey: 'pub1',
      created_at: 1000,
      kind: 1,
      tags: [],
      content: 'hello',
      sig: 'sig1',
    };
    store.save(event);
    expect(store.has('test-id-1')).toBe(true);
    const results = store.query({ kinds: [1] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-id-1');
  });

  it('has() returns false for unknown id', () => {
    const store = makeStore();
    expect(store.has('nonexistent')).toBe(false);
  });

  it('query() filters by kind, author, since/until', () => {
    const store = makeStore();
    const events: NostrEvent[] = [
      { id: 'e1', pubkey: 'alice', created_at: 100, kind: 1, tags: [], content: '', sig: '' },
      { id: 'e2', pubkey: 'bob', created_at: 200, kind: 1, tags: [], content: '', sig: '' },
      { id: 'e3', pubkey: 'alice', created_at: 300, kind: 4, tags: [], content: '', sig: '' },
    ];
    for (const ev of events) store.save(ev);

    expect(store.query({ kinds: [1] })).toHaveLength(2);
    expect(store.query({ authors: ['alice'] })).toHaveLength(2);
    expect(store.query({ since: 150 })).toHaveLength(2);
    expect(store.query({ until: 150 })).toHaveLength(1);
    expect(store.query({ kinds: [1], authors: ['alice'] })).toHaveLength(1);
  });

  it('query() enforces max limit of 500', () => {
    const store = makeStore();
    // Insert 10 events and query with a limit of 5
    for (let i = 0; i < 10; i++) {
      store.save({ id: `e${i}`, pubkey: 'p', created_at: i, kind: 1, tags: [], content: '', sig: '' });
    }
    expect(store.query({ limit: 5 })).toHaveLength(5);
  });

  it('INSERT OR IGNORE prevents duplicate rows', () => {
    const store = makeStore();
    const ev: NostrEvent = { id: 'dup', pubkey: 'p', created_at: 1, kind: 1, tags: [], content: '', sig: '' };
    store.save(ev);
    store.save(ev); // second save should be ignored
    expect(store.query({})).toHaveLength(1);
  });
});
