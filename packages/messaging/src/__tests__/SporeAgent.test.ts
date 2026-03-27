// Unit tests for SporeAgent and related modules.
//
// Uses vitest. Relay connections are mocked via vi.mock so tests run offline.
// Pattern: mock RelayPool and NostrTransport at module boundaries, then test
// the SporeAgent event pipeline and context helpers in isolation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';

// ─── Mock nostr-tools before importing anything that uses it ──────────────────

// We mock nostr-tools at the module level so RelayPool/NostrTransport
// never open real WebSocket connections during tests.
vi.mock('nostr-tools', () => {
    const fakePool = {
        publish: vi.fn(() => [Promise.resolve('ok')]),
        subscribeMany: vi.fn(() => ({ close: vi.fn() })),
        querySync: vi.fn(async () => []),
        close: vi.fn(),
    };
    return {
        SimplePool: vi.fn(() => fakePool),
        finalizeEvent: vi.fn((evt: object, key: Uint8Array) => ({
            ...evt,
            id: 'mock-event-id',
            sig: 'mock-sig',
        })),
        generateSecretKey: vi.fn(() => new Uint8Array(32).fill(1)),
        getPublicKey: vi.fn(() => 'mock-ephemeral-pubkey'),
    };
});

vi.mock('nostr-tools/pure', () => ({
    // getPublicKey takes Uint8Array in nostr-tools v2
    getPublicKey: vi.fn((_key: Uint8Array) => 'a'.repeat(64)),
}));

vi.mock('nostr-tools/nip44', () => ({
    // getConversationKey(privkeyBytes: Uint8Array, pubkeyHex: string): Uint8Array
    getConversationKey: vi.fn((_priv: Uint8Array, _pub: string) => new Uint8Array(32).fill(2)),
    encrypt: vi.fn((plain: string, _key: Uint8Array) => 'encrypted:' + plain),
    decrypt: vi.fn((cipher: string, _key: Uint8Array) => {
        if (typeof cipher === 'string' && cipher.startsWith('encrypted:')) {
            return cipher.slice('encrypted:'.length);
        }
        return cipher;
    }),
}));

// Mock @noble/curves/secp256k1 for address derivation
vi.mock('@noble/curves/secp256k1', () => ({
    secp256k1: {
        getPublicKey: vi.fn(() => new Uint8Array(65).fill(4)),
    },
}));

// Mock @noble/hashes/sha3 for keccak
vi.mock('@noble/hashes/sha3', () => ({
    keccak_256: vi.fn(() => new Uint8Array(32).fill(0xab)),
}));

// ─── Imports (after mocks are registered) ─────────────────────────────────────

import { SporeAgent } from '../SporeAgent.js';
import { RelayPool } from '../relay/RelayPool.js';
import { NostrTransport } from '../transport/NostrTransport.js';
import { MessageContext } from '../MessageContext.js';
import { ConversationContext } from '../ConversationContext.js';
import { encrypt, decrypt } from '../crypto/Nip44Crypto.js';
import { createIdentity } from '../identity/AirAccountIdentity.js';
import type { SporeConversation, SporeMessage } from '../types.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** A deterministic test private key (32 bytes, never used on mainnet). */
const TEST_PRIVATE_KEY = '0x' + 'de'.repeat(32);

/** Create a minimal SporeMessage for testing event pipelines. */
function makeMessage(overrides: Partial<SporeMessage> = {}): SporeMessage {
    const conv: SporeConversation = {
        id: 'alice-pubkey:bob-pubkey',
        type: 'dm',
        members: ['alice-pubkey', 'bob-pubkey'],
        createdAt: 1_700_000_000,
    };
    return {
        id: 'msg-id-1',
        senderPubkey: 'alice-pubkey',
        content: 'Hello Spore!',
        contentType: 'text',
        sentAt: 1_700_000_001,
        conversation: conv,
        rawEvent: {
            id: 'msg-id-1',
            pubkey: 'alice-pubkey',
            kind: 1059,
            created_at: 1_700_000_001,
            tags: [['p', 'bob-pubkey']],
            content: 'encrypted:...',
            sig: 'sig',
        },
        ...overrides,
    };
}

// ─── AirAccountIdentity tests ─────────────────────────────────────────────────

