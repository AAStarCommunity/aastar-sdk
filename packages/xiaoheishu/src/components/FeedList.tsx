import type { FeedItem, XiaoHeiNote, NoteCategory } from '../types.js';
import { NoteCard } from './NoteCard.js';

export interface FeedListProps {
  items: FeedItem[];
  loading?: boolean;
  hasMore?: boolean;
  selectedCategory?: NoteCategory | 'all';
  onLike?: (note: XiaoHeiNote) => void;
  onSave?: (note: XiaoHeiNote) => void;
  onTip?: (note: XiaoHeiNote) => void;
  onDm?: (note: XiaoHeiNote) => void;
  onNoteClick?: (note: XiaoHeiNote) => void;
  onLoadMore?: () => void;
}

const CATEGORIES: Array<{ key: NoteCategory | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'food', label: '美食' },
  { key: 'fashion', label: '穿搭' },
  { key: 'travel', label: '旅行' },
  { key: 'beauty', label: '美妆' },
  { key: 'fitness', label: '运动' },
  { key: 'home', label: '家居' },
  { key: 'tech', label: '科技' },
];

/**
 * FeedList — masonry-style feed grid rendering FeedItems.
 *
 * Supports category filtering, infinite scroll (onLoadMore), and
 * passes interaction callbacks down to NoteCard.
 */
export function FeedList({
  items,
  loading = false,
  hasMore = false,
  selectedCategory = 'all',
  onLike,
  onSave,
  onTip,
  onDm,
  onNoteClick,
  onLoadMore,
}: FeedListProps) {
  const visible =
    selectedCategory === 'all'
      ? items
      : items.filter((i) => i.note.category === selectedCategory);

  function renderFeedContent() {
    if (loading && items.length === 0) {
      return (
        <div data-testid="feed-loading" role="status" aria-label="Loading notes">
          Loading…
        </div>
      );
    }
    if (visible.length === 0) {
      return <div data-testid="feed-empty">暂时没有笔记</div>;
    }
    return (
      <div data-testid="feed-grid">
        {visible.map((item) => (
          <NoteCard
            key={item.note.uri ?? item.note.cid ?? item.note.title}
            item={item}
            onLike={onLike}
            onSave={onSave}
            onTip={onTip}
            onDm={onDm}
            onClick={onNoteClick}
          />
        ))}
      </div>
    );
  }

  return (
    <section data-testid="feed-list">
      {/* Category tabs */}
      <nav data-testid="category-tabs" aria-label="categories">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`category-${key}`}
            aria-current={selectedCategory === key ? 'true' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Notes grid */}
      {renderFeedContent()}

      {/* Load more */}
      {hasMore && !loading && (
        <button data-testid="load-more-btn" onClick={onLoadMore}>
          加载更多
        </button>
      )}
      {loading && items.length > 0 && (
        <div data-testid="feed-loading-more" role="status">
          加载中…
        </div>
      )}
    </section>
  );
}
