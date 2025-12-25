# AAStar SDK API Documentation

## Overview

AAStar SDK is a comprehensive TypeScript SDK for interacting with the AAStar Public Goods Infrastructure and create Your Own Protocol (YOP), providing Account Abstraction (ERC-4337) capabilities with advanced features like gasless SuperPaymaster(AOA+), EOA RainBow Bridge and community management, and reputation systems.

**Version**: 0.14.0  
**License**: MIT  
**Repository**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Module](#core-module)
4. [Account Module](#account-module)
5. [Paymaster Module](#paymaster-module)
6. [Tokens Module](#tokens-module)
7. [Identity Module](#identity-module)
8. [DApp Module](#dapp-module)
9. [Complete Examples](#complete-examples)

---

## Installation

```bash
pnpm add @aastar/sdk
# or individual packages
pnpm add @aastar/core @aastar/account @aastar/paymaster
```

---

## Quick Start

```typescript
import { createOperatorClient, createEndUserClient } from '@aastar/core';
import { sepolia } from 'viem/chains';

// Create an Operator client
const operatorClient = createOperatorClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
  account: privateKeyToAccount('0x...'),
});

// Stake GTokens
const stakeTx = await operatorClient.stake({
  amount: parseEther('100'),
});
```

---

## Core Module

### `@aastar/core`

Core configuration, contract addresses, and client creation utilities.

#### Exports

```typescript
export * from './branding';
export * from './contract-addresses';
export * from './contracts';
export * from './contract-versions';
export * from './networks';
export * from './constants';
export * from './communities';
export * from './abis';
export * from './clients';
export * from './actions';
```

---

### Networks

#### `getNetwork(network)`

Get network configuration for a supported network.

**Parameters:**
- `network`: `SupportedNetwork` - Network name ('sepolia' | 'optimism' | 'optimism-sepolia' | 'anvil')

**Returns:** Network configuration object

**Example:**
```typescript
import { getNetwork } from '@aastar/core';

const network = getNetwork('sepolia');
console.log(network.chainId); // 11155111
console.log(network.rpcUrl);  // 'https://rpc.sepolia.org'
```

---

#### `getTxUrl(network, txHash)`

Get block explorer URL for a transaction.

**Parameters:**
- `network`: `SupportedNetwork` - Network name
- `txHash`: `string` - Transaction hash

**Returns:** `string` - Full transaction URL

**Example:**
```typescript
import { getTxUrl } from '@aastar/core';

const url = getTxUrl('sepolia', '0x123...');
// 'https://sepolia.etherscan.io/tx/0x123...'
```

---

#### `getAddressUrl(network, address)`

Get block explorer URL for an address.

**Parameters:**
- `network`: `SupportedNetwork` - Network name
- `address`: `string` - Contract or wallet address

**Returns:** `string` - Full address URL

**Example:**
```typescript
import { getAddressUrl } from '@aastar/core';

const url = getAddressUrl('sepolia', '0xabc...');
// 'https://sepolia.etherscan.io/address/0xabc...'
```

---

#### `getChainId(network)`

Get chain ID for a network.

**Parameters:**
- `network`: `SupportedNetwork` - Network name

**Returns:** `number` - Chain ID

**Example:**
```typescript
import { getChainId } from '@aastar/core';

const chainId = getChainId('sepolia'); // 11155111
```

---

### Contract Addresses

#### `CONTRACTS`

Object containing all contract addresses for supported networks.

**Structure:**
```typescript
{
  sepolia: {
    registry: Address,
    superPaymaster: Address,
    gToken: Address,
    gTokenStaking: Address,
    // ... more contracts
  },
  // ... other networks
}
```

**Example:**
```typescript
import { CONTRACTS } from '@aastar/core';

const registryAddress = CONTRACTS.sepolia.registry;
console.log(registryAddress); // '0x...'
```

---

### Constants

#### Protocol Constants

```typescript
import {
  SERVICE_FEE_RATE,      // 200 (2%)
  MAX_SERVICE_FEE,       // 1000 (10%)
  BPS_DENOMINATOR,       // 10000
  ROLE_ENDUSER,          // Keccak256 hash
  ROLE_COMMUNITY,        // Keccak256 hash
  ROLE_PAYMASTER_SUPER,  // Keccak256 hash
} from '@aastar/core';
```

---

### Client Creation

#### `createOperatorClient(config)`

Create a client for Paymaster operators.

**Parameters:**
- `config`: `ClientConfig`
  - `chain`: `Chain` - Viem chain object
  - `transport`: `Transport` - Viem transport
  - `account`: `Account` - Operator account

**Returns:** `OperatorClient` with extended actions

**Example:**
```typescript
import { createOperatorClient } from '@aastar/core';
import { http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const client = createOperatorClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
  account: privateKeyToAccount(process.env.OPERATOR_KEY),
});

// Available actions:
await client.stake({ amount: parseEther('100') });
await client.deposit({ amount: parseEther('10') });
await client.withdraw({ amount: parseEther('5') });
```

---

#### `createCommunityClient(config)`

Create a client for community managers.

**Parameters:**
- `config`: `ClientConfig`
  - `chain`: `Chain`
  - `transport`: `Transport`
  - `account`: `Account` - Community admin account

**Returns:** `CommunityClient` with extended actions

**Example:**
```typescript
import { createCommunityClient } from '@aastar/core';

const client = createCommunityClient({
  chain: sepolia,
  transport: http(),
  account: communityAccount,
});

// Available actions:
await client.registerCommunity({ name: 'MyDAO' });
await client.mintSBT({ to: userAddress, tokenId: 1n });
await client.setReputationRules({ rules: [...] });
```

---

#### `createEndUserClient(config)`

Create a client for end users.

**Parameters:**
- `config`: `ClientConfig`
  - `chain`: `Chain`
  - `transport`: `Transport`
  - `account`: `Account` - User account

**Returns:** `EndUserClient` with extended actions

**Example:**
```typescript
import { createEndUserClient } from '@aastar/core';

const client = createEndUserClient({
  chain: sepolia,
  transport: http(),
  account: userAccount,
});

// Available actions:
const credit = await client.getCreditLimit();
await client.repayDebt({ amount: parseEther('1') });
```

---

#### `createAdminClient(config)`

Create a client for protocol administrators.

**Parameters:**
- `config`: `ClientConfig`
  - `chain`: `Chain`
  - `transport`: `Transport`
  - `account`: `Account` - Admin account

**Returns:** `AdminClient` with extended actions

**Example:**
```typescript
import { createAdminClient } from '@aastar/core';

const client = createAdminClient({
  chain: sepolia,
  transport: http(),
  account: adminAccount,
});

// Available actions:
await client.slashOperator({ operator: address, amount: parseEther('10') });
await client.setGlobalParameters({ exitFee: 100n });
```

---

## Account Module

### `@aastar/account`

Account Abstraction utilities for creating and managing smart accounts.

#### `createSmartAccount(config)`

Create a new smart account (ERC-4337).

**Parameters:**
- `config`: `SmartAccountConfig`
  - `owner`: `Address` - EOA owner address
  - `salt`: `bigint` - Salt for deterministic address
  - `factoryAddress`: `Address` - Account factory address

**Returns:** `SmartAccount` object

**Example:**
```typescript
import { createSmartAccount } from '@aastar/account';

const account = await createSmartAccount({
  owner: '0x...',
  salt: 0n,
  factoryAddress: CONTRACTS.sepolia.simpleAccountFactory,
});

console.log(account.address); // Predicted smart account address
```

---

#### `getAccountAddress(config)`

Get the deterministic address for a smart account.

**Parameters:**
- `config`: `SmartAccountConfig`

**Returns:** `Promise<Address>` - Smart account address

**Example:**
```typescript
import { getAccountAddress } from '@aastar/account';

const address = await getAccountAddress({
  owner: ownerAddress,
  salt: 0n,
  factoryAddress: factoryAddress,
});
```

---

## Paymaster Module

### `@aastar/paymaster`

Paymaster utilities for gas sponsorship.

#### `getPaymasterAndData(userOp, paymasterConfig)`

Generate paymaster data for a UserOperation.

**Parameters:**
- `userOp`: `UserOperation` - User operation object
- `paymasterConfig`: `PaymasterConfig`
  - `paymasterAddress`: `Address`
  - `communityAddress`: `Address`
  - `xPNTsAddress`: `Address`
  - `verificationGasLimit`: `bigint`
  - `postOpGasLimit`: `bigint`

**Returns:** `Hex` - Encoded paymaster and data

**Example:**
```typescript
import { getPaymasterAndData } from '@aastar/paymaster';

const paymasterAndData = getPaymasterAndData(userOp, {
  paymasterAddress: CONTRACTS.sepolia.superPaymaster,
  communityAddress: '0x...',
  xPNTsAddress: '0x...',
  verificationGasLimit: 100000n,
  postOpGasLimit: 50000n,
});
```

---

#### `checkEligibility(user, community, rpcUrl)`

Check if a user is eligible for gas sponsorship.

**Parameters:**
- `user`: `Address` - User address
- `community`: `Address` - Community address
- `rpcUrl`: `string` - RPC endpoint

**Returns:** `Promise<boolean>` - Eligibility status

**Example:**
```typescript
import { checkEligibility } from '@aastar/paymaster';

const isEligible = await checkEligibility(
  userAddress,
  communityAddress,
  'https://rpc.sepolia.org'
);

if (isEligible) {
  // Proceed with sponsored transaction
}
```

---

## Tokens Module

### `@aastar/tokens`

Token utilities for GToken, xPNTs, and SBTs.

#### `mintGToken(client, to, amount)`

Mint GTokens (test/development only).

**Parameters:**
- `client`: `WalletClient` - Wallet client with minter role
- `to`: `Address` - Recipient address
- `amount`: `bigint` - Amount to mint (in wei)

**Returns:** `Promise<Hash>` - Transaction hash

**Example:**
```typescript
import { mintGToken } from '@aastar/tokens';

const txHash = await mintGToken(
  client,
  recipientAddress,
  parseEther('1000')
);
```

---

#### `approveGToken(client, spender, amount)`

Approve GToken spending.

**Parameters:**
- `client`: `WalletClient`
- `spender`: `Address` - Spender address (e.g., staking contract)
- `amount`: `bigint` - Approval amount

**Returns:** `Promise<Hash>` - Transaction hash

**Example:**
```typescript
import { approveGToken } from '@aastar/tokens';

await approveGToken(
  client,
  CONTRACTS.sepolia.gTokenStaking,
  parseEther('100')
);
```

---

#### `getGTokenBalance(client, address)`

Get GToken balance for an address.

**Parameters:**
- `client`: `PublicClient`
- `address`: `Address`

**Returns:** `Promise<bigint>` - Balance in wei

**Example:**
```typescript
import { getGTokenBalance } from '@aastar/tokens';

const balance = await getGTokenBalance(client, userAddress);
console.log(formatEther(balance)); // "1000.0"
```

---

## Identity Module

### `@aastar/identity`

Identity and reputation management.

#### `getSBTBalance(client, user, tokenId)`

Get SBT (Soul-Bound Token) balance.

**Parameters:**
- `client`: `PublicClient`
- `user`: `Address`
- `tokenId`: `bigint`

**Returns:** `Promise<bigint>` - SBT balance (0 or 1)

**Example:**
```typescript
import { getSBTBalance } from '@aastar/identity';

const hasSBT = await getSBTBalance(client, userAddress, 1n);
console.log(hasSBT > 0n); // true if user has the SBT
```

---

#### `getReputationScore(client, user, community)`

Get user's reputation score in a community.

**Parameters:**
- `client`: `PublicClient`
- `user`: `Address`
- `community`: `Address`

**Returns:** `Promise<bigint>` - Reputation score

**Example:**
```typescript
import { getReputationScore } from '@aastar/identity';

const score = await getReputationScore(
  client,
  userAddress,
  communityAddress
);
console.log(score); // 850n
```

---

## DApp Module

### `@aastar/dapp`

React hooks and utilities for DApp integration.

#### `useAAStar(config)`

React hook for AAStar SDK integration.

**Parameters:**
- `config`: `AAStarConfig`
  - `network`: `SupportedNetwork`
  - `rpcUrl`: `string`

**Returns:** `AAStarContext` object

**Example:**
```typescript
import { useAAStar } from '@aastar/dapp';

function MyComponent() {
  const { client, account, connect, disconnect } = useAAStar({
    network: 'sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
  });

  return (
    <button onClick={connect}>Connect Wallet</button>
  );
}
```

---

## Complete Examples

### Example 1: Operator Staking Flow

```typescript
import { createOperatorClient, CONTRACTS } from '@aastar/core';
import { mintGToken, approveGToken } from '@aastar/tokens';
import { http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

async function operatorStakingFlow() {
  // 1. Create operator client
  const operator = createOperatorClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
    account: privateKeyToAccount(process.env.OPERATOR_KEY),
  });

  // 2. Mint GTokens (testnet only)
  await mintGToken(
    operator,
    operator.account.address,
    parseEther('1000')
  );

  // 3. Approve staking contract
  await approveGToken(
    operator,
    CONTRACTS.sepolia.gTokenStaking,
    parseEther('100')
  );

  // 4. Stake tokens
  const stakeTx = await operator.stake({
    amount: parseEther('100'),
  });

  console.log('Staked! TX:', stakeTx);

  // 5. Deposit to Paymaster
  const depositTx = await operator.deposit({
    amount: parseEther('10'),
  });

  console.log('Deposited! TX:', depositTx);
}
```

---

### Example 2: Community Registration

```typescript
import { createCommunityClient, CONTRACTS } from '@aastar/core';
import { http } from 'viem';
import { sepolia } from 'viem/chains';

async function registerCommunity() {
  const community = createCommunityClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
    account: communityAccount,
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

  // Set reputation rules
  await community.setReputationRules({
    rules: [
      { metric: 'activity', weight: 30 },
      { metric: 'contribution', weight: 70 },
    ],
  });
}
```

---

### Example 3: End User Gasless Transaction

```typescript
import { createEndUserClient, checkEligibility } from '@aastar/core';
import { getPaymasterAndData } from '@aastar/paymaster';

async function sendGaslessTransaction() {
  const user = createEndUserClient({
    chain: sepolia,
    transport: http(),
    account: userAccount,
  });

  // Check eligibility
  const eligible = await checkEligibility(
    user.account.address,
    communityAddress,
    process.env.RPC_URL
  );

  if (!eligible) {
    throw new Error('Not eligible for gas sponsorship');
  }

  // Create UserOperation
  const userOp = {
    sender: user.account.address,
    nonce: 0n,
    // ... other fields
  };

  // Get paymaster data
  const paymasterAndData = getPaymasterAndData(userOp, {
    paymasterAddress: CONTRACTS.sepolia.superPaymaster,
    communityAddress,
    xPNTsAddress: CONTRACTS.sepolia.xPNTsToken,
    verificationGasLimit: 100000n,
    postOpGasLimit: 50000n,
  });

  // Submit to bundler
  const txHash = await submitUserOperation({
    ...userOp,
    paymasterAndData,
  });

  console.log('Gasless TX:', txHash);
}
```

---

## Error Handling

All SDK functions may throw errors. Always wrap in try-catch:

```typescript
try {
  await client.stake({ amount: parseEther('100') });
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('Not enough GTokens');
  } else {
    console.error('Staking failed:', error);
  }
}
```

---

## TypeScript Support

The SDK is fully typed. Use TypeScript for the best development experience:

```typescript
import type {
  OperatorClient,
  CommunityClient,
  EndUserClient,
  AdminClient,
  SupportedNetwork,
} from '@aastar/core';
```

---

## Support

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [Join our community](https://discord.gg/aastar)

---

## License

MIT © AAStar Community
