import { useCallback, useEffect, useState } from 'react';
import type { GroupInfo, SporeMessage } from '@aastar/messaging';
import { useSporeContext } from '../context/SporeContext.js';

export interface UseGroupResult {
  info: GroupInfo | null;
  messages: SporeMessage[];
  sendText: (content: string) => Promise<void>;
  addMember: (pubkeyHex: string) => Promise<void>;
  removeMember: (pubkeyHex: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * useGroup — subscribe to a NIP-29 group: messages, membership, and send.
 *
 * @param groupId - The group identifier returned by `agent.createGroup()`
 */
export function useGroup(groupId: string): UseGroupResult {
  const { agent, ready } = useSporeContext();
  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<SporeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agent || !ready || !groupId) return;

    let cancelled = false;
    const controller = new AbortController();

    // Load group metadata
    const groupInfo = agent.getGroupInfo(groupId);
    if (!cancelled) {
      setInfo(groupInfo);
      setLoading(false);
    }

    // Load message history
    agent
      .getMessages(groupId, { limit: 50 })
      .then((msgs) => { if (!cancelled) setMessages(msgs); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });

    // Stream new group messages
    (async () => {
      try {
        for await (const ctx of agent.streamAllMessages({ signal: controller.signal })) {
          if (cancelled) break;
          if (ctx.message.conversation.id === groupId) {
            setMessages((prev) => [...prev, ctx.message]);
          }
        }
      } catch {
        // AbortError on cleanup
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [agent, ready, groupId]);

  const sendText = useCallback(
    async (content: string) => {
      if (!agent) throw new Error('SporeAgent not ready');
      const members = agent.getGroupInfo(groupId)?.members ?? [];
      await agent.sendGroupMessage(groupId, members, content);
    },
    [agent, groupId],
  );

  const addMember = useCallback(
    async (pubkeyHex: string) => {
      if (!agent) throw new Error('SporeAgent not ready');
      await agent.addGroupMember(groupId, pubkeyHex);
      setInfo(agent.getGroupInfo(groupId));
    },
    [agent, groupId],
  );

  const removeMember = useCallback(
    async (pubkeyHex: string) => {
      if (!agent) throw new Error('SporeAgent not ready');
      await agent.removeGroupMember(groupId, pubkeyHex);
      setInfo(agent.getGroupInfo(groupId));
    },
    [agent, groupId],
  );

  return { info, messages, sendText, addMember, removeMember, loading, error };
}
