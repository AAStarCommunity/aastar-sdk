# Quick Start

Get up and running with AAStar SDK in 5 minutes.

## Step 1: Install the SDK

```bash
pnpm add @aastar/sdk viem
```

## Step 2: Set Up Your Environment

Create a `.env` file:

```bash
RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
```

## Step 3: Create Your First Client

Choose a client based on your role:

### For End Users (DApp Developers)

```typescript
import { createEndUserClient } from '@aastar/core';
import { http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const client = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
});

// Check credit limit
const credit = await client.getCreditLimit();
console.log('Available credit:', credit);
```

### For Operators (Paymaster Providers)

```typescript
import { createOperatorClient, CONTRACTS } from '@aastar/core';
import { parseEther } from 'viem';

const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.OPERATOR_KEY),
});

// Stake GTokens
await operator.stake({
  amount: parseEther('100'),
});

// Deposit to Paymaster
await operator.deposit({
  amount: parseEther('10'),
});
```

### For Communities (DAO Managers)

```typescript
import { createCommunityClient } from '@aastar/core';

const community = createCommunityClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.COMMUNITY_KEY),
});

// Register community
await community.registerCommunity({
  name: 'MyAwesomeDAO',
  metadata: 'ipfs://...',
});

// Mint SBT to member
await community.mintSBT({
  to: memberAddress,
  tokenId: 1n,
});
```

## Step 4: Run Your Code

```bash
tsx your-script.ts
```

## Common Patterns

### Check Network Configuration

```typescript
import { getNetwork, CONTRACTS } from '@aastar/core';

const network = getNetwork('sepolia');
console.log('Chain ID:', network.chainId);
console.log('RPC URL:', network.rpcUrl);
console.log('Registry:', CONTRACTS.sepolia.registry);
```

### Handle Errors

```typescript
try {
  await operator.stake({ amount: parseEther('100') });
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('Not enough GTokens');
  } else {
    console.error('Staking failed:', error);
  }
}
```

### Get Transaction URL

```typescript
import { getTxUrl } from '@aastar/core';

const txHash = await operator.stake({ amount: parseEther('100') });
const url = getTxUrl('sepolia', txHash);
console.log('View transaction:', url);
```

## Next Steps

- [Learn about Account Abstraction](/guide/concepts/account-abstraction)
- [Explore use cases](/guide/use-cases/community-management)
- [Read the full API reference](/api/)
- [Try complete examples](/examples/)

## Need Help?

- [GitHub Issues](https://github.com/AAStarCommunity/aastar-sdk/issues)
- [Discord](https://discord.gg/aastar)
- [Documentation](https://docs.aastar.io)
