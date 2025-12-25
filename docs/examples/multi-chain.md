# Multi-Chain Setup Example

This example demonstrates how to configure and switch between different networks using the AAStar SDK.

## Supported Networks

- **Ethereum Sepolia**: Recommended for testing.
- **Optimism**: Low cost production environment.
- **Anvil**: Local development and rapid prototyping.

## Code Preview

```typescript
import { createPublicClient, http } from 'viem';
import { sepolia, optimism } from 'viem/chains';
import { getNetwork } from '@aastar/core';

// Switch to Sepolia
const sepoliaConfig = getNetwork('sepolia');
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(sepoliaConfig.rpcUrl),
});

// Switch to Optimism
const opConfig = getNetwork('optimism');
const opClient = createPublicClient({
  chain: optimism,
  transport: http(opConfig.rpcUrl),
});
```
