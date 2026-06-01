import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedList } from '../components/FeedList.js';
import type { FeedItem, XiaoHeiNote } from '../types.js';

function makeNote(id: string, category: XiaoHeiNote['category'] = 'food'): FeedItem {
  return {
    note: {
      uri: `at://test/${id}`,
      title: `Note ${id}`,
      body: `Body ${id}`,
      author: { did: `did:plc:${id}`, handle: `user${id}` },
      category,
      createdAt: '2025-01-01T00:00:00Z',
    },
  };
}

describe('FeedList', () => {
  it('renders all notes', () => {
    render(<FeedList items={[makeNote('1'), makeNote('2'), makeNote('3')]} />);
    expect(screen.getAllByTestId('note-card')).toHaveLength(3);
  });

  it('shows loading skeleton when loading and no items', () => {
    render(<FeedList items={[]} loading />);
    expect(screen.getByTestId('feed-loading')).toBeDefined();
  });

  it('shows empty state when no items', () => {
    render(<FeedList items={[]} />);
    expect(screen.getByTestId('feed-empty')).toBeDefined();
  });

  it('shows load-more button when hasMore=true', () => {
    render(<FeedList items={[makeNote('1')]} hasMore />);
    expect(screen.getByTestId('load-more-btn')).toBeDefined();
  });

  it('calls onLoadMore when load-more clicked', () => {
    const onLoadMore = vi.fn();
    render(<FeedList items={[makeNote('1')]} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByTestId('load-more-btn'));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('filters by category', () => {
    const items = [makeNote('1', 'food'), makeNote('2', 'fashion'), makeNote('3', 'food')];
    render(<FeedList items={items} selectedCategory="food" />);
    expect(screen.getAllByTestId('note-card')).toHaveLength(2);
  });

  it('shows all items when category=all', () => {
    const items = [makeNote('1', 'food'), makeNote('2', 'fashion')];
    render(<FeedList items={items} selectedCategory="all" />);
    expect(screen.getAllByTestId('note-card')).toHaveLength(2);
  });

  it('renders category tab buttons', () => {
    render(<FeedList items={[]} />);
    expect(screen.getByTestId('category-all')).toBeDefined();
    expect(screen.getByTestId('category-food')).toBeDefined();
    expect(screen.getByTestId('category-fashion')).toBeDefined();
  });

  it('shows loading-more indicator when loading with existing items', () => {
    render(<FeedList items={[makeNote('1')]} loading />);
    expect(screen.getByTestId('feed-loading-more')).toBeDefined();
  });
});
