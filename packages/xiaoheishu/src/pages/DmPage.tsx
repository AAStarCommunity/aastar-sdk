import { useState } from 'react';
import { useConversations } from '@aastar/react';
import { DmThread } from '../components/DmThread.js';
import type { XiaoHeiAuthor } from '../types.js';

export interface DmPageProps {
  self: XiaoHeiAuthor;
  /** Lookup function: Nostr pubkey → XiaoHeiAuthor (from your user store) */
  resolveAuthor: (pubkey: string) => XiaoHeiAuthor | null;
}

/**
 * DmPage — inbox listing all conversations + active thread view.
 *
 * Left panel: conversation list from `useConversations()`.
 * Right panel: `DmThread` for the selected conversation.
 * All messages are E2E encrypted via NIP-17/NIP-44 (Spore Protocol M1).
 */
export function DmPage({ self, resolveAuthor }: DmPageProps) {
  const { conversations, loading, error } = useConversations();
  const [activePubkey, setActivePubkey] = useState<string | null>(null);
  const activePeer = activePubkey ? resolveAuthor(activePubkey) : null;

  return (
    <main data-testid="dm-page">
      {/* Conversation sidebar */}
      <aside data-testid="conversation-list">
        <h2>私信</h2>

        {loading && <div data-testid="conv-loading">加载中…</div>}
        {error && <div data-testid="conv-error" role="alert">{error.message}</div>}

        {!loading && conversations.length === 0 && (
          <div data-testid="conv-empty">暂无私信</div>
        )}

        <ul>
          {conversations.map((conv) => {
            const peerPubkey = conv.members.find((m) => m !== self.sporePubkey) ?? '';
            const peer = resolveAuthor(peerPubkey);

            return (
              <li
                key={conv.id}
                data-testid="conv-item"
                data-active={activePubkey === peerPubkey}
                onClick={() => setActivePubkey(peerPubkey)}
                style={{ cursor: 'pointer' }}
              >
                <span data-testid="conv-peer-name">
                  {peer?.displayName ?? peer?.handle ?? peerPubkey.slice(0, 8)}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Thread panel */}
      <section data-testid="thread-panel">
        {activePeer ? (
          <DmThread self={self} peer={activePeer} />
        ) : (
          <div data-testid="no-thread-selected">
            选择一个会话开始聊天
          </div>
        )}
      </section>
    </main>
  );
}
