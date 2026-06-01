// Unit tests for NostrTransport — NIP-17 Gift Wrap and group messaging.
//
// Strategy:
//   - Mock nostr-tools (no real WebSocket/relay)
//   - Mock Nip44Crypto to make encrypt/decrypt deterministic
//   - Test sendDm layer structure: 3 levels (rumor → seal → wrap)
//   - Test subscribeToDms / subscribeToGroups subscription setup
//   - Test unwrapDm / decodeGroupEvent parsing (white-box via private access)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (registered before any imports that use them) ─────────────────────

// Mock nostr-tools — no real WebSocket connections
vi.mock('nostr-tools', () => {
    let callIndex = 0;
    const fakePool = {
        publish: vi.fn(() => [Promise.resolve('ok')]),
        subscribeMany: vi.fn(() => ({ close: vi.fn() })),
        querySync: vi.fn(async () => []),
        close: vi.fn(),
    };
    return {
        SimplePool: vi.fn(() => fakePool),
        finalizeEvent: vi.fn((evt: object, _key: Uint8Array) => ({
            ...evt,
            id: `event-id-${callIndex++}`,
            sig: 'fake-sig',
        })),
        generateSecretKey: vi.fn(() => new Uint8Array(32).fill(0xee)),
        getPublicKey: vi.fn(() => 'ee'.repeat(32)),
    };
});

vi.mock('nostr-tools/pure', () => ({
    getPublicKey: vi.fn(() => 'a'.repeat(64)),
}));

// Deterministic NIP-44 crypto: encrypt wraps in "enc:<privkey>:<pubkey>:<plain>"
vi.mock('../crypto/Nip44Crypto.js', () => ({
    encrypt: vi.fn((priv: string, pub: string, plain: string) => `enc:${priv.slice(0, 4)}:${pub.slice(0, 4)}:${plain}`),
    decrypt: vi.fn((_priv: string, _pub: string, cipher: string) => {
        // Strip "enc:<priv4>:<pub4>:" prefix
        const parts = cipher.split(':');
        if (parts.length < 4) return cipher;
        return parts.slice(3).join(':');
    }),
}));

// Mock @noble/curves for address derivation
vi.mock('@noble/curves/secp256k1', () => ({
    secp256k1: {
        getPublicKey: vi.fn(() => new Uint8Array(65).fill(4)),
    },
}));

