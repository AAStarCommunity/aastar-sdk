import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '../context/SporeContext.js';
import { useConversations } from '../hooks/useConversations.js';
import type { SporeConversation } from '@aastar/messaging';

function makeConv(id: string): SporeConversation {
  return { id, type: 'dm', members: ['alice', 'bob'], createdAt: 1000 };
}

async function* neverStream() { await new Promise(() => {}); }

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'agent-pubkey',
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    listConversations: vi.fn(),
    streamAllMessages: vi.fn(),
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

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.listConversations.mockReturnValue([makeConv('conv-1')]);
    mockAgent.streamAllMessages.mockReturnValue(neverStream());
    mockAgent.stop.mockResolvedValue(undefined);
  });

  it('returns conversations from agent', async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]!.id).toBe('conv-1');
  });

  it('refresh() re-fetches conversation list', async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockAgent.listConversations.mockReturnValue([makeConv('conv-1'), makeConv('conv-2')]);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));
  });

  it('sets error on exception from listConversations', async () => {
    mockAgent.listConversations.mockImplementationOnce(() => { throw new Error('store error'); });
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe('store error'));
  });

  it('exposes refresh as function', async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refresh).toBe('function');
  });

  it('starts loading until agent is ready', () => {
    const { result } = renderHook(() => useConversations(), { wrapper });
    // loading=true while agent is initializing
    expect(result.current.loading).toBe(true);
  });
});
