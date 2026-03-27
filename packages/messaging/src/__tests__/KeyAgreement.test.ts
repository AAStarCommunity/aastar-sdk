// Unit tests for M9 MLS Key Agreement:
//   SporeKeyAgreement — KeyPackage, epoch key, Welcome, group message encryption
//   SporeAgent M9 — publishKeyPackage, createMlsGroup, sendMlsMessage,
//                   decryptMlsMessage, processWelcome

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    SporeKeyAgreement,
    KIND_KEY_PACKAGE,
    KIND_MLS_GROUP_MESSAGE,
    SPORE_MLS_WELCOME_PREFIX,
    SPORE_MLS_CIPHER,
} from '../keyagreement/SporeKeyAgreement.js';
import { SporeAgent } from '../SporeAgent.js';
import type { MlsGroupState } from '../types.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../identity/AirAccountIdentity.js', () => ({
    createIdentity: vi.fn().mockResolvedValue({
        pubkey: 'self'.padEnd(64, '0'),
        address: '0xSelf' + 'a'.repeat(35),
        privateKeyHex: 'priv'.padEnd(64, '0'),
    }),
    createIdentityFromEnv: vi.fn(),
}));

const mockPublish = vi.fn().mockResolvedValue([{ status: 'fulfilled', value: 'ok' }]);
const mockSendDm = vi.fn().mockResolvedValue('dm-event-id');
let mockFetchEventsImpl: (filter: unknown) => Promise<unknown[]> = async () => [];

vi.mock('../relay/RelayPool.js', () => ({
    DEFAULT_RELAYS: ['ws://localhost:9999'],
    parseRelaysFromEnv: vi.fn().mockReturnValue([]),
    RelayPool: vi.fn().mockImplementation(() => ({
        connectedRelays: ['ws://localhost:9999'],
        publish: mockPublish,
        subscribe: vi.fn().mockReturnValue(() => {}),
        subscribeMany: vi.fn().mockReturnValue(() => {}),
        fetchEvents: vi.fn().mockImplementation((...args: unknown[]) => mockFetchEventsImpl(args[0])),
        close: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../transport/NostrTransport.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../transport/NostrTransport.js')>();
    return {
        ...actual,
        NostrTransport: vi.fn().mockImplementation(() => ({
            subscribeToDms: vi.fn().mockReturnValue(() => {}),
            subscribeToGroups: vi.fn().mockReturnValue(() => {}),
            sendDm: mockSendDm,
            sendGroupMessage: vi.fn(),
            sendGroupMeta: vi.fn().mockResolvedValue(''),
            sendGroupMembership: vi.fn().mockResolvedValue(''),
            decryptDm: vi.fn().mockReturnValue(null),
            decodeGroup: vi.fn().mockReturnValue(null),
        })),
    };
});

// Mock nostr-tools: finalizeEvent builds deterministic events; verifyEvent always passes.
vi.mock('nostr-tools', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nostr-tools')>();
    return {
        ...actual,
        finalizeEvent: vi.fn().mockImplementation((template: Record<string, unknown>, _privkey: Uint8Array) => ({
            ...template,
            id: 'mock-event-id-' + template['kind'],
            pubkey: 'self'.padEnd(64, '0'),
            sig: 'x'.repeat(128),
        })),
        verifyEvent: vi.fn().mockReturnValue(true),
    };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeKeyPackageEvent(pubkey: string, createdAt = 1000) {
    return {
        id: 'kp-' + pubkey.slice(0, 8),
        pubkey,
        kind: KIND_KEY_PACKAGE,
        created_at: createdAt,
        tags: [['d', 'spore-kp'], ['version', '1'], ['cipher', SPORE_MLS_CIPHER]],
        content: '',
        sig: 'x'.repeat(128),
    };
}

function makeMockPool(fetchImpl: (filter: unknown) => Promise<unknown[]> = async () => []) {
    return {
        publish: mockPublish,
        fetchEvents: vi.fn().mockImplementation(fetchImpl),
    } as never;
}

// ─── SporeKeyAgreement: KeyPackage tests ──────────────────────────────────────

describe('SporeKeyAgreement: publishKeyPackage()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('publishes a kind:443 event with expected tags', async () => {
        const ka = new SporeKeyAgreement();
        const pool = makeMockPool();
        const eventId = await ka.publishKeyPackage('priv'.padEnd(64, '0'), pool);

        expect(eventId).toContain('mock-event-id-443');
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 443 })
        );
        const published = mockPublish.mock.calls[0][0] as { tags: string[][] };
        expect(published.tags).toContainEqual(['d', 'spore-kp']);
        expect(published.tags).toContainEqual(['version', '1']);
        expect(published.tags).toContainEqual(['cipher', SPORE_MLS_CIPHER]);
    });
});

