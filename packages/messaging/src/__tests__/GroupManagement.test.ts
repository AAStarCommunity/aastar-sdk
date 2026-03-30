// Unit tests for M6 Group Management API:
//   agent.createGroup()
//   agent.addGroupMember()
//   agent.removeGroupMember()
//   agent.getGroupInfo()
//
// Strategy:
//   - Mock RelayPool and NostrTransport so no real I/O occurs.
//   - Verify that management methods update knownConversations state correctly
//     and call the appropriate NostrTransport methods with the right arguments.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SporeAgent } from '../SporeAgent.js';
import type { SporeConversation } from '../types.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../identity/AirAccountIdentity.js', () => ({
    createIdentity: vi.fn().mockResolvedValue({
        pubkey: 'self'.padEnd(64, '0'),
        address: '0x' + 'a'.repeat(40),
        privateKeyHex: 'abcd'.padEnd(64, '0'),
    }),
    createIdentityFromEnv: vi.fn(),
}));

const mockFetchEvents = vi.fn().mockResolvedValue([]);
const mockPublish = vi.fn().mockResolvedValue([]);
const mockSubscribe = vi.fn().mockReturnValue(() => {});
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('../relay/RelayPool.js', () => ({
    DEFAULT_RELAYS: ['ws://localhost:9999'],
    parseRelaysFromEnv: vi.fn().mockReturnValue([]),
    RelayPool: vi.fn().mockImplementation(() => ({
        connectedRelays: ['ws://localhost:9999'],
        publish: mockPublish,
        subscribe: mockSubscribe,
        subscribeMany: vi.fn().mockReturnValue(() => {}),
        fetchEvents: mockFetchEvents,
        close: mockClose,
    })),
}));

const mockSendGroupMeta = vi.fn().mockResolvedValue('meta-event-id');
const mockSendGroupMembership = vi.fn().mockResolvedValue('membership-event-id');
const mockSendDm = vi.fn();
const mockSendGroupMessage = vi.fn();

vi.mock('../transport/NostrTransport.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../transport/NostrTransport.js')>();
    return {
        ...actual,
        NostrTransport: vi.fn().mockImplementation(() => ({
            subscribeToDms: vi.fn().mockReturnValue(() => {}),
            subscribeToGroups: vi.fn().mockReturnValue(() => {}),
            sendDm: mockSendDm,
            sendGroupMessage: mockSendGroupMessage,
            sendGroupMeta: mockSendGroupMeta,
            sendGroupMembership: mockSendGroupMembership,
            decryptDm: vi.fn().mockReturnValue(null),
            decodeGroup: vi.fn().mockReturnValue(null),
        })),
    };
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function injectConversation(agent: SporeAgent, conv: SporeConversation): void {
    (agent as unknown as { knownConversations: Map<string, SporeConversation> })
        .knownConversations.set(conv.id, conv);
}

const SELF_PUBKEY = 'self'.padEnd(64, '0');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('M6: createGroup()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'abcd'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns a SporeConversation with type=group', async () => {
        const conv = await agent.createGroup();
        expect(conv.type).toBe('group');
        expect(conv.id).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('always includes self in members', async () => {
        const conv = await agent.createGroup();
        expect(conv.members).toContain(SELF_PUBKEY);
    });

    it('includes initialMembers when provided', async () => {
        const member1 = 'm1'.padEnd(64, '0');
        const member2 = 'm2'.padEnd(64, '0');
        const conv = await agent.createGroup({ initialMembers: [member1, member2] });
        expect(conv.members).toContain(member1);
        expect(conv.members).toContain(member2);
    });

    it('stores the group in knownConversations', async () => {
        const conv = await agent.createGroup({ topic: 'Test Group' });
        expect(agent.getGroupInfo(conv.id)).not.toBeNull();
        expect(agent.getGroupInfo(conv.id)!.id).toBe(conv.id);
    });

    it('publishes kind:9000 meta event when topic is provided', async () => {
        await agent.createGroup({ topic: 'My Group' });
        expect(mockSendGroupMeta).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Group' })
        );
    });

    it('does NOT publish meta event when no topic is given', async () => {
        await agent.createGroup();
        expect(mockSendGroupMeta).not.toHaveBeenCalled();
    });

    it('publishes kind:9001 add event for initialMembers', async () => {
        const member = 'm1'.padEnd(64, '0');
        const { KIND_GROUP_ADD } = await import('../transport/NostrTransport.js');
        await agent.createGroup({ initialMembers: [member] });
        expect(mockSendGroupMembership).toHaveBeenCalledWith(
            expect.objectContaining({ kind: KIND_GROUP_ADD, memberPubkeys: [member] })
        );
    });

    it('does NOT publish membership event when no initialMembers', async () => {
        await agent.createGroup();
        expect(mockSendGroupMembership).not.toHaveBeenCalled();
    });

    it('sets createdAt to approximately now', async () => {
        const before = Math.floor(Date.now() / 1000) - 1;
        const conv = await agent.createGroup();
        const after = Math.floor(Date.now() / 1000) + 1;
        expect(conv.createdAt).toBeGreaterThanOrEqual(before);
        expect(conv.createdAt).toBeLessThanOrEqual(after);
    });
});

