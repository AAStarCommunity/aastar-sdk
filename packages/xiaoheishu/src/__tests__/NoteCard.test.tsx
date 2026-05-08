import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from '../components/NoteCard.js';
import type { FeedItem, XiaoHeiNote } from '../types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<XiaoHeiNote> = {}): XiaoHeiNote {
  return {
    uri: 'at://did:plc:test/app.xiaohei.note/1',
    title: '上海最好的咖啡馆',
    body: '手冲耶加雪菲真的绝了',
    author: {
      did: 'did:plc:test',
      handle: 'alice.test',
      displayName: 'Alice',
      sbtTier: 'mycelium',
      sporePubkey: 'aabb'.repeat(16),
    },
    tags: ['咖啡', '上海'],
    location: { name: '静安区' },
    price: { amount: '38', currency: 'CNY' },
    likeCount: 42,
    replyCount: 5,
    createdAt: '2025-03-27T10:00:00Z',
    tipAddress: 'aabb'.repeat(16),
    ...overrides,
  };
}

function makeItem(overrides: Partial<XiaoHeiNote> = {}): FeedItem {
  return { note: makeNote(overrides), isLiked: false, isSaved: false };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NoteCard', () => {
  it('renders title and body', () => {
    render(<NoteCard item={makeItem()} />);
    expect(screen.getByTestId('note-title').textContent).toBe('上海最好的咖啡馆');
    expect(screen.getByTestId('note-body').textContent).toBe('手冲耶加雪菲真的绝了');
  });

  it('renders author info with SBT tier', () => {
    render(<NoteCard item={makeItem()} />);
    expect(screen.getByTestId('note-author').textContent).toContain('Alice');
    expect(screen.getByTestId('author-tier').textContent).toBe('mycelium');
  });

  it('renders tags', () => {
    render(<NoteCard item={makeItem()} />);
    const tags = screen.getByTestId('note-tags').querySelectorAll('li');
    expect(tags).toHaveLength(2);
    expect(tags[0]!.textContent).toBe('#咖啡');
  });

  it('renders location and price', () => {
    render(<NoteCard item={makeItem()} />);
    expect(screen.getByTestId('note-location').textContent).toBe('静安区');
    expect(screen.getByTestId('note-price').textContent).toContain('38');
  });

  it('shows tip button when tipAddress set', () => {
    render(<NoteCard item={makeItem()} />);
    expect(screen.getByTestId('tip-btn')).toBeDefined();
  });

  it('hides tip button when no tipAddress', () => {
    render(<NoteCard item={makeItem({ tipAddress: undefined })} />);
    expect(screen.queryByTestId('tip-btn')).toBeNull();
  });

  it('shows DM button when author has sporePubkey', () => {
    render(<NoteCard item={makeItem()} />);
    expect(screen.getByTestId('dm-btn')).toBeDefined();
  });

  it('hides DM button when no sporePubkey', () => {
    render(<NoteCard item={makeItem({ author: { did: 'did:plc:x', handle: 'x' } })} />);
    expect(screen.queryByTestId('dm-btn')).toBeNull();
  });

  it('like button toggles aria-pressed and calls onLike', () => {
    const onLike = vi.fn();
    render(<NoteCard item={makeItem()} onLike={onLike} />);

    const btn = screen.getByTestId('like-btn');
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(onLike).toHaveBeenCalledOnce();
  });

  it('save button toggles and calls onSave', () => {
    const onSave = vi.fn();
    render(<NoteCard item={makeItem()} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('save-btn'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('tip button calls onTip with the note', () => {
    const onTip = vi.fn();
    render(<NoteCard item={makeItem()} onTip={onTip} />);
    fireEvent.click(screen.getByTestId('tip-btn'));
    expect(onTip).toHaveBeenCalledWith(expect.objectContaining({ title: '上海最好的咖啡馆' }));
  });

  it('DM button calls onDm with the note', () => {
    const onDm = vi.fn();
    render(<NoteCard item={makeItem()} onDm={onDm} />);
    fireEvent.click(screen.getByTestId('dm-btn'));
    expect(onDm).toHaveBeenCalledOnce();
  });

  it('onClick is called when card is clicked', () => {
    const onClick = vi.fn();
    render(<NoteCard item={makeItem()} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('note-card'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ title: '上海最好的咖啡馆' }));
  });

  it('renders without images gracefully', () => {
    render(<NoteCard item={makeItem({ images: [] })} />);
    expect(screen.queryByTestId('note-cover')).toBeNull();
  });

  it('pre-set isLiked=true shows aria-pressed=true', () => {
    render(<NoteCard item={{ ...makeItem(), isLiked: true }} />);
    expect(screen.getByTestId('like-btn').getAttribute('aria-pressed')).toBe('true');
  });
});
