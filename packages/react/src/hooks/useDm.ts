import { useCallback, useEffect, useRef, useState } from 'react';
import type { SporeMessage } from '@aastar/messaging';
import { useSporeContext } from '../context/SporeContext.js';

export interface UseDmResult {
  messages: SporeMessage[];
  sendText: (content: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * useDm — subscribe to and send direct messages with a single peer.
 *
 * Loads historical messages on mount and streams new ones in real-time.
 * Call `sendText` to send a message to the peer.
 *
 * @param peerPubkeyHex - Recipient's 32-byte Nostr pubkey (hex)
 */
export function useDm(peerPubkeyHex: string): UseDmResult {
  const { agent, ready } = useSporeContext();
  const [messages, setMessages] = useState<SporeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const peerRef = useRef(peerPubkeyHex);
  peerRef.current = peerPubkeyHex;

  useEffect(() => {
    if (!agent || !ready) return;

    let cancelled = false;
    const controller = new AbortController();

    // Load message history
    agent
      .getMessages(peerPubkeyHex, { limit: 50 })
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    // Stream new messages — filter to this conversation by peer pubkey
    (async () => {
      try {
        for await (const ctx of agent.streamAllMessages({ signal: controller.signal })) {
          if (cancelled) break;
          const msg = ctx.message;
          if (msg.senderPubkey === peerRef.current) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      } catch {
        // AbortError is expected on cleanup
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [agent, ready, peerPubkeyHex]);

  const sendText = useCallback(
    async (content: string) => {
      if (!agent) throw new Error('SporeAgent not ready');
      await agent.sendDm(peerRef.current, content);
    },
    [agent],
  );

  return { messages, sendText, loading, error };
}
