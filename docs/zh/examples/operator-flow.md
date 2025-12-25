# Operator Flow Example

This example demonstrates how to set up and manage a SuperPaymaster as an Operator.

## Steps

1. **Staking**: Deposit GTokens into the staking contract to become an authorized operator.
2. **Paymaster Deposit**: Add ETH or other tokens to the SuperPaymaster's deposit pool for gas sponsorship.
3. **Monitoring**: Track gas usage and reputation metrics.

## Code Preview

```typescript
import { createOperatorClient } from '@aastar/core';
import { parseEther } from 'viem';

const operator = createOperatorClient({ ... });

// Stake GTokens
await operator.stake({
  amount: parseEther('100'),
});

// Deposit Gas Funds
await operator.deposit({
  amount: parseEther('10'),
});
```
