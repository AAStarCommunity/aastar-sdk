# Spore Protocol — Ecosystem Overview

> Mycelium Network · AAStar SDK · MushroomDAO

---

## Vision

Spore Protocol is the messaging and coordination backbone of the **Mycelium Network** — a decentralized infrastructure for AI agents, human communities, and on-chain economies to collaborate without central gatekeepers.

Just as mycelium networks in nature connect trees through nutrient-sharing root networks invisible to the eye, Spore connects agents and humans through encrypted, censorship-resistant message channels that carry both information and value.

---

## Ecosystem Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│   AI Agents · dApps · Mobile clients · HTTP gateway consumers      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ @aastar/messaging
┌────────────────────────────▼────────────────────────────────────────┐
│                      SPORE PROTOCOL LAYER                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Transport  │  │   Payment    │  │       Identity           │   │
│  │  M1/M12/M13 │  │  Bridges M2  │  │   AirAccount · SBT M8    │   │
│  │  Nostr/Waku │  │ X402/Channel │  │   MLS Key Agree. M9      │   │
│  │  Multi      │  │   UserOp     │  │   HyperCapital rep.      │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                           │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │  Nostr Relay  │  │  Waku Node    │  │  SuperPaymaster      │   │
│  │  Operators    │  │  Operators    │  │  ERC-4337 Bundler    │   │
│  └───────────────┘  └───────────────┘  └──────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                       GOVERNANCE LAYER                              │
│              MushroomDAO · xPNTs Staking · OpenPNTs                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Five Ecosystem Roles

### 1. Agent Developers
Build AI bots, automation agents, and services using `@aastar/messaging`.
- **Earn**: Charge senders via X402 (per-query) or Channel (micropayment stream)
- **Stake**: xPNTs to unlock lower relay fees and higher rate limits
- **Reputation**: SBT-based reputation grows with successful interactions

### 2. End Users
Humans sending/receiving messages through client apps or the HTTP gateway.
- **Pay**: Small per-message fees to relay operators and agent services
- **Earn**: OpenPNTs loyalty rewards for active participation
- **Own**: On-chain identity via AirAccount — one key for Ethereum + Nostr

### 3. Relay Operators (Nostr)
Run `@aastar/message-relay` nodes that route Nostr events.
- **Earn**: Relay fees (kind:23402 X402) from agents publishing through their relay
- **Stake**: xPNTs for priority queue placement and higher fee tiers
- **Govern**: Vote on relay policy parameters via MushroomDAO

### 4. Waku Node Operators
Run Waku full nodes that participate in the libp2p GossipSub network.
- **Earn**: Future Waku Store fees for serving historical messages
- **Contribute**: Provide decentralized routing infrastructure without relay operators
- **Stake**: xPNTs to signal commitment to uptime SLAs

### 5. Protocol Participants (MushroomDAO)
xPNTs holders who govern the protocol.
- **Vote**: Propose and vote on protocol upgrades, fee parameters, relay whitelist
- **Earn**: Treasury distribution proportional to staking weight
- **Build**: Contribute code/research → earn reputation → increase governance weight

---

## Token Economic Model

### Token Overview

| Token | Type | Purpose |
|-------|------|---------|
| **xPNTs** | ERC-20, stakeable | Governance, fee discounts, operator bonding |
| **aPNTs** | ERC-20, activity-based | Earned by participation, convertible to xPNTs |
| **GToken** | ERC-20, community | Community treasury, grant distribution |
| **SBT** | ERC-5114, non-transferable | Reputation score, access tiers |
| **OpenPNTs** | ERC-20, loyalty | End-user rewards for activity |

### Value Flow

```
                    ┌──────────────┐
                    │   End User   │
                    │  (sends msg) │
                    └──────┬───────┘
                           │ micro-fee (USDC / OpenPNTs)
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
   │   Relay     │  │    Agent    │  │  MushroomDAO  │
   │  Operator   │  │  Developer  │  │   Treasury   │
   │  (routing)  │  │  (service)  │  │  (protocol%) │
   └──────┬──────┘  └──────┬──────┘  └──────────────┘
          │                │
          ▼                ▼
   xPNTs staking    aPNTs earned
   (governance      (→ xPNTs conversion
    weight)          → governance)
```

### Fee Distribution (Protocol Parameters, MushroomDAO Governed)

| Fee type | Agent Developer | Relay Operator | Protocol Treasury |
|----------|:--------------:|:--------------:|:-----------------:|
| X402 per-query | 90% | 8% | 2% |
| Channel micropayment | 85% | 12% | 3% |
| Relay-only fee | — | 95% | 5% |
| Storage fee | — | 90% | 10% |

*(Default parameters — adjustable by MushroomDAO governance vote)*

---

## Reputation System (HyperCapital Framework)

Social capital is quantified on-chain using the **HyperCapital** framework:

```
Reputation Score = Σ(activity_weight × recency_decay × network_multiplier)

activity_weight:
  - Successful message delivery:     +1
  - Payment completed (X402):        +5
  - Channel settled on-time:         +10
  - Relay uptime (30d):              +20
  - MLS group created:               +3
  - Bug report accepted:             +50

recency_decay: exp(-λ × days_since_event)

network_multiplier: 1 + (endorsers_reputation / 1000)
```

**SBT Tiers** (non-transferable, minted by AirAccount):

| Tier | Score | Benefits |
|------|-------|---------|
| Seed | 0–99 | Basic relay access, standard fees |
| Sprout | 100–499 | 5% relay fee discount, higher rate limits |
| Mycelium | 500–1999 | 15% discount, priority queue, governance voting |
| Spore | 2000+ | 30% discount, operator whitelist, DAO council eligibility |

---

## Ecosystem Growth Roadmap

### Phase 1: Foundation (Current — M1–M13)
- ✅ Nostr transport, NIP-17 gift-wrap E2E encryption
- ✅ Payment bridges (X402, Channel, UserOp)
- ✅ Group management, MLS key agreement
- ✅ HTTP/SSE gateway for non-JS clients
- ✅ Mainnet hardening checklist
- ✅ WakuTransport adapter (relay-operator-free path)
- ✅ MultiTransport fan-out (Nostr + Waku redundancy)

### Phase 2: Protocol Ossification (M14–M18)
- [ ] **M14** — OpenPNTs loyalty token integration (aPNTs minting on message activity)
- [ ] **M15** — SBT reputation minting via AirAccount
- [ ] **M16** — xPNTs staking for relay fee discounts
- [ ] **M17** — MushroomDAO on-chain governance (Snapshot → on-chain migration)
- [ ] **M18** — SuperPaymaster V4 relay fee settlement

### Phase 3: Network Effects (M19–M24)
- [ ] Relay operator marketplace (discovery, reputation scores, SLA bonding)
- [ ] OpenCards identity cross-chain portability
- [ ] CometENS wallet naming (agent.alice.spore)
- [ ] Waku Store operator incentives
- [ ] Cross-chain message bridge (Optimism ↔ Ethereum ↔ Base)

### Phase 4: Community Economy (v1.0)
- [ ] MushroomDAO treasury operational
- [ ] Grant program for ecosystem builders
- [ ] OpenPNTs → xPNTs conversion protocol
- [ ] Community-run relay network (100+ nodes)
- [ ] Agent developer marketplace
