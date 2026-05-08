import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useDm } from '@aastar/react';
import type { XiaoHeiAuthor } from '../types.js';

export interface DmThreadProps {
  /** Own identity */
  self: XiaoHeiAuthor;
  /** Recipient */
  peer: XiaoHeiAuthor;
}

/**
 * DmThread — E2E encrypted direct message thread (NIP-17 via Spore Protocol).
 *
 * Uses the `useDm` hook from `@aastar/react`. Messages are encrypted
 * end-to-end using NIP-44 (ChaCha20-Poly1305). The peer's `sporePubkey`
 * is required; see author.sporePubkey.
 */
export function DmThread({ self, peer }: DmThreadProps) {
  const peerPubkey = peer.sporePubkey ?? '';
  const { messages, sendText, loading, error } = useDm(peerPubkey);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  if (!peerPubkey) {
    return (
      <div data-testid="dm-no-pubkey" role="alert">
        该用户未开启 Spore 私信（无 Nostr 公钥）
      </div>
    );
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await sendText(text);
      setInput('');
    } finally {
      setSending(false);
    }
  }

  return (
    <section data-testid="dm-thread">
      {/* Header */}
      <header data-testid="dm-header">
        {peer.avatar && <img src={peer.avatar} alt={peer.displayName ?? peer.handle} />}
        <span data-testid="dm-peer-name">{peer.displayName ?? peer.handle}</span>
        <span data-testid="dm-encrypted-badge" title="End-to-end encrypted (NIP-44)">
          🔒 E2E 加密
        </span>
      </header>

      {/* Message list */}
      <div data-testid="dm-messages" role="log" aria-live="polite" aria-label="Messages">
        {loading && <div data-testid="dm-loading">加载中…</div>}
        {error && (
          <div data-testid="dm-error" role="alert">
            {error.message}
          </div>
        )}
        {!loading &&
          messages.map((msg) => {
            const isMine = msg.senderPubkey !== peerPubkey;
            return (
              <div
                key={msg.id}
                data-testid="dm-message"
                data-mine={isMine}
                aria-label={isMine ? `You: ${msg.content}` : `${peer.handle}: ${msg.content}`}
              >
                <span data-testid="msg-sender">
                  {isMine ? (self.displayName ?? self.handle) : (peer.displayName ?? peer.handle)}
                </span>
                <p data-testid="msg-content">{msg.content}</p>
                <time data-testid="msg-time" dateTime={new Date(msg.sentAt * 1000).toISOString()}>
                  {new Date(msg.sentAt * 1000).toLocaleTimeString()}
                </time>
              </div>
            );
          })}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <form data-testid="dm-input-form" onSubmit={handleSend}>
        <input
          data-testid="dm-input"
          type="text"
          placeholder="发消息…"
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          disabled={sending}
          aria-label="Message input"
        />
        <button
          data-testid="dm-send-btn"
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send message"
        >
          {sending ? '发送中…' : '发送'}
        </button>
      </form>
    </section>
  );
}
