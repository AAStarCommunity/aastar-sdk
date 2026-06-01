import type { XiaoHeiAuthor } from '../types.js';

const SBT_LABELS: Record<string, string> = {
  seed: '🌱 Seed',
  sprout: '🌿 Sprout',
  mycelium: '🍄 Mycelium',
  spore: '✨ Spore',
};

export interface ProfileCardProps {
  author: XiaoHeiAuthor;
  noteCount?: number;
  followerCount?: number;
  followingCount?: number;
  onDm?: (author: XiaoHeiAuthor) => void;
  onFollow?: (author: XiaoHeiAuthor) => void;
  isFollowing?: boolean;
  isSelf?: boolean;
}

/**
 * ProfileCard — display a 小黑书 user profile.
 *
 * Shows avatar, handle, SBT reputation tier, stats, and action buttons.
 * DM button requires author.sporePubkey (Spore Protocol identity).
 */
export function ProfileCard({
  author,
  noteCount = 0,
  followerCount = 0,
  followingCount = 0,
  onDm,
  onFollow,
  isFollowing = false,
  isSelf = false,
}: ProfileCardProps) {
  return (
    <section data-testid="profile-card">
      {/* Avatar */}
      <div data-testid="profile-avatar">
        {author.avatar ? (
          <img src={author.avatar} alt={author.displayName ?? author.handle} />
        ) : (
          <div aria-label="default avatar">
            {(author.displayName ?? author.handle).charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Identity */}
      <div>
        <h2 data-testid="profile-display-name">
          {author.displayName ?? author.handle}
        </h2>
        <p data-testid="profile-handle">@{author.handle}</p>

        {author.sbtTier && (
          <span data-testid="profile-sbt-tier" aria-label={`Reputation tier: ${author.sbtTier}`}>
            {SBT_LABELS[author.sbtTier] ?? author.sbtTier}
          </span>
        )}

        {author.sporePubkey && (
          <span data-testid="profile-spore-badge" title="Verified Spore Protocol identity">
            🔑 Spore ID
          </span>
        )}
      </div>

      {/* Stats */}
      <dl data-testid="profile-stats">
        <div>
          <dt>笔记</dt>
          <dd data-testid="stat-notes">{noteCount}</dd>
        </div>
        <div>
          <dt>粉丝</dt>
          <dd data-testid="stat-followers">{followerCount}</dd>
        </div>
        <div>
          <dt>关注</dt>
          <dd data-testid="stat-following">{followingCount}</dd>
        </div>
      </dl>

      {/* Actions */}
      {!isSelf && (
        <div data-testid="profile-actions">
          <button
            data-testid="follow-btn"
            onClick={() => onFollow?.(author)}
            aria-pressed={isFollowing}
          >
            {isFollowing ? '已关注' : '关注'}
          </button>

          {author.sporePubkey && (
            <button
              data-testid="profile-dm-btn"
              onClick={() => onDm?.(author)}
              aria-label={`Send DM to ${author.handle}`}
            >
              ✉️ 私信
            </button>
          )}
        </div>
      )}
    </section>
  );
}
