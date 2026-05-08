import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '@aastar/react';
import { DmThread } from '../components/DmThread.js';
import type { XiaoHeiAuthor } from '../types.js';

const PEER_PUBKEY = 'peer'.repeat(16);

async function* neverStream() { await new Promise(() => {}); }

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'self'.repeat(16),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    sendDm: vi.fn().mockResolvedValue('hash-send'),
    listConversations: vi.fn().mockReturnValue([]),
    getMessages: vi.fn(),
    streamAllMessages: vi.fn(),
  };
  return { mockAgent: agent };
});

vi.mock('@aastar/messaging', () => ({
  SporeAgent: { create: vi.fn().mockResolvedValue(mockAgent) },
}));

const SELF: XiaoHeiAuthor = {
  did: 'did:plc:self',
  handle: 'me.test',
  displayName: 'Me',
  sporePubkey: 'self'.repeat(16),
};

const PEER: XiaoHeiAuthor = {
  did: 'did:plc:peer',
  handle: 'peer.test',
  displayName: 'Peer',
  sporePubkey: PEER_PUBKEY,
};

const PRIVKEY = 'aa'.repeat(32);
function wrapper({ children }: { children: ReactNode }) {
  return <SporeProvider privateKeyHex={PRIVKEY}>{children}</SporeProvider>;
}

describe('DmThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.stop.mockResolvedValue(undefined);
    mockAgent.sendDm.mockResolvedValue('hash-send');
    mockAgent.getMessages.mockResolvedValue([
      {
        id: 'm1',
        senderPubkey: PEER_PUBKEY,
        content: 'Hey there!',
        contentType: 'text',
        sentAt: 1000,
        conversation: { id: 'c1', type: 'dm', members: [], createdAt: 900 },
        rawEvent: {},
      },
    ]);
    mockAgent.streamAllMessages.mockReturnValue(neverStream());
  });

  it('renders peer name in header', async () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('dm-peer-name').textContent).toBe('Peer'));
  });

  it('shows E2E encrypted badge', () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    expect(screen.getByTestId('dm-encrypted-badge')).toBeDefined();
  });

  it('renders message history', async () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    await waitFor(() => expect(screen.getAllByTestId('dm-message')).toHaveLength(1));
    expect(screen.getByTestId('msg-content').textContent).toBe('Hey there!');
  });

  it('shows loading state initially', () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    expect(screen.getByTestId('dm-loading')).toBeDefined();
  });

  it('sends message on form submit', async () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    await waitFor(() => expect(screen.queryByTestId('dm-loading')).toBeNull());

    fireEvent.change(screen.getByTestId('dm-input'), { target: { value: 'Hello!' } });
    fireEvent.submit(screen.getByTestId('dm-input-form'));

    await waitFor(() => expect(mockAgent.sendDm).toHaveBeenCalledWith(PEER_PUBKEY, 'Hello!'));
    await waitFor(() =>
      expect((screen.getByTestId('dm-input') as HTMLInputElement).value).toBe(''),
    );
  });

  it('send button disabled when input empty', async () => {
    render(<DmThread self={SELF} peer={PEER} />, { wrapper });
    await waitFor(() => expect(screen.queryByTestId('dm-loading')).toBeNull());
    expect((screen.getByTestId('dm-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows no-pubkey message when peer has no sporePubkey', () => {
    const peerNoPubkey: XiaoHeiAuthor = { did: 'did:plc:x', handle: 'x' };
    render(<DmThread self={SELF} peer={peerNoPubkey} />, { wrapper });
    expect(screen.getByTestId('dm-no-pubkey')).toBeDefined();
  });
});