describe('AirAccountIdentity', () => {
    it('derives a Nostr pubkey from a hex private key', async () => {
        const identity = await createIdentity(TEST_PRIVATE_KEY);
        expect(identity.pubkey).toBe('a'.repeat(64));
        expect(identity.privateKeyHex).toBe('de'.repeat(32));
    });

    it('accepts 0x-prefixed keys and strips the prefix', async () => {
        const identity = await createIdentity('0x' + 'de'.repeat(32));
        expect(identity.privateKeyHex).not.toMatch(/^0x/);
    });

    it('throws for keys shorter than 32 bytes', async () => {
        await expect(createIdentity('0xdead')).rejects.toThrow('32 bytes');
    });

    it('derives an Ethereum address with 0x prefix', async () => {
        const identity = await createIdentity(TEST_PRIVATE_KEY);
        expect(identity.address).toMatch(/^0x[0-9a-f]+$/i);
    });
});

// ─── Nip44Crypto tests ─────────────────────────────────────────────────────────

describe('Nip44Crypto', () => {
    it('encrypts plaintext to an encrypted string', () => {
        const cipher = encrypt('privkey', 'pubkey', 'hello');
        expect(cipher).toBe('encrypted:hello');
    });

    it('decrypts back to the original plaintext', () => {
        const cipher = encrypt('privkey', 'pubkey', 'hello');
        const plain = decrypt('privkey', 'pubkey', cipher);
        expect(plain).toBe('hello');
    });

    it('produces different ciphertext for different content', () => {
        const c1 = encrypt('privkey', 'pubkey', 'msg1');
        const c2 = encrypt('privkey', 'pubkey', 'msg2');
        expect(c1).not.toBe(c2);
    });
});

// ─── RelayPool tests ───────────────────────────────────────────────────────────

describe('RelayPool', () => {
    let pool: RelayPool;

    beforeEach(() => {
        pool = new RelayPool({ relays: ['wss://relay.test'] });
    });

    afterEach(async () => {
        await pool.close();
    });

    it('stores the configured relays', () => {
        expect(pool.connectedRelays).toEqual(['wss://relay.test']);
    });

    it('falls back to DEFAULT_RELAYS when none are provided', () => {
        const defaultPool = new RelayPool({ relays: [] });
        expect(defaultPool.connectedRelays.length).toBeGreaterThan(0);
    });

    it('publish calls SimplePool.publish with correct args', async () => {
        const { SimplePool } = await import('nostr-tools');
        const mockInstance = (SimplePool as unknown as MockInstance).mock.results[0]?.value;

        const fakeEvent = {
            id: 'eid',
            pubkey: 'pk',
            kind: 1059,
            created_at: 0,
            tags: [],
            content: '',
            sig: 'sig',
        };

        await pool.publish(fakeEvent as any);
        expect(mockInstance?.publish).toHaveBeenCalled();
    });

    it('subscribe calls SimplePool.subscribeMany', () => {
        const unsub = pool.subscribe({ kinds: [1059] }, () => {});
        expect(typeof unsub).toBe('function');
        unsub();
    });
});

// ─── MessageContext tests ──────────────────────────────────────────────────────

describe('MessageContext', () => {
    let sendDmSpy: MockInstance;
    let transport: NostrTransport;
    let pool: RelayPool;

    beforeEach(() => {
        pool = new RelayPool({ relays: ['wss://relay.test'] });
        transport = new NostrTransport(pool);
        sendDmSpy = vi.spyOn(transport, 'sendDm').mockResolvedValue('sent-id');
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await pool.close();
    });

    function makeCtx(overrides: Partial<SporeMessage> = {}): MessageContext {
        const msg = makeMessage(overrides);
        return new MessageContext({
            message: msg,
            transport,
            selfPrivkeyHex: 'b'.repeat(64),
            selfPubkeyHex: 'bob-pubkey',
        });
    }

    it('getSenderAddress returns 0x-prefixed sender pubkey', () => {
        const ctx = makeCtx();
        expect(ctx.getSenderAddress()).toBe('0xalice-pubkey');
    });

    it('sendText sends DM to conversation partner', async () => {
        const ctx = makeCtx();
        const id = await ctx.sendText('Hi!');
        expect(sendDmSpy).toHaveBeenCalledOnce();
        expect(sendDmSpy).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Hi!' })
        );
        expect(id).toBe('sent-id');
    });

    it('sendTextReply includes replyToId referencing original message', async () => {
        const ctx = makeCtx();
        await ctx.sendTextReply('Reply!');
        expect(sendDmSpy).toHaveBeenCalledWith(
            expect.objectContaining({ replyToId: 'msg-id-1' })
        );
    });

    it('sendReaction sends emoji as DM content', async () => {
        const ctx = makeCtx();
        await ctx.sendReaction('🔥');
        expect(sendDmSpy).toHaveBeenCalledWith(
            expect.objectContaining({ content: '🔥' })
        );
    });

    it('group message routes through sendGroupMessage', async () => {
        const groupSendSpy = vi.spyOn(transport, 'sendGroupMessage').mockResolvedValue('gid');
        const msg = makeMessage({
            conversation: {
                id: 'group-1',
                type: 'group',
                members: ['alice-pubkey', 'bob-pubkey'],
                createdAt: 0,
            },
        });
        const ctx = new MessageContext({
            message: msg,
            transport,
            selfPrivkeyHex: 'b'.repeat(64),
            selfPubkeyHex: 'bob-pubkey',
        });
        await ctx.sendText('group hello');
        expect(groupSendSpy).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'group hello', groupId: 'group-1' })
        );
    });
});