describe('SporeKeyAgreement: fetchKeyPackages()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns empty map for empty pubkeys input', async () => {
        const ka = new SporeKeyAgreement();
        const pool = makeMockPool();
        const result = await ka.fetchKeyPackages([], pool);
        expect(result.size).toBe(0);
    });

    it('returns map of pubkey → eventId for found packages', async () => {
        const pk1 = 'a'.repeat(64);
        const pk2 = 'b'.repeat(64);
        const ka = new SporeKeyAgreement();
        const pool = makeMockPool(async () => [
            makeKeyPackageEvent(pk1),
            makeKeyPackageEvent(pk2),
        ]);

        const result = await ka.fetchKeyPackages([pk1, pk2], pool);
        expect(result.size).toBe(2);
        expect(result.get(pk1)!.pubkey).toBe(pk1);
        expect(result.get(pk2)!.pubkey).toBe(pk2);
    });

    it('keeps only the most recent event per pubkey', async () => {
        const pk = 'a'.repeat(64);
        const ka = new SporeKeyAgreement();
        const older = { ...makeKeyPackageEvent(pk, 500), id: 'old-kp' };
        const newer = { ...makeKeyPackageEvent(pk, 1500), id: 'new-kp' };
        const pool = makeMockPool(async () => [older, newer]);

        const result = await ka.fetchKeyPackages([pk], pool);
        expect(result.get(pk)!.eventId).toBe('new-kp');
    });

    it('drops events with invalid signatures', async () => {
        const { verifyEvent } = await import('nostr-tools');
        vi.mocked(verifyEvent).mockReturnValueOnce(false);

        const pk = 'a'.repeat(64);
        const ka = new SporeKeyAgreement();
        const pool = makeMockPool(async () => [makeKeyPackageEvent(pk)]);

        const result = await ka.fetchKeyPackages([pk], pool);
        expect(result.size).toBe(0);
    });
});

// ─── SporeKeyAgreement: Group Key Operations ──────────────────────────────────

describe('SporeKeyAgreement: createGroup()', () => {
    it('returns a valid group state with a 32-byte epoch key', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('group1', ['pk1'.padEnd(64, '0'), 'pk2'.padEnd(64, '0')]);

        expect(state.groupId).toBe('group1');
        expect(state.epoch).toBe(0);
        expect(state.epochKey).toBeInstanceOf(Uint8Array);
        expect(state.epochKey.length).toBe(32);
        expect(state.members).toHaveLength(2);
    });

    it('generates unique epoch keys on each call', () => {
        const ka = new SporeKeyAgreement();
        const s1 = ka.createGroup('g1', []);
        const s2 = ka.createGroup('g2', []);
        // Two independent groups should have different epoch keys
        expect(Buffer.from(s1.epochKey).equals(Buffer.from(s2.epochKey))).toBe(false);
    });
});

