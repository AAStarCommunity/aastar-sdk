# Account Abstraction

Understanding Account Abstraction (ERC-4337) in AAStar SDK.

## What is Account Abstraction?

Account Abstraction (AA) allows users to use smart contract wallets instead of traditional Externally Owned Accounts (EOAs). This enables advanced features like:

- **Gasless Transactions**: Users don't need ETH for gas
- **Social Recovery**: Recover accounts without seed phrases
- **Session Keys**: Temporary permissions for DApps
- **Batch Transactions**: Multiple operations in one transaction
- **Custom Validation**: Flexible signature schemes

## ERC-4337 Overview

ERC-4337 is the standard for Account Abstraction. Key components:

### UserOperation

A pseudo-transaction object that represents a user's intent:

```typescript
interface UserOperation {
  sender: Address;           // Smart account address
  nonce: bigint;            // Anti-replay protection
  callData: Hex;            // Actual transaction data
  paymasterAndData: Hex;    // Paymaster info (for gasless tx)
  signature: Hex;           // User signature
  // ... gas fields
}
```

### EntryPoint

The singleton contract that processes UserOperations.

### Bundler

Off-chain service that bundles UserOperations and submits them to the EntryPoint.

### Paymaster

Contract that sponsors gas fees for users.

## AAStar Implementation

AAStar SDK provides a complete AA infrastructure:

### Smart Accounts

```typescript
import { createSmartAccount } from '@aastar/account';

const account = await createSmartAccount({
  owner: ownerAddress,
  salt: 0n,
  factoryAddress: CONTRACTS.sepolia.simpleAccountFactory,
});
```

### Gasless Transactions

```typescript
import { createEndUserClient } from '@aastar/core';

const user = createEndUserClient({...});

// Check eligibility
const eligible = await user.checkEligibility(communityAddress);

if (eligible) {
  // Send gasless transaction
  await sendGaslessTransaction();
}
```

## Benefits

1. **Better UX**: Users don't need to understand gas or hold ETH
2. **Security**: Smart contract wallets are more secure than EOAs
3. **Flexibility**: Custom validation logic and recovery mechanisms
4. **Programmability**: Wallets can have complex logic

## Learn More

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Module API](/api/modules/account)
- [End User API](/api/roles/enduser)

## Next Steps

- [SuperPaymaster (AOA+)](/guide/concepts/superpaymaster)
- [Quick Start](/guide/quick-start)
- [Examples](/examples/)
