// @aastar/react — React hooks for the Spore Protocol SDK (M14)

// ─── Provider ─────────────────────────────────────────────────────────────────
export { SporeProvider, useSporeContext } from './context/SporeContext.js';
export type { SporeProviderProps, SporeContextValue } from './context/SporeContext.js';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSporeAgent } from './hooks/useSporeAgent.js';
export type { UseSporeAgentResult } from './hooks/useSporeAgent.js';

export { useDm } from './hooks/useDm.js';
export type { UseDmResult } from './hooks/useDm.js';

export { useConversations } from './hooks/useConversations.js';
export type { UseConversationsResult } from './hooks/useConversations.js';

export { useGroup } from './hooks/useGroup.js';
export type { UseGroupResult } from './hooks/useGroup.js';

export { usePayment } from './hooks/usePayment.js';
export type { UsePaymentResult, PaymentStatus, TipParams } from './hooks/usePayment.js';

export { useIdentity } from './hooks/useIdentity.js';
export type { UseIdentityResult } from './hooks/useIdentity.js';

export { useGatewayStream } from './hooks/useGatewayStream.js';
export type { UseGatewayStreamResult } from './hooks/useGatewayStream.js';
