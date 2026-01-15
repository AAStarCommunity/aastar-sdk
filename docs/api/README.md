# AAStar SDK API Documentation

**[中文版 →](/zh/api/)** | **[English](/api/)**

## Overview

AAStar SDK is a comprehensive TypeScript SDK for interacting with the AAStar Public Goods Infrastructure and create Your Own Protocol (YOP), providing Account Abstraction (ERC-4337) capabilities with advanced features like gasless SuperPaymaster(AOA+), EOA RainBow Bridge, community management, and reputation systems.

**Version**: 0.16.6  
**License**: MIT  
**Repository**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

---

## Table of Contents

1. [Installation](#installation)
2. [Package Structure](#package-structure)
3. [Developer Levels](#developer-levels)
4. [Quick Start](#quick-start)
5. [Core Module](#core-module)
6. [Account Module](#account-module)
7. [Paymaster Module](#paymaster-module)
8. [Tokens Module](#tokens-module)
9. [Identity Module](#identity-module)
10. [DApp Module](#dapp-module)
11. [Analytics Module](#analytics-module)
12. [SDK Module](#sdk-module)
13. [Complete Examples](#complete-examples)

---

## Installation

### Option 1: Install All Packages (Recommended)

```bash
pnpm add @aastar/sdk
```

This installs all sub-packages: `core`, `account`, `paymaster`, `tokens`, `identity`, `dapp`, `analytics`.

### Option 2: Install Individual Packages

```bash
# Core is required for all packages
pnpm add @aastar/core viem

# Add specific packages as needed
pnpm add @aastar/account
pnpm add @aastar/paymaster
pnpm add @aastar/tokens
```

> **Note**: `@aastar/core` is a required dependency for all other packages. It contains contract ABIs, addresses, and low-level actions.

---

## Package Structure

```
@aastar/sdk (Meta Package)
     ↓
┌────────────────────────────────────┐
│      @aastar/core (Foundation)     │
│  - ABIs, Addresses, Actions        │
│  - tokenActions (80+ functions)    │
│  - registryActions (50+ functions) │
└────────────────────────────────────┘
     ↓ (依赖 depends on)
┌─────────┬─────────┬─────────┬─────────┬──────────┐
│ account │paymaster│ tokens  │identity │ dapp     │
│         │         │Finance  │SBT      │ Hooks    │
│         │         │Client   │Rep      │          │
└─────────┴─────────┴─────────┴─────────┴──────────┘
```

**Key Points**:
- ✅ `@aastar/sdk` is a meta package that re-exports all sub-packages
- ✅ `@aastar/core` is a required dependency for all other packages
- ✅ All sub-packages depend on `@aastar/core`

---

## Developer Levels

AAStar SDK caters to different levels of developers:

### 🔧 Low-Level Developers (Protocol Builders)

**Who**: Building custom protocols, integrating with other systems, need maximum flexibility

**Tools**:
- `@aastar/core` - All ABIs, Actions, and low-level utilities
- Direct contract interactions via `tokenActions()`, `registryActions()`, etc.
- Access to all 80+ token functions, 50+ registry functions, etc.

**Example**:
```typescript
import { tokenActions, registryActions } from '@aastar/core';

const client = createPublicClient({...})
  .extend(tokenActions())
  .extend(registryActions());

// Full control over contract calls
await client.tokenMint({ token, to, amount });
await client.registryRegisterRole({ roleId, data });
```

### 🚀 High-Level Developers (Business Logic)

**Who**: Building dApps, community tools, need simplified APIs

**Tools**:
- `@aastar/sdk` - Role-based clients with business logic
- `@aastar/tokens` - FinanceClient for common operations
- `@aastar/paymaster` - Gasless transaction helpers
- `@aastar/identity` - Reputation and SBT management

**Example**:
```typescript
import { createOperatorClient } from '@aastar/sdk';
import { FinanceClient } from '@aastar/tokens';

const operator = createOperatorClient({...});
const finance = new FinanceClient(publicClient, walletClient);

// Simplified business operations
await operator.onboardFully({
  stakeAmount: parseEther('100'),
  depositAmount: parseEther('10'),
  roleId: ROLE_PAYMASTER_SUPER
});

await finance.approveAndStake(parseEther('100'));
```

### 🎨 Frontend Developers (UI/UX)

**Who**: Building user interfaces, need React hooks and components

**Tools**:
- `@aastar/dapp` - React hooks and UI components
- `@aastar/sdk` - End user client for gasless transactions

**Example**:
```typescript
import { useCreditScore, useSuperPaymaster } from '@aastar/dapp';

function MyComponent() {
  const { score, loading } = useCreditScore(userAddress);
  const { submitGasless } = useSuperPaymaster();
  
  return <div>Credit Score: {score}</div>;
}
```

---

## Quick Start

```typescript
import { createOperatorClient, createEndUserClient } from '@aastar/sdk';
import { sepolia } from 'viem/chains';
import { http, privateKeyToAccount, parseEther } from 'viem';

// Create an Operator client
const operatorClient = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.OPERATOR_KEY as `0x${string}`),
});

// Stake GTokens
const stakeTx = await operatorClient.stake({
  amount: parseEther('100'),
});

console.log('Staked! Tx:', stakeTx);
```

---

## Core Module

### @aastar/core

Core configuration, contract ABIs, addresses, and utilities.

**Developer Level**: 🔧 Low-Level + 🚀 High-Level

**Key Features**:
- Contract ABIs for all ecosystem contracts
- Network configurations (Sepolia, Optimism, Anvil)
- Actions for contract interactions (viem-style)
- Client creation utilities

**For Low-Level Developers**:
- `tokenActions()` - 80+ token operation functions
- `registryActions()` - 50+ registry contract interactions
- `sbtActions()` - SBT contract interactions
- `superPaymasterActions()` - SuperPaymaster operations
- `stakingActions()` - Staking operations
- `xPNTsFactoryActions()` - xPNTs factory operations

**For High-Level Developers**:
- `createOperatorClient()` - Operator client with business logic
- `createCommunityClient()` - Community client
- `createEndUserClient()` - End user client
- `createAdminClient()` - Admin client

**Detailed API**: [View @aastar/core API →](./@aastar/core/)

### Architecture: Where to Find Things

#### Registry
Registry contract manages roles, communities, and permissions.

- **ABI**: `import { RegistryABI } from '@aastar/core'`
- **Address**: `import { REGISTRY_ADDRESS } from '@aastar/core'`
- **Actions**: `import { registryActions } from '@aastar/core'`
- **Detailed API**: [RegistryABI](./@aastar/core/variables/RegistryABI.md) | [registryActions](./@aastar/core/functions/registryActions.md)

#### SBT (Soul Bound Token)
SBT contract for community membership and identity.

- **ABI**: `import { MySBTABI } from '@aastar/core'`
- **Address**: `import { SBT_ADDRESS } from '@aastar/core'`
- **Actions**: `import { sbtActions } from '@aastar/core'`
- **Detailed API**: [MySBTABI](./@aastar/core/variables/MySBTABI.md) | [sbtActions](./@aastar/core/functions/sbtActions.md)

#### xPNTsFactory
Factory contract for creating xPNTs tokens (spending limit tokens).

- **ABI**: `import { xPNTsFactoryABI } from '@aastar/core'`
- **Address**: `import { XPNTS_FACTORY_ADDRESS } from '@aastar/core'`
- **Actions**: `import { xPNTsFactoryActions } from '@aastar/core'`
- **Detailed API**: [xPNTsFactoryABI](./@aastar/core/variables/xPNTsFactoryABI.md) | [xPNTsFactoryActions](./@aastar/core/functions/xPNTsFactoryActions.md)

#### SuperPaymaster
SuperPaymaster contract for gasless transactions (AOA+).

- **ABI**: `import { SuperPaymasterABI } from '@aastar/core'`
- **Address**: `import { SUPER_PAYMASTER_ADDRESS } from '@aastar/core'`
- **Actions**: `import { superPaymasterActions } from '@aastar/core'`
- **Detailed API**: [SuperPaymasterABI](./@aastar/core/variables/SuperPaymasterABI.md) | [superPaymasterActions](./@aastar/core/functions/superPaymasterActions.md)

### Networks

```typescript
import { getNetwork, getRpcUrl, getTxUrl } from '@aastar/core';

const network = getNetwork('sepolia');
console.log(network.chainId); // 11155111

const rpcUrl = getRpcUrl('sepolia');
const txUrl = getTxUrl('sepolia', '0x123...');
```

### Contract Addresses

```typescript
import { CONTRACTS, CORE_ADDRESSES } from '@aastar/core';

console.log(CORE_ADDRESSES.registry);
console.log(CORE_ADDRESSES.superPaymaster);
console.log(CORE_ADDRESSES.sbt);
console.log(CORE_ADDRESSES.xPNTsFactory);
console.log(CORE_ADDRESSES.gToken);
console.log(CORE_ADDRESSES.gTokenStaking);
```

### Client Creation

```typescript
import { 
  createOperatorClient,
  createCommunityClient,
  createEndUserClient,
  createAdminClient
} from '@aastar/core';

const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.OPERATOR_KEY as `0x${string}`),
});
```

---

## Account Module

### @aastar/account

Account Abstraction (ERC-4337) utilities for creating and managing smart contract accounts.

**Developer Level**: 🔧 Low-Level + 🚀 High-Level

**Key Features**:
- Smart account creation and management
- UserOperation construction and signing
- ERC-4337 EntryPoint integration

**Main Classes**:
- `UserOpClient` - UserOperation management
- Account creation utilities

**Example**:
```typescript
import { UserOpClient, toSimpleSmartAccount } from '@aastar/account';

// Create smart account
const account = await toSimpleSmartAccount({
  client: publicClient,
  owner: privateKeyToAccount('0x...'),
  entryPoint: ENTRY_POINT_ADDRESS
});

// Create UserOp
const userOp = await UserOpClient.buildUserOp({
  account,
  calls: [{
    to: '0x...',
    value: 0n,
    data: '0x...'
  }]
});
```

**Detailed API**: [View @aastar/account API →](./@aastar/account/)

---

## Paymaster Module

### @aastar/paymaster

SuperPaymaster (AOA+) and Paymaster V4 for gasless transactions and gas sponsorship.

**Developer Level**: 🚀 High-Level

**Key Features**:
- Gasless transaction submission
- Gas sponsorship management
- Paymaster V4 and SuperPaymaster integration

**Main Classes**:
- `SuperPaymasterClient` - SuperPaymaster (AOA+) operations
- `PaymasterClient` - Paymaster V4 operations
- `SuperPaymasterAdminClient` - Admin operations
- `PaymasterOperator` - Operator management

**Example**:
```typescript
import { SuperPaymasterClient } from '@aastar/paymaster';

// Check eligibility
const eligible = await SuperPaymasterClient.checkEligibility({
  client,
  userAddress,
  communityAddress
});

// Submit gasless transaction
if (eligible) {
  const txHash = await SuperPaymasterClient.submitGaslessTransaction({
    client,
    to: '0x...',
    data: '0x...'
  });
}
```

**Detailed API**: [View @aastar/paymaster API →](./@aastar/paymaster/)

---

## Tokens Module

### @aastar/tokens

High-level finance operations and low-level token actions.

**Developer Level**: 🔧 Low-Level + 🚀 High-Level

**For High-Level Developers**:
- `FinanceClient` - Simplified business operations
  - `getGTokenBalance()` - Query GToken balance
  - `getAPNTsBalance()` - Query aPNTs balance
  - `approveAndStake()` - One-click approve + stake
  - `getTokenomicsOverview()` - Complete tokenomics data
  - `getCirculatingSupply()` - Circulating supply metrics

**For Low-Level Developers** (re-exported from @aastar/core):
- `tokenActions()` - 80+ token functions
  - ERC20 Standard: `tokenTransfer`, `tokenApprove`, `tokenBalanceOf`, `tokenAllowance`
  - Mintable/Burnable: `tokenMint`, `tokenBurn`, `tokenBurnFrom`
  - Metadata: `tokenName`, `tokenSymbol`, `tokenDecimals`
  - Ownable: `tokenOwner`, `tokenTransferOwnership`
  - xPNTs Specific: `tokenUpdateExchangeRate`, `tokenGetDebt`, `tokenRepayDebt`
  - Auto Approval: `tokenAddAutoApprovedSpender`, `tokenIsAutoApprovedSpender`
  - ... and 70+ more functions

**ABIs** (re-exported from @aastar/core):
- `GTokenABI` - GToken contract ABI
- `xPNTsTokenABI` - xPNTs token ABI
- `xPNTsFactoryABI` - xPNTs factory ABI

**Example (High-Level)**:
```typescript
import { FinanceClient } from '@aastar/tokens';

const finance = new FinanceClient(publicClient, walletClient);

// Automatic approve + stake
await finance.approveAndStake(parseEther('100'));

// Get tokenomics overview
const overview = await finance.getTokenomicsOverview();
console.log(overview);
// {
//   totalSupply: 1000000000000000000000000n,
//   totalStaked: 500000000000000000000000n,
//   totalBurned: 10000000000000000000000n,
//   circulatingSupply: 490000000000000000000000n,
//   stakingRatio: 50.0
// }
```

**Example (Low-Level)**:
```typescript
import { tokenActions, CORE_ADDRESSES } from '@aastar/tokens';
// or
import { tokenActions, CORE_ADDRESSES } from '@aastar/core';

const client = createPublicClient({...}).extend(tokenActions());

// Transfer tokens
await client.tokenTransfer({
  token: CORE_ADDRESSES.gToken,
  to: '0x...',
  amount: parseEther('100')
});

// Approve spending
await client.tokenApprove({
  token: CORE_ADDRESSES.gToken,
  spender: CORE_ADDRESSES.gTokenStaking,
  amount: parseEther('100')
});

// Get balance
const balance = await client.tokenBalanceOf({
  token: CORE_ADDRESSES.gToken,
  account: '0x...'
});
```

**When to choose**:
- **Low-Level** (`tokenActions`): Custom logic, direct contract calls, maximum flexibility
- **High-Level** (`FinanceClient`): Common operations, simplified API, automatic workflows

**Detailed API**: [View @aastar/tokens API →](./@aastar/tokens/)

---

## Identity Module

### @aastar/identity

Identity management, SBT (Soul Bound Token), and reputation system.

**Developer Level**: 🚀 High-Level

**Key Features**:
- Reputation score calculation
- Credit limit queries
- Reputation proof submission
- SBT management

**Main Classes**:
- `ReputationClient` - Reputation system operations
- SBT utilities

**Example**:
```typescript
import { ReputationClient } from '@aastar/identity';

const reputation = new ReputationClient(
  publicClient, 
  REPUTATION_SYSTEM_ADDRESS
);

// Get global reputation
const score = await reputation.getGlobalReputation(userAddress);

// Get credit limit based on reputation
const creditLimit = await reputation.getCreditLimit(userAddress);

// Get reputation breakdown
const breakdown = await reputation.getReputationBreakdown(userAddress);
console.log(breakdown);
// {
//   baseScore: 500,
//   stakingBonus: 300,
//   activityBonus: 200,
//   penaltyDeduction: 0,
//   total: 1000
// }
```

**Detailed API**: [View @aastar/identity API →](./@aastar/identity/)

---

## DApp Module

### @aastar/dapp

DApp integration utilities, React hooks, and UI components.

**Developer Level**: 🎨 Frontend

**Key Features**:
- React hooks for credit scores
- React hooks for SuperPaymaster
- UI components (coming soon)

**Main Exports**:
- `useCreditScore()` - Credit score React hook
- `useSuperPaymaster()` - SuperPaymaster React hook

**Example**:
```typescript
import { useCreditScore, useSuperPaymaster } from '@aastar/dapp';

function MyComponent() {
  const { score, loading, error } = useCreditScore(userAddress);
  const { submitGasless, eligible } = useSuperPaymaster();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h2>Credit Score: {score}</h2>
      {eligible && (
        <button onClick={() => submitGasless({...})}>
          Send Gasless Transaction
        </button>
      )}
    </div>
  );
}
```

**Detailed API**: [View @aastar/dapp API →](./@aastar/dapp/)

---

## Analytics Module

### @aastar/analytics

Analytics client for monitoring and statistics.

**Developer Level**: 🔧 Low-Level + 🚀 High-Level

**Key Features**:
- Supply metrics (no permission required)
- Real-time burn event subscriptions
- Role entrance cost queries

**Main Classes**:
- `AnalyticsClient` - Analytics and monitoring

**Example**:
```typescript
import { AnalyticsClient } from '@aastar/analytics';

const analytics = new AnalyticsClient(publicClient, {
  gtoken: G TOKEN_ADDRESS,
  registry: REGISTRY_ADDRESS
});

// Get supply metrics
const metrics = await analytics.getSupplyMetrics();
console.log(metrics);
// {
//   cap: 1000000000000000000000000n,
//   totalSupply: 800000000000000000000000n,
//   totalLifetimeBurned: 10000000000000000000000n,
//   remainingMintable: 190000000000000000000000n,
//   deflationRate: 1.0
// }

// Subscribe to burn events
const unwatch = analytics.subscribeToBurnEvents((event) => {
  console.log('Token burned:', event);
});

// Get role entrance cost
const cost = await analytics.getRoleEntranceCost(ROLE_PAYMASTER_SUPER);
console.log(cost);
// {
//   minStake: 100000000000000000000n,
//   entryBurn: 10000000000000000000n,
//   totalRequired: 110000000000000000000n,
//   exitFee: { percent: 1.0, minFee: 1000000000000000000n }
// }
```

**Detailed API**: [View @aastar/analytics API →](./@aastar/analytics/)

---

## SDK Module

### @aastar/sdk

Meta package that re-exports all sub-packages and provides additional role-based clients.

**Developer Level**: 🚀 High-Level

**Key Features**:
- Re-exports all sub-packages
- Role-based clients with business logic
- Error handling utilities
- Role data factory

**Main Exports**:
- Everything from `@aastar/core`
- Everything from `@aastar/account`
- Everything from `@aastar/paymaster`
- Everything from `@aastar/tokens`
- Everything from `@aastar/identity`
- Everything from `@aastar/dapp`
- Additional utilities: `AAStarError`, `RoleDataFactory`, `eventDecoder`

**Example**:
```typescript
// One-stop import
import { 
  createOperatorClient,
  createCommunityClient,
  createEndUserClient,
  FinanceClient,
  SuperPaymasterClient,
  ReputationClient,
  useCreditScore
} from '@aastar/sdk';

// All functionality available from a single package
```

**Detailed API**: [View @aastar/sdk API →](./@aastar/sdk/)

---

## Token Operations

Token operations are available at two levels:

### Low-Level: Direct Contract Interactions

Use `tokenActions()` from `@aastar/core` or `@aastar/tokens`:

```typescript
import { tokenActions, CORE_ADDRESSES } from '@aastar/tokens';
// or
import { tokenActions, CORE_ADDRESSES } from '@aastar/core';

const client = createPublicClient({...}).extend(tokenActions());

// Transfer tokens
await client.tokenTransfer({
  token: CORE_ADDRESSES.gToken,
  to: '0x...',
  amount: parseEther('100')
});

// Approve spending
await client.tokenApprove({
  token: CORE_ADDRESSES.gToken,
  spender: CORE_ADDRESSES.gTokenStaking,
  amount: parseEther('100')
});

// Mint tokens (admin)
await client.tokenMint({
  token: CORE_ADDRESSES.gToken,
  to: '0x...',
  amount: parseEther('1000')
});

// Get balance
const balance = await client.tokenBalanceOf({
  token: CORE_ADDRESSES.gToken,
  account: '0x...'
});
```

**Available Functions** (80+):
- **ERC20 Standard**: `tokenTransfer`, `tokenTransferFrom`, `tokenApprove`, `tokenAllowance`, `tokenBalanceOf`, `tokenTotalSupply`
- **Mintable/Burnable**: `tokenMint`, `tokenBurn`, `tokenBurnFrom`
- **Metadata**: `tokenName`, `tokenSymbol`, `tokenDecimals`
- **Ownable**: `tokenOwner`, `tokenTransferOwnership`, `tokenRenounceOwnership`
- **Capped**: `tokenCap`, `tokenRemainingMintableSupply`
- **xPNTs Specific**: 
  - `tokenUpdateExchangeRate`, `tokenGet Debt`, `tokenRepayDebt`
  - `tokenTransferAndCall`, `tokenCommunityName`, `tokenCommunityENS`
  - `tokenExchangeRate`, `tokenSpendingLimits`, `tokenDefaultSpendingLimitXPNTs`
  - `tokenCumulativeSpent`, `tokenDebts`, `tokenUsedOpHashes`
- **Auto Approval**: `tokenAddAutoApprovedSpender`, `tokenRemoveAutoApprovedSpender`, `tokenIsAutoApprovedSpender`
- **EIP2612 (Permit)**: `tokenDOMAIN_SEPARATOR`, `tokenNonces`, `tokenPermit`
- **Admin**: `tokenSetPaymasterLimit`, `tokenSetSuperPaymasterAddress`
- ... and 50+ more functions

[View All Token Functions →](./@aastar/core/type-aliases/TokenActions.md)

### High-Level: Business Logic

Use `FinanceClient` from `@aastar/tokens`:

```typescript
import { FinanceClient } from '@aastar/tokens';

const finance = new FinanceClient(publicClient, walletClient);

// Get GToken balance
const gTokenBalance = await finance.getGTokenBalance(userAddress);

// Get aPNTs balance
const aPNTsBalance = await finance.getAPNTsBalance(userAddress);

// Automatic approve + stake (one transaction)
await finance.approveAndStake(parseEther('100'));

// Get circulating supply
const supply = await finance.getCirculatingSupply();
console.log(supply);
// {
//   total: 1000000000000000000000000n,
//   locked: 500000000000000000000000n,
//   circulating: 500000000000000000000000n
// }

// Get tokenomics overview
const overview = await finance.getTokenomicsOverview();
console.log(overview);
// {
//   totalSupply: 1000000000000000000000000n,
//   totalStaked: 500000000000000000000000n,
//   totalBurned: 10000000000000000000000n,
//   circulatingSupply: 490000000000000000000000n,
//   stakingRatio: 50.0
// }
```

**When to choose**:
- **Low-Level** (`tokenActions`): 
  - Custom logic requiring specific token functions
  - Direct contract calls for maximum control
  - Building custom protocols or integrations
  - Need access to all 80+ token functions
  
- **High-Level** (`FinanceClient`): 
  - Common operations (stake, balance queries, tokenomics)
  - Simplified API for business logic
  - Automatic workflows (auto-approve + stake)
  - Building dApps with standard functionality

---

## Complete Examples

### Example 1: Operator Staking Flow

```typescript
import { createOperatorClient, ROLE_PAYMASTER_SUPER } from '@aastar/sdk';
import { parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { http, privateKeyToAccount } from 'viem';

// Create operator client
const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.OPERATOR_KEY as `0x${string}`),
});

// Full onboarding flow (approve + register + deposit)
await operator.onboardFully({
  stakeAmount: parseEther('100'),  // Stake 100 GToken
  depositAmount: parseEther('10'), // Deposit 10 aPNTs
  roleId: ROLE_PAYMASTER_SUPER     // Register as SuperPaymaster operator
});

// Configure operator
await operator.configureOperator({
  xPNTsToken: '0x...',              // xPNTs token address
  treasury: '0x...',                // Treasury address
  exchangeRate: parseEther('1.0')   // 1:1 exchange rate
});

// Check readiness
const status = await operator.checkReadiness();
console.log(status);
// {
//   isRegistered: true,
//   isConfigured: true,
//   collateralBalance: 10000000000000000000n,
//   isPaused: false,
//   roleStatus: true
// }
```

### Example 2: Community Registration

```typescript
import { createCommunityClient } from '@aastar/sdk';
import { sepolia } from 'viem/chains';
import { http, privateKeyToAccount } from 'viem';

const community = createCommunityClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.COMMUNITY_KEY as `0x${string}`),
});

// Register community
const tx = await community.registerCommunity({
  name: 'My Community',
  description: 'A great community for builders',
});

console.log('Community registered! Tx:', tx);
```

### Example 3: End User Gasless Transaction

```typescript
import { createEndUserClient } from '@aastar/sdk';
import { SuperPaymasterClient } from '@aastar/paymaster';
import { sepolia } from 'viem/chains';
import { http, privateKeyToAccount } from 'viem';

const user = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.USER_KEY as `0x${string}`),
});

// Check eligibility
const eligible = await SuperPaymasterClient.checkEligibility({
  client: user,
  userAddress: user.account.address,
  communityAddress: '0x...'
});

// Submit gasless transaction
if (eligible) {
  const txHash = await SuperPaymasterClient.submitGaslessTransaction({
    client: user,
    to: '0x...' as `0x${string}`,
    data: '0x...' as `0x${string}`,
  });

  console.log('Gasless transaction submitted! Hash:', txHash);
}
```

### Example 4: Using Low-Level Registry Actions

```typescript
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { registryActions, REGISTRY_ADDRESS } from '@aastar/core';

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL)
}).extend(registryActions());

// Get community info
const community = await client.getCommunity({
  address: '0x...' as `0x${string}`
});

console.log('Community:', community);

// Check if user has role
const hasRole = await client.registryHasRole({
  user: '0x...' as `0x${string}`,
  roleId: ROLE_PAYMASTER_SUPER
});

console.log('Has role:', hasRole);
```

### Example 5: Token Operations

```typescript
import { FinanceClient, tokenActions, CORE_ADDRESSES } from '@aastar/tokens';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';

// High-level approach
const finance = new FinanceClient(publicClient, walletClient);
await finance.approveAndStake(parseEther('100'));

// Low-level approach
const client = createPublicClient({...}).extend(tokenActions());
await client.tokenApprove({
  token: CORE_ADDRESSES.gToken,
  spender: CORE_ADDRESSES.gTokenStaking,
  amount: parseEther('100')
});
```

---

## Error Handling

```typescript
import { AAStarValidationError, AAStarError } from '@aastar/sdk';

try {
  await operator.stake({ amount: parseEther('100') });
} catch (error) {
  if (error instanceof AAStarValidationError) {
    console.error('Validation failed:', error.message);
  } else if (error instanceof AAStarError) {
    console.error('SDK error:', error.message, error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## TypeScript Support

All packages are written in TypeScript with full type definitions.

```typescript
import type { 
  SupportedNetwork, 
  ClientConfig, 
  RoleRequirement,
  SuperPaymasterConfig,
  TokenActions
} from '@aastar/core';

import type { FinanceClient } from '@aastar/tokens';
import type { ReputationClient } from '@aastar/identity';
```

---

## Support

- **Documentation**: https://docs.aastar.io
- **GitHub**: https://github.com/AAStarCommunity/aastar-sdk

---

## License

MIT © AAStar Community
