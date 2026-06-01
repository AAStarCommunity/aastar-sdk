import { useEffect, useState } from 'react';
import type { SporeConversation } from '@aastar/messaging';
import { useSporeContext } from '../context/SporeContext.js';

export interface UseConversationsResult {
  conversations: SporeConversation[];
  loading: boolean;
  error: Error | null;
  /** Force-refresh the conversation list */
  refresh: () => void;
}

/**
 * useConversations — list all active conversations for this agent.
 *
 * Automatically refreshes when a new message arrives on any conversation.
 */
export function useConversations(): UseConversationsResult {
  const { agent, ready } = useSporeContext();
  const [conversations, setConversations] = useState<SporeConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!agent || !ready) return;

    try {
      const convs = agent.listConversations();
      setConversations(convs);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [agent, ready, tick]);

  // Refresh on new messages to keep last-message timestamps current
  useEffect(() => {
    if (!agent || !ready) return;

    const controller = new AbortController();
    (async () => {
      try {
        for await (const _ctx of agent.streamAllMessages({ signal: controller.signal })) {
          setConversations(agent.listConversations());
        }
      } catch {
        // AbortError on cleanup
      }
    })();

    return () => controller.abort();
  }, [agent, ready]);

  return { conversations, loading, error, refresh };
}
