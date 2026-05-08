import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '../context/SporeContext.js';
import { usePayment } from '../hooks/usePayment.js';

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'agent-pubkey',
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    sendDm: vi.fn().mockResolvedValue('tip-txhash'),
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

const TIP_PARAMS = {
  recipientPubkeyHex: 'recipient-pubkey',
  amount: 1_000_000n,
  tokenAddress: '0xUSDC',
  message: 'Great post!',
};

describe('usePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.sendDm.mockResolvedValue('tip-txhash');
    mockAgent.stop.mockResolvedValue(undefined);
  });

  it('starts in idle state', async () => {
    const { result } = renderHook(() => usePayment(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('tip() transitions to success and returns hash', async () => {
    const { result } = renderHook(() => usePayment(), { wrapper });
    const { SporeAgent } = await import('@aastar/messaging');
    const createFn = SporeAgent.create as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(createFn).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    let hash!: string;
    await act(async () => { hash = await result.current.tip(TIP_PARAMS); });
    expect(hash).toBe('tip-txhash');
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('tip() calls agent.sendDm with recipient', async () => {
    const { result } = renderHook(() => usePayment(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.tip(TIP_PARAMS); });
    expect(mockAgent.sendDm).toHaveBeenCalledWith(
      'recipient-pubkey',
      expect.stringContaining('"type":"x402-tip"'),
    );
  });

  it('encodes amount and token in the payload', async () => {
    const { result } = renderHook(() => usePayment(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.tip(TIP_PARAMS); });

    const payload = JSON.parse(mockAgent.sendDm.mock.calls[0]![1] as string) as { amount: string; token: string };
    expect(payload.amount).toBe('1000000');
    expect(payload.token).toBe('0xUSDC');
  });

  it('sets error state on failure', async () => {
    mockAgent.sendDm.mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => usePayment(), { wrapper });

    // Wait until SporeAgent.create has been called and React has flushed
    // the resulting setState({agent, ready:true}) — this ensures agent is non-null
    const { SporeAgent } = await import('@aastar/messaging');
    const createFn = SporeAgent.create as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(createFn).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    let caught: Error | undefined;
    await act(async () => {
      try { await result.current.tip(TIP_PARAMS); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('network error');
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('network error');
  });

  it('reset() returns to idle', async () => {
    mockAgent.sendDm.mockRejectedValueOnce(new Error('oops'));
    const { result } = renderHook(() => usePayment(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.tip(TIP_PARAMS).catch(() => {}); });
    expect(result.current.status).toBe('error');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
