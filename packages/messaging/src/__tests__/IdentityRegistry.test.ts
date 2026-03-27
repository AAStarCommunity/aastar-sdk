// Unit tests for M8 Identity Registry + Multi-Device:
//   SporeIdentityRegistry (publishProfile, fetchProfile, fetchProfiles)
//   SporeIdentityRegistry (publishDeviceList, fetchDeviceList, isLinkedDevice)
//   SporeAgent (publishProfile, fetchProfile, linkDevice, unlinkDevice, getLinkedDevices)
//
// Strategy:
//   - Mock RelayPool.fetchEvents() to return controlled kind:0 / kind:10001 events.
//   - Mock RelayPool.publish() to capture published events for assertion.
//   - Mock nostr-tools finalizeEvent so we don't need real crypto in the registry unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SporeIdentityRegistry } from '../identity/SporeIdentityRegistry.js';
import { SporeAgent } from '../SporeAgent.js';
import type { IdentityProfile, LinkedDevice } from '../identity/SporeIdentityRegistry.js';

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
            sendDm: vi.fn(),
            sendGroupMessage: vi.fn(),
            sendGroupMeta: vi.fn().mockResolvedValue(''),
            sendGroupMembership: vi.fn().mockResolvedValue(''),
            decryptDm: vi.fn().mockReturnValue(null),
            decodeGroup: vi.fn().mockReturnValue(null),
        })),
    };
});

// Mock nostr-tools: finalizeEvent produces deterministic test events;
// verifyEvent always returns true so relay-sig checks don't block test fixtures.
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

function makeKind0Event(pubkey: string, contentObj: Record<string, unknown>) {
    return {
        id: 'ev-' + pubkey.slice(0, 8),
        pubkey,
        kind: 0,
        created_at: 1000,
        tags: [],
        content: JSON.stringify(contentObj),
        sig: 'x'.repeat(128),
    };
}

function makeKind10001Event(pubkey: string, devices: { pubkey: string; label?: string }[], createdAt = 1000) {
    return {
        id: 'dev-ev-' + pubkey.slice(0, 8),
        pubkey,
        kind: 10001,
        created_at: createdAt,
        tags: [
            ['d', 'spore-devices'],
            ...devices.map((d) => d.label ? ['p', d.pubkey, d.label] : ['p', d.pubkey]),
        ],
        content: '',
        sig: 'x'.repeat(128),
    };
}

// Minimal mock RelayPool for registry direct tests
function makeMockPool(fetchImpl: (filter: unknown) => Promise<unknown[]> = async () => []) {
    return {
        publish: mockPublish,
        fetchEvents: vi.fn().mockImplementation(fetchImpl),
    } as never;
}

// ─── SporeIdentityRegistry tests ─────────────────────────────────────────────

describe('SporeIdentityRegistry: publishProfile()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('publishes a kind:0 event with profile fields', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool());
        const eventId = await registry.publishProfile('priv'.padEnd(64, '0'), {
            name: 'Alice',
            about: 'Spore dev',
            ethAddress: '0x' + 'a'.repeat(40) as `0x${string}`,
        });

        expect(eventId).toContain('mock-event-id-0');
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 0 })
        );
        const published = mockPublish.mock.calls[0][0] as { content: string };
        const content = JSON.parse(published.content);
        expect(content.name).toBe('Alice');
        expect(content.about).toBe('Spore dev');
        expect(content.eth_address).toBe('0x' + 'a'.repeat(40));
    });

    it('omits undefined fields from content', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool());
        await registry.publishProfile('priv'.padEnd(64, '0'), {});

        const published = mockPublish.mock.calls[0][0] as { content: string };
        const content = JSON.parse(published.content);
        expect(Object.keys(content)).toHaveLength(0);
    });

    it('extra fields cannot override reserved keys (eth_address)', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool());
        const realAddress = '0x' + 'a'.repeat(40) as `0x${string}`;
        await registry.publishProfile('priv'.padEnd(64, '0'), {
            ethAddress: realAddress,
            extra: { eth_address: '0xattacker' + 'b'.repeat(31) },
        });

        const published = mockPublish.mock.calls[0][0] as { content: string };
        const content = JSON.parse(published.content);
        expect(content.eth_address).toBe(realAddress);
    });
});

