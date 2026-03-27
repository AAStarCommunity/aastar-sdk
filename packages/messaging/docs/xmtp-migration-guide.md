# XMTP → Spore Protocol Migration Guide

> For developers currently using `@xmtp/agent-sdk` or `@xmtp/react-sdk`

---

## Why Migrate?

| Feature | XMTP | Spore Protocol |
|---------|------|----------------|
| Transport | XMTP network (MLS) | Nostr relays + Waku (your choice) |
| Encryption | MLS (libXMTP) | NIP-44 (ChaCha20-Poly1305 + HKDF) + MLS (M9) |
| Identity | XMTP inbox ID | AirAccount EOA key — same key for ETH + messaging |
| Gas | Not applicable | Gasless via SuperPaymaster (ERC-4337) |
| Payment | Not built-in | X402 / Channel / UserOp bridges (built-in) |
| Relay operators | XMTP nodes (permissioned) | Any Nostr relay / Waku (permissionless) |
| Self-hosting | No | Yes — run your own relay + gateway |
| Open source infra | Partial | Fully open (relay, agent, contracts) |
| AI agent payments | Not built-in | Native (kind:23402–23404) |

**Key motivation**: Spore Protocol lets you own your relay infrastructure, charge for agent services natively, and use the same private key your users already have for their Ethereum wallet — zero new key onboarding friction.

---

## Compatibility Layer (Zero-Code Migration)

The fastest migration path — **change only one import line**:

```typescript
// ─── Before (XMTP agent-sdk) ─────────────────────────────────────────────────
import { Agent, MessageContext, ConversationContext } from '@xmtp/agent-sdk';

// ─── After (Spore Protocol — identical API) ───────────────────────────────────
import { Agent, MessageContext, ConversationContext } from '@aastar/messaging/xmtp-compat';
```

All class names, method signatures, and event semantics are preserved. Your existing agent code runs unchanged.

### Install

```bash
pnpm add @aastar/messaging
# or
npm install @aastar/messaging
```

### Environment Variables

```bash
# XMTP used:
XMTP_ENV=production
WALLET_KEY=0xabc123...

# Spore Protocol uses:
SPORE_ENV=production
SPORE_WALLET_KEY=0xabc123...     # same private key — no new wallet needed
SPORE_RELAYS=wss://relay.damus.io,wss://nos.lol  # optional; has defaults
```

---

## API Mapping

### Agent creation

```typescript
// XMTP
import { Agent } from '@xmtp/agent-sdk';
const agent = await Agent.create({ walletKey: process.env.WALLET_KEY });

// Spore
import { SporeAgent } from '@aastar/messaging';
const agent = await SporeAgent.createFromEnv();
// or:
const agent = await SporeAgent.create({ privateKeyHex: process.env.SPORE_WALLET_KEY! });
```

### Event handlers

```typescript
// XMTP
agent.on('message', async (ctx) => {
  const { content, senderAddress, conversation } = ctx.message;
  await ctx.reply('Hello back');
});

// Spore — identical
agent.on('text', async (ctx) => {
  const { content, senderPubkey, conversation } = ctx.message;
  await ctx.sendText('Hello back');   // ctx.reply() also works via xmtp-compat
});
```

### Sending messages

```typescript
// XMTP
await client.conversations.newConversation(peerAddress);
await conversation.send('Hello!');

// Spore
await agent.sendDm(recipientPubkeyHex, 'Hello!');
// Conversations are created implicitly on first send
```

### Listing conversations

```typescript
// XMTP
const convs = await client.conversations.list();

// Spore
const convs = agent.listConversations();
```

### Getting message history

```typescript
// XMTP
const messages = await conversation.messages({ limit: 20 });

// Spore
const messages = await agent.getMessages(convId, { limit: 20 });
```

### Streaming messages

```typescript
// XMTP
for await (const message of await client.conversations.streamAllMessages()) {
  console.log(message.content);
}

// Spore
const unsub = await agent.streamAllMessages(({ message }) => {
  console.log(message.content);
});
// cleanup:
unsub();
```

---

## Type Mapping

| XMTP type | Spore type | Notes |
|-----------|-----------|-------|
| `Agent` | `SporeAgent` | Same API via xmtp-compat |
| `MessageContext` | `MessageContext` | Identical |
| `ConversationContext` | `ConversationContext` | Identical |
| `AgentConfig` | `SporeAgentConfig` | `walletKey` → `privateKeyHex` |
| `Message` | `SporeMessage` | `senderAddress` → `senderPubkey` |
| `Conversation` | `SporeConversation` | `peerAddress` → peer pubkey |
| `ContentType` | `MessageContentType` | `'text'` \| `'reaction'` \| `'reply'` \| `'attachment'` |

