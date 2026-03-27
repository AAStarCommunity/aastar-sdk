import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '@aastar/react';
import { PaymentModal } from '../components/PaymentModal.js';
import type { XiaoHeiNote, XiaoHeiAuthor } from '../types.js';

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'self'.repeat(16),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    sendDm: vi.fn().mockResolvedValue('tip-tx-hash'),
  };
  return { mockAgent: agent };
});

vi.mock('@aastar/messaging', () => ({
  SporeAgent: { create: vi.fn().mockResolvedValue(mockAgent) },
}));

const AUTHOR: XiaoHeiAuthor = {
  did: 'did:plc:alice',
  handle: 'alice.test',
  displayName: 'Alice',
  sporePubkey: 'aabb'.repeat(16),
};

const NOTE: XiaoHeiNote = {
  uri: 'at://test/1',
  title: '好咖啡',
  body: '很好喝',
  author: AUTHOR,
  tipAddress: AUTHOR.sporePubkey,
  createdAt: '2025-01-01T00:00:00Z',
};

const SENDER: XiaoHeiAuthor = { did: 'did:plc:bob', handle: 'bob.test' };
const USDC = '0xUSDC';
const PRIVKEY = 'aa'.repeat(32);

function wrapper({ children }: { children: ReactNode }) {
  return <SporeProvider privateKeyHex={PRIVKEY}>{children}</SporeProvider>;
}

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.sendDm.mockResolvedValue('tip-tx-hash');
    mockAgent.stop.mockResolvedValue(undefined);
  });

  it('renders preset amount buttons', () => {
    render(<PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} />, { wrapper });
    expect(screen.getByTestId('preset-1')).toBeDefined();
    expect(screen.getByTestId('preset-5')).toBeDefined();
    expect(screen.getByTestId('preset-10')).toBeDefined();
    expect(screen.getByTestId('preset-20')).toBeDefined();
  });

  it('shows author name in dialog', () => {
    render(<PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} />, { wrapper });
    expect(screen.getByRole('dialog').textContent).toContain('Alice');
  });

  it('calls onClose when X clicked', () => {
    const onClose = vi.fn();
    render(<PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sends tip and shows success state', async () => {
    const onSuccess = vi.fn();
    render(
      <PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} onSuccess={onSuccess} />,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByTestId('confirm-btn')).toBeDefined());
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(screen.getByTestId('payment-success')).toBeDefined());
    expect(onSuccess).toHaveBeenCalledWith('tip-tx-hash');
  });

  it('encodes correct USDC amount for preset 5', async () => {
    render(<PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('preset-5')).toBeDefined());

    fireEvent.click(screen.getByTestId('preset-5'));
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockAgent.sendDm).toHaveBeenCalledOnce());
    const payload = JSON.parse(mockAgent.sendDm.mock.calls[0]![1] as string) as { amount: string };
    expect(payload.amount).toBe('5000000');
  });

  it('shows no-tip-address when author has no sporePubkey', () => {
    const noteNoAddr: XiaoHeiNote = {
      ...NOTE,
      author: { did: 'did:plc:x', handle: 'x' },
      tipAddress: undefined,
    };
    render(<PaymentModal note={noteNoAddr} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} />, { wrapper });
    expect(screen.getByTestId('no-tip-address')).toBeDefined();
  });

  it('shows error state when tip fails', async () => {
    mockAgent.sendDm.mockRejectedValueOnce(new Error('wallet rejected'));
    render(<PaymentModal note={NOTE} sender={SENDER} usdcAddress={USDC} onClose={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('confirm-btn')).toBeDefined());

    fireEvent.click(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(screen.getByTestId('payment-error')).toBeDefined());
    expect(screen.getByTestId('payment-error').textContent).toContain('wallet rejected');
  });
});