describe('SporeIdentityRegistry: fetchProfile()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns null when no events found', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool(async () => []));
        const profile = await registry.fetchProfile('a'.repeat(64));
        expect(profile).toBeNull();
    });

    it('parses kind:0 event into IdentityProfile', async () => {
        const pubkey = 'a'.repeat(64);
        const ev = makeKind0Event(pubkey, {
            name: 'Bob',
            about: 'Test user',
            eth_address: '0x' + 'b'.repeat(40),
        });
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        const profile = await registry.fetchProfile(pubkey);
        expect(profile).not.toBeNull();
        expect(profile!.nostrPubkey).toBe(pubkey);
        expect(profile!.name).toBe('Bob');
        expect(profile!.about).toBe('Test user');
        expect(profile!.ethAddress).toBe('0x' + 'b'.repeat(40));
    });

    it('returns most recent event when multiple returned', async () => {
        const pubkey = 'a'.repeat(64);
        const older = { ...makeKind0Event(pubkey, { name: 'OldName' }), created_at: 500 };
        const newer = { ...makeKind0Event(pubkey, { name: 'NewName' }), created_at: 1500 };
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [older, newer]));

        const profile = await registry.fetchProfile(pubkey);
        expect(profile!.name).toBe('NewName');
    });

    it('silently ignores malformed kind:0 content', async () => {
        const pubkey = 'a'.repeat(64);
        const ev = { ...makeKind0Event(pubkey, {}), content: 'not-json' };
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        const profile = await registry.fetchProfile(pubkey);
        expect(profile).toBeNull();
    });

    it('drops events with invalid signatures (malicious relay)', async () => {
        const { verifyEvent } = await import('nostr-tools');
        vi.mocked(verifyEvent).mockReturnValueOnce(false);

        const pubkey = 'a'.repeat(64);
        const ev = makeKind0Event(pubkey, { name: 'Attacker' });
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        const profile = await registry.fetchProfile(pubkey);
        expect(profile).toBeNull();
    });
});

describe('SporeIdentityRegistry: fetchProfiles()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns empty Map for empty input', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool());
        const result = await registry.fetchProfiles([]);
        expect(result.size).toBe(0);
    });

    it('returns Map with profiles for found pubkeys', async () => {
        const pk1 = 'a'.repeat(64);
        const pk2 = 'b'.repeat(64);
        const evs = [
            makeKind0Event(pk1, { name: 'Alice' }),
            makeKind0Event(pk2, { name: 'Bob' }),
        ];
        const registry = new SporeIdentityRegistry(makeMockPool(async () => evs));

        const result = await registry.fetchProfiles([pk1, pk2]);
        expect(result.size).toBe(2);
        expect(result.get(pk1)!.name).toBe('Alice');
        expect(result.get(pk2)!.name).toBe('Bob');
    });
});

describe('SporeIdentityRegistry: device list', () => {
    beforeEach(() => vi.clearAllMocks());

    it('publishDeviceList publishes kind:10001 with p tags', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool());
        const devices: LinkedDevice[] = [
            { pubkey: 'dev1'.padEnd(64, '0'), label: 'iPhone 15' },
            { pubkey: 'dev2'.padEnd(64, '0') },
        ];
        await registry.publishDeviceList('priv'.padEnd(64, '0'), devices);

        const published = mockPublish.mock.calls[0][0] as { kind: number; tags: string[][] };
        expect(published.kind).toBe(10001);
        expect(published.tags).toContainEqual(['d', 'spore-devices']);
        expect(published.tags).toContainEqual(['p', 'dev1'.padEnd(64, '0'), 'iPhone 15']);
        expect(published.tags).toContainEqual(['p', 'dev2'.padEnd(64, '0')]);
    });

    it('fetchDeviceList returns empty array when no events', async () => {
        const registry = new SporeIdentityRegistry(makeMockPool(async () => []));
        const devices = await registry.fetchDeviceList('a'.repeat(64));
        expect(devices).toEqual([]);
    });

    it('fetchDeviceList parses p tags into LinkedDevice[]', async () => {
        const primaryPubkey = 'a'.repeat(64);
        const ev = makeKind10001Event(primaryPubkey, [
            { pubkey: 'dev1'.padEnd(64, '0'), label: 'Phone' },
            { pubkey: 'dev2'.padEnd(64, '0') },
        ]);
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        const devices = await registry.fetchDeviceList(primaryPubkey);
        expect(devices).toHaveLength(2);
        expect(devices[0]!.pubkey).toBe('dev1'.padEnd(64, '0'));
        expect(devices[0]!.label).toBe('Phone');
        expect(devices[1]!.pubkey).toBe('dev2'.padEnd(64, '0'));
        expect(devices[1]!.label).toBeUndefined();
    });

    it('isLinkedDevice returns true for linked device', async () => {
        const primaryPubkey = 'a'.repeat(64);
        const devPubkey = 'dev'.padEnd(64, '0');
        const ev = makeKind10001Event(primaryPubkey, [{ pubkey: devPubkey }]);
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        expect(await registry.isLinkedDevice(primaryPubkey, devPubkey)).toBe(true);
    });

    it('isLinkedDevice returns false for unlinked device', async () => {
        const primaryPubkey = 'a'.repeat(64);
        const ev = makeKind10001Event(primaryPubkey, [{ pubkey: 'other'.padEnd(64, '0') }]);
        const registry = new SporeIdentityRegistry(makeMockPool(async () => [ev]));

        expect(await registry.isLinkedDevice(primaryPubkey, 'ghost'.padEnd(64, '0'))).toBe(false);
    });
});

// ─── SporeAgent M8 tests ──────────────────────────────────────────────────────

