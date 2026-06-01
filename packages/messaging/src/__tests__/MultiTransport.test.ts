// Unit tests for M13: MultiTransport.
//
// Uses mock SporeTransport instances — no real network connections.
// Tests verify fan-out sends, merged subscriptions, deduplication,
// SeenSet TTL eviction, query merge + sort, and error handling.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiTransport } from '../transport/MultiTransport.js';
import type { SporeTransport } from '../transport/SporeTransport.js';
import type { SporeConversation, SporeMessage } from '../types.js';

// ─── Mock transport factory ───────────────────────────────────────────────────

type Handler = (msg: SporeMessage, conv: SporeConversation) => void;

interface MockTransport extends SporeTransport {
  _fireMessage(msg: SporeMessage, conv: SporeConversation): void;
  _fireGroup(msg: SporeMessage, conv: SporeConversation): void;
}

function makeMockTransport(name: string): MockTransport {
  let dmHandler: Handler | null = null;
  let groupHandler: Handler | null = null;

  return {
    name,
    sendDm: vi.fn().mockResolvedValue(`hash-dm-${name}`),
    sendGroupMessage: vi.fn().mockResolvedValue(`hash-group-${name}`),
    subscribeToDms: vi.fn((_pubkey, onMsg) => {
      dmHandler = onMsg;
      return () => { dmHandler = null; };
    }),
    subscribeToGroups: vi.fn((_ids, onMsg) => {
      groupHandler = onMsg;
      return () => { groupHandler = null; };
    }),
    queryMessages: vi.fn().mockResolvedValue([]),
    _fireMessage(msg, conv) { dmHandler?.(msg, conv); },
    _fireGroup(msg, conv) { groupHandler?.(msg, conv); },
  };
}

function makeMsg(id: string, sentAt = 1000): SporeMessage {
  return {
    id,
    senderPubkey: 'a'.repeat(64),
    content: `content-${id}`,
    contentType: 'text',
    sentAt,
    conversation: { id: 'conv1', type: 'dm', members: ['a'.repeat(64)], createdAt: sentAt },
    rawEvent: {} as never,
  };
}

