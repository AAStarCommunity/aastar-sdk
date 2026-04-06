# Spore Protocol — Usage Guide

> `@aastar/messaging` v0.1 · M1–M13

This guide covers all milestone features from the perspective of the four roles that interact with the Spore Protocol:

| Role | Who | Primary package |
|------|-----|----------------|
| **Agent Developer** | Builds AI bots / automation agents | `@aastar/messaging` |
| **End User** | Sends/receives messages via a client app | HTTP gateway or XMTP-compatible client |
| **Relay Operator** | Runs infrastructure that routes messages | `@aastar/message-relay` |
| **dApp Integrator** | Embeds messaging into a web/mobile app | `@aastar/messaging` + HTTP gateway |

---

## Table of Contents

1. [Identity & Keys](#1-identity--keys)
2. [Agent Developer](#2-agent-developer)
   - [Echo Bot (M1/M3)](#21-echo-bot-m1m3)
   - [Handling Content Types (M7)](#22-handling-content-types-m7)
   - [Group Conversations (M6)](#23-group-conversations-m6)
   - [MLS End-to-End Encryption (M9)](#24-mls-end-to-end-encryption-m9)
   - [Payment-Gated Actions (M2)](#25-payment-gated-actions-m2)
   - [Multi-Device Identity (M8)](#26-multi-device-identity-m8)
   - [Waku Transport (M12)](#27-waku-transport-m12)
   - [Multi-Transport Redundancy (M13)](#28-multi-transport-redundancy-m13)
3. [End User](#3-end-user)
   - [Sending a Message via HTTP Gateway (M10)](#31-sending-a-message-via-http-gateway-m10)
   - [Streaming Incoming Messages (M10)](#32-streaming-incoming-messages-m10)
4. [Relay Operator](#4-relay-operator)
   - [Running a Relay Node (M4)](#41-running-a-relay-node-m4)
   - [Rate Limiting & Mainnet Checklist (M11)](#42-rate-limiting--mainnet-checklist-m11)
5. [dApp Integrator](#5-dapp-integrator)
   - [HTTP Gateway Integration (M10)](#51-http-gateway-integration-m10)
6. [Incentive Mechanics & Gamification](#6-incentive-mechanics--gamification)
7. [Feature Acceptance Checklist](#7-feature-acceptance-checklist)

---

## 1. Identity & Keys

Every participant uses a **single secp256k1 private key** for both Ethereum and Nostr:

```
EOA Private Key (64-char hex, no 0x prefix)
        │
        ├──► Ethereum Address  (0x...)         — on-chain payments, UserOp auth
        └──► Nostr Public Key  (32-byte hex)   — message routing, encryption
```

**Environment variable** (simplest setup):
```bash
export SPORE_WALLET_KEY=0xabc123...  # or without 0x prefix
```

**Programmatic**:
```typescript
import { SporeAgent } from '@aastar/messaging';

const agent = await SporeAgent.create({
  privateKeyHex: 'abc123...', // 64-char hex, no 0x
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  env: 'production',
});

console.log(agent.pubkey);   // Nostr pubkey (hex)
console.log(agent.address);  // Ethereum address (0x...)
```

---

## 2. Agent Developer

### 2.1 Echo Bot (M1/M3)

Minimal agent that echoes every incoming DM:

```typescript
import { SporeAgent } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();

agent.on('text', async (ctx) => {
  await ctx.sendText(`Echo: ${ctx.message.content}`);
});

await agent.start();
console.log(`Listening on pubkey: ${agent.pubkey}`);
```

**Available events** on `SporeAgent`:

| Event | Payload | When |
|-------|---------|------|
| `text` | `MessageContext` | Plain text DM received |
| `message` | `MessageContext` | Any message (all content types) |
| `group:text` | `MessageContext` | Text in a group conversation |
| `group:message` | `MessageContext` | Any group message |

**MessageContext** methods:
```typescript
ctx.message.content      // decrypted text
ctx.message.senderPubkey // sender's Nostr pubkey
ctx.conversation.id      // conversation identifier
ctx.conversation.type    // 'dm' | 'group'

await ctx.sendText('reply')
await ctx.sendMessage({ content: '...', contentTypeId: 'xmtp.org/reaction:1.0' })
```

### 2.2 Handling Content Types (M7)

M7 adds a codec registry for structured message types:

```typescript
import {
  SporeAgent,
  CodecRegistry,
  ReactionCodec, ContentTypeReaction,
  ReplyCodec,    ContentTypeReply,
  RemoteAttachmentCodec,
} from '@aastar/messaging';

const codecs = new CodecRegistry();
codecs.register(new ReactionCodec());
codecs.register(new ReplyCodec());
codecs.register(new RemoteAttachmentCodec());

const agent = await SporeAgent.create({
  privateKeyHex: process.env.SPORE_WALLET_KEY!,
  codecs,
});

// Send a reaction
await agent.sendMessage(recipientPubkey, {
  content: { action: 'added', reference: 'original-msg-id', schema: 'unicode', content: '👍' },
  contentTypeId: 'xmtp.org/reaction:1.0',
});

// Handle reactions
agent.on('message', (ctx) => {
  if (ctx.message.contentType === 'reaction') {
    const reaction = ctx.decoded; // typed as ReactionContent
    console.log(`${reaction.action} ${reaction.content} on ${reaction.reference}`);
  }
});
```

**Built-in codec IDs:**

| Codec | Content type ID | Content shape |
|-------|----------------|---------------|
| `TextCodec` | `xmtp.org/text:1.0` | `string` |
| `ReactionCodec` | `xmtp.org/reaction:1.0` | `{ action, reference, schema, content }` |
| `ReplyCodec` | `xmtp.org/reply:1.0` | `{ reference, content }` |
| `RemoteAttachmentCodec` | `xmtp.org/remote-attachment:1.0` | `{ url, contentDigest, salt, ... }` |

### 2.3 Group Conversations (M6)

```typescript
// Create a group and add members
const group = await agent.createGroup({
  topic: 'Project Alpha',
  initialMembers: [alicePubkey, bobPubkey],
});
console.log(group.id); // group identifier

// Add/remove members dynamically
await agent.addGroupMember(group.id, charliePubkey);
await agent.removeGroupMember(group.id, bobPubkey);

// Send to group
await agent.sendGroupMessage(group.id, 'Hello team!');

// Listen to group messages
agent.on('group:text', (ctx) => {
  console.log(`[${ctx.conversation.id}] ${ctx.message.senderPubkey}: ${ctx.message.content}`);
});
```

Groups use **NIP-29** kind events (kind:9, kind:9000–9002) published to your relay pool.

### 2.4 MLS End-to-End Encryption (M9)

For groups requiring **forward secrecy and post-compromise security**, use MLS key agreement:

```typescript
// Step 1: Publish your key package (do this at startup)
await agent.publishKeyPackage();

// Step 2: Create an MLS-secured group
const group = await agent.createMlsGroup({
  memberPubkeys: [alicePubkey, bobPubkey],
});

// Step 3: Send MLS-encrypted message
await agent.sendMlsMessage(group.id, 'Ultra-private message');

// Step 4: Rotate epoch (forward secrecy — call periodically or after member changes)
await agent.rotateMlsEpoch(group.id);
```

**MLS Nostr event kinds:**

| Kind | Purpose |
|------|---------|
| `443` | KeyPackage (your ECDH pubkey for this device) |
| `444` | Welcome (epoch key encrypted to new member via NIP-17) |
| `445` | Group message (NIP-44 encrypted with shared epoch key) |

**Epoch derivation:** `epoch-n = HKDF-SHA256(epoch-n-1, "", "spore-mls-next-epoch")`

### 2.5 Payment-Gated Actions (M2)

Lock any agent action behind a payment. Three bridge types are supported:

#### X402 (EIP-3009 instant transfer)

```typescript
import { X402Bridge } from '@aastar/messaging';

agent.registerBridge(new X402Bridge({
  x402Client: myX402Client,       // your X402ClientLike implementation
  requiredAmount: 100n,           // USDC in wei units
  tokenAddress: '0xUSDC...',
  maxValidBeforeWindowSeconds: 86400, // 24h window
}));

// Agent automatically validates kind:23402 payment events before calling your handler
agent.on('text', async (ctx) => {
  // Only reached if sender paid 100 USDC
  await ctx.sendText('Payment verified — here is your premium response.');
});
```

#### State Channel (M2 — micropayments)

For high-frequency, low-value micropayments without on-chain settlement per message:

```typescript
import { ChannelBridge } from '@aastar/messaging';

agent.registerBridge(new ChannelBridge({
  channelClient: myChannelClient,
  lazySettleThreshold: 50,         // settle after 50 outstanding vouchers
  verifyVoucherSig: async (voucher, senderAddress) => {
    return mySignatureVerifier.verify(voucher, senderAddress);
  },
}));
```

Each message bundles a signed voucher (kind:23403). The bridge accumulates vouchers and triggers on-chain settlement when the threshold is reached.

#### ERC-4337 UserOp (M2 — gasless triggers)

For agents that trigger on-chain actions on behalf of users:

```typescript
import { UserOpBridge } from '@aastar/messaging';

agent.registerBridge(new UserOpBridge({
  bundlerClient: myBundlerClient,
  entryPoint: '0xEntryPoint...',
  authMode: 'ecdsa',              // 'ecdsa' | 'session-key'
}));

// kind:23404 events trigger gasless UserOps through your bundler
```

#### Incentive model

```
Sender              Agent (you)          Chain
  │                    │                   │
  │─── kind:23402 ────►│                   │
  │  (payment event)   │─── settle() ─────►│
  │                    │   (ERC-3009 tx)   │
  │◄── kind:1 ────────│                   │
  │  (response DM)     │                   │
```

Agents earn by:
- Charging per-query (X402, one-shot)
- Accumulating vouchers until settlement threshold (Channel, micropayment stream)
- Sponsoring gas and recouping via paymaster (UserOp)

### 2.6 Multi-Device Identity (M8)

```typescript
// Publish your profile (kind:0)
await agent.publishProfile({
  name: 'AliceBot',
  about: 'AI assistant on Spore',
  picture: 'https://...',
  website: 'https://mybot.xyz',
});

// Link a new device (kind:10001 device list)
const newDevicePubkey = '...';
await agent.linkDevice(newDevicePubkey, { label: 'Mobile device' });

// Fetch another user's linked devices
const devices = await agent.fetchLinkedDevices(alicePubkey);

// Unlink a lost device
await agent.unlinkDevice(oldDevicePubkey);
```

### 2.7 Waku Transport (M12)

Replace Nostr relays with **Waku v2 (libp2p GossipSub)** for relay-operator-free messaging:

```typescript
import { createLightNode } from '@waku/sdk';
import { SporeAgent, WakuTransport, NostrTransport } from '@aastar/messaging';
import { RelayPool } from '@aastar/messaging';

// Set up Waku node
const wakuNode = await createLightNode({ defaultBootstrap: true });
await wakuNode.start();

// Create WakuTransport (injects your Waku node)
const wakuTransport = new WakuTransport({ node: wakuNode });

// Use WakuTransport with SporeAgent via the HTTP gateway pattern
// (SporeAgent.create() currently defaults to NostrTransport; Waku is used
//  directly via WakuTransport.sendDm / subscribeToDms for Waku-native apps)
```

**Content topic convention:**
- DM: `/spore/1/dm-{recipientPubkeyHex}/proto`
- Group: `/spore/1/group-{groupId}/proto`

**Security note:** The `from` field in Waku envelopes is not cryptographically verified at the transport layer. Always verify that NIP-44 decryption succeeds with the claimed sender pubkey before trusting `senderPubkey`.

### 2.8 Multi-Transport Redundancy (M13)

Run Nostr and Waku in parallel. Messages are sent to both; duplicates are automatically dropped on receive:

```typescript
import { MultiTransport, WakuTransport, NostrTransport } from '@aastar/messaging';
import { RelayPool } from '@aastar/messaging';

const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol']);
const nostr = new NostrTransport(pool);
const waku = new WakuTransport({ node: wakuNode });

const transport = new MultiTransport({
  transports: [nostr, waku],
  seenTtlMs: 300_000, // 5-minute dedup window
});

// Use transport.sendDm(), transport.subscribeToDms(), etc.
// Sends go to BOTH Nostr and Waku; incoming messages are deduplicated by ID
```

**Fallback logic:** If Nostr fails, the hash from Waku is returned (and vice versa). Only throws if all transports fail.

---

## 3. End User

End users interact through a **client application** that talks to the HTTP/SSE Gateway (M10). No Nostr SDK required.

### 3.1 Sending a Message via HTTP Gateway (M10)

```bash
# Send a DM
curl -X POST http://localhost:7402/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d '{
    "to": "a1b2c3d4e5f6...",   // 64-char hex recipient pubkey
    "content": "Hello!"
  }'
# → { "id": "nostr-event-id-here" }

# List conversations
curl http://localhost:7402/api/v1/conversations \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
# → { "conversations": [{ "peerAddress": "a1b2c3..." }, ...] }

# Fetch messages with a peer
curl "http://localhost:7402/api/v1/messages?peer=a1b2c3...&limit=20" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

### 3.2 Streaming Incoming Messages (M10)

Use Server-Sent Events to receive messages in real time:

```javascript
// Browser / Node.js EventSource
const stream = new EventSource('http://localhost:7402/api/v1/stream', {
  headers: { Authorization: 'Bearer ' + GATEWAY_TOKEN }
});

stream.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === 'message') {
    console.log(`From: ${event.from}`);
    console.log(`Content: ${event.content}`);
  }
};
```

**Python client example:**
```python
import sseclient, requests

with requests.get(
    'http://localhost:7402/api/v1/stream',
    headers={'Authorization': 'Bearer TOKEN'},
    stream=True
) as r:
    for event in sseclient.SSEClient(r).events():
        print(event.data)
```

**Gateway API reference:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Liveness probe; returns `{ status, pubkey, address }` |
| `POST` | `/api/v1/messages/send` | Send DM to a pubkey |
| `GET` | `/api/v1/conversations` | List known conversations |
| `GET` | `/api/v1/messages?peer=&limit=` | Fetch message history with a peer |
| `GET` | `/api/v1/stream` | SSE stream of incoming messages |

---

## 4. Relay Operator

### 4.1 Running a Relay Node (M4)

```bash
# Install
pnpm add @aastar/message-relay

# Start with environment variables
RELAY_PORT=8080 \
RELAY_AUTH_SECRET=my-secret \
RELAY_UPSTREAM_RELAYS=wss://relay.damus.io,wss://nos.lol \
node dist/index.js
```

The relay node:
- Forwards Nostr events to upstream relays
- Validates EIP-712 authorization signatures (DoS prevention)
- Rate-limits per sender pubkey
- Earns fees from X402 / Channel bridge payments passing through (see [Incentive Mechanics](#6-incentive-mechanics--gamification))

### 4.2 Rate Limiting & Mainnet Checklist (M11)

**RateLimiter** — token bucket, injectable store:

```typescript
import { RateLimiter, InMemoryRateLimitStore } from '@aastar/messaging';

const limiter = new RateLimiter({
  tokensPerInterval: 10,   // 10 messages
  intervalMs: 60_000,      // per minute
  burstLimit: 20,          // burst allowance
  store: new InMemoryRateLimitStore(),
});

// In your message handler:
if (!(await limiter.allow(senderPubkey))) {
  return; // drop — too many requests
}
```

**MainnetChecklist** — run before production launch:

```typescript
import { runMainnetChecklist } from '@aastar/messaging';

const report = await runMainnetChecklist({
  relays: agent.relays,
  rateLimiter: limiter,
  nonceStore: myNonceStore,
  x402BridgeConfig: { maxValidBeforeWindowSeconds: 86400 },
  gatewayConfig: { authToken: 'set', requestTimeoutMs: 30000 },
});

console.table(report.results.map(r => ({
  id: r.id, name: r.name, passed: r.passed, severity: r.severity
})));
// Prints: SEC-1 through SEC-9
```

**Checklist checks:**

| ID | Check | Severity |
|----|-------|----------|
| SEC-1 | All relay URLs use `wss://` (not `ws://`) | HIGH |
| SEC-2 | RateLimiter is configured | HIGH |
| SEC-3 | Persistent nonce store (not in-memory) | HIGH |
| SEC-4 | Voucher signature verification enabled | CRIT |
| SEC-5 | Gateway auth token is set | HIGH |
| SEC-6 | Gateway request timeout is configured | MED |
| SEC-7 | X402 validity window ≤ 24 hours | MED |
| SEC-8 | UserOp auth mode is set | HIGH |
| SEC-9 | At least 2 relay URLs configured | LOW |

---

## 5. dApp Integrator

### 5.1 HTTP Gateway Integration (M10)

Start the gateway alongside your agent:

```typescript
import { SporeAgent, SporeHttpGateway } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();
await agent.start();

const gateway = new SporeHttpGateway({
  agent,
  port: 7402,
  host: '127.0.0.1',       // localhost only; put Nginx in front for external access
  authToken: process.env.GATEWAY_AUTH_TOKEN,
  maxBodyBytes: 65536,
  maxSseClients: 100,
  requestTimeoutMs: 30000,
});
await gateway.start();

console.log(`Gateway on http://127.0.0.1:${gateway.port}`);
```

**React integration (polling):**
```typescript
const [messages, setMessages] = useState([]);

useEffect(() => {
  const es = new EventSource('/api/v1/stream');
  es.onmessage = (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === 'message') setMessages(m => [...m, ev]);
  };
  return () => es.close();
}, []);
```

---

## 6. Incentive Mechanics & Gamification

### Payment Flow Overview

```
 User/Agent (Sender)                Your Agent                  Blockchain
        │                               │                           │
        │── NIP-17 DM ─────────────────►│                           │
        │   with kind:23402/3/4 event   │                           │
        │                               │─── validate payment ─────►│
        │                               │◄── confirmed ─────────────│
        │                               │                           │
        │◄── response DM ───────────────│                           │
```

### Earning as an Agent Operator

| Bridge | Model | When to use |
|--------|-------|-------------|
| **X402** | Fixed fee per request (ERC-3009 approve+transfer) | API-style services, one-off queries |
| **Channel** | Streaming micropayments via off-chain vouchers | High-frequency interactions, subscriptions |
| **UserOp** | Gas sponsorship (agent pays gas, recoups from paymaster) | Gasless UX for end users |

### Earning as a Relay Operator

Relay operators earn by:
1. **Relay fees**: Charge agents a small fee (kind:23402) to publish events through your relay
2. **Uptime rewards**: Future MushroomDAO protocol will distribute PNTS to high-availability relays
3. **Storage fees**: kind:23405 events commit pay-per-store storage fees to the operator

### Incentive Multipliers

- **Reputation SBT**: Agents and users accumulate on-chain SBTs through AirAccount. Higher reputation = lower required payment thresholds (operators can offer tiered pricing)
- **xPNTs staking**: Stake xPNTs to unlock discounted relay fees and priority queue placement
- **Channel voucher compounding**: High-volume channels earn compound APY by holding vouchers until optimal settlement gas conditions

### Testing Incentive Flows

```bash
# 1. Start local Anvil with SuperPaymaster contracts
./run_sdk_regression.sh --env anvil

# 2. Run end-to-end incentive scenario
pnpm tsx scripts/06_local_test_v3_full.ts

# 3. Verify channel voucher settlement
pnpm tsx tests/regression/index.ts --network=anvil

# Expected output:
# ✓ X402 payment validated
# ✓ Channel voucher accumulated (n/50)
# ✓ Settlement triggered at threshold
# ✓ On-chain balance updated
```

---

## 7. Feature Acceptance Checklist

Use this checklist to verify each milestone is working correctly in your environment.

### M1 — NIP-17 DM Transport

- [ ] Agent starts and logs pubkey
- [ ] Send a DM from another Nostr client → agent `text` event fires
- [ ] Agent reply arrives in the sender's Nostr client
- [ ] NIP-17 gift-wrap seal verified (not plain NIP-04)

### M2 — Payment Bridges

- [ ] kind:23402 X402 event received → payment validated → handler fires
- [ ] kind:23402 with wrong amount → handler does NOT fire, logs rejection
- [ ] Channel voucher accumulates to threshold → settlement triggered
- [ ] UserOp bridge triggers gasless transaction through bundler

### M3 — SporeAgent & Relay Pool

- [ ] `createFromEnv()` reads `SPORE_WALLET_KEY` and `SPORE_RELAYS`
- [ ] Agent reconnects to relay after disconnect
- [ ] `agent.pubkey` and `agent.address` are consistent (same secp256k1 key)

### M4 — Message Relay Node

- [ ] Relay node starts and accepts WebSocket connections
- [ ] EIP-712 auth signature rejected if malformed
- [ ] Rate limiting kicks in after configured threshold

### M5 — Conversations API

- [ ] `listConversations()` returns conversations from relay history
- [ ] `getMessages(convId, { limit: 10 })` returns correct messages
- [ ] `streamAllMessages()` yields new messages as they arrive

### M6 — Group Management

- [ ] `createGroup({ initialMembers })` returns a group with correct members
- [ ] `addGroupMember` → new member receives subsequent messages
- [ ] `removeGroupMember` → removed member stops receiving group messages
- [ ] Group `kind:9` events visible on relay

### M7 — Content Type Codecs

- [ ] `TextCodec` encodes and decodes plain text
- [ ] `ReactionCodec` round-trips `{ action, reference, schema, content }`
- [ ] `ReplyCodec` round-trips `{ reference, content }`
- [ ] `RemoteAttachmentCodec` round-trips attachment metadata
- [ ] Unknown content type ID passes through as raw string

### M8 — Identity Registry + Multi-Device

- [ ] `publishProfile()` emits kind:0 event visible on relay
- [ ] `linkDevice()` emits kind:10001 event
- [ ] `fetchLinkedDevices(pubkey)` returns correct device list
- [ ] Reserved profile keys (`nostrPubkey`, `ethAddress`) cannot be overridden

### M9 — MLS Key Agreement

- [ ] `publishKeyPackage()` emits kind:443
- [ ] `createMlsGroup()` sends kind:444 Welcome to all members
- [ ] `sendMlsMessage()` emits kind:445 encrypted with current epoch key
- [ ] `rotateMlsEpoch()` increments epoch; old epoch key is discarded
- [ ] Replaying a kind:445 from a previous epoch fails to decrypt

### M10 — HTTP/SSE Gateway

- [ ] `GET /api/v1/health` returns `{ status: "ok", pubkey, address }`
- [ ] `POST /api/v1/messages/send` with valid pubkey → returns `{ id }`
- [ ] `POST` with invalid pubkey (not 64-char hex) → 400 error
- [ ] `GET /api/v1/stream` streams `data: {"type":"message",...}` events
- [ ] Missing/wrong `Authorization` header → 401
- [ ] Body > `maxBodyBytes` → 413

### M11 — Mainnet Hardening

- [ ] `RateLimiter.allow(key)` returns `false` after burst exhausted
- [ ] Tokens refill correctly after `intervalMs`
- [ ] `runMainnetChecklist()` passes all 9 checks on a production config
- [ ] SEC-4 (voucher sig) fails when `skipVoucherSigVerification: true` is used in production

### M12 — Waku Transport

- [ ] `WakuTransport.sendDm()` publishes to `/spore/1/dm-{pubkey}/proto`
- [ ] `subscribeToDms()` receives and decodes incoming envelope
- [ ] Malformed payload silently dropped (no crash)
- [ ] AbortSignal stops message delivery after abort

### M13 — Multi-Transport

- [ ] `MultiTransport` with [Nostr, Waku] sends to both
- [ ] If one transport fails, hash from the other is returned
- [ ] Same message arriving on both transports fires `onMessage` only once
- [ ] `queryMessages()` merges and deduplicates results from all transports
