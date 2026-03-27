import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '../context/SporeContext.js';
import { useGroup } from '../hooks/useGroup.js';
import type { GroupInfo, SporeMessage, SporeConversation } from '@aastar/messaging';

const GROUP_ID = 'group-abc123';

function makeGroupInfo(): GroupInfo {
  return {
    id: GROUP_ID,
    topic: 'Coffee lovers',
    members: ['alice', 'bob'],
    createdAt: 1000,
  };
}

function makeMsg(id: string): SporeMessage {
  return {
    id,
    senderPubkey: 'alice',
    content: 'hello group',
    contentType: 'text',
    sentAt: 1001,
    conversation: { id: GROUP_ID, type: 'group', members: [], createdAt: 1000 } as SporeConversation,
    rawEvent: {} as never,
  };
}

async function* neverStream() { await new Promise(() => {}); }

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'agent-pubkey',
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    getGroupInfo: vi.fn(),
    getMessages: vi.fn(),
    streamAllMessages: vi.fn(),
    sendGroupMessage: vi.fn().mockResolvedValue('hash-send'),
    addGroupMember: vi.fn().mockResolvedValue(undefined),
    removeGroupMember: vi.fn().mockResolvedValue(undefined),
  };
  return { mockAgent: agent };
});

vi.mock('@aastar/messaging', () => ({
  SporeAgent: { create: vi.fn().mockResolvedValue(mockAgent) },
}));

const PRIVKEY = 'aa'.repeat(32);
function wrapper({ children }: { children: ReactNode }) {
  return <SporeProvider privateKeyHex={PRIVKEY}>{children}</SporeProvider>;
}

describe('useGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.getGroupInfo.mockReturnValue(makeGroupInfo());
    mockAgent.getMessages.mockResolvedValue([makeMsg('msg-1')]);
    mockAgent.streamAllMessages.mockReturnValue(neverStream());
    mockAgent.stop.mockResolvedValue(undefined);
    mockAgent.sendGroupMessage.mockResolvedValue('hash-send');
    mockAgent.addGroupMember.mockResolvedValue(undefined);
    mockAgent.removeGroupMember.mockResolvedValue(undefined);
  });

  it('loads group info on mount', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.info?.topic).toBe('Coffee lovers');
  });

  it('loads message history', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]!.id).toBe('msg-1');
  });

  it('sendText calls agent.sendGroupMessage with groupId and members', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.sendText('hi'); });
    expect(mockAgent.sendGroupMessage).toHaveBeenCalledWith(
      GROUP_ID,
      expect.arrayContaining(['alice', 'bob']),
      'hi',
    );
  });

  it('addMember calls agent.addGroupMember and refreshes info', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.addMember('charlie'); });
    expect(mockAgent.addGroupMember).toHaveBeenCalledWith(GROUP_ID, 'charlie');
    expect(mockAgent.getGroupInfo).toHaveBeenCalledTimes(2); // mount + refresh
  });

  it('removeMember calls agent.removeGroupMember', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.removeMember('bob'); });
    expect(mockAgent.removeGroupMember).toHaveBeenCalledWith(GROUP_ID, 'bob');
  });
});
