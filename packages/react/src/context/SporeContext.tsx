import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SporeAgent, type SporeAgentConfig } from '@aastar/messaging';

// ─── Context types ─────────────────────────────────────────────────────────────

export interface SporeContextValue {
  agent: SporeAgent | null;
  ready: boolean;
  error: Error | null;
}

const SporeContext = createContext<SporeContextValue>({
  agent: null,
  ready: false,
  error: null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface SporeProviderProps {
  privateKeyHex: string;
  /** Additional SporeAgent config (relays, env, codecs, etc.) */
  config?: Omit<SporeAgentConfig, 'privateKeyHex'>;
  children: ReactNode;
}

/**
 * SporeProvider — initialises a SporeAgent and makes it available
 * to all child hooks via context.
 *
 * @example
 * ```tsx
 * <SporeProvider privateKeyHex={process.env.SPORE_WALLET_KEY!}>
 *   <App />
 * </SporeProvider>
 * ```
 */
export function SporeProvider({ privateKeyHex, config, children }: SporeProviderProps) {
  const [ctx, setCtx] = useState<SporeContextValue>({
    agent: null,
    ready: false,
    error: null,
  });
  const agentRef = useRef<SporeAgent | null>(null);

  useEffect(() => {
    let cancelled = false;

    SporeAgent.create({ privateKeyHex, ...config })
      .then((agent) => {
        if (cancelled) {
          agent.stop();
          return;
        }
        agentRef.current = agent;
        setCtx({ agent, ready: true, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCtx({
            agent: null,
            ready: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });

    return () => {
      cancelled = true;
      agentRef.current?.stop();
      agentRef.current = null;
    };
    // config is intentionally excluded — only re-init on key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateKeyHex]);

  return <SporeContext.Provider value={ctx}>{children}</SporeContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Returns the raw SporeContext — prefer the domain-specific hooks. */
export function useSporeContext(): SporeContextValue {
  return useContext(SporeContext);
}