describe('SporeKeyAgreement: ratchetEpoch()', () => {
    it('increments epoch and changes the epoch key', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', ['pk'.padEnd(64, '0')]);
        const next = ka.ratchetEpoch(state);

        expect(next.epoch).toBe(1);
        expect(Buffer.from(next.epochKey).equals(Buffer.from(state.epochKey))).toBe(false);
        expect(next.groupId).toBe(state.groupId);
        expect(next.members).toEqual(state.members);
    });

    it('is deterministic — same input always produces same next key', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', []);
        const next1 = ka.ratchetEpoch(state);
        const next2 = ka.ratchetEpoch(state);

        expect(Buffer.from(next1.epochKey).equals(Buffer.from(next2.epochKey))).toBe(true);
    });

    it('produces a chain: epoch 0 → 1 → 2 → all different', () => {
        const ka = new SporeKeyAgreement();
        const s0 = ka.createGroup('g', []);
        const s1 = ka.ratchetEpoch(s0);
        const s2 = ka.ratchetEpoch(s1);

        expect(s2.epoch).toBe(2);
        expect(Buffer.from(s0.epochKey).equals(Buffer.from(s2.epochKey))).toBe(false);
        expect(Buffer.from(s1.epochKey).equals(Buffer.from(s2.epochKey))).toBe(false);
    });
});

// ─── SporeKeyAgreement: Welcome encode/decode round-trip ─────────────────────

describe('SporeKeyAgreement: Welcome encode/decode', () => {
    it('encodes and parses a Welcome round-trip', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('group-abc', ['pk1'.padEnd(64, '0')]);
        const payload = ka.buildWelcomePayload(state);
        const content = ka.encodeWelcomeDmContent(payload);

        expect(content.startsWith(SPORE_MLS_WELCOME_PREFIX)).toBe(true);

        const parsed = ka.parseWelcomeDmContent(content);
        expect(parsed).not.toBeNull();
        expect(parsed!.type).toBe('spore-mls-welcome');
        expect(parsed!.groupId).toBe('group-abc');
        expect(parsed!.epoch).toBe(0);
        expect(parsed!.cipher).toBe(SPORE_MLS_CIPHER);
        expect(parsed!.members).toEqual(state.members);
    });

    it('returns null for non-Welcome DM content', () => {
        const ka = new SporeKeyAgreement();
        expect(ka.parseWelcomeDmContent('Hello world')).toBeNull();
        expect(ka.parseWelcomeDmContent('')).toBeNull();
        expect(ka.parseWelcomeDmContent(SPORE_MLS_WELCOME_PREFIX + 'not-json')).toBeNull();
    });

    it('returns null if type field is wrong', () => {
        const ka = new SporeKeyAgreement();
        const bad = SPORE_MLS_WELCOME_PREFIX + JSON.stringify({ type: 'other', groupId: 'g', epochKeyHex: 'ab', epoch: 0, members: [] });
        expect(ka.parseWelcomeDmContent(bad)).toBeNull();
    });

    it('processWelcome reconstructs correct MlsGroupState', () => {
        const ka = new SporeKeyAgreement();
        const original = ka.createGroup('g2', ['pk'.padEnd(64, '0')]);
        const payload = ka.buildWelcomePayload(original);
        const recovered = ka.processWelcome(payload);

        expect(recovered.groupId).toBe(original.groupId);
        expect(recovered.epoch).toBe(original.epoch);
        expect(Buffer.from(recovered.epochKey).equals(Buffer.from(original.epochKey))).toBe(true);
        expect(recovered.members).toEqual(original.members);
    });
});

// ─── SporeKeyAgreement: Group message encryption ─────────────────────────────