describe('M6: addGroupMember()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'abcd'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('throws if group is not found', async () => {
        await expect(agent.addGroupMember('no-such-group', 'pubkey')).rejects.toThrow(
            /not found/
        );
    });

    it('throws if conversation is not a group', async () => {
        injectConversation(agent, {
            id: 'dm-conv',
            type: 'dm',
            members: [SELF_PUBKEY, 'other'.padEnd(64, '0')],
            createdAt: 1000,
        });
        await expect(agent.addGroupMember('dm-conv', 'pubkey')).rejects.toThrow(/not found/);
    });

    it('adds the member to the conversation', async () => {
        const conv = await agent.createGroup();
        vi.clearAllMocks();

        const newMember = 'new'.padEnd(64, '0');
        await agent.addGroupMember(conv.id, newMember);

        const info = agent.getGroupInfo(conv.id)!;
        expect(info.members).toContain(newMember);
    });

    it('publishes kind:9001 event', async () => {
        const conv = await agent.createGroup();
        vi.clearAllMocks();

        const { KIND_GROUP_ADD } = await import('../transport/NostrTransport.js');
        const newMember = 'new'.padEnd(64, '0');
        await agent.addGroupMember(conv.id, newMember);

        expect(mockSendGroupMembership).toHaveBeenCalledWith(
            expect.objectContaining({ kind: KIND_GROUP_ADD, memberPubkeys: [newMember] })
        );
    });

    it('is idempotent — does not add duplicate members', async () => {
        const conv = await agent.createGroup({ initialMembers: ['existing'.padEnd(64, '0')] });
        vi.clearAllMocks();

        await agent.addGroupMember(conv.id, 'existing'.padEnd(64, '0'));

        // No transport call since member already in group
        expect(mockSendGroupMembership).not.toHaveBeenCalled();
        // Member count unchanged
        const info = agent.getGroupInfo(conv.id)!;
        const count = info.members.filter((m) => m === 'existing'.padEnd(64, '0')).length;
        expect(count).toBe(1);
    });
});

describe('M6: removeGroupMember()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'abcd'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('throws if group is not found', async () => {
        await expect(agent.removeGroupMember('ghost', 'pk')).rejects.toThrow(/not found/);
    });

    it('removes the member from the conversation', async () => {
        const member = 'rem'.padEnd(64, '0');
        const conv = await agent.createGroup({ initialMembers: [member] });
        vi.clearAllMocks();

        await agent.removeGroupMember(conv.id, member);

        const info = agent.getGroupInfo(conv.id)!;
        expect(info.members).not.toContain(member);
    });

    it('publishes kind:9002 event', async () => {
        const member = 'rem'.padEnd(64, '0');
        const conv = await agent.createGroup({ initialMembers: [member] });
        vi.clearAllMocks();

        const { KIND_GROUP_REMOVE } = await import('../transport/NostrTransport.js');
        await agent.removeGroupMember(conv.id, member);

        expect(mockSendGroupMembership).toHaveBeenCalledWith(
            expect.objectContaining({ kind: KIND_GROUP_REMOVE, memberPubkeys: [member] })
        );
    });

    it('is idempotent — silently does nothing if member not in group', async () => {
        const conv = await agent.createGroup();
        vi.clearAllMocks();

        await agent.removeGroupMember(conv.id, 'not-a-member'.padEnd(64, '0'));
        expect(mockSendGroupMembership).not.toHaveBeenCalled();
    });
});

describe('M6: getGroupInfo()', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'abcd'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('returns null for unknown group', () => {
        expect(agent.getGroupInfo('ghost')).toBeNull();
    });

    it('returns null for a DM conversation', () => {
        injectConversation(agent, {
            id: 'dm-id',
            type: 'dm',
            members: [SELF_PUBKEY],
            createdAt: 1000,
        });
        expect(agent.getGroupInfo('dm-id')).toBeNull();
    });

    it('returns GroupInfo with correct fields', async () => {
        const member = 'mem'.padEnd(64, '0');
        const conv = await agent.createGroup({ topic: 'Test Chat', initialMembers: [member] });

        const info = agent.getGroupInfo(conv.id)!;
        expect(info.id).toBe(conv.id);
        expect(info.topic).toBe('Test Chat');
        expect(info.members).toContain(SELF_PUBKEY);
        expect(info.members).toContain(member);
        expect(typeof info.createdAt).toBe('number');
    });

    it('returns a copy of members — mutations do not affect stored state', async () => {
        const conv = await agent.createGroup();
        const info = agent.getGroupInfo(conv.id)!;
        const originalLen = info.members.length;

        // Mutate the returned array
        info.members.push('injected'.padEnd(64, '0'));

        // Stored state should be unchanged
        expect(agent.getGroupInfo(conv.id)!.members).toHaveLength(originalLen);
    });
});
