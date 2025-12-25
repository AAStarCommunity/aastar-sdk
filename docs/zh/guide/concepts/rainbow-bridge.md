# EOA Rainbow Bridge

Seamlessly bridge between traditional EOA wallets and smart contract accounts.

## Overview

The EOA Rainbow Bridge enables users to:
- Use existing EOA wallets
- Upgrade to smart accounts
- Maintain backward compatibility
- Seamless transition

## How It Works

```
EOA Wallet → Rainbow Bridge → Smart Account
     ↓              ↓              ↓
  Private Key   Ownership     Advanced Features
```

## Implementation

```typescript
import { createSmartAccount } from '@aastar/account';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Start with EOA
const eoaAccount = privateKeyToAccount(process.env.PRIVATE_KEY);

// 2. Create smart account owned by EOA
const smartAccount = await createSmartAccount({
  owner: eoaAccount.address,
  salt: 0n,
  factoryAddress: CONTRACTS.sepolia.simpleAccountFactory,
});

// 3. Use smart account for advanced features
const user = createEndUserClient({
  chain: sepolia,
  transport: http(),
  account: smartAccount,
});

// Now user has:
// - Gasless transactions
// - Social recovery
// - Session keys
// - Batch operations
```

## Benefits

1. **No Learning Curve**: Users keep their familiar wallets
2. **Gradual Adoption**: Upgrade when needed
3. **Best of Both Worlds**: EOA simplicity + smart account features
4. **Backward Compatible**: Works with existing DApps

## Use Cases

- Onboarding new users
- Migrating existing users
- Multi-wallet support
- Progressive enhancement

## Related

- [Account Module](/api/modules/account)
- [Account Abstraction](/guide/concepts/account-abstraction)
