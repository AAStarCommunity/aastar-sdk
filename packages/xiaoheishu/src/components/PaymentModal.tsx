import { useState, type FormEvent, type ChangeEvent } from 'react';
import { usePayment } from '@aastar/react';
import type { XiaoHeiNote, XiaoHeiAuthor } from '../types.js';

export interface PaymentModalProps {
  note: XiaoHeiNote;
  sender: XiaoHeiAuthor;
  /** USDC token address on Optimism (passed from app config) */
  usdcAddress: string;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 20]; // USDC

/**
 * PaymentModal — USDC tip modal for 小黑书.
 *
 * Uses `usePayment` from `@aastar/react` (X402 bridge, M2).
 * The tip is sent as a kind:23402 Nostr event to the author's Spore pubkey.
 * Gas is sponsored by SuperPaymaster (gasless for end user).
 */
export function PaymentModal({ note, usdcAddress, onClose, onSuccess }: PaymentModalProps) {
  const { tip, status, error, reset } = usePayment();
  const [amount, setAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');

  const recipientPubkey = note.author.sporePubkey;
  const finalAmount = customAmount ? parseFloat(customAmount) : amount;
  const atomicAmount = BigInt(Math.round(finalAmount * 1_000_000)); // USDC 6 decimals

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!recipientPubkey) return;

    try {
      const txHash = await tip({
        recipientPubkeyHex: recipientPubkey,
        amount: atomicAmount,
        tokenAddress: usdcAddress,
        message: message.trim() || undefined,
      });
      onSuccess?.(txHash);
    } catch {
      // error is already captured in usePayment's error state
    }
  }

  if (!recipientPubkey) {
    return (
      <div data-testid="payment-modal" role="dialog" aria-modal="true">
        <p data-testid="no-tip-address">该作者未设置收款地址</p>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div data-testid="payment-modal" role="dialog" aria-modal="true">
        <div data-testid="payment-success">
          <span>✅ 打赏成功！</span>
          <p>
            已向 {note.author.displayName ?? note.author.handle} 打赏{' '}
            {finalAmount} USDC
          </p>
        </div>
        <button data-testid="close-btn" onClick={onClose}>
          关闭
        </button>
      </div>
    );
  }

  return (
    <div data-testid="payment-modal" role="dialog" aria-modal="true" aria-label="Tip creator">
      <header>
        <h2>打赏 {note.author.displayName ?? note.author.handle}</h2>
        <button data-testid="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <form data-testid="payment-form" onSubmit={handleSubmit}>
        {/* Preset amounts */}
        <div data-testid="preset-amounts">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              data-testid={`preset-${a}`}
              aria-pressed={!customAmount && amount === a}
              onClick={() => { setAmount(a); setCustomAmount(''); }}
            >
              {a} USDC
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <input
          data-testid="custom-amount-input"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="自定义金额 (USDC)"
          value={customAmount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomAmount(e.target.value)}
        />

        {/* Message */}
        <input
          data-testid="tip-message-input"
          type="text"
          placeholder="留言（可选）"
          value={message}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
          maxLength={100}
        />

        {error && (
          <div data-testid="payment-error" role="alert">
            {error.message}
            <button type="button" onClick={reset}>重试</button>
          </div>
        )}

        <div data-testid="payment-summary">
          打赏金额：{finalAmount} USDC（Gas 由 SuperPaymaster 代付）
        </div>

        <button
          data-testid="confirm-btn"
          type="submit"
          disabled={status === 'pending' || finalAmount <= 0}
        >
          {status === 'pending' ? '处理中…' : `确认打赏 ${finalAmount} USDC`}
        </button>
      </form>
    </div>
  );
}
