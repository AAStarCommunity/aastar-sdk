import { useCallback, useState } from 'react';
import { useSporeContext } from '../context/SporeContext.js';

export type PaymentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface TipParams {
  /** Recipient Nostr pubkey (hex) */
  recipientPubkeyHex: string;
  /** Amount in atomic units (e.g. USDC 6 decimals: 1_000_000 = 1 USDC) */
  amount: bigint;
  /** Token address (e.g. USDC on Optimism) */
  tokenAddress: string;
  /** Optional message to accompany the tip */
  message?: string;
}

export interface UsePaymentResult {
  /** Send a micropayment tip to another agent/user */
  tip: (params: TipParams) => Promise<string>;
  status: PaymentStatus;
  error: Error | null;
  reset: () => void;
}

/**
 * usePayment — send micropayment tips using the X402 bridge.
 *
 * The agent encodes the payment as a kind:23402 Nostr event; the recipient's
 * SporeAgent processes it with an X402Bridge for on-chain settlement.
 *
 * @example
 * ```tsx
 * const { tip, status } = usePayment();
 * await tip({ recipientPubkeyHex: peer, amount: 1_000_000n, tokenAddress: USDC });
 * ```
 */
export function usePayment(): UsePaymentResult {
  const { agent } = useSporeContext();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const tip = useCallback(
    async ({ recipientPubkeyHex, amount, tokenAddress, message }: TipParams): Promise<string> => {
      if (!agent) throw new Error('SporeAgent not ready');

      setStatus('pending');
      setError(null);

      try {
        // Encode the tip as an X402 payment event message.
        // The content is a JSON payload the recipient decodes with X402Bridge.
        const payload = JSON.stringify({
          type: 'x402-tip',
          amount: amount.toString(),
          token: tokenAddress,
          message: message ?? '',
        });
        const hash = await agent.sendDm(recipientPubkeyHex, payload);
        setStatus('success');
        return hash;
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('error');
        throw e;
      }
    },
    [agent],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { tip, status, error, reset };
}