// ─── ConversationContext tests ─────────────────────────────────────────────────

describe('ConversationContext', () => {
    let transport: NostrTransport;
    let pool: RelayPool;
    let sendDmSpy: MockInstance;

    beforeEach(() => {
        pool = new RelayPool({ relays: ['wss://relay.test'] });
        transport = new NostrTransport(pool);
        sendDmSpy = vi.spyOn(transport, 'sendDm').mockResolvedValue('sent-id');
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await pool.close();
    });

    it('isDm() returns true for DM conversations', () => {
        const ctx = new ConversationContext({
            conversation: { id: 'c1', type: 'dm', members: ['a', 'b'], createdAt: 0 },
            transport,
            senderPrivkeyHex: 'a'.repeat(64),
            senderPubkeyHex: 'b',
        });
        expect(ctx.isDm()).toBe(true);
        expect(ctx.isGroup()).toBe(false);
    });

    it('isGroup() returns true for group conversations', () => {
        const ctx = new ConversationContext({
            conversation: { id: 'g1', type: 'group', members: ['a', 'b', 'c'], createdAt: 0 },
            transport,
            senderPrivkeyHex: 'a'.repeat(64),
            senderPubkeyHex: 'a',
        });
        expect(ctx.isGroup()).toBe(true);
    });

    it('sendText on a DM calls transport.sendDm', async () => {
        const ctx = new ConversationContext({
            conversation: { id: 'c1', type: 'dm', members: ['alice', 'bob'], createdAt: 0 },
            transport,
            senderPrivkeyHex: 'a'.repeat(64),
            senderPubkeyHex: 'bob',
        });
        await ctx.sendText('hello');
        expect(sendDmSpy).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'hello', recipientPubkeyHex: 'alice' })
        );
    });
});

// ─── SporeAgent event pipeline tests ──────────────────────────────────────────

describe('SporeAgent', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        agent = await SporeAgent.create({
            privateKeyHex: TEST_PRIVATE_KEY,
            relays: ['wss://relay.test'],
            debug: false,
        });
    });

    afterEach(async () => {
        if (agent.isRunning) {
            await agent.stop();
        }
    });

    it('has an address and pubkey after creation', () => {
        expect(agent.address).toMatch(/^0x/);
        expect(agent.pubkey).toBe('a'.repeat(64));
    });

    it('isRunning is false before start()', () => {
        expect(agent.isRunning).toBe(false);
    });

    it('emits "start" event on start()', async () => {
        let started = false;
        agent.on('start', () => { started = true; });
        await agent.start();
        expect(started).toBe(true);
        expect(agent.isRunning).toBe(true);
    });

    it('emits "stop" event on stop()', async () => {
        let stopped = false;
        agent.on('stop', () => { stopped = true; });
        await agent.start();
        await agent.stop();
        expect(stopped).toBe(true);
        expect(agent.isRunning).toBe(false);
    });

    it('calling start() twice is idempotent', async () => {
        const startHandler = vi.fn();
        agent.on('start', startHandler);
        await agent.start();
        await agent.start();
        expect(startHandler).toHaveBeenCalledOnce();
    });

    it('supports createFromEnv() when SPORE_WALLET_KEY is set', async () => {
        process.env['SPORE_WALLET_KEY'] = TEST_PRIVATE_KEY;
        try {
            const envAgent = await SporeAgent.createFromEnv();
            expect(envAgent.pubkey).toBe('a'.repeat(64));
        } finally {
            delete process.env['SPORE_WALLET_KEY'];
        }
    });

    it('createFromEnv() throws when no key is in environment', async () => {
        delete process.env['SPORE_WALLET_KEY'];
        delete process.env['WALLET_KEY'];
        delete process.env['KEY'];
        await expect(SporeAgent.createFromEnv()).rejects.toThrow('SPORE_WALLET_KEY');
    });

    it('on() / off() work for typed events', async () => {
        const handler = vi.fn();
        agent.on('text', handler);
        agent.off('text', handler);
        // No way to trigger internal handleIncomingMessage without relay events,
        // but we verify the EventEmitter wiring compiles and runs.
        expect(agent.listenerCount('text')).toBe(0);
    });

    it('SporeAgent as Agent alias works from xmtp-compat', async () => {
        // Dynamic import to verify the re-export
        const { Agent } = await import('../xmtp-compat.js');
        expect(Agent).toBe(SporeAgent);
    });
});