---

## Content Type Codecs (M7)

XMTP content types are fully supported:

```typescript
import {
  SporeAgent,
  ReactionCodec,
  ReplyCodec,
  RemoteAttachmentCodec,
  CodecRegistry,
} from '@aastar/messaging';

const codecs = new CodecRegistry();
codecs.register(new ReactionCodec());     // xmtp.org/reaction:1.0
codecs.register(new ReplyCodec());        // xmtp.org/reply:1.0
codecs.register(new RemoteAttachmentCodec()); // xmtp.org/remote-attachment:1.0

const agent = await SporeAgent.create({ privateKeyHex: '...', codecs });
```

Content type IDs match XMTP's namespace (`xmtp.org/*`) so cross-protocol messages parse correctly.

---

## Identity Differences

### XMTP Identity
- XMTP creates an "inbox ID" separate from your wallet
- Users need to authorize XMTP separately from their wallet
- Key rotation managed by XMTP network

### Spore Identity
- One secp256k1 key → both Ethereum address and Nostr pubkey
- No separate authorization step — the same key signs Nostr events and ETH txs
- Key rotation via `linkDevice()` / `unlinkDevice()` (M8)

**Migration note:** XMTP inbox IDs and Spore pubkeys are different address spaces — existing XMTP conversation history is not automatically portable. Users will need to re-establish conversations with Spore-based agents.

---

## React SDK Migration

If you use `@xmtp/react-sdk`, replace with the HTTP gateway (M10) + standard fetch:

```typescript
// XMTP React SDK
import { useClient, useMessages, useSendMessage } from '@xmtp/react-sdk';

const { client } = useClient();
const { messages } = useMessages(conversation);
const { sendMessage } = useSendMessage();

// Spore: use the HTTP gateway (no React SDK needed)
const GATEWAY = 'http://localhost:7402';
const TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN;

// Send
await fetch(`${GATEWAY}/api/v1/messages/send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({ to: recipientPubkey, content: 'Hello!' }),
});

// List conversations
const { conversations } = await fetch(`${GATEWAY}/api/v1/conversations`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then(r => r.json());

// Stream (SSE)
const es = new EventSource(`${GATEWAY}/api/v1/stream`);
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === 'message') setMessages(m => [...m, event]);
};
```

Or use the community-maintained `@aastar/react` hooks package (coming in M14).

---

## Feature Parity Checklist

| XMTP feature | Spore equivalent | Status |
|-------------|-----------------|--------|
| 1-to-1 encrypted DMs | NIP-17 gift-wrap (M1) | ✅ |
| Group conversations | NIP-29 groups (M6) | ✅ |
| MLS E2E encryption | SporeKeyAgreement (M9) | ✅ |
| Content type codecs | CodecRegistry (M7) | ✅ |
| Message history | Relay query + Store (M5/M12) | ✅ |
| Multi-device | kind:10001 device list (M8) | ✅ |
| React SDK | HTTP gateway (M10) | ✅ via REST |
| Stream all messages | streamAllMessages (M5) | ✅ |
| Inbox ID | AirAccount pubkey | ✅ (different address space) |
| Push notifications | — | 🔜 M14 |
| XMTP → Spore conversation bridge | — | 🔜 M15 |

---

## Step-by-Step Migration Checklist

```
1. [ ] Install @aastar/messaging
2. [ ] Rename WALLET_KEY → SPORE_WALLET_KEY in .env
3. [ ] Add SPORE_RELAYS=wss://... (or use defaults)
4. [ ] Change import line to @aastar/messaging/xmtp-compat (zero other changes)
5. [ ] Run your test suite — should pass without changes
6. [ ] Replace senderAddress references with senderPubkey in your own logic
7. [ ] (Optional) Add payment bridge for monetization
8. [ ] (Optional) Publish agent profile via agent.publishProfile()
9. [ ] (Optional) Run runMainnetChecklist() before production launch
```

---

## Getting Help

- GitHub Issues: github.com/AAStarCommunity/aastar-sdk/issues
- Discord: discord.gg/aastar (`#xmtp-migration` channel)
- Docs: packages/messaging/docs/
