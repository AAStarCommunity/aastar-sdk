import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateNoteForm } from '../components/CreateNoteForm.js';
import type { XiaoHeiAuthor } from '../types.js';

const AUTHOR: XiaoHeiAuthor = {
  did: 'did:plc:alice',
  handle: 'alice.test',
  displayName: 'Alice',
};

describe('CreateNoteForm', () => {
  it('renders required inputs', () => {
    render(<CreateNoteForm author={AUTHOR} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('title-input')).toBeDefined();
    expect(screen.getByTestId('body-input')).toBeDefined();
    expect(screen.getByTestId('submit-btn')).toBeDefined();
  });

  it('submit button is disabled when fields empty', () => {
    render(<CreateNoteForm author={AUTHOR} onSubmit={vi.fn()} />);
    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit button enabled when title and body filled', () => {
    render(<CreateNoteForm author={AUTHOR} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: '我的标题' } });
    fireEvent.change(screen.getByTestId('body-input'), { target: { value: '内容内容内容' } });
    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls onSubmit with correct payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateNoteForm author={AUTHOR} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('title-input'), { target: { value: '咖啡馆推荐' } });
    fireEvent.change(screen.getByTestId('body-input'), { target: { value: '真的很好喝' } });
    fireEvent.change(screen.getByTestId('tags-input'), { target: { value: '咖啡, 上海' } });
    fireEvent.change(screen.getByTestId('location-input'), { target: { value: '静安区' } });
    fireEvent.change(screen.getByTestId('price-input'), { target: { value: '38' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    const payload = onSubmit.mock.calls[0]![0] as ReturnType<typeof onSubmit>;
    expect((payload as { title: string }).title).toBe('咖啡馆推荐');
    expect((payload as { tags: string[] }).tags).toContain('咖啡');
    expect((payload as { tags: string[] }).tags).toContain('上海');
    expect((payload as { location: { name: string } }).location?.name).toBe('静安区');
    expect((payload as { price: { amount: string } }).price?.amount).toBe('38');
    expect((payload as { author: XiaoHeiAuthor }).author.did).toBe('did:plc:alice');
  });

  it('shows validation error when submitting empty form', async () => {
    render(<CreateNoteForm author={AUTHOR} onSubmit={vi.fn()} />);
    // Force submit by directly firing submit event (bypasses disabled check)
    const form = screen.getByTestId('create-note-form');
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByTestId('form-error')).toBeDefined());
  });

  it('shows submitting state during async submit', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    render(<CreateNoteForm author={AUTHOR} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'T' } });
    fireEvent.change(screen.getByTestId('body-input'), { target: { value: 'B' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() =>
      expect((screen.getByTestId('submit-btn') as HTMLButtonElement).textContent).toContain('发布中'),
    );
    resolve();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<CreateNoteForm author={AUTHOR} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('parses comma-separated tags stripping # prefix', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateNoteForm author={AUTHOR} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'T' } });
    fireEvent.change(screen.getByTestId('body-input'), { target: { value: 'B' } });
    fireEvent.change(screen.getByTestId('tags-input'), { target: { value: '#咖啡 #上海' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const tags = (onSubmit.mock.calls[0]![0] as { tags: string[] }).tags;
    expect(tags).toContain('咖啡');
    expect(tags).toContain('上海');
  });
});
