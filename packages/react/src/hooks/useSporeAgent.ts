import type { SporeAgent } from '@aastar/messaging';
import { useSporeContext } from '../context/SporeContext.js';

export interface UseSporeAgentResult {
  agent: SporeAgent | null;
  ready: boolean;
  error: Error | null;
}

/**
 * useSporeAgent — access the underlying SporeAgent instance.
 *
 * For most use cases prefer the domain-specific hooks (useDm, useGroup, etc.).
 * Use this only when you need direct access to the agent API.
 */
export function useSporeAgent(): UseSporeAgentResult {
  return useSporeContext();
}