vi.mock('@noble/hashes/sha3', () => ({
    keccak_256: vi.fn(() => new Uint8Array(32).fill(0xab)),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { NostrTransport, KIND_GIFT_WRAP, KIND_SEAL, KIND_RUMOR } from '../transport/NostrTransport.js';
import { RelayPool } from '../relay/RelayPool.js';
import type { SporeMessage } from '../types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALICE_PRIV = 'aa'.repeat(32);
const ALICE_PUB = 'alice-pub'.padEnd(64, '0');
const BOB_PRIV = 'bb'.repeat(32);
const BOB_PUB = 'bob-pub'.padEnd(64, '0');

function makePool(): RelayPool {
    return new RelayPool({ relays: ['wss://relay.test'] });
}

// ─── NostrTransport tests ─────────────────────────────────────────────────────

describe('NostrTransport.sendDm', () => {
    let pool: RelayPool;
    let transport: NostrTransport;

    beforeEach(() => {
        pool = makePool();
        transport = new NostrTransport(pool, false);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await pool.close();
    });

    it('publishes exactly one gift-wrap event (kind:1059) per DM', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendDm({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            recipientPubkeyHex: BOB_PUB,
            content: 'Hello Bob!',
        });

        expect(publishSpy).toHaveBeenCalledOnce();
        const [publishedEvent] = publishSpy.mock.calls[0]!;
        expect(publishedEvent.kind).toBe(KIND_GIFT_WRAP);
    });

    it('gift-wrap event has a p-tag pointing to the recipient', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendDm({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            recipientPubkeyHex: BOB_PUB,
            content: 'test',
        });

        const event = publishSpy.mock.calls[0]![0];
        const pTag = event.tags.find((t: string[]) => t[0] === 'p');
        expect(pTag).toBeDefined();
        expect(pTag![1]).toBe(BOB_PUB);
    });

    it('the gift-wrap content is encrypted (has enc: prefix from mock)', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendDm({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            recipientPubkeyHex: BOB_PUB,
            content: 'secret content',
        });

        const event = publishSpy.mock.calls[0]![0];
        // Our mock encrypt wraps content: "enc:<priv4>:<pub4>:<plaintext>"
        // The gift-wrap content should have this prefix, confirming encrypt() was called
        expect(event.content).toMatch(/^enc:/);
        // The seal (inner level) also went through encrypt — two nested enc: layers
        // The outer content contains the seal JSON (also encrypted)
        expect(typeof event.content).toBe('string');
        expect(event.content.length).toBeGreaterThan(0);
    });

    it('includes replyToId as e-tag in the rumor when provided', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendDm({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            recipientPubkeyHex: BOB_PUB,
            content: 'a reply',
            replyToId: 'parent-event-id',
        });

        const event = publishSpy.mock.calls[0]![0];
        // The reply tag is in the rumor, buried inside the encrypted content
        // We can verify it was embedded by checking the mock encrypt call args
        const { encrypt } = await import('../crypto/Nip44Crypto.js');
        const encryptCalls = (encrypt as ReturnType<typeof vi.fn>).mock.calls;
        // First call is seal (rumor → seal), second is wrap (seal → wrap)
        const rumorJson = encryptCalls[0][2]; // third arg = plaintext
        const rumor = JSON.parse(rumorJson);
        const eTag = rumor.tags?.find((t: string[]) => t[0] === 'e' && t[3] === 'reply');
        expect(eTag).toBeDefined();
        expect(eTag[1]).toBe('parent-event-id');
    });

    it('returns the gift-wrap event id', async () => {
        vi.spyOn(pool, 'publish').mockResolvedValue([]);

        const id = await transport.sendDm({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            recipientPubkeyHex: BOB_PUB,
            content: 'hello',
        });

        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });
});

describe('NostrTransport.sendGroupMessage', () => {
    let pool: RelayPool;
    let transport: NostrTransport;

    beforeEach(() => {
        pool = makePool();
        transport = new NostrTransport(pool);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await pool.close();
    });

    it('publishes a kind:11 group event', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendGroupMessage({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            groupId: 'group-xyz',
            memberPubkeys: [BOB_PUB],
            content: 'hello group',
        });

        expect(publishSpy).toHaveBeenCalledOnce();
        const event = publishSpy.mock.calls[0]![0];
        expect(event.kind).toBe(11);
    });

    it('has an h-tag with the group id', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);

        await transport.sendGroupMessage({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            groupId: 'test-group',
            memberPubkeys: [BOB_PUB],
            content: 'hi',
        });

        const event = publishSpy.mock.calls[0]![0];
        const hTag = event.tags.find((t: string[]) => t[0] === 'h');
        expect(hTag).toBeDefined();
        expect(hTag![1]).toBe('test-group');
    });

    it('has p-tags for all members', async () => {
        const publishSpy = vi.spyOn(pool, 'publish').mockResolvedValue([]);
        const carolPub = 'carol-pub'.padEnd(64, '0');

        await transport.sendGroupMessage({
            senderPrivkeyHex: ALICE_PRIV,
            senderPubkeyHex: ALICE_PUB,
            groupId: 'multi-group',
            memberPubkeys: [BOB_PUB, carolPub],
            content: 'hi all',
        });

        const event = publishSpy.mock.calls[0]![0];
        const pTags = event.tags.filter((t: string[]) => t[0] === 'p').map((t: string[]) => t[1]);
        expect(pTags).toContain(BOB_PUB);
        expect(pTags).toContain(carolPub);
    });
});

