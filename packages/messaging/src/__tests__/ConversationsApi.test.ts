// Unit tests for M5 Conversations API:
//   agent.listConversations()
//   agent.getMessages()
//   agent.streamAllMessages()
//
// Strategy:
//   - Inject known conversations via the private knownConversations map using
//     a test-only accessor (we expose one via a subclass trick / type cast).
//   - Mock pool.fetchEvents() for getMessages() to avoid real relay calls.
//   - Test streamAllMessages() by emitting 'message' events and consuming the
//     async generator, then aborting via AbortController.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SporeConversation, SporeMessage, SignedNostrEvent } from '../types.js';
import { MessageContext } from '../MessageContext.js';

// ─── Minimal SporeAgent test double ──────────────────────────────────────────
//
// We construct SporeAgent via SporeAgent.create() but then cast to access
// internals. All relay I/O is replaced with mocks.

import { SporeAgent } from '../SporeAgent.js';

// Mock AirAccountIdentity so we don't need a real private key
vi.mock('../identity/AirAccountIdentity.js', () => ({
    createIdentity: vi.fn().mockResolvedValue({
        pubkey: 'a'.repeat(64),
        address: '0x' + 'a'.repeat(40),
        privateKeyHex: 'a'.repeat(64),
    }),
    createIdentityFromEnv: vi.fn(),
}));

// Mock RelayPool — capture fetchEvents mock for injection
const mockFetchEvents = vi.fn().mockResolvedValue([]);
const mockPublish = vi.fn().mockResolvedValue([]);
const mockSubscribe = vi.fn().mockReturnValue(() => {});
const mockSubscribeMany = vi.fn().mockReturnValue(() => {});
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('../relay/RelayPool.js', () => ({
    DEFAULT_RELAYS: ['ws://localhost:9999'],
    parseRelaysFromEnv: vi.fn().mockReturnValue([]),
    RelayPool: vi.fn().mockImplementation(() => ({
        connectedRelays: ['ws://localhost:9999'],
        publish: mockPublish,
        subscribe: mockSubscribe,
        subscribeMany: mockSubscribeMany,
        fetchEvents: mockFetchEvents,
        close: mockClose,
    })),
}));

// Mock NostrTransport — decryptDm and decodeGroup return controlled values
const mockDecryptDm = vi.fn().mockReturnValue(null);
const mockDecodeGroup = vi.fn().mockReturnValue(null);

vi.mock('../transport/NostrTransport.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../transport/NostrTransport.js')>();
    return {
        ...actual,
        NostrTransport: vi.fn().mockImplementation(() => ({
            subscribeToDms: vi.fn().mockReturnValue(() => {}),
            subscribeToGroups: vi.fn().mockReturnValue(() => {}),
            sendDm: vi.fn(),
            sendGroupMessage: vi.fn(),
            decryptDm: mockDecryptDm,
            decodeGroup: mockDecodeGroup,
        })),
    };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConversation(
    id: string,
    type: 'dm' | 'group',
    createdAt: number
): SporeConversation {
    return {
        id,
        type,
        members: ['a'.repeat(64), 'b'.repeat(64)],
        createdAt,
    };
}

function makeMessage(id: string, conv: SporeConversation, sentAt: number): SporeMessage {
    return {
        id,
        senderPubkey: 'b'.repeat(64),
        content: `hello from ${id}`,
        contentType: 'text',
        sentAt,
        conversation: conv,
        rawEvent: { id, kind: 14, content: '', tags: [], created_at: sentAt, pubkey: 'b'.repeat(64), sig: 'x'.repeat(128) } as SignedNostrEvent,
    };
}

