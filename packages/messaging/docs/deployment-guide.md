# Spore Protocol — Deployment Guide

> `@aastar/messaging` v0.1 · M1–M13

This guide covers deploying the Spore Protocol SDK in three configurations:

| Configuration | Use case |
|--------------|---------|
| **Local Dev** | Rapid iteration with Anvil + local relay |
| **Testnet** | Integration testing against Sepolia / Optimism Sepolia |
| **Production** | Mainnet-ready deployment with hardening checklist |

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Running an Agent](#3-running-an-agent)
4. [Running the HTTP/SSE Gateway](#4-running-the-httpsse-gateway-m10)
5. [Running the Message Relay Node](#5-running-the-message-relay-node-m4)
6. [Waku Node Setup](#6-waku-node-setup-m12)
7. [Testnet Deployment](#7-testnet-deployment)
8. [Production Deployment](#8-production-deployment)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Docker Compose Example](#10-docker-compose-example)
11. [Monitoring & Health Checks](#11-monitoring--health-checks)
12. [Upgrade Path](#12-upgrade-path)

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 22+ | ESM required |
| pnpm | 9+ | `npm install -g pnpm` |
| Anvil | latest | `cargo install --git https://github.com/foundry-rs/foundry anvil` |
| Git | any | |

**Optional (for Waku transport):**
- `@waku/sdk` peer dependency: `pnpm add @waku/sdk`

**Clone and build:**
```bash
git clone https://github.com/AAStarCommunity/aastar-sdk
cd aastar-sdk
pnpm install
pnpm -r build
```

---

## 2. Local Development

### Start Anvil + Deploy Contracts

```bash
# Start local Anvil node + deploy SuperPaymaster contracts
./run_sdk_regression.sh

# Or: run against a specific network
./run_sdk_regression.sh --env sepolia
```

This script:
1. Starts Anvil on port 8545
2. Deploys EntryPoint, SuperPaymaster, Registry, SBT contracts
3. Writes contract addresses to `config.anvil.json`
4. Runs L1–L4 regression tests

### Start a Test Relay (Nostr)

Use any Nostr relay. For local dev, `nostr-rs-relay` or `strfry` works well:

```bash
# Using nostr-rs-relay (Rust)
docker run -p 7000:7000 scsibug/nostr-rs-relay

# Then point your agent at it:
export SPORE_RELAYS=ws://localhost:7000
```

### Run Unit Tests

```bash
# All packages
pnpm -r test

# Messaging package only
pnpm --filter @aastar/messaging test

# Watch mode
pnpm --filter @aastar/messaging exec vitest
```

### Run a Specific Test File

```bash
pnpm exec vitest run packages/messaging/src/__tests__/WakuTransport.test.ts
```

---

## 3. Running an Agent

### Minimal Echo Bot

**`agent.ts`:**
```typescript
import { SporeAgent } from '@aastar/messaging';

async function main() {
  const agent = await SporeAgent.createFromEnv();

  agent.on('text', async (ctx) => {
    console.log(`[DM] ${ctx.message.senderPubkey.slice(0,8)}: ${ctx.message.content}`);
    await ctx.sendText(`Echo: ${ctx.message.content}`);
  });

  await agent.start();
  console.log(`Agent running — pubkey: ${agent.pubkey}`);
  console.log(`Ethereum address: ${agent.address}`);
}

main().catch(console.error);
```

**Run:**
```bash
SPORE_WALLET_KEY=0xabc123... \
SPORE_RELAYS=wss://relay.damus.io,wss://nos.lol \
SPORE_ENV=production \
node --loader ts-node/esm agent.ts
# Or compile first:
pnpm exec tsc && node dist/agent.js
```

### Production Agent with Payment Bridge

**`agent-paid.ts`:**
```typescript
import { SporeAgent, X402Bridge, FileNonceStore } from '@aastar/messaging';

const agent = await SporeAgent.create({
  privateKeyHex: process.env.SPORE_WALLET_KEY!,
  relays: process.env.SPORE_RELAYS!.split(','),
  env: 'production',
});

agent.useX402Bridge({
  x402Client: myX402Client,
  requiredAmount: 1_000_000n,          // 1 USDC (6 decimals)
  tokenAddress: '0xUSDC_ADDRESS',
  nonceStore: new FileNonceStore('./data/nonces.json'),
  maxValidBeforeWindowSeconds: 86400,  // 24h
});

agent.on('text', async (ctx) => {
  await ctx.sendText('Premium response here.');
});

await agent.start();
```

### Persistent Nonce Store

Use `FileNonceStore` (not `InMemoryNonceStore`) in production to prevent replay attacks across restarts:

```typescript
import { FileNonceStore } from '@aastar/messaging';

const nonceStore = new FileNonceStore('./data/payment-nonces.json');
// Backed by a JSON file. Survives process restarts.
// Note: single-process only — use a database store for multi-instance deployments.
```

---

## 4. Running the HTTP/SSE Gateway (M10)

The gateway exposes a REST+SSE API so non-JS clients (Python, Go, mobile) can interact with your agent.

### Basic Setup

```typescript
import { SporeAgent, SporeHttpGateway } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();
await agent.start();

const gateway = new SporeHttpGateway({
  agent,
  port: parseInt(process.env.GATEWAY_PORT ?? '7402'),
  host: '127.0.0.1',                         // bind to localhost; Nginx handles external TLS
  authToken: process.env.GATEWAY_AUTH_TOKEN,  // required in production
  maxBodyBytes: 65536,                        // 64 KB request limit
  maxSseClients: 100,                         // max concurrent SSE connections
  requestTimeoutMs: 30000,                    // 30s socket timeout (DoS protection)
});
await gateway.start();
console.log(`Gateway: http://127.0.0.1:${gateway.port}`);
```

### Nginx Reverse Proxy (TLS + external access)

```nginx
server {
    listen 443 ssl;
    server_name gateway.yourbot.xyz;

    ssl_certificate     /etc/letsencrypt/live/gateway.yourbot.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.yourbot.xyz/privkey.pem;

    location /api/v1/stream {
        proxy_pass http://127.0.0.1:7402;
        proxy_http_version 1.1;
        proxy_set_header Connection '';          # SSE: keep connection open
        proxy_buffering off;                     # SSE: disable buffering
        proxy_cache off;
        proxy_read_timeout 3600s;                # SSE: long-lived connection
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    location /api/v1/ {
        proxy_pass http://127.0.0.1:7402;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

### Generating a Gateway Auth Token

```bash
# Generate a cryptographically random token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → store in GATEWAY_AUTH_TOKEN environment variable
```

---

## 5. Running the Message Relay Node (M4)

The relay node (`@aastar/message-relay`) forwards Nostr events, enforces rate limits, and can charge relay fees.

```bash
cd packages/message-relay
pnpm build

RELAY_PORT=8080 \
RELAY_UPSTREAM_RELAYS=wss://relay.damus.io,wss://nos.lol \
RELAY_AUTH_SECRET=your-eip712-domain-secret \
RELAY_RATE_LIMIT_RPS=10 \
node dist/index.js
```

### Relay Operator Checklist

- [ ] Running on a server with static IP
- [ ] TLS certificate configured (Let's Encrypt)
- [ ] Upstream relays are `wss://` (not `ws://`)
- [ ] Rate limiting enabled (`RELAY_RATE_LIMIT_RPS`)
- [ ] Nonce store is persistent (not in-memory)
- [ ] EIP-712 auth validation enabled
- [ ] Monitoring set up (see [Monitoring](#11-monitoring--health-checks))

---

## 6. Waku Node Setup (M12)

Waku provides relay-operator-free P2P messaging via libp2p GossipSub.

### Install Waku SDK

```bash
pnpm add @waku/sdk
```

### Light Node (browser/mobile)

```typescript
import { createLightNode, waitForRemotePeer } from '@waku/sdk';
import { WakuTransport } from '@aastar/messaging';

const wakuNode = await createLightNode({ defaultBootstrap: true });
await wakuNode.start();
await waitForRemotePeer(wakuNode); // wait for at least one peer

const transport = new WakuTransport({
  node: wakuNode,
  topicPrefix: '/spore/1', // default — change for private networks
  debug: false,
});
```

### Full Node (server)

```typescript
import { createFullNode, waitForRemotePeer } from '@waku/sdk';

const wakuNode = await createFullNode({ defaultBootstrap: true });
await wakuNode.start();
```

### Custom Topic Prefix (private network)

```typescript
const transport = new WakuTransport({
  node: wakuNode,
  topicPrefix: '/mycompany/1', // isolates your messages from public Spore traffic
});
```

---

## 7. Testnet Deployment

### Sepolia

```bash
cp env.template .env.sepolia
# Fill in:
#   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
#   PRIVATE_KEY=0xabc123...

pnpm tsx tests/regression/index.ts --network=sepolia
```

### Optimism Sepolia

```bash
cp env.template .env.op-sepolia
# Fill in OP_SEPOLIA_RPC_URL, PRIVATE_KEY

pnpm run keeper:op-sepolia  # start price oracle
pnpm tsx tests/regression/index.ts --network=op-sepolia
```

---

## 8. Production Deployment

### Pre-Launch Security Checklist (M11)

Always run `runMainnetChecklist` before going live:

```typescript
import { runMainnetChecklist, RateLimiter, InMemoryRateLimitStore, FileNonceStore } from '@aastar/messaging';

const limiter = new RateLimiter({
  tokensPerInterval: 60,
  intervalMs: 60_000,
  burstLimit: 120,
  store: new InMemoryRateLimitStore(),
});

const report = await runMainnetChecklist({
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  rateLimiter: limiter,
  nonceStore: new FileNonceStore('./data/nonces.json'), // persistent
  x402BridgeConfig: { maxValidBeforeWindowSeconds: 86400 },
  gatewayConfig: {
    authToken: process.env.GATEWAY_AUTH_TOKEN,
    requestTimeoutMs: 30000,
  },
  channelBridgeConfig: {
    verifyVoucherSig: myVerifier,
  },
  userOpBridgeConfig: {
    authMode: 'ecdsa',
  },
});

const failed = report.results.filter((r) => !r.passed);
if (failed.length > 0) {
  console.error('Pre-launch checklist FAILED:');
  for (const f of failed) console.error(`  [${f.severity}] ${f.id}: ${f.message}`);
  process.exit(1);
}
console.log('All checks passed — safe to launch.');
```

### Hardened Production Config

```typescript
const agent = await SporeAgent.create({
  privateKeyHex: process.env.SPORE_WALLET_KEY!,
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
  ], // min 2, prefer 3+
  env: 'production',
  debug: false,
});

const gateway = new SporeHttpGateway({
  agent,
  port: 7402,
  host: '127.0.0.1',           // Nginx handles external TLS
  authToken: process.env.GATEWAY_AUTH_TOKEN!,
  maxBodyBytes: 65536,
  maxSseClients: 100,
  requestTimeoutMs: 30000,
});
```

### Key Management

```
NEVER commit private keys to git.

Recommended:
  - Local dev:    .env file (git-ignored)
  - CI/CD:        GitHub Actions secrets / environment variables
  - Server:       HashiCorp Vault, AWS Secrets Manager, or systemd EnvironmentFile
  - Container:    Docker secrets, Kubernetes Secret objects

Key rotation:
  - Generate a new key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  - Update SPORE_WALLET_KEY
  - Old conversations are inaccessible (NIP-44 uses the old key's conversation keys)
  - Publish a new kind:0 profile event from the new key
```

---

## 9. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPORE_WALLET_KEY` | Yes | — | EOA private key (64-char hex, with or without `0x`) |
| `SPORE_RELAYS` | No | 3 public relays | Comma-separated `wss://` relay URLs |
| `SPORE_ENV` | No | `dev` | `dev` \| `production` |
| `SPORE_DEBUG` | No | `false` | Enable verbose transport logging |
| `GATEWAY_PORT` | No | `7402` | HTTP gateway port |
| `GATEWAY_AUTH_TOKEN` | Prod: Yes | — | Bearer token for gateway auth |
| `RELAY_PORT` | No | `8080` | Message relay node port |
| `RELAY_UPSTREAM_RELAYS` | No | — | Comma-separated upstream `wss://` relays |
| `RELAY_AUTH_SECRET` | No | — | EIP-712 domain secret for auth validation |
| `RELAY_RATE_LIMIT_RPS` | No | `10` | Requests per second per sender |

---

## 10. Docker Compose Example

```yaml
# docker-compose.yml

services:
  agent:
    build: .
    environment:
      SPORE_WALLET_KEY: ${SPORE_WALLET_KEY}
      SPORE_RELAYS: wss://relay.damus.io,wss://nos.lol
      SPORE_ENV: production
      GATEWAY_PORT: "7402"
      GATEWAY_AUTH_TOKEN: ${GATEWAY_AUTH_TOKEN}
    volumes:
      - ./data:/app/data       # persistent nonce store
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7402/api/v1/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - agent
    restart: unless-stopped
```

**`Dockerfile`:**
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["node", "dist/agent.js"]
```

---

## 11. Monitoring & Health Checks

### Liveness Probe

```bash
curl http://localhost:7402/api/v1/health
# → { "status": "ok", "pubkey": "a1b2...", "address": "0x..." }
```

Use this endpoint for:
- Docker healthcheck (see above)
- Kubernetes liveness probe
- Uptime monitoring (e.g., UptimeRobot, Better Uptime)

### Metrics to Watch

| Metric | Source | Alert threshold |
|--------|--------|----------------|
| Gateway `/health` response time | HTTP probe | > 2s |
| SSE client count | Gateway config `maxSseClients` | > 80% of limit |
| Nonce store size | FileNonceStore file size | > 50 MB |
| Relay reconnection rate | Agent `error` events | > 5/min |
| Payment validation failures | Bridge logs | > 10% of requests |

### Logging

Structured logging is written to stdout. Pipe to your log aggregator:

```bash
# systemd journal
node dist/agent.js | systemd-cat -t spore-agent

# JSON logging (pipe through pino or similar)
node dist/agent.js 2>&1 | tee -a /var/log/spore-agent.log
```

---

## 12. Upgrade Path

When upgrading between milestone versions:

### M1–M9 → M10 (HTTP Gateway)

No breaking changes. Add `SporeHttpGateway` alongside your existing agent:

```typescript
// Existing agent.start() call remains unchanged
const gw = new SporeHttpGateway({ agent });
await gw.start();
```

### M10 → M11 (Mainnet Hardening)

Replace `InMemoryNonceStore` with `FileNonceStore` in production:

```typescript
// Before
nonceStore: new InMemoryNonceStore()

// After
nonceStore: new FileNonceStore('./data/nonces.json')
```

Run `runMainnetChecklist()` and fix any `CRIT` or `HIGH` failures.

### M11 → M12 (WakuTransport)

Opt-in only — no changes to existing Nostr-based agents required. To add Waku:

```bash
pnpm add @waku/sdk
```

Then create a `WakuTransport` and use it directly or wrap with `MultiTransport`.

### M12 → M13 (MultiTransport)

Wrap existing transports:

```typescript
// Before: using NostrTransport alone
const transport = nostrTransport;

// After: Nostr + Waku in parallel
const transport = new MultiTransport({ transports: [nostrTransport, wakuTransport] });
```

No other changes needed — `MultiTransport` implements the same `SporeTransport` interface.
