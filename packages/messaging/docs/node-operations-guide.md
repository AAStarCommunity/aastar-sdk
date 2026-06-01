# Spore Protocol — Node Operations Guide

> For Relay Operators, Waku Node Operators, and SuperPaymaster Operators

---

## Overview

The Spore Protocol relies on three types of infrastructure nodes:

| Node Type | Package | Earns | Minimum Stake |
|-----------|---------|-------|---------------|
| **Nostr Relay** | `@aastar/message-relay` | Relay fees (X402) | 1,000 xPNTs |
| **Waku Full Node** | `@waku/sdk` (full node) | Store query fees (future) | 500 xPNTs |
| **SuperPaymaster** | `@aastar/paymaster` + contracts | Gas sponsorship margin | 10,000 xPNTs |

---

## Part 1 — Nostr Relay Operator

### 1.1 Role & Responsibilities

A Relay Operator runs a Nostr relay node that:
- Routes NIP-17 gift-wrap DMs between agents and users
- Validates EIP-712 authorization signatures (anti-DoS)
- Rate-limits per sender pubkey
- Charges relay fees via X402 (kind:23402) for publishing privileges

**Minimum viable setup:** 1 vCPU · 1 GB RAM · 20 GB SSD · 100 Mbps uplink

**Recommended (production):** 4 vCPU · 8 GB RAM · 100 GB SSD · 1 Gbps uplink

---

### 1.2 Installation

```bash
# Clone the relay package
git clone https://github.com/AAStarCommunity/aastar-sdk
cd aastar-sdk/packages/message-relay
pnpm install && pnpm build
```

### 1.3 Configuration

Create `.env.relay`:
```bash
# Network
RELAY_PORT=8080
RELAY_HOST=0.0.0.0          # bind to all interfaces (Nginx handles TLS)

# Upstream relays (for event fan-out to the broader Nostr network)
RELAY_UPSTREAM_RELAYS=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol

# Auth (EIP-712 domain)
RELAY_AUTH_SECRET=<random-32-byte-hex>
RELAY_AUTH_DOMAIN=relay.yournode.xyz

# Rate limiting
RELAY_RATE_LIMIT_RPS=20          # messages per second per sender
RELAY_RATE_LIMIT_BURST=100       # burst allowance

# Fee collection (X402)
RELAY_FEE_ENABLED=true
RELAY_FEE_AMOUNT=10000           # 0.01 USDC per publish (6 decimals)
RELAY_FEE_TOKEN=0xUSDC_ADDRESS
RELAY_FEE_RECIPIENT=0xYOUR_ETH_ADDRESS

# Nonce store (use Redis or file in production — never in-memory)
RELAY_NONCE_STORE_TYPE=file
RELAY_NONCE_STORE_PATH=/var/lib/spore-relay/nonces.json

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### 1.4 Starting the Relay

```bash
# Direct
node --env-file=.env.relay dist/index.js

# systemd service
sudo cp deploy/spore-relay.service /etc/systemd/system/
sudo systemctl enable spore-relay
sudo systemctl start spore-relay
sudo journalctl -u spore-relay -f
```

**systemd unit (`deploy/spore-relay.service`):**
```ini
[Unit]
Description=Spore Protocol Relay Node
After=network.target

[Service]
Type=simple
User=spore
WorkingDirectory=/opt/spore-relay
EnvironmentFile=/opt/spore-relay/.env.relay
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 1.5 TLS with Nginx

```nginx
server {
    listen 443 ssl;
    server_name relay.yournode.xyz;

    ssl_certificate     /etc/letsencrypt/live/relay.yournode.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.yournode.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # WebSocket upgrade
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

### 1.6 Fee Collection Setup

Register your relay as an X402-capable relay:

```typescript
// scripts/register-relay.ts
import { createOperatorClient } from '@aastar/sdk';

const client = createOperatorClient({
  privateKey: process.env.OPERATOR_PRIVATE_KEY!,
  rpcUrl: process.env.OP_MAINNET_RPC_URL!,
  network: 'op-mainnet',
});

