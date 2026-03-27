# Spore Protocol — Community Governance & MushroomDAO

> How the Mycelium Network is governed, grown, and sustained

---

## MushroomDAO Overview

MushroomDAO is the decentralized autonomous organization that governs the Spore Protocol. It controls:

- Protocol upgrade parameters (fee splits, rate limits, SBT tier thresholds)
- Treasury distribution (grants, bounties, contributor rewards)
- Relay operator whitelist (for high-trust operators)
- Emergency circuit breakers (pause bridge types in case of exploits)

**Governance token:** xPNTs (ERC-20, stakeable)
**On-chain platform:** Optimism (low fees for governance participation)
**Current status:** Snapshot-based voting → migrating to fully on-chain (M17)

---

## Governance Structure

```
┌─────────────────────────────────────────────────┐
│               MushroomDAO                        │
│                                                 │
│  ┌─────────────┐    ┌──────────────────────┐   │
│  │   Council   │    │  Community Assembly   │   │
│  │ (Spore-tier │    │  (all xPNTs holders)  │   │
│  │  operators) │    │                       │   │
│  └──────┬──────┘    └──────────┬────────────┘   │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────────────────────────────────┐   │
│  │         Governance Contract               │   │
│  │  (on-chain voting, Optimism Mainnet)      │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Council (Spore-Tier Operators)

Operators and developers with SBT tier ≥ Spore (score ≥ 2000) form the **Council**:
- 10x voting weight on technical proposals
- Fast-track veto power (72h window, requires 2/3 council consensus)
- Access to the protocol admin multisig (for emergency actions only)
- Elected annually by community vote

### Community Assembly

All xPNTs holders participate in the Community Assembly:
- 1 xPNTs = 1 vote (capped at sqrt(balance) to prevent plutocracy)
- Standard proposal timeline: 7-day discussion → 5-day vote → 48h timelock
- Quorum: 5% of circulating xPNTs for parameter changes, 10% for treasury withdrawals

---

## Proposal Process

### Step 1: Discussion (Days 1–7)

Post an RFC (Request for Comment) to the MushroomDAO forum:
```
Title: [RFC] Increase relay fee share from 8% to 10%
Tags: protocol-params, fees
Body:
  ## Summary
  Proposal to increase the relay operator fee share from 8% to 10%
  to incentivize more relay node deployment.

  ## Motivation
  Current relay count: 12. Target for mainnet: 50+.

  ## Specification
  Change RELAY_FEE_SHARE from 800 bps to 1000 bps in
  SuperPaymaster fee distribution contract.

  ## Security Considerations
  Reduces protocol treasury share from 2% to 0%.
  Treasury reserves currently cover 18 months of runway.

  ## Voting
  YES: Increase to 10%
  NO: Keep at 8%
```

### Step 2: Formal Proposal (Days 8–12)

After community discussion, create a formal on-chain proposal:

```typescript
import { createAdminClient } from '@aastar/sdk';

const admin = createAdminClient({
  privateKey: process.env.COUNCIL_MEMBER_KEY!,
  rpcUrl: process.env.OP_MAINNET_RPC_URL!,
  network: 'op-mainnet',
});

const proposalId = await admin.createProposal({
  title: 'Increase relay fee share to 10%',
  description: 'ipfs://QmXxx...', // IPFS link to full RFC
  actions: [
    {
      target: '0xFeeDistributor...',
      calldata: admin.encodeFeeShare({ relayShare: 1000 }), // 10%
    }
  ],
  votingPeriodDays: 5,
});
```

### Step 3: Voting (Days 8–12)

```typescript
// Cast vote
await admin.castVote(proposalId, 'FOR', {
  reason: 'Relay operators need better incentives for network growth'
});

// Delegate votes (if you want someone else to vote on your behalf)
await admin.delegate(delegateAddress, { untilBlock: 1000000 });
```

### Step 4: Execution (Day 13+, after 48h timelock)

```typescript
// Execute after timelock expires
await admin.executeProposal(proposalId);
```

---

## Treasury Management

### Treasury Sources

| Source | Frequency | Amount |
|--------|-----------|--------|
| Protocol fee cut (X402/Channel) | Per transaction | 2–5% of fees |
| Relay fee cut | Per event | 2–5% of relay fees |
| Storage fees | Per commitment | 10% of storage fees |
| xPNTs staking rewards | Daily | 0.5% of staked supply/year |
| Grant/investment repayments | Periodic | Variable |

### Treasury Allocation Policy (Current)

| Category | % of inflow | Purpose |
|----------|------------|---------|
| Core team | 40% | Protocol development, security audits |
| Community grants | 30% | Ecosystem builders, researchers |
| Node incentives | 20% | Bootstrap relay/waku node operators |
| Emergency reserve | 10% | Circuit breaker fund, bug bounties |

*Allocation adjustable by MushroomDAO governance vote.*

### Grant Program

Builders can apply for ecosystem grants:

**Grant tiers:**

| Tier | Amount | Requirements |
|------|--------|-------------|
| Seed | Up to $1,000 | Open-source repo, working prototype |
| Sprout | $1,000–$10,000 | Deployed on testnet, 10+ users |
| Mycelium | $10,000–$50,000 | Mainnet deployment, community traction |
| Spore | $50,000+ | Council sponsorship required |

**Apply:** Submit a proposal to the Community Assembly with:
- Project description + team background
- Milestone-based budget breakdown
- Open-source commitment
- Delivery timeline (max 6 months)

---

## Community Roles & Contribution Paths

### For Developers

| Contribution | Reward |
|-------------|--------|
| Bug report (accepted) | 50–500 aPNTs |
| Security vulnerability (critical) | 5,000–50,000 aPNTs |
| Feature PR merged | 100–2,000 aPNTs |
| Documentation improvement | 20–200 aPNTs |
| New codec implemented | 500 aPNTs |
| Test coverage increase | 50 aPNTs per 1% |

```bash
# Claim your contribution rewards
pnpm exec tsx scripts/claim-contribution.ts \
  --type=pr --pr-number=42 --wallet=0xYOUR_ADDRESS
