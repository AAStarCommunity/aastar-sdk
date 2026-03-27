import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGatewayStream } from '../hooks/useGatewayStream.js';

// ─── EventSource mock ─────────────────────────────────────────────────────────

interface MockEventSource {
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
}

let mockEs: MockEventSource;

vi.stubGlobal(
  'EventSource',
  vi.fn().mockImplementation(() => {
    mockEs = { onopen: null, onmessage: null, onerror: null, close: vi.fn() };
    return mockEs;
  }),
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGatewayStream', () => {
  const URL = 'http://localhost:7402';
  const TOKEN = 'secret-token';

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    mockEs?.close();
  });

  it('creates EventSource with correct URL + token', () => {
    renderHook(() => useGatewayStream(URL, TOKEN));
    expect(EventSource).toHaveBeenCalledWith(
      `${URL}/api/v1/stream?token=${encodeURIComponent(TOKEN)}`,
    );
  });

  it('connected becomes true on open', async () => {
    const { result } = renderHook(() => useGatewayStream(URL, TOKEN));
    expect(result.current.connected).toBe(false);

    act(() => { mockEs.onopen?.(); });
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('calls onMessage callback for valid SSE frames', async () => {
    const onMessage = vi.fn();
    renderHook(() => useGatewayStream(URL, TOKEN, onMessage));

    act(() => {
      mockEs.onopen?.();
      mockEs.onmessage?.({
        data: JSON.stringify({ type: 'message', message: { id: 'm1', content: 'hi' } }),
      });
    });

    await waitFor(() => expect(onMessage).toHaveBeenCalledOnce());
    expect(onMessage.mock.calls[0]![0]).toMatchObject({ type: 'message' });
  });

  it('ignores malformed SSE frames', () => {
    const onMessage = vi.fn();
    renderHook(() => useGatewayStream(URL, TOKEN, onMessage));

    act(() => {
      mockEs.onopen?.();
      mockEs.onmessage?.({ data: 'not-json' });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('sets error and connected=false on SSE error', async () => {
    const { result } = renderHook(() => useGatewayStream(URL, TOKEN));
    act(() => { mockEs.onopen?.(); });
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => { mockEs.onerror?.(); });
    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(result.current.error?.message).toMatch(/SSE/i);
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useGatewayStream(URL, TOKEN));
    act(() => { mockEs.onopen?.(); });
    unmount();
    expect(mockEs.close).toHaveBeenCalled();
  });

  it('does not create EventSource when url is empty', () => {
    renderHook(() => useGatewayStream('', TOKEN));
    expect(EventSource).not.toHaveBeenCalled();
  });
});
