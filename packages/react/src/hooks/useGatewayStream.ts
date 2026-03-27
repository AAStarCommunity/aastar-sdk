import { useEffect, useRef, useState } from 'react';
import type { StreamEvent } from '@aastar/messaging';

export interface UseGatewayStreamResult {
  connected: boolean;
  error: Error | null;
}

/**
 * useGatewayStream — subscribe to SporeHttpGateway SSE stream (M10).
 *
 * Use this in browser environments where you access the Spore network via an
 * HTTP gateway rather than running a SporeAgent directly (e.g. in a Next.js
 * server-side rendered app where Node.js WebSocket connections aren't desired).
 *
 * @param gatewayUrl  - Base URL of the SporeHttpGateway (e.g. "http://localhost:7402")
 * @param token       - Bearer token for gateway authentication
 * @param onMessage   - Callback invoked for each incoming StreamEvent
 *
 * @example
 * ```tsx
 * const { connected } = useGatewayStream(
 *   process.env.NEXT_PUBLIC_GATEWAY_URL!,
 *   process.env.NEXT_PUBLIC_GATEWAY_TOKEN!,
 *   (event) => {
 *     if (event.type === 'message') setMessages(m => [...m, event.message]);
 *   }
 * );
 * ```
 */
/**
 * Validate that a gateway URL uses an allowed protocol (http or https).
 * Prevents SSRF / open-redirect via arbitrary protocol schemes.
 */
function isAllowedGatewayUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function useGatewayStream(
  gatewayUrl: string,
  token: string,
  onMessage?: (event: StreamEvent) => void,
): UseGatewayStreamResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!gatewayUrl || !token) return;

    if (!isAllowedGatewayUrl(gatewayUrl)) {
      setError(new Error(`Invalid gateway URL: must use http or https protocol`));
      return;
    }

    // EventSource doesn't support custom headers — pass token as query param.
    // Note: The token will be visible in server logs and browser network tab.
    const url = `${gatewayUrl}/api/v1/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent;
        onMessageRef.current?.(event);
      } catch {
        // ignore malformed SSE frames
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError(new Error('SSE connection error'));
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [gatewayUrl, token]);

  return { connected, error };
}
