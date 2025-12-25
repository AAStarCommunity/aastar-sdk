# End User Flow Example

This example demonstrates how an end user sends a gasless transaction using community credit.

## Steps

1. **Eligibility Check**: Verify the user has sufficient reputation or SBTs to use community sponsorship.
2. **UserOperation Construction**: Create a signed UserOperation targeting a dapp contract.
3. **Paymaster Sponsorship**: Request the SuperPaymaster to sign the UserOperation for gasless execution.

## Code Preview

```typescript
import { createEndUserClient } from '@aastar/core';

const user = createEndUserClient({ ... });

// Send Gasless Transaction
const hash = await user.sendTransaction({
  to: dappAddress,
  data: callData,
  communityAddress: '0x...', // Community to sponsor gas
});
```
