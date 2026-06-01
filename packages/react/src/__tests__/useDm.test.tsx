import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '../context/SporeContext.js';
import { useDm } from '../hooks/useDm.js';
import type { SporeMessage, SporeConversation } from '@aastar/messaging';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<SporeMessage> = {}): SporeMessage {
  return {
    id: 'msg-1',
    senderPubkey: 'peer-pubkey',
    content: 'hello',
    contentType: 'text',
    sentAt: 1000,
    conversation: { id: 'conv-1', type: 'dm', members: [], createdAt: 900 } as SporeConversation,
    rawEvent: {} as never,
    ...overrides,
  };
}

async function* makeStream(messages: SporeMessage[]) {
  for (const msg of messages) {
    yield { message: msg } as { message: SporeMessage };
  }
  await new Promise(() => {});
}

// ─── Hoisted mock ─────────────────────────────────────────────────────────────

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'agent-pubkey',
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    sendDm: vi.fn().mockResolvedValue('txhash'),
    listConversations: vi.fn().mockReturnValue([]),
    getMessages: vi.fn(),
    streamAllMessages: vi.fn(),
  };
  return { mockAgent: agent };
});

vi.mock('@aastar/messaging', () => ({
  SporeAgent: { create: vi.fn().mockResolvedValue(mockAgent) },
}));

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const PRIVKEY = 'aa'.repeat(32);
function wrapper({ children }: { children: ReactNode }) {
  return <SporeProvider privateKeyHex={PRIVKEY}>{children}</SporeProvider>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDm', () => {
  const PEER = 'peer-pubkey';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.getMessages.mockResolvedValue([makeMsg()]);
    mockAgent.streamAllMessages.mockReturnValue(makeStream([]));
    mockAgent.stop.mockResolvedValue(undefined);
  });

  it('starts loading and resolves with history', async () => {
    const { result } = renderHook(() => useDm(PEER), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]!.content).toBe('hello');
  });

  it('calls getMessages with peerPubkeyHex', async () => {
    const { result } = renderHook(() => useDm(PEER), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockAgent.getMessages).toHaveBeenCalledWith(PEER, { limit: 50 });
  });

  it('appends streamed messages from the peer', async () => {
    const streamMsg = makeMsg({ id: 'msg-stream', senderPubkey: PEER, content: 'streamed' });
    mockAgent.streamAllMessages.mockReturnValue(makeStream([streamMsg]));

    const { result } = renderHook(() => useDm(PEER), { wrapper });
    await waitFor(() => expect(result.current.messages.some((m) => m.id === 'msg-stream')).toBe(true));
  });

  it('ignores streamed messages from other senders', async () => {
    const otherMsg = makeMsg({ id: 'other', senderPubkey: 'other-pubkey', content: 'noise' });
    mockAgent.streamAllMessages.mockReturnValue(makeStream([otherMsg]));

    const { result } = renderHook(() => useDm(PEER), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.every((m) => m.id !== 'other')).toBe(true);
  });

  it('sendText delegates to agent.sendDm', async () => {
    const { result } = renderHook(() => useDm(PEER), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.sendText('world'); });
    expect(mockAgent.sendDm).toHaveBeenCalledWith(PEER, 'world');
  });

  it('sets error when getMessages rejects', async () => {
    mockAgent.getMessages.mockRejectedValueOnce(new Error('relay down'));
    const { result } = renderHook(() => useDm(PEER), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe('relay down'));
  });
});
