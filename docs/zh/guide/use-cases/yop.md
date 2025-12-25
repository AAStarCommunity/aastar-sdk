# Build Your Own Protocol (YOP)

Guide for building custom protocols on AAStar infrastructure.

## Overview

AAStar SDK provides infrastructure to build Your Own Protocol with:
- Account Abstraction
- Gas sponsorship
- Community management
- Reputation systems

---

## Architecture

```
Your Protocol
├── Smart Contracts
│   └── Custom logic
├── AAStar SDK
│   ├── Account Abstraction
│   ├── SuperPaymaster
│   └── Community Management
└── Frontend DApp
    └── React + @aastar/dapp
```

---

## Example: Custom DeFi Protocol

```typescript
import { createEndUserClient, createCommunityClient } from '@aastar/core';

// 1. Set up community
const community = createCommunityClient({...});
await community.registerCommunity({ name: 'MyDeFi' });

// 2. Deploy community token
const tokenAddress = await community.deployXPNTs({
  name: 'MyDeFi Points',
  symbol: 'MDP',
  initialSupply: parseEther('1000000'),
});

// 3. Enable gasless transactions for users
const user = createEndUserClient({...});
const eligible = await user.checkEligibility(communityAddress);

// 4. Users can interact without gas fees
if (eligible) {
  await sendGaslessTransaction();
}
```

---

## Key Features

1. **Gasless UX**: Users don't need ETH
2. **Community Tokens**: Custom reward systems
3. **Reputation**: On-chain reputation tracking
4. **Flexible**: Build any protocol logic

---

## Related

- [Core Module](/api/modules/core)
- [Community API](/api/roles/community)
- [SuperPaymaster Concept](/guide/concepts/superpaymaster)
