# Community Flow Example

This example demonstrates how to manage a community, issue SBTs, and configure reputation.

## Steps

1. **Registration**: Register your community name and metadata on-chain.
2. **SBT Issuance**: Mint Soul-Bound Tokens to members to define their roles.
3. **Reputation Setup**: Define rules that calculate member reputation based on activity.

## Code Preview

```typescript
import { createCommunityClient } from '@aastar/sdk';

const community = createCommunityClient({ 
  account, 
  chain: sepolia 
});

// Launch community and deploy community token
const { tokenAddress, txs } = await community.launch({
  name: 'Alpha DAO',
  tokenName: 'Alpha Points',
  tokenSymbol: 'ALP',
  description: 'A research-focused community',
});

// Mint SBT
await community.mintSBT({
  to: memberAddress,
  tokenId: 1n,
});
```
