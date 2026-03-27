import { useState } from 'react';
import { useIdentity } from '@aastar/react';
import { ProfileCard } from '../components/ProfileCard.js';
import { FeedList } from '../components/FeedList.js';
import { DmThread } from '../components/DmThread.js';
import type { XiaoHeiAuthor, FeedItem, XiaoHeiNote } from '../types.js';

export interface ProfilePageProps {
  /** The profile being viewed */
  author: XiaoHeiAuthor;
  /** Notes published by this author */
  notes: FeedItem[];
  /** Own identity (to detect isSelf and enable DM) */
  selfAuthor: XiaoHeiAuthor;
  noteCount?: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  onFollow?: (author: XiaoHeiAuthor) => void;
  onNoteClick?: (note: XiaoHeiNote) => void;
}

/**
 * ProfilePage — user profile with notes grid, follow, DM, and identity editing.
 *
 * If viewing own profile (isSelf), shows an "Edit Profile" button that uses
 * `useIdentity().publishProfile()` to update the NIP-01 profile on Nostr.
 */
export function ProfilePage({
  author,
  notes,
  selfAuthor,
  noteCount,
  followerCount,
  followingCount,
  isFollowing = false,
  onFollow,
  onNoteClick,
}: ProfilePageProps) {
  const isSelf = author.did === selfAuthor.did;
  const [dmOpen, setDmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { publishProfile } = useIdentity();
  const [displayName, setDisplayName] = useState(author.displayName ?? '');

  async function handleSaveProfile() {
    await publishProfile({ name: displayName });
    setEditing(false);
  }

  return (
    <main data-testid="profile-page">
      <ProfileCard
        author={author}
        noteCount={noteCount}
        followerCount={followerCount}
        followingCount={followingCount}
        isFollowing={isFollowing}
        isSelf={isSelf}
        onFollow={onFollow}
        onDm={() => setDmOpen(true)}
      />

      {/* Edit profile (own profile only) */}
      {isSelf && (
        <div data-testid="edit-profile-section">
          {editing ? (
            <div data-testid="edit-form">
              <input
                data-testid="edit-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="昵称"
              />
              <button data-testid="save-profile-btn" onClick={handleSaveProfile}>
                保存
              </button>
              <button data-testid="cancel-edit-btn" onClick={() => setEditing(false)}>
                取消
              </button>
            </div>
          ) : (
            <button data-testid="edit-profile-btn" onClick={() => setEditing(true)}>
              编辑资料
            </button>
          )}
        </div>
      )}

      {/* Notes grid */}
      <section data-testid="profile-notes">
        <h3>TA 的笔记</h3>
        <FeedList
          items={notes}
          onNoteClick={onNoteClick}
        />
      </section>

      {/* DM thread overlay */}
      {dmOpen && !isSelf && author.sporePubkey && (
        <div data-testid="dm-overlay">
          <button data-testid="close-dm-btn" onClick={() => setDmOpen(false)}>
            关闭
          </button>
          <DmThread self={selfAuthor} peer={author} />
        </div>
      )}
    </main>
  );
}
