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
# Clear ts-node cache
rm -rf node_modules/.cache
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
        # PRIVATE_KEY_JASON is already in .env.v3, no need to override
    fi

    # Remove old config to ensure fresh generation
    rm -f script/v3/config.json
    
    # Clear cache and attempt deployment
    rm -rf broadcast cache
    if ! forge script script/v3/SetupV3.s.sol:SetupV3 --rpc-url http://127.0.0.1:8545 --broadcast --slow; then
        echo -e "${RED}❌ Deployment failed.${NC}"
        # Since we just restarted Anvil, failure is critical
        exit 1
    fi
    
    # Verify config generation
    if [ ! -f script/v3/config.json ]; then
        echo -e "${RED}❌ config.json was NOT generated! Address sync will fail.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ config.json generated with fresh addresses.${NC}"
    
    # Extract Registry Address from config
    REGISTRY_ADDR=$(grep -o '"registry": *"[^"]*"' script/v3/config.json | cut -d'"' -f4)
    echo -e "${YELLOW}🔍 Verifying deployment at $REGISTRY_ADDR...${NC}"
    
    # Check code existence (requires cast)
    if ! command -v cast &> /dev/null; then
        echo -e "${YELLOW}⚠️ 'cast' not found. Skipping code verification.${NC}"
    else
        CODE_SIZE=$(cast code "$REGISTRY_ADDR" --rpc-url http://127.0.0.1:8545 | wc -c)
        if [ "$CODE_SIZE" -lt 10 ]; then
            echo -e "${RED}❌ Deployment verification failed: No code at Registry address!${NC}"
            echo -e "${RED}🔍 Possible cause: Forge simulation succeeded (writing config) but Broadcast failed.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Deployment verified (Code exists).${NC}"
    fi

    # 3. Extract ABIs (dual extraction for SDK and legacy tests)
    echo -e "${YELLOW}📝 Extracting ABIs...${NC}"
    
    # For SDK (packages/core/src/abis/)
    ./extract_abis.sh --dest ../aastar-sdk/packages/core/src/abis
    
    # For legacy non-SDK tests (abis/ at root)
    ./extract_abis_legacy.sh
    
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
    "scripts/06_local_test_v3_admin.ts"
    "scripts/06_local_test_v3_funding.ts"
    "scripts/06_local_test_v3_reputation.ts"
    "scripts/06_local_test_v3_execution.ts"
    "scripts/08_local_test_registry_lifecycle.ts"
    "scripts/09_local_test_community_lifecycle.ts"
    "scripts/10_test_protocol_admin_full.ts"
    "scripts/11_test_core_flows_full.ts"
    "scripts/12_test_staking_slash.ts"
    "scripts/12_test_slash_mechanism.ts"
    "scripts/12_test_staking_exit.ts"
    "scripts/13_test_sbt_burn_linkage.ts"
    "scripts/14_test_credit_redesign.ts"
    "scripts/15_test_dvt_bls_full.ts"
    "scripts/17_test_cross_role_collaboration.ts"
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
        if grep -Ei "reverted|Error:|Panic:|TypeError:" "$TMP_OUT" | grep -v "properly blocked" | grep -v "already registered" | grep -v "Skipping step" | grep -v "benign" | grep -v "InsufficientBalance" | grep -v "DepositNotVerified" > /dev/null; then
            echo -e "${RED}❌ FAILED (Internal Error): $script${NC}"
            echo -e "${YELLOW}🔍 Failure Report (Triggered by log scan):${NC}"
            grep -Ei "reverted|Error:|Panic:|TypeError:" "$TMP_OUT" | grep -v "properly blocked" | grep -v "already registered" | grep -v "Skipping step" | grep -v "benign" | grep -v "InsufficientBalance" | grep -v "DepositNotVerified"
            echo -e "${YELLOW}----------------------------------------${NC}"
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
