#!/bin/bash

# SuperPaymaster V3 Full Regression Suite (Ultra-Robust Version)
# This script automates: Anvil setup, contract deployment, sync, and all scenario testing.

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting SuperPaymaster V3 Full Local Regression...${NC}"

# Handle flags
INIT_ONLY=false
SKIP_DEPLOY=false
if [[ "$*" == *"--init-only"* ]]; then
    INIT_ONLY=true
fi
if [[ "$*" == *"--skip-deploy"* ]]; then
    SKIP_DEPLOY=true
fi

# 1. Restart Anvil for Clean State
echo -e "${YELLOW}🔄 Restarting Anvil for Clean State...${NC}"
pkill -f anvil || true
sleep 2
anvil --block-time 1 > /dev/null 2>&1 &
ANVIL_PID=$!
echo -e "${GREEN}✅ Anvil started (PID: $ANVIL_PID). Waiting for RPC...${NC}"

# Wait for Anvil
MAX_RETRIES=10
COUNT=0
while ! curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null; do
    sleep 1
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}❌ Failed to start Anvil.${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Anvil is ready.${NC}"

# 2. Deploy Contracts (Optional)
if [ "$SKIP_DEPLOY" = false ]; then
    echo -e "${YELLOW}📦 Deploying contracts to Anvil...${NC}"
    PROJECT_ROOT=$(pwd)
    cd ../SuperPaymaster
    
    # Export keys if .env.v3 exists
    if [ -f ../aastar-sdk/.env.v3 ]; then
        export $(grep -v '^#' ../aastar-sdk/.env.v3 | grep -v ' ' | xargs)
        export PRIVATE_KEY_JASON=$ADMIN_KEY
    fi

    # Clear cache and attempt deployment
    rm -rf broadcast cache
    if ! forge script script/v3/SetupV3.s.sol:SetupV3 --rpc-url http://127.0.0.1:8545 --broadcast --quiet --slow; then
        echo -e "${RED}❌ Deployment failed (possibly 'nonce too low').${NC}"
        echo -e "${CYAN}💡 Recommendation: Restart your Anvil node ('killall anvil && anvil') to clear state.${NC}"
        echo -e "${YELLOW}⚠️  Attempting to proceed with existing deployment...${NC}"
    fi

    # 3. Extract ABIs
    echo -e "${YELLOW}📝 Extracting ABIs...${NC}"
    ./extract_abis.sh --dest ../aastar-sdk/abis
    cd ../aastar-sdk
fi

# 4. Sync Configuration
echo -e "${YELLOW}🔄 Syncing SDK configuration...${NC}"
pnpm ts-node scripts/sync_config_to_env.ts

if [ "$INIT_ONLY" = true ]; then
    echo -e "${GREEN}✅ Initialization complete.${NC}"
    exit 0
fi

# 5. Run Full Test Suite
echo -e "${YELLOW}🧪 Running Full Test Suite...${NC}"

# Detailed Script List to cover all user-requested areas
TEST_SCRIPTS=(
    "scripts/99_bug_hunting_fast.ts"
    "scripts/06_local_test_v3_full.ts"
    "scripts/08_local_test_registry_lifecycle.ts"
    "scripts/09_local_test_community_lifecycle.ts"
    "scripts/10_test_protocol_admin_full.ts"
    "scripts/11_test_core_flows_full.ts"
    "scripts/12_test_staking_slash.ts"
    "scripts/12_test_slash_mechanism.ts"
    "scripts/12_test_staking_exit.ts"
    "scripts/13_test_sbt_burn_linkage.ts"
    "scripts/14_test_credit_redesign.ts"
    "scripts/98_edge_reentrancy.ts"
)

TOTAL_SCRIPTS=${#TEST_SCRIPTS[@]}
PASSED_COUNT=0
FAILED_LIST=()

for script in "${TEST_SCRIPTS[@]}"; do
    echo -e "${YELLOW}--------------------------------------------------${NC}"
    echo -e "${YELLOW}▶️ Running: $script${NC}"
    
    TMP_OUT=$(mktemp)
    # Run with ts-node and force colored output for readability
    if pnpm ts-node "$script" > "$TMP_OUT" 2>&1; then
        # Check for internal reverts even on exit code 0
        # Specifically excluding "expected" reverts if any script uses them loosely
        if grep -Ei "reverted|Error:|Panic:|TypeError:" "$TMP_OUT" | grep -v "properly blocked" | grep -v "already registered" > /dev/null; then
            echo -e "${RED}❌ FAILED (Internal Error): $script${NC}"
            cat "$TMP_OUT" | tail -n 15
            FAILED_LIST+=("$script")
        else
            echo -e "${GREEN}✅ PASSED: $script${NC}"
            PASSED_COUNT=$((PASSED_COUNT + 1))
        fi
    else
        echo -e "${RED}❌ FAILED (Exit Code): $script${NC}"
        cat "$TMP_OUT" | tail -n 15
        FAILED_LIST+=("$script")
    fi
    rm "$TMP_OUT"
done

# Final Report
echo -e "\n${YELLOW}==================================================${NC}"
echo -e "${YELLOW}📊 Full Regression Final Report${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo -e "Total Scripts: $TOTAL_SCRIPTS"
echo -e "Passed: ${GREEN} $PASSED_COUNT ${NC}"
echo -e "Failed: ${RED} $((TOTAL_SCRIPTS - PASSED_COUNT)) ${NC}"

if [ $PASSED_COUNT -eq $TOTAL_SCRIPTS ]; then
    echo -e "\n${GREEN}🎉 All local regression tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Regression failed with $((TOTAL_SCRIPTS - PASSED_COUNT)) errors.${NC}"
    for failed in "${FAILED_LIST[@]}"; do
        echo -e "   - $failed"
    done
    exit 1
fi
