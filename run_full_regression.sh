#!/bin/bash

# SuperPaymaster V3 Full Regression Suite (Ultra-Robust Version)
# This script automates: Anvil setup, contract deployment, sync, and all scenario testing.

set -e

# Robust PATH setup for non-interactive shells
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$HOME/.foundry/bin"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting SuperPaymaster V3 Full Local Regression...${NC}"

# 0. Build all packages and Extract ABIs first
echo -e "${YELLOW}📦 Building all packages and extracting fresh ABIs...${NC}"

# Extract fresh ABIs from SuperPaymaster
if [ -f "./extract_abis.sh" ]; then
    echo -e "${YELLOW}📝 Extracting fresh ABIs...${NC}"
    ./extract_abis.sh || { echo -e "${RED}❌ ABI Extraction failed.${NC}"; exit 1; }
fi
echo -e "${GREEN}✅ Build and Extraction completed.${NC}"

# Handle flags
INIT_ONLY=false
SKIP_DEPLOY=false
ENV_MODE="anvil"
ENV_FILE=".env.v3"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --init-only) INIT_ONLY=true ;;
        --skip-deploy) SKIP_DEPLOY=true ;;
        --env) ENV_MODE="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ "$ENV_MODE" == "sepolia" ]; then
    ENV_FILE=".env.sepolia"
    SKIP_DEPLOY=true # Never deploy to Sepolia from regression runner
    echo -e "${CYAN}🌐 Environment Mode: SEPOLIA (Skipping Deploy, Using .env.sepolia)${NC}"
else
    ENV_FILE=".env.anvil"
    echo -e "${CYAN}🏠 Environment Mode: ANVIL (Local)${NC}"
fi

# 1. Restart Anvil for Clean State (Only in Anvil Mode)
if [ "$ENV_MODE" == "anvil" ]; then
    echo -e "${YELLOW}🔄 Restarting Anvil for Clean State...${NC}"
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
fi

# 1.5. Run Security Audit (Pre-Test)
# ... codes ...

# 2. Deploy Contracts (Optional & Anvil Only)
if [ "$SKIP_DEPLOY" = false ] && [ "$ENV_MODE" == "anvil" ]; then
    echo -e "${YELLOW}📦 Deploying contracts to Anvil...${NC}"
    PROJECT_ROOT=$(pwd)
    cd ../SuperPaymaster
    
    # Export keys if .env.v3 exists
    if [ -f ../aastar-sdk/.env.v3 ]; then
        export $(grep -v '^#' ../aastar-sdk/.env.v3 | grep -v ' ' | xargs)
    fi

    # Remove old config
    rm -f script/v3/config.json
    rm -rf broadcast cache
    
    if ! forge script contracts/script/DeployV3FullLocal.s.sol:DeployV3FullLocal --fork-url http://127.0.0.1:8545 --broadcast --slow; then
        echo -e "${RED}❌ Deployment failed.${NC}"
        exit 1
    fi
    # ... extraction and verification codes ...
    cd ../aastar-sdk
fi

# 4. Sync Configuration (Anvil Only)
if [ "$ENV_MODE" == "anvil" ]; then
    echo -e "${YELLOW}🔄 Syncing SDK configuration...${NC}"
    pnpm ts-node scripts/sync_config_to_env.ts
    if [ -f ".env.anvil" ]; then
        echo -e "${GREEN}✅ .env.anvil created and synced.${NC}"
    fi
fi

if [ "$INIT_ONLY" = true ]; then
    echo -e "${GREEN}✅ Initialization complete.${NC}"
    exit 0
fi

# 5. Run Full Test Suite
echo -e "${YELLOW}🧪 Running Full Test Suite ($ENV_MODE)...${NC}"

# Detailed Script List
TEST_SCRIPTS=(
    "scripts/v2_regression/00_validate_env.ts"
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
    "scripts/15_test_bls_full.ts"             # Core BLS Curve Validation
    "scripts/15_test_dvt_bls_full.ts"         # DVT + BLS Integration
    "scripts/18_test_lifecycle_completion.ts"
    "scripts/98_edge_reentrancy.ts"
    "scripts/99_bug_hunting_fast.ts"
)

# Set ENV for scripts
export REVISION_ENV="$ENV_MODE"
export SDK_ENV_PATH="$ENV_FILE"

TOTAL_SCRIPTS=${#TEST_SCRIPTS[@]}
PASSED_COUNT=0
FAILED_LIST=()
CURRENT_INDEX=0

for script in "${TEST_SCRIPTS[@]}"; do
    CURRENT_INDEX=$((CURRENT_INDEX + 1))
    echo -e "${YELLOW}--------------------------------------------------${NC}"
    echo -e "${CYAN}Suite $CURRENT_INDEX/$TOTAL_SCRIPTS: $script${NC}"
    
    TMP_OUT=$(mktemp)
    # Run with ts-node
    if pnpm ts-node "$script" > "$TMP_OUT" 2>&1; then
        # Check for internal reverts even on exit code 0
        # Exclude common benign messages and successful blocked-reverts
        if grep -Ei "reverted|Error:|Panic:|TypeError:" "$TMP_OUT" | \
           grep -iv "properly blocked" | \
           grep -iv "already registered" | \
           grep -iv "Skipping step" | \
           grep -iv "benign" | \
           grep -iv "InsufficientBalance" | \
           grep -iv "DepositNotVerified" | \
           grep -iv "revert matched" | \
           grep -iv "expected revert" > /dev/null; then
            echo -e "${RED}❌ FAILED (Internal Error): $script${NC}"
            FAILED_LIST+=("$script")
        else
            echo -e "${GREEN}✅ PASSED: $script${NC}"
            PASSED_COUNT=$((PASSED_COUNT + 1))
        fi
    else
        echo -e "${RED}❌ FAILED (Exit Code): $script${NC}"
        FAILED_LIST+=("$script")
    fi
    rm "$TMP_OUT"
done

# Final Report
echo -e "\n${YELLOW}==================================================${NC}"
echo -e "${YELLOW}📊 Full Regression Final Report${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo -e "Total Scripts: $TOTAL_SCRIPTS"
echo -e "Passed:       ${GREEN} $PASSED_COUNT ${NC}"
echo -e "Failed:       ${RED} $((TOTAL_SCRIPTS - PASSED_COUNT)) ${NC}"

PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_COUNT / $TOTAL_SCRIPTS) * 100}")
echo -e "Pass Rate:    ${CYAN} ${PASS_RATE}% ${NC}"

if [ $PASSED_COUNT -eq $TOTAL_SCRIPTS ]; then
    echo -e "\n${GREEN}🎉 All core contract regression tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Regression failed with $((TOTAL_SCRIPTS - PASSED_COUNT)) errors.${NC}"
    for failed in "${FAILED_LIST[@]}"; do
        echo -e "   - $failed"
    done
    exit 1
fi