describe('SporeAgent M8: publishProfile()', () => {
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

    it('publishes profile and auto-includes eth address', async () => {
        await agent.publishProfile({ name: 'Alice' });
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 0 })
        );
        const published = mockPublish.mock.calls[0][0] as { content: string };
        const content = JSON.parse(published.content);
        expect(content.name).toBe('Alice');
        expect(content.eth_address).toBe('0xSelf' + 'a'.repeat(35));
    });
});

describe('SporeAgent M8: fetchProfile()', () => {
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

    it('fetches own profile by default', async () => {
        const ev = makeKind0Event('self'.padEnd(64, '0'), { name: 'Self' });
        mockFetchEventsImpl = async () => [ev];

        const profile = await agent.fetchProfile();
        expect(profile!.name).toBe('Self');
        expect(profile!.nostrPubkey).toBe('self'.padEnd(64, '0'));
    });

    it('fetches another pubkey profile', async () => {
        const otherPubkey = 'other'.padEnd(64, '0');
        const ev = makeKind0Event(otherPubkey, { name: 'Other' });
        mockFetchEventsImpl = async () => [ev];

        const profile = await agent.fetchProfile(otherPubkey);
        expect(profile!.name).toBe('Other');
    });
});

describe('SporeAgent M8: linkDevice / unlinkDevice / getLinkedDevices', () => {
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

    it('linkDevice publishes device list with new device', async () => {
        const devPubkey = 'dev1'.padEnd(64, '0');
        await agent.linkDevice(devPubkey, { label: 'iPad' });

        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 10001 })
        );
        const published = mockPublish.mock.calls[0][0] as { tags: string[][] };
        expect(published.tags).toContainEqual(['p', devPubkey, 'iPad']);
    });

    it('linkDevice is idempotent — returns empty string if already linked', async () => {
        const devPubkey = 'dev1'.padEnd(64, '0');
        // Simulate device already in relay
        mockFetchEventsImpl = async () => [
            makeKind10001Event('self'.padEnd(64, '0'), [{ pubkey: devPubkey }]),
        ];

        const result = await agent.linkDevice(devPubkey);
        expect(result).toBe('');
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('linkDevice appends to existing device list', async () => {
        const existingDevice = 'dev0'.padEnd(64, '0');
        const newDevice = 'dev1'.padEnd(64, '0');
        // Simulate existing device list
        mockFetchEventsImpl = async () => [
            makeKind10001Event('self'.padEnd(64, '0'), [{ pubkey: existingDevice }]),
        ];

        await agent.linkDevice(newDevice);

        const published = mockPublish.mock.calls[0][0] as { tags: string[][] };
        const pTags = published.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
        expect(pTags).toContain(existingDevice);
        expect(pTags).toContain(newDevice);
    });

    it('unlinkDevice removes device and republishes', async () => {
        const dev1 = 'dev1'.padEnd(64, '0');
        const dev2 = 'dev2'.padEnd(64, '0');
        mockFetchEventsImpl = async () => [
            makeKind10001Event('self'.padEnd(64, '0'), [{ pubkey: dev1 }, { pubkey: dev2 }]),
        ];

        await agent.unlinkDevice(dev1);

        const published = mockPublish.mock.calls[0][0] as { tags: string[][] };
        const pTags = published.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
        expect(pTags).not.toContain(dev1);
        expect(pTags).toContain(dev2);
    });

    it('unlinkDevice is a no-op when device not in list', async () => {
        mockFetchEventsImpl = async () => [];
        const result = await agent.unlinkDevice('ghost'.padEnd(64, '0'));
        expect(result).toBe('');
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('getLinkedDevices returns device list for self', async () => {
        const dev = 'dev1'.padEnd(64, '0');
        mockFetchEventsImpl = async () => [
            makeKind10001Event('self'.padEnd(64, '0'), [{ pubkey: dev, label: 'Phone' }]),
        ];

        const devices = await agent.getLinkedDevices();
        expect(devices).toHaveLength(1);
        expect(devices[0]!.pubkey).toBe(dev);
        expect(devices[0]!.label).toBe('Phone');
    });

    it('getLinkedDevices can query another identity', async () => {
        const otherPrimary = 'other'.padEnd(64, '0');
        const dev = 'dev1'.padEnd(64, '0');
        mockFetchEventsImpl = async () => [
            makeKind10001Event(otherPrimary, [{ pubkey: dev }]),
        ];

        const devices = await agent.getLinkedDevices(otherPrimary);
        expect(devices).toHaveLength(1);
        expect(devices[0]!.pubkey).toBe(dev);
    });

    it('isLinkedDevice checks device membership', async () => {
        const primary = 'primary'.padEnd(64, '0');
        const dev = 'dev1'.padEnd(64, '0');
        mockFetchEventsImpl = async () => [
            makeKind10001Event(primary, [{ pubkey: dev }]),
        ];

        expect(await agent.isLinkedDevice(primary, dev)).toBe(true);
        expect(await agent.isLinkedDevice(primary, 'notlinked'.padEnd(64, '0'))).toBe(false);
    });
});
