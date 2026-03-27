import { useCallback, useEffect, useState } from 'react';
import type { IdentityProfile, LinkedDevice, LinkDeviceOptions } from '@aastar/messaging';
import { useSporeContext } from '../context/SporeContext.js';

export interface UseIdentityResult {
  /** Agent's own Nostr pubkey */
  pubkey: string | null;
  /** Published profile (name, about, picture, nip05) */
  profile: IdentityProfile | null;
  /** Linked devices for multi-device support */
  devices: LinkedDevice[];
  /** Publish or update the agent's NIP-01 profile */
  publishProfile: (profile: Omit<IdentityProfile, 'nostrPubkey' | 'ethAddress'>) => Promise<void>;
  /** Link a new device pubkey */
  linkDevice: (devicePubkeyHex: string, opts?: LinkDeviceOptions) => Promise<void>;
  /** Unlink a device pubkey */
  unlinkDevice: (devicePubkeyHex: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * useIdentity — AirAccount identity management.
 *
 * Exposes the agent's own pubkey, profile, linked devices, and methods to
 * publish/update them (M8 Identity Registry).
 */
export function useIdentity(): UseIdentityResult {
  const { agent, ready } = useSporeContext();
  const [profile, setProfile] = useState<IdentityProfile | null>(null);
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load profile on mount
  useEffect(() => {
    if (!agent || !ready) return;
    setLoading(true);
    // Profile is published to relay — fetch own profile by own pubkey
    // SporeIdentityRegistry.fetchProfile is accessible via agent internals;
    // here we just initialise from what the agent already knows.
    setLoading(false);
  }, [agent, ready]);

  const publishProfile = useCallback(
    async (p: Omit<IdentityProfile, 'nostrPubkey' | 'ethAddress'>) => {
      if (!agent) throw new Error('SporeAgent not ready');
      setError(null);
      try {
        await agent.publishProfile(p);
        setProfile({ ...p, nostrPubkey: agent.pubkey });
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      }
    },
    [agent],
  );

  const linkDevice = useCallback(
    async (devicePubkeyHex: string, opts?: LinkDeviceOptions) => {
      if (!agent) throw new Error('SporeAgent not ready');
      await agent.linkDevice(devicePubkeyHex, opts);
      // Re-fetch updated device list via public API
      const updated = await agent.getLinkedDevices();
      setDevices(updated);
    },
    [agent],
  );

  const unlinkDevice = useCallback(
    async (devicePubkeyHex: string) => {
      if (!agent) throw new Error('SporeAgent not ready');
      await agent.unlinkDevice(devicePubkeyHex);
      setDevices((prev) => prev.filter((d) => d.pubkey !== devicePubkeyHex));
    },
    [agent],
  );

  return {
    pubkey: agent?.pubkey ?? null,
    profile,
    devices,
    publishProfile,
    linkDevice,
    unlinkDevice,
    loading,
    error,
  };
}