describe('SporeKeyAgreement: encryptGroupMessage / decryptGroupMessage', () => {
    it('encrypt/decrypt round-trip with same epoch key', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', []);
        const plaintext = 'Hello, MLS group!';

        const ct = ka.encryptGroupMessage(plaintext, state.epochKey);
        const pt = ka.decryptGroupMessage(ct, state.epochKey);

        expect(pt).toBe(plaintext);
    });

    it('decryption throws with wrong epoch key', () => {
        const ka = new SporeKeyAgreement();
        const s1 = ka.createGroup('g1', []);
        const s2 = ka.createGroup('g2', []);  // different key

        const ct = ka.encryptGroupMessage('secret', s1.epochKey);
        expect(() => ka.decryptGroupMessage(ct, s2.epochKey)).toThrow();
    });

    it('ciphertext is different on each call (random nonce)', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', []);
        const ct1 = ka.encryptGroupMessage('same', state.epochKey);
        const ct2 = ka.encryptGroupMessage('same', state.epochKey);
        // NIP-44 uses random nonce, so ciphertexts should differ
        expect(ct1).not.toBe(ct2);
    });
});

describe('SporeKeyAgreement: buildGroupMessageEvent()', () => {
    it('builds a kind:445 event with correct tags', () => {
        const ka = new SporeKeyAgreement();
        const ev = ka.buildGroupMessageEvent('priv'.padEnd(64, '0'), 'group1', 3, 'encrypted-ct');

        expect(ev.kind).toBe(445);
        expect(ev.content).toBe('encrypted-ct');
        expect(ev.tags).toContainEqual(['h', 'group1']);
        expect(ev.tags).toContainEqual(['epoch', '3']);
    });
});

// ─── SporeAgent M9 tests ──────────────────────────────────────────────────────

describe('SporeAgent M9: publishKeyPackage()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('publishes kind:443 KeyPackage to pool', async () => {
        await agent.publishKeyPackage();
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 443 })
        );
    });
});

describe('SporeAgent M9: fetchKeyPackages()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns empty map when no packages found', async () => {
        const result = await agent.fetchKeyPackages(['a'.repeat(64)]);
        expect(result.size).toBe(0);
    });

    it('fetches packages for given pubkeys', async () => {
        const pk = 'a'.repeat(64);
        mockFetchEventsImpl = async () => [makeKeyPackageEvent(pk)];

        const result = await agent.fetchKeyPackages([pk]);
        expect(result.size).toBe(1);
        expect(result.has(pk)).toBe(true);
    });
});

describe('SporeAgent M9: createMlsGroup()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns a valid MlsGroupState', async () => {
        const member1 = 'mem1'.padEnd(64, '0');
        const state = await agent.createMlsGroup([member1]);

        expect(state.groupId).toHaveLength(64);  // 32-byte hex
        expect(state.epoch).toBe(0);
        expect(state.epochKey).toBeInstanceOf(Uint8Array);
        expect(state.epochKey.length).toBe(32);
        expect(state.members).toContain('self'.padEnd(64, '0'));
        expect(state.members).toContain(member1);
    });

    it('sends a Welcome DM to each member', async () => {
        const m1 = 'mem1'.padEnd(64, '0');
        const m2 = 'mem2'.padEnd(64, '0');
        await agent.createMlsGroup([m1, m2]);

        expect(mockSendDm).toHaveBeenCalledTimes(2);
        const [call1, call2] = mockSendDm.mock.calls as [{ recipientPubkeyHex: string; content: string }[], { recipientPubkeyHex: string; content: string }[]];
        const recipients = [call1[0].recipientPubkeyHex, call2[0].recipientPubkeyHex];
        expect(recipients).toContain(m1);
        expect(recipients).toContain(m2);

        // DM content must be a Welcome
        expect(call1[0].content.startsWith(SPORE_MLS_WELCOME_PREFIX)).toBe(true);
    });

    it('uses provided groupId', async () => {
        const state = await agent.createMlsGroup([], 'my-custom-group-id');
        expect(state.groupId).toBe('my-custom-group-id');
    });

    it('sends no DMs when no members are invited', async () => {
        await agent.createMlsGroup([]);
        expect(mockSendDm).not.toHaveBeenCalled();
    });
});