describe('NostrTransport.subscribeToDms', () => {
    let pool: RelayPool;
    let transport: NostrTransport;

    beforeEach(() => {
        pool = makePool();
        transport = new NostrTransport(pool);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await pool.close();
    });

    it('subscribes to kind:1059 gift-wrap events with #p filter', () => {
        const subscribeSpy = vi.spyOn(pool, 'subscribe').mockReturnValue(() => {});

        transport.subscribeToDms(ALICE_PUB, ALICE_PRIV, () => {});

        expect(subscribeSpy).toHaveBeenCalledOnce();
        const [filter] = subscribeSpy.mock.calls[0]!;
        expect(filter.kinds).toContain(KIND_GIFT_WRAP);
        expect(filter['#p']).toContain(ALICE_PUB);
    });

    it('returns an unsubscribe function', () => {
        const closeMock = vi.fn();
        vi.spyOn(pool, 'subscribe').mockReturnValue(closeMock);

        const unsub = transport.subscribeToDms(ALICE_PUB, ALICE_PRIV, () => {});

        expect(typeof unsub).toBe('function');
        unsub();
        expect(closeMock).toHaveBeenCalledOnce();
    });
});

describe('NostrTransport.subscribeToGroups', () => {
    let pool: RelayPool;
    let transport: NostrTransport;

    beforeEach(() => {
        pool = makePool();
        transport = new NostrTransport(pool);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await pool.close();
    });

    it('subscribes to kind:11 events with #p filter', () => {
        const subscribeSpy = vi.spyOn(pool, 'subscribe').mockReturnValue(() => {});

        transport.subscribeToGroups(ALICE_PUB, [], () => {});

        expect(subscribeSpy).toHaveBeenCalledOnce();
        const [filter] = subscribeSpy.mock.calls[0]!;
        expect(filter.kinds).toContain(11);
        expect(filter['#p']).toContain(ALICE_PUB);
    });

    it('adds #h filter when specific groupIds are provided', () => {
        const subscribeSpy = vi.spyOn(pool, 'subscribe').mockReturnValue(() => {});

        transport.subscribeToGroups(ALICE_PUB, ['group-a', 'group-b'], () => {});

        const [filter] = subscribeSpy.mock.calls[0]!;
        expect((filter as Record<string, unknown>)['#h']).toEqual(['group-a', 'group-b']);
    });
});

describe('NostrTransport private: decodeGroupEvent', () => {
    let pool: RelayPool;
    let transport: NostrTransport;

    type DecodeGroupFn = (event: Record<string, unknown>) => SporeMessage | null;

    beforeEach(() => {
        pool = makePool();
        transport = new NostrTransport(pool);
    });

    afterEach(async () => {
        await pool.close();
    });

    function decode(event: Record<string, unknown>): SporeMessage | null {
        return (transport as unknown as { decodeGroupEvent: DecodeGroupFn }).decodeGroupEvent(event);
    }

    it('returns null if no h-tag present', () => {
        const event = {
            id: 'eid',
            pubkey: ALICE_PUB,
            kind: 11,
            created_at: 1000,
            tags: [['p', BOB_PUB]],
            content: 'hello',
            sig: 'sig',
        };
        expect(decode(event)).toBeNull();
    });

    it('returns a SporeMessage with type=group', () => {
        const event = {
            id: 'eid',
            pubkey: ALICE_PUB,
            kind: 11,
            created_at: 1000,
            tags: [['h', 'group-1'], ['p', BOB_PUB]],
            content: 'hello group',
            sig: 'sig',
        };
        const msg = decode(event);
        expect(msg).not.toBeNull();
        expect(msg!.conversation.type).toBe('group');
        expect(msg!.conversation.id).toBe('group-1');
        expect(msg!.content).toBe('hello group');
        expect(msg!.senderPubkey).toBe(ALICE_PUB);
    });

    it('sets referencedMessageId from e-tag with reply marker', () => {
        const event = {
            id: 'eid',
            pubkey: ALICE_PUB,
            kind: 11,
            created_at: 1000,
            tags: [['h', 'group-1'], ['e', 'parent-id', '', 'reply']],
            content: 'reply text',
            sig: 'sig',
        };
        const msg = decode(event);
        expect(msg!.referencedMessageId).toBe('parent-id');
    });
});
