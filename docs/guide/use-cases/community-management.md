# Community Management Guide

Complete guide for managing DAOs and communities with AAStar SDK.

## Overview

This guide shows how to:
- Register a community
- Manage members with SBTs
- Configure reputation systems
- Deploy community tokens
- Set up gas sponsorship

---

## Prerequisites

- Community admin account
- Basic understanding of DAOs
- Testnet ETH for transactions

---

## Step 1: Register Community

```typescript
import { createCommunityClient } from '@aastar/core';
import { http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const community = createCommunityClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.COMMUNITY_KEY),
});

// Register community
const txHash = await community.registerCommunity({
  name: 'DevDAO',
  metadata: 'ipfs://QmCommunityMetadata...',
});

console.log('Community registered:', txHash);
```

---

## Step 2: Deploy Community Token

```typescript
import { parseEther } from 'viem';

const tokenAddress = await community.deployXPNTs({
  name: 'DevDAO Points',
  symbol: 'DDP',
  initialSupply: parseEther('1000000'),
});

console.log('Token deployed at:', tokenAddress);
```

---

## Step 3: Configure Reputation System

```typescript
await community.setReputationRules({
  rules: [
    { metric: 'code_contributions', weight: 40 },
    { metric: 'community_engagement', weight: 30 },
    { metric: 'governance_participation', weight: 30 },
  ],
});
```

---

## Step 4: Manage Members

```typescript
// Mint membership SBT
await community.mintSBT({
  to: memberAddress,
  tokenId: 1n,
  metadata: 'ipfs://QmMembershipBadge...',
});

// Distribute points
import { mintXPNTs } from '@aastar/tokens';

await mintXPNTs(community, memberAddress, parseEther('100'));
```

---

## Complete Example

```typescript
async function setupCommunity() {
  const community = createCommunityClient({...});

  // 1. Register
  await community.registerCommunity({
    name: 'DevDAO',
    metadata: 'ipfs://...',
  });

  // 2. Deploy token
  const tokenAddress = await community.deployXPNTs({
    name: 'DevDAO Points',
    symbol: 'DDP',
    initialSupply: parseEther('1000000'),
  });

  // 3. Set reputation rules
  await community.setReputationRules({
    rules: [
      { metric: 'contributions', weight: 50 },
      { metric: 'engagement', weight: 50 },
    ],
  });

  // 4. Onboard members
  const members = ['0x...', '0x...'];
  for (const member of members) {
    await community.mintSBT({ to: member, tokenId: 1n });
    await mintXPNTs(community, member, parseEther('100'));
  }

  console.log('Community setup complete!');
}
```

---

## Related

- [Community API](/api/roles/community)
- [Tokens Module](/api/modules/tokens)
- [Identity Module](/api/modules/identity)