// ─── xmtp-compat shim tests ────────────────────────────────────────────────────

describe('xmtp-compat', () => {
    it('exports Agent as SporeAgent', async () => {
        const mod = await import('../xmtp-compat.js');
        expect(mod.Agent).toBe(SporeAgent);
    });

    it('exports MessageContext', async () => {
        const mod = await import('../xmtp-compat.js');
        expect(mod.MessageContext).toBe(MessageContext);
    });

    it('exports ConversationContext', async () => {
        const mod = await import('../xmtp-compat.js');
        expect(mod.ConversationContext).toBe(ConversationContext);
    });
});

// ─── SporeAgent consent API (F1) tests ────────────────────────────────────────

describe('SporeAgent consent (allowedSenders / blockedSenders)', () => {
    let agent: SporeAgent;

    /** Invoke the private handleIncomingMessage via cast (white-box test). */
    async function deliver(ag: SporeAgent, msg: SporeMessage): Promise<void> {
        await (ag as unknown as { handleIncomingMessage: (m: SporeMessage) => Promise<void> })
            .handleIncomingMessage(msg);
    }

    afterEach(async () => {
        if (agent.isRunning) await agent.stop();
    });

    it('allowedSenders: only processes messages from allowlisted pubkeys', async () => {
        agent = await SporeAgent.create({
            privateKeyHex: TEST_PRIVATE_KEY,
            relays: ['wss://relay.test'],
            allowedSenders: new Set(['allowed-pubkey']),
        });

        const handler = vi.fn();
        agent.on('text', handler);

        // Message from non-allowed sender — should be dropped
        await deliver(agent, makeMessage({ senderPubkey: 'blocked-pubkey' }));
        expect(handler).not.toHaveBeenCalled();

        // Message from allowed sender — should pass through
        await deliver(agent, makeMessage({ senderPubkey: 'allowed-pubkey' }));
        expect(handler).toHaveBeenCalledOnce();
    });

    it('blockedSenders: drops messages from blocklisted pubkeys', async () => {
        agent = await SporeAgent.create({
            privateKeyHex: TEST_PRIVATE_KEY,
            relays: ['wss://relay.test'],
            blockedSenders: new Set(['spammer-pubkey']),
        });

        const handler = vi.fn();
        agent.on('text', handler);

        // Message from blocked sender — should be dropped
        await deliver(agent, makeMessage({ senderPubkey: 'spammer-pubkey' }));
        expect(handler).not.toHaveBeenCalled();

        // Message from other sender — should pass through
        await deliver(agent, makeMessage({ senderPubkey: 'alice-pubkey' }));
        expect(handler).toHaveBeenCalledOnce();
    });

    it('allowedSenders takes precedence over blockedSenders', async () => {
        agent = await SporeAgent.create({
            privateKeyHex: TEST_PRIVATE_KEY,
            relays: ['wss://relay.test'],
            allowedSenders: new Set(['only-this-pubkey']),
            blockedSenders: new Set(['also-blocked']),
        });

        const handler = vi.fn();
        agent.on('text', handler);

        // Neither allowed nor blocked — not in allowlist → dropped
        await deliver(agent, makeMessage({ senderPubkey: 'also-blocked' }));
        await deliver(agent, makeMessage({ senderPubkey: 'random-pubkey' }));
        expect(handler).not.toHaveBeenCalled();

        // In allowlist → processed
        await deliver(agent, makeMessage({ senderPubkey: 'only-this-pubkey' }));
        expect(handler).toHaveBeenCalledOnce();
    });

    it('no consent config: all senders are processed', async () => {
        agent = await SporeAgent.create({
            privateKeyHex: TEST_PRIVATE_KEY,
            relays: ['wss://relay.test'],
        });

        const handler = vi.fn();
        agent.on('text', handler);

        await deliver(agent, makeMessage({ senderPubkey: 'anyone-pubkey' }));
        expect(handler).toHaveBeenCalledOnce();
    });
});
