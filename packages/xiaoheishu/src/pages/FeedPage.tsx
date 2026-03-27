import { useState } from 'react';
import { FeedList } from '../components/FeedList.js';
import { PaymentModal } from '../components/PaymentModal.js';
import { DmThread } from '../components/DmThread.js';
import type { FeedItem, XiaoHeiNote, XiaoHeiAuthor, NoteCategory, XiaoHeiConfig } from '../types.js';

export interface FeedPageProps {
  items: FeedItem[];
  selfAuthor: XiaoHeiAuthor;
  config: XiaoHeiConfig;
  loading?: boolean;
  hasMore?: boolean;
  onLike?: (note: XiaoHeiNote) => void;
  onSave?: (note: XiaoHeiNote) => void;
  onTipSuccess?: (note: XiaoHeiNote, txHash: string) => void;
  onLoadMore?: () => void;
}

type ModalState =
  | { type: 'none' }
  | { type: 'tip'; note: XiaoHeiNote }
  | { type: 'dm'; note: XiaoHeiNote };

/**
 * FeedPage — the main discovery feed for 小黑书.
 *
 * Composes FeedList with PaymentModal (USDC tip) and DmThread (E2E DM).
 * Category filtering is local state; infinite scroll triggers onLoadMore.
 */
export function FeedPage({
  items,
  selfAuthor,
  config,
  loading = false,
  hasMore = false,
  onLike,
  onSave,
  onTipSuccess,
  onLoadMore,
}: FeedPageProps) {
  const [category, setCategory] = useState<NoteCategory | 'all'>('all');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  function handleTip(note: XiaoHeiNote) {
    setModal({ type: 'tip', note });
  }

  function handleDm(note: XiaoHeiNote) {
    setModal({ type: 'dm', note });
  }

  function closeModal() {
    setModal({ type: 'none' });
  }

  return (
    <main data-testid="feed-page">
      <FeedList
        items={items}
        loading={loading}
        hasMore={hasMore}
        selectedCategory={category}
        onLike={onLike}
        onSave={onSave}
        onTip={handleTip}
        onDm={handleDm}
        onLoadMore={onLoadMore}
      />

      {/* Tip modal */}
      {modal.type === 'tip' && (
        <PaymentModal
          note={modal.note}
          usdcAddress={config.usdcAddress}
          onClose={closeModal}
          onSuccess={(txHash) => {
            onTipSuccess?.(modal.note, txHash);
            closeModal();
          }}
        />
      )}

      {/* DM thread */}
      {modal.type === 'dm' && modal.note.author.sporePubkey && (
        <DmThread
          self={selfAuthor}
          peer={modal.note.author}
        />
      )}
    </main>
  );
}