// Inject conversations into the agent's private knownConversations map
function injectConversation(agent: SporeAgent, conv: SporeConversation): void {
    // Cast to access private field for testing
    (agent as unknown as { knownConversations: Map<string, SporeConversation> })
        .knownConversations.set(conv.id, conv);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('M5: listConversations()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'a'.repeat(64),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns empty array when no conversations known', () => {
        expect(agent.listConversations()).toEqual([]);
    });

    it('returns all conversations sorted by createdAt descending', () => {
        const older = makeConversation('conv-old', 'dm', 1000);
        const newer = makeConversation('conv-new', 'dm', 2000);
        injectConversation(agent, older);
        injectConversation(agent, newer);

        const result = agent.listConversations();
        expect(result).toHaveLength(2);
        expect(result[0]!.id).toBe('conv-new');
        expect(result[1]!.id).toBe('conv-old');
    });

    it('filters by type=dm', () => {
        injectConversation(agent, makeConversation('dm-1', 'dm', 1000));
        injectConversation(agent, makeConversation('grp-1', 'group', 1000));

        const result = agent.listConversations({ type: 'dm' });
        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('dm-1');
    });

    it('filters by type=group', () => {
        injectConversation(agent, makeConversation('dm-1', 'dm', 1000));
        injectConversation(agent, makeConversation('grp-1', 'group', 1000));

        const result = agent.listConversations({ type: 'group' });
        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('grp-1');
    });

    it('applies limit', () => {
        for (let i = 0; i < 10; i++) {
            injectConversation(agent, makeConversation(`conv-${i}`, 'dm', i * 100));
        }
        const result = agent.listConversations({ limit: 3 });
        expect(result).toHaveLength(3);
    });

    it('defaults type=all, limit=100', () => {
        injectConversation(agent, makeConversation('dm-1', 'dm', 1000));
        injectConversation(agent, makeConversation('grp-1', 'group', 2000));
        const result = agent.listConversations();
        expect(result).toHaveLength(2);
    });
});

describe('M5: getMessages()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'a'.repeat(64),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns empty array for unknown convId', async () => {
        const result = await agent.getMessages('unknown-conv');
        expect(result).toEqual([]);
    });

    it('queries kind:1059 events for DM conversations', async () => {
        const conv = makeConversation('dm-conv-1', 'dm', 1000);
        injectConversation(agent, conv);

        const fakeEvent = { id: 'ev1', kind: 1059, content: '', tags: [['p', 'a'.repeat(64)]], created_at: 1000, pubkey: 'z'.repeat(64), sig: 'x'.repeat(128) };
        const fakeMessage = makeMessage('msg-1', conv, 1000);

        mockFetchEvents.mockResolvedValueOnce([fakeEvent]);
        mockDecryptDm.mockReturnValueOnce(fakeMessage);

        const result = await agent.getMessages('dm-conv-1');

        expect(mockFetchEvents).toHaveBeenCalledWith(
            expect.objectContaining({ kinds: [1059], '#p': expect.arrayContaining(['a'.repeat(64)]) })
        );
        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('msg-1');
    });

    it('filters out DM messages not belonging to requested convId', async () => {
        const conv = makeConversation('dm-conv-target', 'dm', 1000);
        injectConversation(agent, conv);

        const otherConv = makeConversation('dm-conv-other', 'dm', 1000);
        const wrongMsg = makeMessage('wrong', otherConv, 1000);
        const rightMsg = makeMessage('right', conv, 1000);

        mockFetchEvents.mockResolvedValueOnce([{}, {}]);
        mockDecryptDm
            .mockReturnValueOnce(wrongMsg)
            .mockReturnValueOnce(rightMsg);

        const result = await agent.getMessages('dm-conv-target');
        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('right');
    });

    it('queries kind:11 events with #h filter for group conversations', async () => {
        const conv = makeConversation('group-id-xyz', 'group', 1000);
        injectConversation(agent, conv);

        const fakeEvent = { id: 'g1', kind: 11, content: 'hi', tags: [['h', 'group-id-xyz']], created_at: 1000, pubkey: 'b'.repeat(64), sig: 'x'.repeat(128) };
        const fakeMessage = makeMessage('g1', conv, 1000);

        mockFetchEvents.mockResolvedValueOnce([fakeEvent]);
        mockDecodeGroup.mockReturnValueOnce(fakeMessage);

        const result = await agent.getMessages('group-id-xyz');

        expect(mockFetchEvents).toHaveBeenCalledWith(
            expect.objectContaining({ kinds: [11], '#h': ['group-id-xyz'] })
        );
        expect(result).toHaveLength(1);
    });

    it('returns messages sorted by sentAt ascending', async () => {
        const conv = makeConversation('dm-sort', 'dm', 1000);
        injectConversation(agent, conv);

        const m1 = makeMessage('msg-early', conv, 1000);
        const m2 = makeMessage('msg-late', conv, 3000);
        const m3 = makeMessage('msg-mid', conv, 2000);

        mockFetchEvents.mockResolvedValueOnce([{}, {}, {}]);
        mockDecryptDm
            .mockReturnValueOnce(m2)  // late comes first from relay (most recent)
            .mockReturnValueOnce(m3)
            .mockReturnValueOnce(m1);

        const result = await agent.getMessages('dm-sort');
        expect(result.map((m) => m.id)).toEqual(['msg-early', 'msg-mid', 'msg-late']);
    });

    it('passes since/until/limit to fetchEvents', async () => {
        const conv = makeConversation('dm-opts', 'dm', 1000);
        injectConversation(agent, conv);
        mockFetchEvents.mockResolvedValueOnce([]);

        await agent.getMessages('dm-opts', { limit: 10, since: 500, until: 2000 });

        expect(mockFetchEvents).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, since: 500, until: 2000 })
        );
    });
});

