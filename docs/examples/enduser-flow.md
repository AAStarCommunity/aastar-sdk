# End User Flow Example

This example demonstrates how an end user sends a gasless transaction using community credit.

## Steps

1. **Eligibility Check**: Verify the user has sufficient reputation or SBTs to use community sponsorship.
2. **UserOperation Construction**: Create a signed UserOperation targeting a dapp contract.
3. **Paymaster Sponsorship**: Request the SuperPaymaster to sign the UserOperation for gasless execution.

## Code Preview

```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// Execute Gasless Transaction
const hash = await user.executeGasless({
  target: dappAddress,
  data: callData,
  operator: operatorAddress, // Operator to sponsor gas
});
```
