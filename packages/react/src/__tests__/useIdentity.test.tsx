import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SporeProvider } from '../context/SporeContext.js';
import { useIdentity } from '../hooks/useIdentity.js';

const { mockAgent } = vi.hoisted(() => {
  const agent = {
    pubkey: 'agent-pubkey-hex',
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    publishProfile: vi.fn().mockResolvedValue('evt-profile'),
    linkDevice: vi.fn().mockResolvedValue('evt-link'),
    unlinkDevice: vi.fn().mockResolvedValue('evt-unlink'),
    getLinkedDevices: vi.fn().mockResolvedValue([
      { pubkey: 'device-1', label: 'iPhone', addedAt: 1000 },
    ]),
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

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.stop.mockResolvedValue(undefined);
    mockAgent.publishProfile.mockResolvedValue('evt-profile');
    mockAgent.linkDevice.mockResolvedValue('evt-link');
    mockAgent.unlinkDevice.mockResolvedValue('evt-unlink');
    mockAgent.getLinkedDevices.mockResolvedValue([
      { pubkey: 'device-1', label: 'iPhone', addedAt: 1000 },
    ]);
  });

  it('exposes the agent pubkey', async () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    await waitFor(() => expect(result.current.pubkey).toBe('agent-pubkey-hex'));
  });

  it('starts with null profile', async () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    await waitFor(() => expect(result.current.pubkey).toBeDefined());
    expect(result.current.profile).toBeNull();
  });

  it('publishProfile updates local profile state', async () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    await waitFor(() => expect(result.current.pubkey).toBeDefined());

    await act(async () => {
      await result.current.publishProfile({ name: 'Alice', about: 'Builder' });
    });

    expect(mockAgent.publishProfile).toHaveBeenCalledWith({ name: 'Alice', about: 'Builder' });
    expect(result.current.profile?.name).toBe('Alice');
  });

  it('linkDevice calls agent.linkDevice and refreshes device list', async () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    await waitFor(() => expect(result.current.pubkey).toBeDefined());

    await act(async () => {
      await result.current.linkDevice('device-1', { label: 'iPhone' });
    });

    expect(mockAgent.linkDevice).toHaveBeenCalledWith('device-1', { label: 'iPhone' });
    await waitFor(() => expect(result.current.devices).toHaveLength(1));
  });

  it('unlinkDevice removes device from local state', async () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    await waitFor(() => expect(result.current.pubkey).toBeDefined());

    await act(async () => { await result.current.linkDevice('device-1'); });
    expect(result.current.devices).toHaveLength(1);

    await act(async () => { await result.current.unlinkDevice('device-1'); });
    expect(result.current.devices.find((d) => d.pubkey === 'device-1')).toBeUndefined();
  });
});