describe('M5: streamAllMessages()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'a'.repeat(64),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('yields MessageContext instances as messages arrive', async () => {
        const conv = makeConversation('stream-dm', 'dm', 1000);
        const msg = makeMessage('stream-1', conv, 1000);

        const ac = new AbortController();
        const stream = agent.streamAllMessages({ signal: ac.signal });

        // Build a MessageContext and emit it
        const ctx = new MessageContext({
            message: msg,
            transport: null as never,
            selfPrivkeyHex: 'a'.repeat(64),
            selfPubkeyHex: 'a'.repeat(64),
        });

        // Schedule the emit, then abort
        setTimeout(() => {
            agent.emit('message', ctx);
            // Give the generator a tick to pick it up, then abort
            setTimeout(() => ac.abort(), 5);
        }, 5);

        const results: MessageContext[] = [];
        for await (const item of stream) {
            results.push(item);
        }

        expect(results).toHaveLength(1);
        expect(results[0]).toBe(ctx);
    });

    it('stops immediately when signal is already aborted', async () => {
        const ac = new AbortController();
        ac.abort(); // pre-aborted

        const results: MessageContext[] = [];
        for await (const item of agent.streamAllMessages({ signal: ac.signal })) {
            results.push(item);
        }

        expect(results).toHaveLength(0);
    });

    it('yields multiple messages before abort', async () => {
        const conv = makeConversation('stream-multi', 'dm', 1000);
        const ac = new AbortController();
        const stream = agent.streamAllMessages({ signal: ac.signal });

        const ctxs = [1, 2, 3].map((i) =>
            new MessageContext({
                message: makeMessage(`msg-${i}`, conv, i * 100),
                transport: null as never,
                selfPrivkeyHex: 'a'.repeat(64),
                selfPubkeyHex: 'a'.repeat(64),
            })
        );

        setTimeout(() => {
            for (const ctx of ctxs) agent.emit('message', ctx);
            setTimeout(() => ac.abort(), 5);
        }, 5);

        const results: MessageContext[] = [];
        for await (const item of stream) {
            results.push(item);
        }

        expect(results).toHaveLength(3);
        expect(results.map((r) => r.message.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });
});