await client.registerRelay({
  endpoint: 'wss://relay.yournode.xyz',
  feeAmount: 10000n,      // 0.01 USDC
  feeToken: '0xUSDC...',
  stakeAmount: 1000n * 10n**18n,  // 1000 xPNTs stake
});
```

### 1.7 Relay Monitoring

**Health endpoint:** `wss://relay.yournode.xyz/health` (custom endpoint) or standard Nostr NIP-11:
```bash
curl -H "Accept: application/nostr+json" https://relay.yournode.xyz
# → { "name": "My Spore Relay", "description": "...", "supported_nips": [...] }
```

**Key metrics to track:**

| Metric | Normal | Alert |
|--------|--------|-------|
| Event publish rate (events/s) | 0–100 | > 500 |
| Rate-limited requests (%) | < 5% | > 20% |
| Fee validation failures (%) | < 2% | > 10% |
| WebSocket connection count | 0–1000 | > 5000 |
| Nonce store size | < 10 MB | > 100 MB |
| Upstream relay latency (ms) | < 500 | > 2000 |

---

## Part 2 — Waku Full Node Operator

### 2.1 Role & Responsibilities

Waku full node operators:
- Participate in libp2p GossipSub routing (no relay operators needed by senders)
- Run Waku Store protocol to serve historical messages
- Earn future Store query fees from light node clients

**Minimum viable:** 2 vCPU · 4 GB RAM · 100 GB SSD · 100 Mbps uplink

---

### 2.2 Installation

```bash
# Using the official Waku Go implementation (nwaku)
docker pull wakuorg/nwaku:latest

# Or build from source
git clone https://github.com/waku-org/nwaku
cd nwaku && make -j4
```

### 2.3 Configuration

```bash
# docker-compose.yml for nwaku full node
services:
  nwaku:
    image: wakuorg/nwaku:latest
    command: >
      --nat=extip:YOUR_PUBLIC_IP
      --relay=true
      --store=true
      --store-message-retention-policy=time:604800  # 7 days
      --topic=/waku/2/default-waku/proto
      --topic=/spore/1/default-waku/proto            # Spore-specific topic
      --rpc-admin=true
      --rpc-port=8645
      --tcp-port=60000
      --websocket-support=true
      --websocket-port=8546
    ports:
      - "60000:60000"   # libp2p
      - "8546:8546"     # WebSocket (for light nodes)
    volumes:
      - ./waku-data:/data
    restart: unless-stopped
```

### 2.4 Bootstrap Peer Discovery

Connect to the Waku bootstrap nodes and announce Spore-specific topics:

```bash
# Connect to Waku network bootstrap nodes
./nwaku \
  --bootnodes=enr:... \
  --topic=/spore/1/dm-*/proto \  # wildcard subscription
  --topic=/spore/1/group-*/proto
```

### 2.5 Spore Integration

Waku node operators should subscribe to Spore content topics to ensure message propagation:

```
/spore/1/dm-*/proto      — all DM topics
/spore/1/group-*/proto   — all group topics
```

For large networks, operators can choose to only propagate topics for pubkeys in their registered user set (selective relay).

### 2.6 Future: Store Fees

The Waku Store fee protocol is under development by the Waku team. Once enabled, operators can charge light nodes for historical message retrieval:

```
Light Node                    Waku Store Node
     │                              │
     │── query(topic, since) ──────►│
     │   with X402 payment          │
     │◄─ payloads[] ────────────────│
     │   (after payment validation) │
```

Operators can pre-register their store nodes with the Spore Protocol to be discoverable by light nodes using `WakuTransport({ node })`.

---

## Part 3 — SuperPaymaster Operator

### 3.1 Role & Responsibilities

SuperPaymaster operators:
- Run ERC-4337 paymasters that sponsor gas for end users
- Stake xPNTs as collateral (slashable for misbehavior)
- Earn gas sponsorship margin (difference between actual gas cost and sponsor fee)
- Participate in the DVT aggregation protocol (distributed validator threshold)

**Capital requirements:** Must stake xPNTs + ETH/USDC collateral in the SuperPaymaster contract.

---

### 3.2 Registration

```typescript
import { createOperatorClient } from '@aastar/sdk';

const operator = createOperatorClient({
  privateKey: process.env.OPERATOR_KEY!,
  rpcUrl: process.env.OP_MAINNET_RPC_URL!,
  network: 'op-mainnet',
});

// Register as a SuperPaymaster operator
await operator.registerPaymaster({
  stake: 10_000n * 10n**18n,           // 10,000 xPNTs stake
  collateral: 1_000n * 10n**6n,        // 1,000 USDC collateral
  maxGasSponsored: 500_000n,           // max gas units per UserOp
  supportedTokens: ['0xUSDC', '0xUSDT'],
});
```