describe('SporeAgent M9: sendMlsMessage()', () => {
    let agent: SporeAgent;
    let groupState: MlsGroupState;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
        groupState = await agent.createMlsGroup([]);
        mockPublish.mockClear();
    });

    it('publishes a kind:445 event', async () => {
        const { eventId } = await agent.sendMlsMessage(groupState, 'Hello group');
        expect(eventId).toContain('mock-event-id-445');
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 445 })
        );
    });

    it('returns same state when ratchet=false', async () => {
        const { updatedState } = await agent.sendMlsMessage(groupState, 'msg', false);
        expect(updatedState.epoch).toBe(groupState.epoch);
        expect(Buffer.from(updatedState.epochKey).equals(Buffer.from(groupState.epochKey))).toBe(true);
    });

    it('returns ratcheted state when ratchet=true', async () => {
        const { updatedState } = await agent.sendMlsMessage(groupState, 'msg', true);
        expect(updatedState.epoch).toBe(1);
        expect(Buffer.from(updatedState.epochKey).equals(Buffer.from(groupState.epochKey))).toBe(false);
    });
});

describe('SporeAgent M9: decryptMlsMessage()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns null for events with wrong kind', () => {
        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', []);
        const ct = ka.encryptGroupMessage('secret', state.epochKey);
        const fakeEvent = { kind: 1, content: ct, id: 'x', pubkey: 'a'.repeat(64), sig: 'y'.repeat(128), created_at: 1, tags: [] } as never;

        expect(agent.decryptMlsMessage(fakeEvent, state.epochKey)).toBeNull();
    });

    it('returns null when verifyEvent returns false', async () => {
        const { verifyEvent } = await import('nostr-tools');
        vi.mocked(verifyEvent).mockReturnValueOnce(false);

        const ka = new SporeKeyAgreement();
        const state = ka.createGroup('g', []);
        const ct = ka.encryptGroupMessage('secret', state.epochKey);
        const ev = { kind: 445, content: ct, id: 'x', pubkey: 'a'.repeat(64), sig: 'y'.repeat(128), created_at: 1, tags: [['h', 'g'], ['epoch', '0']] } as never;

        expect(agent.decryptMlsMessage(ev, state.epochKey)).toBeNull();
    });
});

describe('SporeAgent M9: processWelcome()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetchEventsImpl = async () => [];
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('parses a valid Welcome DM content', async () => {
        const ka = new SporeKeyAgreement();
        const original = ka.createGroup('g-welcome', ['pk'.padEnd(64, '0')]);
        const payload = ka.buildWelcomePayload(original);
        const dmContent = ka.encodeWelcomeDmContent(payload);

        const result = agent.processWelcome(dmContent);
        expect(result).not.toBeNull();
        expect(result!.groupId).toBe('g-welcome');
        expect(result!.epoch).toBe(0);
        expect(Buffer.from(result!.epochKey).equals(Buffer.from(original.epochKey))).toBe(true);
    });

    it('returns null for non-Welcome DM content', () => {
        expect(agent.processWelcome('Just a regular message')).toBeNull();
        expect(agent.processWelcome('')).toBeNull();
    });

    it('round-trip: createMlsGroup sender → processWelcome receiver', async () => {
        const member = 'mem1'.padEnd(64, '0');
        const senderState = await agent.createMlsGroup([member]);

        // Extract the DM content that was sent to member
        const dmContent = (mockSendDm.mock.calls[0] as [{ content: string }])[0].content;

        // Member processes it
        const receiverState = agent.processWelcome(dmContent);
        expect(receiverState).not.toBeNull();
        expect(receiverState!.groupId).toBe(senderState.groupId);
        expect(Buffer.from(receiverState!.epochKey).equals(Buffer.from(senderState.epochKey))).toBe(true);
        expect(receiverState!.members).toEqual(senderState.members);
    });
});
