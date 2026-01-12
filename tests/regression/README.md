# Complete Regression Test Suite

## Overview
Integrated regression testing framework for AAStar SDK covering L1/L2/L3 APIs with automatic environment setup, ABI synchronization, and contract deployment.

## Quick Start

```bash
# Full regression on Anvil (auto-deploy + ABI sync + tests)
./run_complete_regression.sh

# Test on Sepolia (skip deployment)
./run_complete_regression.sh --env sepolia

# Skip ABI sync (use existing ABIs)
./run_complete_regression.sh --skip-abi-sync

# Keep Anvil running after tests
./run_complete_regression.sh --keep-anvil
```

## Workflow

The complete regression suite follows this workflow:

```
1. Environment Check
   ├─ Anvil: Start if not running
   └─ Sepolia: Verify RPC connection

2. Contract Deployment (Anvil only)
   ├─ Deploy via SuperPaymaster/DeployV3FullLocal.s.sol
   └─ Generate config.json

3. ABI Synchronization
   ├─ Extract ABIs from SuperPaymaster/out
   ├─ Copy to packages/core/src/abis
   └─ Update index.ts exports

4. Environment Configuration
   ├─ Sync config.json → .env.anvil
   └─ Load environment variables

5. SDK Build
   ├─ Clean stale artifacts
   └─ Build all @aastar/* packages

6. L1/L2/L3 Regression Tests
   ├─ L1: Core Actions (Registry, Staking, SBT, Reputation, etc.)
   ├─ L2: Business Clients (UserClient, CommunityClient, etc.)
   └─ L3: Scenario Patterns (UserLifecycle, OperatorLifecycle, etc.)

7. Cleanup
   └─ Stop Anvil (if started by script)
```

## Scripts

### Main Script
- `run_complete_regression.sh` - Complete integrated test suite

### Helper Scripts
- `extract_abis.sh` - Extract ABIs from SuperPaymaster
- `extract_addresses_to_env.sh` - Parse deployment output to ENV
- `scripts/sync_anvil_config.cjs` - Sync config.json to .env.anvil

### Test Files
- `tests/regression/index.ts` - Test runner
- `tests/regression/config.ts` - Network configuration loader
- `tests/regression/l1-tests.ts` - L1 Core Actions tests
- `tests/regression/l2-tests.ts` - L2 Business Clients tests
- `tests/regression/l3-tests.ts` - L3 Scenario Patterns tests

## Environment Files

### .env.anvil
```bash
RPC_URL=http://127.0.0.1:8545
TEST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
TEST_ACCOUNT_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

REGISTRY_ADDRESS=0x...
GTOKEN_ADDRESS=0x...
# ... (auto-synced from config.json)
```

### .env.sepolia
```bash
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
TEST_PRIVATE_KEY=0xYOUR_KEY
TEST_ACCOUNT_ADDRESS=0xYOUR_ADDRESS

# Contract addresses from SuperPaymaster deployment
REGISTRY_ADDRESS=0x...
GTOKEN_ADDRESS=0x...
```

## Test Coverage

### L1 Core Actions
- Registry: Role management, community queries
- Staking: Stake/unstake, balance queries
- Token: ERC20 operations
- SBT: NFT operations, membership
- Reputation: Score queries, rule management
- SuperPaymaster: Operator management, deposits
- xPNTsFactory: Token deployment

### L2 Business Clients
- UserClient: User operations
- CommunityClient: Community management
- PaymasterOperatorClient: Operator operations
- ProtocolClient: Governance operations

### L3 Scenario Patterns
- UserLifecycle: Onboarding, staking, SBT minting
- StakingManager: Stake management
- OperatorLifecycle: Operator registration, management
- CommunityLaunchpad: Community creation
- SuperPaymasterOperator: Operator lifecycle
- ProtocolGovernance: Governance workflows
- ReputationManager: Reputation management

## Troubleshooting

### Anvil won't start
```bash
pkill anvil
./run_complete_regression.sh
```

### ABI mismatch errors
```bash
# Force ABI re-sync
./run_complete_regression.sh --skip-deploy
```

### Contract not deployed
```bash
# Force re-deployment
pkill anvil
./run_complete_regression.sh
```

### Build errors
```bash
# Clean and rebuild
pnpm -r clean
./run_complete_regression.sh --skip-deploy --skip-abi-sync
```

## CI/CD Integration

```yaml
# .github/workflows/regression.yml
name: Regression Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      - name: Run Regression
        run: ./run_complete_regression.sh --env anvil
```