### 3.3 Keeper (Price Oracle)

The SuperPaymaster needs up-to-date gas price data:

```bash
# Run the keeper (updates on-chain price oracle)
pnpm run keeper:op-sepolia

# Or on mainnet
OPERATOR_KEY=0x... OP_MAINNET_RPC_URL=https://... pnpm exec tsx scripts/keeper.ts \
  --network op-mainnet \
  --interval 60000     # update every 60s
```

### 3.4 Monitoring Your Paymaster

```typescript
import { createOperatorClient } from '@aastar/sdk';

const operator = createOperatorClient({ ... });

// Check stake and collateral health
const status = await operator.getPaymasterStatus();
console.log({
  stake: status.stakedXPNTs,
  collateral: status.collateralUSDC,
  gasSponsored: status.totalGasSponsored,
  revenue: status.totalRevenue,
  slashRisk: status.pendingSlash,
});
```

**Alert thresholds:**
- Collateral < 10% of capacity → top up
- Stake value drops below minimum → add xPNTs
- Slash risk > 0 → investigate immediately

---

## Part 4 — Community Node Health Dashboard

All node operators can register with the community monitoring dashboard:

```
https://monitor.aastar.community/nodes
```

Registration:
```bash
# Publish your node's NIP-11 info doc to a community registry relay
curl -X POST https://registry.aastar.community/register \
  -H "Content-Type: application/json" \
  -d '{
    "type": "relay",
    "endpoint": "wss://relay.yournode.xyz",
    "operator": "0xYOUR_ETH_ADDRESS",
    "stake": "1000",
    "location": "US-East"
  }'
```

The dashboard shows:
- Node uptime (30d rolling average)
- Message throughput
- Fee revenue
- Reputation score
- SBT tier

High-reputation operators (Mycelium/Spore tier) are eligible for:
- Priority listing in the relay discovery endpoint
- MushroomDAO council membership
- Increased fee tier (charge more per relay)

---

## Part 5 — Operator Incentive Summary

### Monthly Revenue Estimation

**Nostr Relay (mid-tier, 100 active agents):**
```
100 agents × 1,000 msgs/day × 0.01 USDC/msg × 8% relay share
= 100 × 1000 × 0.01 × 0.08 × 30 days
= $240/month
```

**Waku Node (once Store fees activate):**
```
Estimated: $50–$200/month per node depending on query volume
```

**SuperPaymaster (mid-tier, 500 daily UserOps):**
```
500 UserOps/day × ~50,000 gas × 5% margin on gas cost
= $30–$150/month at current gas prices
```

### Staking APY (xPNTs)

| Stake amount | Estimated APY | Source |
|-------------|--------------|--------|
| 1,000 xPNTs | 8–12% | Relay fee share |
| 10,000 xPNTs | 12–18% | Paymaster margin + governance rewards |
| 50,000 xPNTs | 15–25% | All sources + council bonus |

*APY estimates based on projected network activity; not guaranteed.*

---

## Part 6 — Slashing & Penalties

Node operators must behave honestly. The following actions trigger slashing:

| Offense | Slash amount | Notes |
|---------|-------------|-------|
| Censoring valid events | 10% stake | Detected by redundant relay monitoring |
| Double-signing vouchers | 50% stake | Cryptographic proof submitted by reporter |
| Offline > 72h without notice | 2% stake | Grace period for maintenance |
| Invalid fee collection | 25% stake | Overcharging without service |

Slashed xPNTs go 50% to the reporter and 50% to the MushroomDAO treasury.

---

## Part 7 — Operator Upgrade Path

When the protocol upgrades, operators receive advance notice via:

1. MushroomDAO governance proposal (7-day vote)
2. Relay announcement event (kind:30078 with upgrade notice)
3. GitHub release notes

**Breaking change policy:**
- 30-day deprecation window for all breaking protocol changes
- Old event kinds supported in parallel during transition
- Operators who upgrade within the first 7 days receive a loyalty aPNTs bonus
