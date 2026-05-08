import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SporeProvider, useSporeContext } from '../context/SporeContext.js';

// ─── Hoisted mock (vi.mock is hoisted above const declarations) ───────────────

const { mockAgent, mockCreate } = vi.hoisted(() => {
  const agent = {
    pubkey: 'aabbccdd'.repeat(8),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    sendDm: vi.fn().mockResolvedValue('hash123'),
    listConversations: vi.fn().mockReturnValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    streamAllMessages: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }),
    }),
    getGroupInfo: vi.fn().mockReturnValue(null),
    sendGroupMessage: vi.fn().mockResolvedValue('hash456'),
    addGroupMember: vi.fn().mockResolvedValue(undefined),
    removeGroupMember: vi.fn().mockResolvedValue(undefined),
    publishProfile: vi.fn().mockResolvedValue('evtId'),
    linkDevice: vi.fn().mockResolvedValue('evtId'),
    unlinkDevice: vi.fn().mockResolvedValue('evtId'),
  };
  return { mockAgent: agent, mockCreate: vi.fn().mockResolvedValue(agent) };
});

vi.mock('@aastar/messaging', () => ({
  SporeAgent: { create: mockCreate },
}));

// ─── Test component ────────────────────────────────────────────────────────────

function StatusDisplay() {
  const { ready, error, agent } = useSporeContext();
  if (error) return <div>error:{error.message}</div>;
  if (!ready) return <div>loading</div>;
  return <div>ready:{agent?.pubkey.slice(0, 8)}</div>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SporeProvider', () => {
  const PRIVKEY = 'aa'.repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(mockAgent);
    mockAgent.stop.mockResolvedValue(undefined);
  });

  it('renders loading state initially', () => {
    render(
      <SporeProvider privateKeyHex={PRIVKEY}>
        <StatusDisplay />
      </SporeProvider>,
    );
    expect(screen.getByText('loading')).toBeDefined();
  });

  it('transitions to ready after agent creation', async () => {
    render(
      <SporeProvider privateKeyHex={PRIVKEY}>
        <StatusDisplay />
      </SporeProvider>,
    );
    await waitFor(() => expect(screen.getByText(/^ready:/)).toBeDefined());
    expect(screen.getByText(`ready:${mockAgent.pubkey.slice(0, 8)}`)).toBeDefined();
  });

  it('transitions to error when creation fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('bad key'));
    render(
      <SporeProvider privateKeyHex={PRIVKEY}>
        <StatusDisplay />
      </SporeProvider>,
    );
    await waitFor(() => expect(screen.getByText('error:bad key')).toBeDefined());
  });

  it('calls agent.stop() on unmount', async () => {
    const { unmount } = render(
      <SporeProvider privateKeyHex={PRIVKEY}>
        <StatusDisplay />
      </SporeProvider>,
    );
    await waitFor(() => screen.getByText(/^ready:/));
    unmount();
    await waitFor(() => expect(mockAgent.stop).toHaveBeenCalled());
  });

  it('passes config to SporeAgent.create', async () => {
    render(
      <SporeProvider privateKeyHex={PRIVKEY} config={{ relays: ['wss://relay.example.com'] }}>
        <StatusDisplay />
      </SporeProvider>,
    );
    await waitFor(() => screen.getByText(/^ready:/));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ relays: ['wss://relay.example.com'] }),
    );
  });
});
