// Unit tests for M12: WakuTransport + SporeTransport interface.
//
// WakuNodeLike is mocked — no real Waku network connections are made.
// Tests verify content topic routing, NIP-44 encryption/decryption,
// group fan-out, history query, and AbortSignal cleanup.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WakuTransport } from '../transport/WakuTransport.js';
import type { WakuNodeLike } from '../transport/WakuTransport.js';
import type { SporeTransport } from '../transport/SporeTransport.js';
import type { SporeConversation, SporeMessage } from '../types.js';

// ─── nostr-tools/nip44 mock (same as SporeAgent tests) ───────────────────────

vi.mock('nostr-tools/nip44', () => ({
  getConversationKey: vi.fn(() => new Uint8Array(32).fill(2)),
  encrypt: vi.fn((plain: string) => `enc:${plain}`),
  decrypt: vi.fn((cipher: string) => {
    return typeof cipher === 'string' && cipher.startsWith('enc:')
      ? cipher.slice(4)
      : cipher;
  }),
}));

vi.mock('@noble/curves/secp256k1', () => ({
  secp256k1: { getPublicKey: vi.fn(() => new Uint8Array(65).fill(4)) },
}));

vi.mock('@noble/hashes/sha3', () => ({
  keccak_256: vi.fn(() => new Uint8Array(32).fill(0xab)),
}));

// ─── Mock WakuNode ────────────────────────────────────────────────────────────

function makeMockNode(): WakuNodeLike & {
  _handlers: Map<string, ((p: Uint8Array) => void)[]>;
  _sent: { topic: string; payload: Uint8Array }[];
} {
  const handlers = new Map<string, ((p: Uint8Array) => void)[]>();
  const sent: { topic: string; payload: Uint8Array }[] = [];

  return {
    connected: true,
    _handlers: handlers,
    _sent: sent,

    send: vi.fn(async (topic: string, payload: Uint8Array) => {
      sent.push({ topic, payload });
      return `hash-${sent.length}`;
    }),

    subscribe: vi.fn((topic: string, handler: (p: Uint8Array) => void) => {
      const list = handlers.get(topic) ?? [];
      list.push(handler);
      handlers.set(topic, list);
      return () => {
        const l = handlers.get(topic) ?? [];
        handlers.set(topic, l.filter((h) => h !== handler));
      };
    }),

    query: vi.fn(async () => []),
  };
}

