# AAStar SDK Regression Testing

## Overview

Complete regression test framework for L1/L2/L3 APIs across multiple networks.

## Quick Start

```bash
# Test on Sepolia
pnpm test:regression:sepolia

# Test on Anvil
pnpm test:regression:anvil

# Test custom network
pnpm test:regression -- --network=op-sepolia
```

## Supported Networks

| Network | Command | ENV File |
|---------|---------|----------|
| Anvil | `pnpm test:regression:anvil` | `.env.anvil` |
| Sepolia | `pnpm test:regression:sepolia` | `.env.sepolia` |
| OP Sepolia | `pnpm test:regression:op-sepolia` | `.env.op-sepolia` |
| OP Mainnet | `pnpm test:regression:op-mainnet` | `.env.op-mainnet` |
| ETH Mainnet | `pnpm test:regression:mainnet` | `.env.mainnet` |

## Setup

1. **Copy ENV template**:
   ```bash
   cp env.template .env.sepolia
   ```

2. **Fill in contract addresses** from your deployment or use SuperPaymaster repo addresses.

3. **Add test account**:
   ```env
   TEST_PRIVATE_KEY=0x...
   TEST_ACCOUNT_ADDRESS=0x...
   ```

4. **Run tests**:
   ```bash
   pnpm test:regression:sepolia
   ```

## Test Layers

### L1 Core Actions
- Registry role checks
- Token balance queries
- Staking queries
- SBT balance checks

### L2 Business Clients
- UserClient functionality
- Community Client init
- Paymaster Operator checks

### L3 Scenario Patterns
- UserLifecycle queries
- StakingManager init
- OperatorLifecycle status

## ENV File Structure

Required variables:
```bash
RPC_URL=...
TEST_PRIVATE_KEY=0x...
TEST_ACCOUNT_ADDRESS=0x...

REGISTRY_ADDRESS=0x...
GTOKEN_ADDRESS=0x...
GTOKEN_STAKING_ADDRESS=0x...
SUPER_PAYMASTER_ADDRESS=0x...
SBT_ADDRESS=0x...
REPUTATION_ADDRESS=0x...
XPNTS_FACTORY_ADDRESS=0x...
```

## L3 Examples

Run L3 pattern examples:

```bash
# Community Launch
tsx examples/l3-community-launch.ts

# User Onboarding
tsx examples/l3-user-onboarding.ts
```