const CONV: SporeConversation = {
  id: 'conv1', type: 'dm', members: ['a'.repeat(64)], createdAt: 1000,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MultiTransport', () => {
  let t1: MockTransport;
  let t2: MockTransport;
  let multi: MultiTransport;

  beforeEach(() => {
    t1 = makeMockTransport('t1');
    t2 = makeMockTransport('t2');
    multi = new MultiTransport({ transports: [t1, t2] });
  });

  // ─── Constructor ───────────────────────────────────────────────────────────

  it('has name "multi"', () => {
    expect(multi.name).toBe('multi');
  });

  it('throws if transports array is empty', () => {
    expect(() => new MultiTransport({ transports: [] })).toThrow();
  });

  // ─── sendDm ────────────────────────────────────────────────────────────────

  describe('sendDm', () => {
    const opts = {
      senderPrivkeyHex: 'ab'.repeat(32),
      senderPubkeyHex: 'a'.repeat(64),
      recipientPubkeyHex: 'b'.repeat(64),
      content: 'hello',
    };

    it('sends to all transports', async () => {
      await multi.sendDm(opts);
      expect(t1.sendDm).toHaveBeenCalledWith(opts);
      expect(t2.sendDm).toHaveBeenCalledWith(opts);
    });

    it('returns hash from first successful transport', async () => {
      const hash = await multi.sendDm(opts);
      expect(hash).toBe('hash-dm-t1');
    });

    it('falls back to second transport when first fails', async () => {
      (t1.sendDm as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('t1 down'));
      const hash = await multi.sendDm(opts);
      expect(hash).toBe('hash-dm-t2');
    });

    it('throws when all transports fail', async () => {
      (t1.sendDm as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('t1 down'));
      (t2.sendDm as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('t2 down'));
      await expect(multi.sendDm(opts)).rejects.toThrow('t2 down');
    });
  });

  // ─── sendGroupMessage ──────────────────────────────────────────────────────

  describe('sendGroupMessage', () => {
    const opts = {
      senderPrivkeyHex: 'ab'.repeat(32),
      senderPubkeyHex: 'a'.repeat(64),
      groupId: 'grp1',
      memberPubkeys: ['b'.repeat(64)],
      content: 'hi group',
    };

    it('sends to all transports', async () => {
      await multi.sendGroupMessage(opts);
      expect(t1.sendGroupMessage).toHaveBeenCalledWith(opts);
      expect(t2.sendGroupMessage).toHaveBeenCalledWith(opts);
    });

    it('returns hash from first transport', async () => {
      const hash = await multi.sendGroupMessage(opts);
      expect(hash).toBe('hash-group-t1');
    });
  });

  // ─── subscribeToDms ────────────────────────────────────────────────────────

  describe('subscribeToDms', () => {
    it('subscribes on all transports', () => {
      multi.subscribeToDms('a'.repeat(64), vi.fn());
      expect(t1.subscribeToDms).toHaveBeenCalledOnce();
      expect(t2.subscribeToDms).toHaveBeenCalledOnce();
    });

    it('delivers unique messages from each transport', () => {
      const onMessage = vi.fn();
      multi.subscribeToDms('a'.repeat(64), onMessage);

      t1._fireMessage(makeMsg('msg-1'), CONV);
      t2._fireMessage(makeMsg('msg-2'), CONV);

      expect(onMessage).toHaveBeenCalledTimes(2);
    });

    it('deduplicates same message ID arriving on both transports', () => {
      const onMessage = vi.fn();
      multi.subscribeToDms('a'.repeat(64), onMessage);

      t1._fireMessage(makeMsg('dup-id'), CONV);
      t2._fireMessage(makeMsg('dup-id'), CONV);

      expect(onMessage).toHaveBeenCalledOnce();
    });

    it('unsub cleans up all transport subscriptions', () => {
      const onMessage = vi.fn();
      const unsub = multi.subscribeToDms('a'.repeat(64), onMessage);
      unsub();

      // After unsub, firing messages should not reach onMessage
      t1._fireMessage(makeMsg('after-unsub'), CONV);
      expect(onMessage).not.toHaveBeenCalled();
    });

    it('passes AbortSignal to each transport', () => {
      const controller = new AbortController();
      multi.subscribeToDms('a'.repeat(64), vi.fn(), { signal: controller.signal });
      expect(t1.subscribeToDms).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { signal: controller.signal }
      );
      expect(t2.subscribeToDms).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { signal: controller.signal }
      );
    });
  });

  // ─── subscribeToGroups ─────────────────────────────────────────────────────

  describe('subscribeToGroups', () => {
    it('subscribes on all transports', () => {
      multi.subscribeToGroups(['grp1'], vi.fn());
      expect(t1.subscribeToGroups).toHaveBeenCalledWith(['grp1'], expect.any(Function), undefined);
      expect(t2.subscribeToGroups).toHaveBeenCalledWith(['grp1'], expect.any(Function), undefined);
    });

    it('deduplicates same group message ID across transports', () => {
      const onMessage = vi.fn();
      multi.subscribeToGroups(['grp1'], onMessage);

      const groupConv: SporeConversation = { id: 'grp1', type: 'group', members: [], createdAt: 1000 };
      t1._fireGroup(makeMsg('grp-dup'), groupConv);
      t2._fireGroup(makeMsg('grp-dup'), groupConv);

      expect(onMessage).toHaveBeenCalledOnce();
    });
  });

  // ─── queryMessages ─────────────────────────────────────────────────────────

  describe('queryMessages', () => {
    it('returns empty when all transports return empty', async () => {
      const msgs = await multi.queryMessages('conv1');
      expect(msgs).toEqual([]);
    });

    it('merges results from all transports sorted by sentAt', async () => {
      (t1.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeMsg('a', 3000),
        makeMsg('b', 1000),
      ]);
      (t2.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeMsg('c', 2000),
      ]);
      const msgs = await multi.queryMessages('conv1');
      expect(msgs.map((m) => m.id)).toEqual(['b', 'c', 'a']);
    });

    it('deduplicates messages with same ID across transports', async () => {
      (t1.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([makeMsg('dup', 1000)]);
      (t2.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([makeMsg('dup', 1000)]);
      const msgs = await multi.queryMessages('conv1');
      expect(msgs).toHaveLength(1);
    });

    it('respects limit after merge', async () => {
      (t1.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeMsg('a', 1000), makeMsg('b', 2000),
      ]);
      (t2.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeMsg('c', 3000),
      ]);
      const msgs = await multi.queryMessages('conv1', { limit: 2 });
      expect(msgs).toHaveLength(2);
      expect(msgs[0]!.id).toBe('a');
      expect(msgs[1]!.id).toBe('b');
    });

    it('skips failed transports gracefully', async () => {
      (t1.queryMessages as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('t1 down'));
      (t2.queryMessages as ReturnType<typeof vi.fn>).mockResolvedValue([makeMsg('ok', 1000)]);
      const msgs = await multi.queryMessages('conv1');
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.id).toBe('ok');
    });
  });

  // ─── SeenSet TTL eviction ──────────────────────────────────────────────────

  describe('SeenSet TTL', () => {
    it('allows the same ID again after TTL expires', async () => {
      // Use very short TTL for testing
      const shortMulti = new MultiTransport({ transports: [t1, t2], seenTtlMs: 1 });
      const onMessage = vi.fn();
      shortMulti.subscribeToDms('a'.repeat(64), onMessage);

      t1._fireMessage(makeMsg('ttl-test'), CONV);
      expect(onMessage).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      // Fire again — TTL expired, should be allowed through
      t1._fireMessage(makeMsg('ttl-test'), CONV);
      expect(onMessage).toHaveBeenCalledTimes(2);
    });
  });
});
