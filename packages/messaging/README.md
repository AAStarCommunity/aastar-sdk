# @aastar/messaging

> Spore Protocol — Decentralized Agent Messaging SDK

A TypeScript SDK for building AI agents that communicate over [Nostr](https://nostr.com/) and execute gasless on-chain operations via [AAStar](https://github.com/AAStarCommunity). Drop-in compatible with the XMTP agent-sdk API.

---

## Architecture Overview

Spore Protocol is a three-party messaging system:

```
┌─────────────────┐     NIP-17 GiftWrap DM      ┌──────────────────────┐
│  Sender Agent   │  ──────────────────────────► │  Message Relay Node  │
│ @aastar/messaging│     (NIP-44 E2E encrypted)  │  @aastar/message-relay│
└─────────────────┘                              └──────────┬───────────┘
                                                            │ fan-out
                                                            ▼
                                                 ┌──────────────────────┐
                                                 │  Receiver Agent      │
                                                 │  @aastar/messaging   │
                                                 └──────────────────────┘
```

**This package** (`@aastar/messaging`) is the client-side SDK used by both senders and receivers.
**`@aastar/message-relay`** is the separate server-side package for running a relay node.

### Identity Layer

The same `secp256k1` private key serves **both** Ethereum and Nostr — zero conversion needed:

```
EOA Private Key (hex)
        │
        ├──► Ethereum Address  (0x...)   ← for on-chain operations
        └──► Nostr Public Key  (32-byte hex) ← for message routing
```

### Four Layers

| Layer | What it does | Nostr primitives |
|-------|-------------|-----------------|
| **Identity** | EOA key → Nostr keypair | secp256k1 Schnorr |
| **Encryption** | E2E message encryption | NIP-44 (ChaCha20-Poly1305 + HKDF) |
| **Transport** | Encrypted DMs + group messages | NIP-17 Gift Wrap + NIP-29 |
| **On-chain Bridge** | Nostr event → blockchain action | kind:23402–23404 |

---

## Installation

```bash
pnpm add @aastar/messaging
# or
npm install @aastar/messaging
```

**Requirements**: Node.js 22+

---

## Quick Start

### Echo Bot

```typescript
import { SporeAgent } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();

agent.on('text', async (ctx) => {
  await ctx.sendText(`Echo: ${ctx.message.content}`);
});

await agent.start();
console.log(`Agent running — pubkey: ${agent.pubkey}`);
```

**Environment variables:**

```bash
SPORE_WALLET_KEY=0x<64-hex-chars>   # Required: EOA private key
SPORE_RELAYS=wss://relay1,wss://relay2  # Optional: comma-separated relay URLs
SPORE_ENV=dev                            # Optional: dev | production
```

### Explicit Configuration

```typescript
import { SporeAgent } from '@aastar/messaging';

const agent = await SporeAgent.create({
  privateKeyHex: '0xabc123...',
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  env: 'production',
});
```

---

## API Reference

### SporeAgent

The main class. API mirrors [@xmtp/agent-sdk](https://docs.xmtp.org/agents/get-started/connect-to-xmtp) for easy migration.

#### Factory Methods

```typescript
// From environment variables
static async createFromEnv(): Promise<SporeAgent>

// Explicit config
static async create(config: SporeAgentConfig): Promise<SporeAgent>
```

#### Event Handlers

```typescript
agent.on('text',         async (ctx: MessageContext) => { ... })
agent.on('dm',           async (ctx: MessageContext) => { ... })
agent.on('group',        async (ctx: MessageContext) => { ... })
agent.on('message',      async (ctx: MessageContext) => { ... }) // all messages
agent.on('conversation', async (ctx: ConversationContext) => { ... })
agent.on('bridge:error', (kind, event, error) => { ... })        // M2 bridges
agent.on('start',        ({ address, pubkey }) => { ... })
agent.on('stop',         () => { ... })
```

#### Sending Messages

```typescript
// Inside a handler (preferred):
await ctx.sendText('Hello!')
await ctx.conversation.sendText('Hello!')

// Direct send:
await agent.sendDm(recipientPubkey, 'Hello!')
await agent.sendGroupMessage(groupId, memberPubkeys, 'Hello!')
```

#### Identity

```typescript
agent.address   // Ethereum address: '0x...'
agent.pubkey    // Nostr pubkey: 32-byte hex
agent.isRunning // boolean
```

#### Lifecycle

```typescript
await agent.start()  // connect to relays, begin listening
await agent.stop()   // close connections
```

### MessageContext

Passed to `on('text')`, `on('dm')`, `on('group')`, `on('message')`:

```typescript
ctx.message.content       // string
ctx.message.senderPubkey  // Nostr pubkey of sender
ctx.message.conversation  // SporeConversation
ctx.conversation          // ConversationContext (shortcut)

await ctx.sendText('reply')
await ctx.sendTextReply('reply to this message')
```

### ConversationContext

Passed to `on('conversation')`, also accessible via `ctx.conversation`:

```typescript
ctx.conversation.id    // unique conversation ID
ctx.conversation.type  // 'dm' | 'group'
ctx.isDm()             // boolean
ctx.isGroup()          // boolean

await ctx.sendText('message')
```

---

## M2: On-Chain Bridges

Nostr events can trigger on-chain operations via bridge modules. Zero blockchain code is required in your agent unless you explicitly enable bridges.

```typescript
import { SporeAgent, X402Bridge, ChannelBridge, UserOpBridge } from '@aastar/messaging';
import type { X402ClientLike, ChannelClientLike, BundlerClientLike } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();

// Enable x402 payment receiving (kind:23402)
agent.enableX402({
  x402Client: myX402Client,         // implements X402ClientLike
  maxAmountPerRequest: 10_000_000n, // 10 USDC max
});

// Enable channel voucher receiving (kind:23403)
agent.enableChannel({
  channelClient: myChannelClient,   // implements ChannelClientLike
  lazySettleThreshold: 5_000_000n, // settle after 5 USDC accumulated
});

// Enable gasless UserOp triggering (kind:23404)
agent.enableUserOp({
  bundlerClient: myBundlerClient,   // implements BundlerClientLike
  authMode: 'self_only',           // 'self_only' | 'whitelist' | 'open'
  selfAddress: '0x...',
});

agent.on('bridge:error', (kind, event, error) => {
  console.error(`Bridge ${kind} failed:`, error.message);
});

await agent.start();
```

### Bridge Interfaces

All bridge dependencies are **interfaces**, not concrete imports — no `@aastar/x402` or `@aastar/channel` required in `@aastar/messaging` itself:

```typescript
interface X402ClientLike {
  settlePayment(params: { from, to, amount, nonce, validBefore, tokenAddress, chainId, sig }): Promise<{ txHash }>
}

interface ChannelClientLike {
  getChannelState(channelId: string): Promise<ChannelState>
  submitVoucher(params: { channelId, cumulativeAmount, voucherSig }): Promise<{ txHash }>
}

interface BundlerClientLike {
  sendUserOperation(userOp, entryPoint): Promise<{ userOpHash }>
}
```

### Event Kinds

| Kind | Name | Description |
|------|------|-------------|
| `23402` | x402 Payment | EIP-3009 USDC transfer authorization |
| `23403` | Channel Voucher | EIP-712 micro-payment channel voucher |
| `23404` | UserOp Trigger | Gasless ERC-4337 UserOperation trigger |
| `23405` | Storage Commitment | Pay-per-Store relay commitment (M3) |

---

## M3: Pay-per-Store

Relay operators earn USDC for storing and forwarding messages. Senders attach a `kind:23405` EIP-3009 commitment to each message:

```typescript
// Coming in M3 — RelayPool.publishWithPayment()
await agent.sendDmWithPayment(recipientPubkey, 'Hello!', {
  amountPerMessage: 1_000n,    // 0.001 USDC per message
  usdcAddress: '0x0b2C...',
  chainId: 10,                 // Optimism
});
```

Relay nodes validate commitments off-chain (no RPC, <5ms) and batch-settle to their operator address via `@aastar/channel`.

---

## XMTP Compatibility

Migrate from `@xmtp/agent-sdk` by changing one import line:

```typescript
// Before:
import { Agent } from '@xmtp/agent-sdk';
const agent = await Agent.createFromEnv();

// After:
import { SporeAgent as Agent } from '@aastar/messaging';
const agent = await SporeAgent.createFromEnv();
```

Or use the drop-in shim:

```typescript
import { Agent } from '@aastar/messaging/xmtp-compat';
// identical API surface
```

**Key differences vs XMTP:**
- Transport: Nostr WebSocket vs XMTP gRPC
- Identity: EOA secp256k1 (same key for Ethereum + Nostr) vs XMTP Inbox ID
- Nodes: permissionless (anyone can run a relay) vs permissioned (7 vetted operators)
- Encryption: NIP-44 ChaCha20-Poly1305 vs MLS

---

## Running a Relay Node

Use `@aastar/message-relay` to run your own Spore relay node:

```bash
pnpm add @aastar/message-relay
npx spore-relay
# or with Docker:
docker compose up -f packages/message-relay/docker/docker-compose.yml
```

Relay nodes are **permissionless** — anyone can join the network and earn USDC for delivering messages. Register on-chain (optional) via `RelayRegistryClient` to be discoverable.

---

## Relay Discovery

Default relays (dev environment):

```
wss://relay.damus.io
wss://relay.nostr.band
wss://nos.lol
```

Production: set `SPORE_RELAYS` to your preferred relay URLs, or query `RelayRegistry.sol` on Optimism for registered Spore-native relays.

---

## Development

```bash
# Build
pnpm --filter @aastar/messaging build

# Test (31 unit tests)
pnpm --filter @aastar/messaging test
```

---

## License

MIT