function makeEnvelope(from: string, content: string, groupId?: string): Uint8Array {
  const envelope = { v: 1, from, ciphertext: `enc:${content}`, ts: 1700000000, groupId };
  return new TextEncoder().encode(JSON.stringify(envelope));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WakuTransport', () => {
  const senderPrivkey = 'ab'.repeat(32); // 64-char hex
  const senderPubkey = 'a'.repeat(64);
  const recipientPubkey = 'b'.repeat(64);

  let node: ReturnType<typeof makeMockNode>;
  let transport: WakuTransport;

  beforeEach(() => {
    node = makeMockNode();
    transport = new WakuTransport({ node });
  });

  // ─── Interface compliance ────────────────────────────────────────────────

  it('implements SporeTransport interface', () => {
    const t: SporeTransport = transport;
    expect(t.name).toBe('waku');
    expect(typeof t.sendDm).toBe('function');
    expect(typeof t.sendGroupMessage).toBe('function');
    expect(typeof t.subscribeToDms).toBe('function');
    expect(typeof t.subscribeToGroups).toBe('function');
    expect(typeof t.queryMessages).toBe('function');
  });

  // ─── Content topic routing ───────────────────────────────────────────────

  describe('sendDm', () => {
    it('sends to recipient DM topic', async () => {
      const hash = await transport.sendDm({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        recipientPubkeyHex: recipientPubkey,
        content: 'hello waku',
      });

      expect(hash).toBe('hash-1');
      expect(node._sent).toHaveLength(1);
      expect(node._sent[0]!.topic).toBe(`/spore/1/dm-${recipientPubkey}/proto`);
    });

    it('encodes envelope with from, ciphertext, ts fields', async () => {
      await transport.sendDm({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        recipientPubkeyHex: recipientPubkey,
        content: 'test content',
      });

      const raw = node._sent[0]!.payload;
      const envelope = JSON.parse(new TextDecoder().decode(raw)) as {
        v: number; from: string; ciphertext: string; ts: number;
      };
      expect(envelope.v).toBe(1);
      expect(envelope.from).toBe(senderPubkey);
      expect(typeof envelope.ciphertext).toBe('string');
      expect(typeof envelope.ts).toBe('number');
    });

    it('includes contentTypeId in envelope when provided', async () => {
      await transport.sendDm({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        recipientPubkeyHex: recipientPubkey,
        content: 'typed content',
        contentTypeId: 'xmtp.org/text/1.0',
      });

      const envelope = JSON.parse(new TextDecoder().decode(node._sent[0]!.payload)) as {
        contentTypeId?: string;
      };
      expect(envelope.contentTypeId).toBe('xmtp.org/text/1.0');
    });

    it('uses custom topic prefix when configured', async () => {
      const customTransport = new WakuTransport({ node, topicPrefix: '/myapp/2' });
      await customTransport.sendDm({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        recipientPubkeyHex: recipientPubkey,
        content: 'hi',
      });
      expect(node._sent[0]!.topic).toMatch(/^\/myapp\/2\/dm-/);
    });
  });

  // ─── Group fan-out ───────────────────────────────────────────────────────

  describe('sendGroupMessage', () => {
    it('sends one message per member (fan-out)', async () => {
      const members = ['c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64)];
      await transport.sendGroupMessage({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        groupId: 'group-1',
        memberPubkeys: members,
        content: 'group hello',
      });

      expect(node._sent).toHaveLength(3);
    });

    it('publishes to group topic', async () => {
      await transport.sendGroupMessage({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        groupId: 'alpha',
        memberPubkeys: ['c'.repeat(64)],
        content: 'msg',
      });

      expect(node._sent[0]!.topic).toBe('/spore/1/group-alpha/proto');
    });

    it('includes groupId in envelope', async () => {
      await transport.sendGroupMessage({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        groupId: 'beta',
        memberPubkeys: ['c'.repeat(64)],
        content: 'msg',
      });

      const envelope = JSON.parse(new TextDecoder().decode(node._sent[0]!.payload)) as { groupId?: string };
      expect(envelope.groupId).toBe('beta');
    });

    it('returns empty string when no members', async () => {
      const hash = await transport.sendGroupMessage({
        senderPrivkeyHex: senderPrivkey,
        senderPubkeyHex: senderPubkey,
        groupId: 'empty',
        memberPubkeys: [],
        content: 'msg',
      });
      expect(hash).toBe('');
    });
  });

  // ─── Subscribe to DMs ────────────────────────────────────────────────────

  describe('subscribeToDms', () => {
    it('subscribes to own DM topic', () => {
      transport.subscribeToDms(recipientPubkey, vi.fn());
      expect(node.subscribe).toHaveBeenCalledWith(
        `/spore/1/dm-${recipientPubkey}/proto`,
        expect.any(Function)
      );
    });

    it('delivers parsed envelope to callback', () => {
      const onMessage = vi.fn();
      transport.subscribeToDms(recipientPubkey, onMessage);

      const handler = node._handlers.get(`/spore/1/dm-${recipientPubkey}/proto`)![0]!;
      handler(makeEnvelope(senderPubkey, 'incoming message'));

      expect(onMessage).toHaveBeenCalledOnce();
      const [msg, conv] = onMessage.mock.calls[0] as [SporeMessage, SporeConversation];
      expect(msg.senderPubkey).toBe(senderPubkey);
      expect(conv.type).toBe('dm');
    });

    it('returns unsubscribe function that removes handler', () => {
      const onMessage = vi.fn();
      const unsub = transport.subscribeToDms(recipientPubkey, onMessage);
      unsub();

      const handlers = node._handlers.get(`/spore/1/dm-${recipientPubkey}/proto`) ?? [];
      expect(handlers).toHaveLength(0);
    });

    it('respects AbortSignal', () => {
      const controller = new AbortController();
      const onMessage = vi.fn();
      transport.subscribeToDms(recipientPubkey, onMessage, { signal: controller.signal });

      // Capture handler before abort (abort fires unsub synchronously, removing it from _handlers)
      const handler = node._handlers.get(`/spore/1/dm-${recipientPubkey}/proto`)![0]!;
      controller.abort();

      // Even if we call the captured handler directly, signal.aborted guard prevents onMessage
      handler(makeEnvelope(senderPubkey, 'after abort'));
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  // ─── Subscribe to Groups ─────────────────────────────────────────────────

  describe('subscribeToGroups', () => {
    it('subscribes to each group topic', () => {
      transport.subscribeToGroups(['grp1', 'grp2'], vi.fn());
      expect(node.subscribe).toHaveBeenCalledWith('/spore/1/group-grp1/proto', expect.any(Function));
      expect(node.subscribe).toHaveBeenCalledWith('/spore/1/group-grp2/proto', expect.any(Function));
    });

    it('single unsub cleans up all group subscriptions', () => {
      const unsub = transport.subscribeToGroups(['grp3', 'grp4'], vi.fn());
      unsub();
      expect(node._handlers.get('/spore/1/group-grp3/proto') ?? []).toHaveLength(0);
      expect(node._handlers.get('/spore/1/group-grp4/proto') ?? []).toHaveLength(0);
    });

    it('delivers group envelope with groupId', () => {
      const onMessage = vi.fn();
      transport.subscribeToGroups(['groupX'], onMessage);

      const handler = node._handlers.get('/spore/1/group-groupX/proto')![0]!;
      handler(makeEnvelope(senderPubkey, 'group msg', 'groupX'));

      expect(onMessage).toHaveBeenCalledOnce();
      const [msg, conv] = onMessage.mock.calls[0] as [SporeMessage, SporeConversation];
      expect(conv.type).toBe('group');
      expect(msg.senderPubkey).toBe(senderPubkey);
    });

    it('respects AbortSignal for group subscriptions', () => {
      const controller = new AbortController();
      const onMessage = vi.fn();
      transport.subscribeToGroups(['grpAbort'], onMessage, { signal: controller.signal });

      const handler = node._handlers.get('/spore/1/group-grpAbort/proto')![0]!;
      controller.abort();
      handler(makeEnvelope(senderPubkey, 'after abort', 'grpAbort'));
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  // ─── Query history ────────────────────────────────────────────────────────

  describe('queryMessages', () => {
    it('returns empty array when node has no stored messages', async () => {
      const msgs = await transport.queryMessages('someConvId');
      expect(msgs).toEqual([]);
    });

    it('returns empty array when query throws (Store not available)', async () => {
      node.query = vi.fn().mockRejectedValue(new Error('Store not available'));
      const msgs = await transport.queryMessages('someConvId');
      expect(msgs).toEqual([]);
    });

    it('parses stored payloads into SporeMessage array', async () => {
      node.query = vi.fn().mockResolvedValue([
        makeEnvelope('f'.repeat(64), 'stored msg 1'),
        makeEnvelope('f'.repeat(64), 'stored msg 2'),
      ]);
      const msgs = await transport.queryMessages('convAbc');
      expect(msgs).toHaveLength(2);
      expect(msgs[0]!.senderPubkey).toBe('f'.repeat(64));
    });

    it('uses group topic when isGroup option is set', async () => {
      node.query = vi.fn().mockResolvedValue([]);
      await transport.queryMessages('grpX', { isGroup: true });
      expect((node.query as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('/spore/1/group-grpX/proto');
    });

    it('uses DM topic by default (no isGroup)', async () => {
      node.query = vi.fn().mockResolvedValue([]);
      await transport.queryMessages(recipientPubkey);
      expect((node.query as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(`/spore/1/dm-${recipientPubkey}/proto`);
    });

    it('skips malformed payloads gracefully', async () => {
      node.query = vi.fn().mockResolvedValue([
        new TextEncoder().encode('not-json'),
        makeEnvelope('f'.repeat(64), 'valid msg'),
      ]);
      const msgs = await transport.queryMessages('convAbc');
      expect(msgs).toHaveLength(1);
    });

    it('skips envelopes missing required fields', async () => {
      const bad = new TextEncoder().encode(JSON.stringify({ v: 1, from: 'abc' })); // missing ciphertext + ts
      node.query = vi.fn().mockResolvedValue([bad, makeEnvelope('f'.repeat(64), 'good')]);
      const msgs = await transport.queryMessages('convAbc');
      expect(msgs).toHaveLength(1);
    });
  });

  // ─── Invalid envelope handling ────────────────────────────────────────────

  describe('malformed payload handling', () => {
    it('ignores non-JSON payloads silently', () => {
      const onMessage = vi.fn();
      transport.subscribeToDms(recipientPubkey, onMessage);

      const handler = node._handlers.get(`/spore/1/dm-${recipientPubkey}/proto`)![0]!;
      handler(new TextEncoder().encode('not-json'));

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('ignores envelopes with unknown version', () => {
      const onMessage = vi.fn();
      transport.subscribeToDms(recipientPubkey, onMessage);

      const badEnvelope = { v: 99, from: senderPubkey, ciphertext: 'x', ts: 1 };
      const handler = node._handlers.get(`/spore/1/dm-${recipientPubkey}/proto`)![0]!;
      handler(new TextEncoder().encode(JSON.stringify(badEnvelope)));

      expect(onMessage).not.toHaveBeenCalled();
    });
  });
});
