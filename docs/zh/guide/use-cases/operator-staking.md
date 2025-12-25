# Operator Staking Guide

Complete guide for becoming a Paymaster operator.

## Overview

Stake GTokens and provide gas sponsorship services.

---

## Steps

### 1. Acquire GTokens

```typescript
import { mintGToken } from '@aastar/tokens';

await mintGToken(client, operatorAddress, parseEther('1000'));
```

### 2. Approve Staking Contract

```typescript
import { approveGToken } from '@aastar/tokens';
import { CONTRACTS } from '@aastar/core';

await approveGToken(
  client,
  CONTRACTS.sepolia.gTokenStaking,
  parseEther('100')
);
```

### 3. Stake

```typescript
import { createOperatorClient } from '@aastar/core';

const operator = createOperatorClient({...});

await operator.stake({ amount: parseEther('100') });
```

### 4. Deposit to Paymaster

```typescript
await operator.deposit({ amount: parseEther('10') });
```

---

## Complete Example

```typescript
async function becomeOperator() {
  const operator = createOperatorClient({...});

  // 1. Mint GTokens
  await mintGToken(operator, operator.account.address, parseEther('1000'));

  // 2. Approve
  await approveGToken(
    operator,
    CONTRACTS.sepolia.gTokenStaking,
    parseEther('100')
  );

  // 3. Stake
  await operator.stake({ amount: parseEther('100') });

  // 4. Deposit
  await operator.deposit({ amount: parseEther('10') });

  console.log('Operator setup complete!');
}
```

---

## Related

- [Operator API](/api/roles/operator)
- [Tokens Module](/api/modules/tokens)
- [Core Module](/api/modules/core)
