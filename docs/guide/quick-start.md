# Quick Start

Get up and running with the AAStar SDK in less than 5 minutes.

## 1. Environment Setup

Create a `.env` file with your private key and RPC provider:

```bash
PRIVATE_KEY_JASON=0x...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
```

## 2. Basic Initialization

Initialize the SDK by choosing a role-based client. Most developers start with the `EndUserClient`.

```typescript
import { createEndUserClient } from '@aastar/sdk';
import { http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY_JASON);

const user = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  account
});
```

## 3. Execute a Gasless Transaction

Enable your users to interact with your dapp without holding native gas tokens.

```typescript
// Send a sponsored transaction via SuperPaymaster
const hash = await user.sendGaslessTransaction({
  to: '0x...',
  data: '0x...',
  communityAddress: '0x...', // Your registered community
});

console.log(`Transaction sent: ${hash}`);
```

## 4. Next Steps

- **Manage Communities**: Use the [CommunityClient](../api/roles/community) to set reputation rules.
- **Become a Provider**: Use the [OperatorClient](../api/roles/operator) to stake and sponsor gas.
- **Advanced Features**: Explore the [API Reference](../api/) for deep customization.
