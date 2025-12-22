#!/bin/bash

# SuperPaymaster V3 Full Local Regression Automation
# This script handles: Anvil Start (Check), Deployment, Funding, and Full Test Suite Execution.

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting SuperPaymaster V3 Full Local Regression...${NC}"

# 1. Check if Anvil is running
if ! curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null; then
    echo -e "${RED}❌ Anvil is not running at http://127.0.0.1:8545${NC}"
    echo -e "${YELLOW}💡 Please start Anvil in a separate terminal: 'anvil'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Anvil is running.${NC}"

# 2. Deploy Contracts (Go to SuperPaymaster dir)
echo -e "${YELLOW}📦 Deploying contracts to Anvil...${NC}"
cd ../SuperPaymaster
# Re-build to be safe
forge build --quiet

# Export keys for deployment
if [ -f ../aastar-sdk/.env.v3 ]; then
    export $(grep -v '^#' ../aastar-sdk/.env.v3 | xargs)
    export PRIVATE_KEY_JASON=$ADMIN_KEY
fi

# Run setup script
forge script script/v3/SetupV3.s.sol:SetupV3 --rpc-url http://127.0.0.1:8545 --broadcast --quiet

# 3. Extract ABIs (to ensure SDK is in sync)
echo -e "${YELLOW}📝 Extracting ABIs...${NC}"
./extract_abis.sh

# 4. Return to SDK and sync config
echo -e "${YELLOW}🔄 Syncing SDK configuration...${NC}"
cd ../aastar-sdk
pnpm ts-node scripts/sync_config_to_env.ts

# 5. Run All Tests
echo -e "${YELLOW}🧪 Running Full Test Suite...${NC}"

TEST_SCRIPTS=(
    "scripts/99_bug_hunting_fast.ts"
    "scripts/10_test_protocol_admin_full.ts"
    "scripts/11_test_core_flows_full.ts"
    "scripts/14_test_credit_redesign.ts"
    "scripts/98_edge_reentrancy.ts"
)

FAILED_TESTS=()

for script in "${TEST_SCRIPTS[@]}"; do
    echo -e "${YELLOW}--------------------------------------------------${NC}"
    echo -e "${YELLOW}▶️ Running: $script${NC}"
    if pnpm ts-node "$script"; then
        echo -e "${GREEN}✅ PASSED: $script${NC}"
    else
        echo -e "${RED}❌ FAILED: $script${NC}"
        FAILED_TESTS+=("$script")
    fi
done

# 6. Final Report
echo -e "\n${YELLOW}==================================================${NC}"
echo -e "${YELLOW}📊 Full Regression Final Report${NC}"
echo -e "${YELLOW}==================================================${NC}"

TOTAL=${#TEST_SCRIPTS[@]}
FAILED=${#FAILED_TESTS[@]}
PASSED=$((TOTAL - FAILED))

echo -e "Total Scripts: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo -e "\n${RED}❌ Regression failed with $FAILED errors.${NC}"
    for f in "${FAILED_TESTS[@]}"; do
        echo -e "   - $f"
    done
    exit 1
else
    echo -e "\n${GREEN}🎉 All local regression tests passed!${NC}"
    exit 0
fi
