// GatewayTypes — request/response shapes for SporeHttpGateway REST API.
//
// The API surface is intentionally compatible with the XMTP HTTP Agent API:
//   POST /api/v1/messages/send
//   GET  /api/v1/conversations
//   GET  /api/v1/messages?peer=<hex>&limit=<n>
//   GET  /api/v1/stream  (Server-Sent Events)
//
// This allows existing XMTP HTTP clients to migrate by changing only the base URL.

// ─── Send ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/messages/send request body */
export interface SendMessageRequest {
  /** Recipient Nostr hex pubkey — exactly 64 lowercase/uppercase hex characters */
  to: string;
  /** Plaintext message content */
  content: string;
  /** MIME content type (default: "text/plain") */
  contentType?: string;
}

/** POST /api/v1/messages/send response */
export interface SendMessageResponse {
  /** Nostr event ID of the sent gift-wrap */
  id: string;
}

// ─── Conversations ────────────────────────────────────────────────────────────

/** Conversation summary returned by GET /api/v1/conversations */
export interface ConversationSummary {
  /** Peer's Nostr hex pubkey */
  peerAddress: string;
  /** Latest message in this conversation (may be absent for new convos) */
  lastMessage?: MessageSummary;
}

/** GET /api/v1/conversations response */
export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/** Single message returned by GET /api/v1/messages */
export interface MessageSummary {
  /** Nostr event ID */
  id: string;
  /** Sender's Nostr hex pubkey */
  senderAddress: string;
  /** Plaintext content */
  content: string;
  /** Unix timestamp (seconds) */
  sentAt: number;
  /** MIME content type */
  contentType: string;
}

/** GET /api/v1/messages response */
export interface MessagesResponse {
  messages: MessageSummary[];
}

// ─── Stream ───────────────────────────────────────────────────────────────────

/**
 * SSE event data for GET /api/v1/stream.
 * Each Server-Sent Event carries a JSON-encoded StreamEvent.
 */
export interface StreamEvent {
  type: 'message' | 'connected' | 'error';
  /** Sender pubkey (present when type = "message") */
  from?: string;
  /** Message content (present when type = "message") */
  content?: string;
  /** Nostr event ID (present when type = "message") */
  id?: string;
  /** Unix timestamp (present when type = "message") */
  sentAt?: number;
  /** Error detail (present when type = "error") */
  error?: string;
}

// ─── Error ────────────────────────────────────────────────────────────────────

/** Standard error response body */
export interface GatewayErrorResponse {
  error: string;
}
