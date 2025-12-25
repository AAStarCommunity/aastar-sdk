# Gasless Transactions Guide

Complete guide for implementing gasless transactions with SuperPaymaster.

## Overview

Enable users to send transactions without holding ETH for gas fees.

---

## Prerequisites

- User has community SBT
- Community has gas sponsorship enabled
- User within credit limit

---

## Implementation

```typescript
import { createEndUserClient } from '@aastar/core';
import { getPaymasterAndData, checkEligibility } from '@aastar/paymaster';

async function sendGaslessTransaction() {
  const user = createEndUserClient({...});

  // 1. Check eligibility
  const eligible = await checkEligibility(
    user.account.address,
    communityAddress,
    process.env.RPC_URL
  );

  if (!eligible) {
    throw new Error('Not eligible');
  }

  // 2. Check credit
  const credit = await user.getCreditLimit();
  console.log('Credit:', formatEther(credit));

  // 3. Create UserOperation
  const userOp = {...};

  // 4. Get paymaster data
  const paymasterAndData = getPaymasterAndData(userOp, {
    paymasterAddress: CONTRACTS.sepolia.superPaymaster,
    communityAddress,
    xPNTsAddress: CONTRACTS.sepolia.xPNTsToken,
    verificationGasLimit: 100000n,
    postOpGasLimit: 50000n,
  });

  // 5. Submit
  const txHash = await submitUserOperation({
    ...userOp,
    paymasterAndData,
  });

  console.log('Gasless TX:', txHash);
}
```

---

## Related

- [End User API](/api/roles/enduser)
- [Paymaster Module](/api/modules/paymaster)
- [SuperPaymaster Concept](/guide/concepts/superpaymaster)
