import { useState, type MouseEvent } from 'react';
import type { FeedItem, XiaoHeiNote } from '../types.js';

export interface NoteCardProps {
  item: FeedItem;
  onLike?: (note: XiaoHeiNote) => void;
  onSave?: (note: XiaoHeiNote) => void;
  onTip?: (note: XiaoHeiNote) => void;
  onDm?: (note: XiaoHeiNote) => void;
  onClick?: (note: XiaoHeiNote) => void;
}

/**
 * NoteCard — renders a single 小黑书 note card.
 *
 * Displays the cover image, title, author, tags, and engagement buttons.
 * The tip button opens a payment flow (usePayment) if the author has tipAddress.
 */
export function NoteCard({ item, onLike, onSave, onTip, onDm, onClick }: NoteCardProps) {
  const { note, isLiked = false, isSaved = false } = item;
  const [liked, setLiked] = useState(isLiked);
  const [saved, setSaved] = useState(isSaved);

  function handleLike(e: MouseEvent) {
    e.stopPropagation();
    setLiked((v) => !v);
    onLike?.(note);
  }

  function handleSave(e: MouseEvent) {
    e.stopPropagation();
    setSaved((v) => !v);
    onSave?.(note);
  }

  function handleTip(e: MouseEvent) {
    e.stopPropagation();
    onTip?.(note);
  }

  function handleDm(e: MouseEvent) {
    e.stopPropagation();
    onDm?.(note);
  }

  const coverImage = note.images?.[0];

  return (
    <article
      data-testid="note-card"
      onClick={() => onClick?.(note)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Cover image */}
      {coverImage && (
        <div data-testid="note-cover">
          <img src={coverImage.url} alt={coverImage.alt} loading="lazy" />
        </div>
      )}

      {/* Content */}
      <div>
        <h3 data-testid="note-title">{note.title}</h3>
        <p data-testid="note-body">{note.body}</p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <ul data-testid="note-tags" aria-label="tags">
            {note.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}

        {/* Location + Price */}
        {note.location && (
          <span data-testid="note-location">{note.location.name}</span>
        )}
        {note.price && (
          <span data-testid="note-price">
            {note.price.currency} {note.price.amount}
          </span>
        )}
      </div>

      {/* Author */}
      <div data-testid="note-author">
        {note.author.avatar && (
          <img src={note.author.avatar} alt={note.author.displayName ?? note.author.handle} />
        )}
        <span>{note.author.displayName ?? note.author.handle}</span>
        {note.author.sbtTier && (
          <span data-testid="author-tier" aria-label={`tier: ${note.author.sbtTier}`}>
            {note.author.sbtTier}
          </span>
        )}
      </div>

      {/* Engagement */}
      <div data-testid="note-actions">
        <button
          data-testid="like-btn"
          onClick={handleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? '❤️' : '🤍'} {(note.likeCount ?? 0) + (liked ? 1 : 0)}
        </button>

        <button
          data-testid="save-btn"
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          {saved ? '🔖' : '📑'} {note.replyCount ?? 0}
        </button>

        {note.tipAddress && (
          <button data-testid="tip-btn" onClick={handleTip} aria-label="Tip creator">
            💸 Tip
          </button>
        )}

        {note.author.sporePubkey && (
          <button data-testid="dm-btn" onClick={handleDm} aria-label="Send DM">
            ✉️ DM
          </button>
        )}
      </div>
    </article>
  );
}
