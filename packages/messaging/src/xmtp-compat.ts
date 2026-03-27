// xmtp-compat — XMTP agent-sdk compatibility shim.
//
// Allows existing XMTP agent-sdk users to migrate to Spore Protocol by
// changing only the import path:
//
//   // Before (XMTP):
//   import { Agent, MessageContext, ConversationContext } from '@xmtp/agent-sdk';
//
//   // After (Spore Protocol — zero code changes beyond this line):
//   import { Agent, MessageContext, ConversationContext } from '@aastar/messaging/xmtp-compat';
//
// All class names, method signatures, and event semantics are preserved.

export { SporeAgent as Agent } from './SporeAgent.js';
export { MessageContext } from './MessageContext.js';
export { ConversationContext } from './ConversationContext.js';

// Re-export types so callers can use XMTP-named types
export type { SporeAgentConfig as AgentConfig } from './types.js';
export type { SporeMessage as Message } from './types.js';
export type { SporeConversation as Conversation } from './types.js';
export type { SporeAgentEventMap as AgentEventMap } from './types.js';