```

### For Researchers

Researchers contributing academic work to the Mycelium Protocol (HyperCapital framework, SuperPaymaster design, AirAccount UX):

- Published papers citing Spore Protocol: +200 aPNTs per citation
- RFC accepted into protocol spec: +1,000 aPNTs
- Speaking at a conference on Mycelium Network: +500 aPNTs

### For Community Builders

| Activity | Reward |
|----------|--------|
| Onboard a new relay operator | 200 aPNTs |
| Translate documentation | 100 aPNTs per doc |
| Moderate Discord/forum (monthly) | 50 aPNTs/month |
| Host a community event | 500 aPNTs |
| Create tutorial/demo video | 200–1,000 aPNTs |

---

## aPNTs → xPNTs Conversion

aPNTs (activity points) are earned through contributions. Convert to xPNTs for governance power:

```
Conversion rate: 100 aPNTs = 1 xPNTs
Conversion window: monthly (first 7 days of each month)
Vesting: 6-month linear vesting on converted xPNTs
```

This prevents instant governance capture by short-term contributors while rewarding sustained participation.

---

## Communication Channels

| Channel | Purpose | Link |
|---------|---------|------|
| GitHub Discussions | Technical RFCs, bug reports | github.com/AAStarCommunity/aastar-sdk/discussions |
| Discord | Real-time community | discord.gg/aastar |
| Forum | Long-form governance proposals | forum.mushroom.dao |
| Snapshot | Off-chain voting (current) | snapshot.org/#/mushroom.eth |
| X (Twitter) | Announcements | @AAStar_Community |
| GitHub Org | MushroomDAO | github.com/orgs/MushroomDAO |

---

## Ecosystem Node Registry

Nodes are discoverable through the on-chain registry:

```typescript
import { createEndUserClient } from '@aastar/sdk';

const client = createEndUserClient({ network: 'op-mainnet' });

// Discover relay nodes
const relays = await client.discoverRelays({
  minUptime: 0.99,          // 99%+ uptime
  minStake: 1000n,           // at least 1,000 xPNTs staked
  tier: 'mycelium',          // SBT tier filter
  limit: 10,
});

// Discover Waku nodes
const wakuNodes = await client.discoverWakuNodes({
  hasStore: true,            // must support Store protocol
  minUptime: 0.95,
});
```

---

## Security & Emergency Procedures

### Circuit Breakers

The protocol admin multisig (5-of-9, Council members) can pause any bridge type within 1 block in case of an active exploit:

```typescript
// Emergency pause (requires 3/9 multisig signers)
await admin.emergencyPause({
  bridgeType: 'x402',   // 'x402' | 'channel' | 'userop' | 'all'
  reason: 'Critical vulnerability in X402Bridge payment validation',
  durationHours: 24,    // auto-resume after 24h unless extended by vote
});
```

A MushroomDAO vote is required within 24 hours to extend any pause beyond 24 hours.

### Bug Bounty Program

| Severity | Payout |
|----------|--------|
| Low (UI/UX, non-critical) | $50–$500 |
| Medium (non-critical logic bug) | $500–$2,000 |
| High (fund loss < $10k) | $2,000–$10,000 |
| Critical (fund loss > $10k) | $10,000–$100,000 |

Report to: security@aastar.community (PGP key on keyserver)

---

## Roadmap to Full Decentralization

```
Phase 1 (Current): Core team controls admin multisig
   └── Community feedback via Snapshot votes (advisory only)

Phase 2 (M17): On-chain governance live
   └── Multisig actions require on-chain vote approval
   └── Council elected on-chain

Phase 3 (v1.0): Full MushroomDAO control
   └── Core team transitions to contributor role
   └── Treasury fully controlled by DAO
   └── Protocol upgrades governed entirely by xPNTs holders
```

The core team commits to surrendering admin keys to the DAO once:
1. On-chain governance contract audited and deployed
2. DAO has ≥ 50 active xPNTs holders voting regularly
3. Treasury has ≥ 6 months of runway under community management
