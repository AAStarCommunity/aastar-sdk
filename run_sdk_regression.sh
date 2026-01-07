#!/bin/bash
# Complete SDK Regression Test Suite
# Integrates: Environment setup, ABI sync, Contract deployment, L1/L2/L3 API tests
# Usage: ./run_complete_regression.sh [--env anvil|sepolia] [--skip-deploy] [--skip-abi-sync]

set -e

# ========================================
# 1. Configuration & Arguments
# ========================================
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$HOME/.foundry/bin:$HOME/Library/pnpm:$HOME/.nvm/versions/node/v24.12.0/bin"

ENV="anvil"
export NETWORK="$ENV"
SKIP_DEPLOY=false
SKIP_ABI_SYNC=false
KEEP_ANVIL=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env) ENV="$2"; shift ;;
        --skip-deploy) SKIP_DEPLOY=true ;;
        --skip-abi-sync) SKIP_ABI_SYNC=true ;;
        --keep-anvil) KEEP_ANVIL=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          AAStar SDK Complete Regression Suite                ║${NC}"
echo -e "${BLUE}║          Environment: ${ENV-unknown}                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}\n"

function log_section() {
    echo -e "\n${BLUE}================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================================================${NC}\n"
}

function log_step() {
    echo -e "${YELLOW}🔹 $1...${NC}"
}

function log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ========================================
# 2. Anvil Environment Setup
# ========================================
WE_STARTED_ANVIL=false

if [ "$ENV" == "anvil" ]; then
    log_section "Anvil Environment Setup"
    log_step "Checking Anvil instance"
    
    if ! curl -s -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://127.0.0.1:8545 > /dev/null 2>&1; then
      
      echo -e "${YELLOW}⚠️  Anvil not running. Starting Anvil...${NC}"
      pkill anvil || true
      sleep 1
      anvil --port 8545 --chain-id 31337 > /tmp/anvil.log 2>&1 &
      ANVIL_PID=$!
      WE_STARTED_ANVIL=true
      sleep 3
      log_success "Anvil started (PID: $ANVIL_PID)"
    else
      log_success "Anvil already running"
    fi
fi

# ========================================
# 3. Contract Deployment (Anvil only)
# ========================================
if [ "$ENV" == "anvil" ] && [ "$SKIP_DEPLOY" == "false" ]; then
    log_section "Contract Deployment (Anvil)"
    log_step "Deploying contracts to Anvil"
    
    if [ ! -d "../SuperPaymaster" ]; then
        log_error "SuperPaymaster directory not found at ../SuperPaymaster"
        [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
        exit 1
    fi
    
    cd ../SuperPaymaster
    # Use tee to show output and log to file
    forge script contracts/script/v3/DeployAnvil.s.sol:DeployAnvil \
      --rpc-url http://127.0.0.1:8545 \
      --broadcast \
      --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
      2>&1 | tee /tmp/deploy.log
    
    DEPLOY_STATUS=${PIPESTATUS[0]}
    
    if [ $DEPLOY_STATUS -eq 0 ]; then
        log_success "Contracts deployed successfully"
    else
        log_error "Deployment failed. Check /tmp/deploy.log"
        cd ../aastar-sdk
        [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
        exit 1
    fi
    
    cd ../aastar-sdk
fi

# ========================================
# 4. ABI Synchronization
# ========================================
# Redundant steps removed. We rely on SuperPaymaster/sync_to_sdk.sh 
# as the single source of truth for ABIs and artifacts.
# This saves significant time during regression runs.

# ========================================
# 5. Environment Configuration Sync: now we use config.network.json to load contract addresses, no need to save to .env files
# ========================================
# echo -e "\n${YELLOW}⚙️  Syncing environment configuration...${NC}"

# if [ "$ENV" == "anvil" ]; then
#     # Sync from SuperPaymaster config.anvil.json
#     if [ -f "./scripts/sync_anvil_config.cjs" ]; then
#         node ./scripts/sync_anvil_config.cjs
#         echo -e "${GREEN}✅ Anvil config synced from config.anvil.json${NC}"
#     else
#         echo -e "${YELLOW}⚠️  sync_anvil_config.cjs not found${NC}"
#     fi
# fi

# Copy config.{env}.json to SDK root for constants.ts check
if [ -f "../SuperPaymaster/deployments/config.${ENV}.json" ]; then
    cp "../SuperPaymaster/deployments/config.${ENV}.json" "./config.${ENV}.json"
    log_success "config.${ENV}.json copied to SDK root"
else
    echo -e "${YELLOW}⚠️  ../SuperPaymaster/deployments/config.${ENV}.json not found${NC}"
fi

# Load environment variables
ENV_FILE=".env.${ENV}"
if [ -f "$ENV_FILE" ]; then
    log_step "Loading environment from $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    log_success "Environment loaded"
else
    log_error "Environment file not found: $ENV_FILE"
    [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
    exit 1
fi

# ========================================
# 5.5. Strict Synchronization Verification
# ========================================
# Run the node script to compare hashes of ABIs and Configs
log_section "Synchronization Verification"
log_step "Verifying file synchronization (SDK vs SuperPaymaster)"
pnpm tsx scripts/pre_test_sync.ts

if [ $? -eq 0 ]; then
    log_success "Synchronization verified"
else
    log_error "Sync verification failed. ABIs or Contracts are out of sync."
    [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
    exit 1
fi

# ========================================
# 6. Build SDK Packages
# ========================================
log_section "Build SDK Packages"
log_step "Cleaning stale artifacts"
# Clean stale artifacts
find packages -name "*.js" -o -name "*.d.ts" -o -name "*.map" | grep "/src/" | xargs rm -f 2>/dev/null || true

log_step "Building all packages via pnpm"
pnpm -r build 2>&1 | tee /tmp/sdk-build.log

SDK_BUILD_STATUS=${PIPESTATUS[0]}

if [ $SDK_BUILD_STATUS -eq 0 ]; then
    log_success "SDK packages built successfully"
else
    log_error "Build failed. Check /tmp/sdk-build.log"
    [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
    exit 1
fi

# ========================================
# 6.5. Verify Onchain Milestone
# ========================================
log_section "On-Chain Milestone Verification"
log_step "Verifying on-chain state"
pnpm tsx scripts/verify_onchain_milestone.ts $ENV

if [ $? -eq 0 ]; then
    log_success "On-chain verification passed"
else
    log_error "On-chain verification failed"
    [ "$WE_STARTED_ANVIL" == "true" ] && kill $ANVIL_PID
    exit 1
fi

# ========================================
# 7. Run L1/L2/L3 Regression Tests
# ========================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Running L1/L2/L3 API Regression Tests       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}\n"

pnpm tsx tests/regression/index.ts --network=$ENV

TEST_EXIT_CODE=$?

# ========================================
# 8. Cleanup
# ========================================
if [ "$WE_STARTED_ANVIL" == "true" ] && [ "$KEEP_ANVIL" == "false" ]; then
    echo -e "\n${YELLOW}🛑 Stopping Anvil...${NC}"
    kill $ANVIL_PID 2>/dev/null || true
fi

# ========================================
# 9. Summary
# ========================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════╗${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${BLUE}║   ${GREEN}✅ Regression Suite PASSED${BLUE}                   ║${NC}"
else
    echo -e "${BLUE}║   ${RED}❌ Regression Suite FAILED${BLUE}                   ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}\n"

exit $TEST_EXIT_CODE
