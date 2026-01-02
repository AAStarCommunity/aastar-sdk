#!/bin/bash
# SDK Full Regression & Scenario Runner
# Usage: ./run_sdk_regression.sh [--env anvil|sepolia] [--scenarios-only]

set -e

# 1. Configuration & Args
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$HOME/.foundry/bin:$HOME/Library/pnpm:/Users/jason/.nvm/versions/node/v24.12.0/bin"

ENV="anvil"
SCENARIOS_ONLY=false
KEEP_ANVIL=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env) ENV="$2"; shift ;;
        --scenarios-only) SCENARIOS_ONLY=true ;;
        --keep-anvil) KEEP_ANVIL=true ;;
    esac
    shift
done

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AAStar SDK Multi-Env Regression Suite       ║${NC}"
echo -e "${BLUE}║   Target Environment: ${ENV}                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}\n"

# 2. Load Environment Variables
# Priority: .env.${ENV} > .env
if [ -f ".env.${ENV}" ]; then
    echo -e "${YELLOW}📡 Loading environment: .env.${ENV}${NC}"
    export $(grep -v '^#' .env.${ENV} | xargs)
elif [ -f ".env" ]; then
    echo -e "${YELLOW}📡 Loading default .env${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}❌ No environment file found (.env or .env.${ENV})${NC}"
    exit 1
fi

# 3. Environment Check/Init
WE_STARTED_ANVIL=false
if [ "$ENV" == "anvil" ]; then
    echo -e "${YELLOW}🔍 Checking Anvil instance...${NC}"
    if ! curl -s -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://127.0.0.1:8545 > /dev/null 2>&1; then
      
      echo -e "${YELLOW}⚠️  Anvil not running. Starting persistent Anvil...${NC}"
      pkill anvil || true
      anvil --port 8545 --chain-id 31337 > /dev/null 2>&1 &
      ANVIL_PID=$!
      WE_STARTED_ANVIL=true
      sleep 3
      
      echo -e "${YELLOW}🚀 Deploying contracts to Anvil...${NC}"
      if [ -d "../SuperPaymaster" ]; then
          cd ../SuperPaymaster
          forge script contracts/script/DeployV3FullLocal.s.sol:DeployV3FullLocal \
            --rpc-url http://127.0.0.1:8545 \
            --broadcast \
            --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
          
          # Sync ABIs & Config
          node scripts/extract_abis_to_sdk.js
          cd ../aastar-sdk
          node scripts/sync_anvil_config.cjs
          # Refresh env in current shell
          export $(grep -v '^#' .env.${ENV} | xargs)
      else
          echo -e "${RED}❌ SuperPaymaster directory not found at ../SuperPaymaster.${NC}"
          kill $ANVIL_PID
          exit 1
      fi
    fi
    echo -e "${GREEN}✅ Anvil is ready.${NC}"
fi

# 4. Build SDK
echo -e "\n${YELLOW}🔨 Building SDK packages...${NC}"
export PATH="$PATH:/Users/jason/Library/pnpm:/Users/jason/.nvm/versions/node/v24.12.0/bin"
# Clean up any accidental artifacts in src before build
find packages -name "*.js" -o -name "*.d.ts" -o -name "*.map" | grep "/src/" | xargs rm -f
# Build only our packages
pnpm -F "@aastar/*" build
echo -e "${GREEN}✅ Build successful.${NC}"

# 5. Run Test Scenarios
echo -e "\n${BLUE}🚀 Running Scenarios...${NC}"

# Scenario 1: Onboard Community
echo -e "${YELLOW}🧪 Scenario 1: Community Onboarding${NC}"
TARGET_ENV=$ENV pnpm tsx packages/sdk/tests/scenarios/01_onboard_community.ts

# Scenario 2: Onboard Operator
echo -e "${YELLOW}🧪 Scenario 2: Operator Onboarding${NC}"
TARGET_ENV=$ENV pnpm tsx packages/sdk/tests/scenarios/02_onboard_operator.ts

# Scenario 3: Onboard User
echo -e "${YELLOW}🧪 Scenario 3: User Onboarding${NC}"
TARGET_ENV=$ENV pnpm tsx packages/sdk/tests/scenarios/03_onboard_user.ts

# Scenario 4: Gasless Flow
echo -e "${YELLOW}🧪 Scenario 4: Gasless Transaction Flow${NC}"
TARGET_ENV=$ENV pnpm tsx packages/sdk/tests/scenarios/04_gasless_tx_flow.ts

if [ "$SCENARIOS_ONLY" == "true" ]; then
    echo -e "\n${GREEN}🎉 Scenario verification complete.${NC}"
    if [ "$WE_STARTED_ANVIL" == "true" ] && [ "$KEEP_ANVIL" == "false" ]; then
        echo -e "${YELLOW}🛑 Stopping Anvil...${NC}"
        kill $ANVIL_PID
    fi
    exit 0
fi

# 6. Legacy Regression (Anvil Only)
if [ "$ENV" == "anvil" ]; then
    echo -e "\n${YELLOW}🧪 Running Legacy SDK Regression (Anvil)...${NC}"
    TARGET_ENV=$ENV pnpm tsx scripts/v2_regression/01_setup_and_fund.ts
    TARGET_ENV=$ENV pnpm tsx scripts/v2_regression/02_operator_onboarding.ts
fi

if [ "$WE_STARTED_ANVIL" == "true" ] && [ "$KEEP_ANVIL" == "false" ]; then
    echo -e "${YELLOW}🛑 Stopping Anvil...${NC}"
    kill $ANVIL_PID
fi

echo -e "\n${GREEN}🎉 SDK Regression Suite Finished!${NC}\n"
