import { useState, type FormEvent, type ChangeEvent } from 'react';
import type { XiaoHeiNote, NoteCategory, XiaoHeiAuthor } from '../types.js';

export interface CreateNoteFormProps {
  author: XiaoHeiAuthor;
  onSubmit: (note: Omit<XiaoHeiNote, 'uri' | 'cid' | 'createdAt' | 'likeCount' | 'replyCount' | 'repostCount'>) => Promise<void>;
  onCancel?: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: NoteCategory; label: string }> = [
  { value: 'food', label: '美食' },
  { value: 'fashion', label: '穿搭' },
  { value: 'travel', label: '旅行' },
  { value: 'beauty', label: '美妆' },
  { value: 'fitness', label: '运动' },
  { value: 'home', label: '家居' },
  { value: 'tech', label: '科技' },
  { value: 'other', label: '其他' },
];

/**
 * CreateNoteForm — compose and publish a new 小黑书 note.
 *
 * Collects title, body, tags, category, location, and price.
 * Images are attached as IPFS URLs (upload handled by parent).
 * Calls `onSubmit` with the completed note payload.
 */
export function CreateNoteForm({ author, onSubmit, onCancel }: CreateNoteFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [category, setCategory] = useState<NoteCategory>('other');
  const [locationName, setLocationName] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [tipAddress, setTipAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('标题和内容不能为空');
      return;
    }

    setError(null);
    setSubmitting(true);

    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const note: Omit<XiaoHeiNote, 'uri' | 'cid' | 'createdAt' | 'likeCount' | 'replyCount' | 'repostCount'> = {
      author,
      title: title.trim(),
      body: body.trim(),
      tags: tags.length > 0 ? tags : undefined,
      category,
      location: locationName.trim() ? { name: locationName.trim() } : undefined,
      price: priceAmount.trim()
        ? { amount: priceAmount.trim(), currency: 'USDC' }
        : undefined,
      tipAddress: tipAddress.trim() || undefined,
    };

    try {
      await onSubmit(note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form data-testid="create-note-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div data-testid="form-error" role="alert">
          {error}
        </div>
      )}

      <input
        data-testid="title-input"
        type="text"
        placeholder="标题（必填）"
        value={title}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        maxLength={100}
        required
      />

      <textarea
        data-testid="body-input"
        placeholder="分享你的故事…（必填）"
        value={body}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
        maxLength={5000}
        rows={6}
        required
      />

      <input
        data-testid="tags-input"
        type="text"
        placeholder="标签（逗号分隔，如 咖啡,上海）"
        value={tagsInput}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTagsInput(e.target.value)}
      />

      <select
        data-testid="category-select"
        value={category}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as NoteCategory)}
      >
        {CATEGORY_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <input
        data-testid="location-input"
        type="text"
        placeholder="位置（可选，如 上海静安区）"
        value={locationName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setLocationName(e.target.value)}
      />

      <input
        data-testid="price-input"
        type="text"
        placeholder="价格（可选，如 38）"
        value={priceAmount}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceAmount(e.target.value)}
      />

      <input
        data-testid="tip-address-input"
        type="text"
        placeholder="收款地址（可选，接受 USDC 打赏）"
        value={tipAddress}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTipAddress(e.target.value)}
      />

      <div>
        <button
          data-testid="submit-btn"
          type="submit"
          disabled={submitting || !title.trim() || !body.trim()}
        >
          {submitting ? '发布中…' : '发布笔记'}
        </button>
        {onCancel && (
          <button
            data-testid="cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}
