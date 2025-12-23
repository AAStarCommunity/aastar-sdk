#!/bin/bash
# PhD Experiment Automation Script
# Runs SuperPaymaster experiments across multiple networks

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
EXPERIMENT_RUNS=${EXPERIMENT_RUNS:-30}
ETH_USD_PRICE=${ETH_USD_PRICE:-3500}

echo -e "${BLUE}🚀 SuperPaymaster PhD Experiment Runner${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to run experiment on a network
run_experiment() {
    local network=$1
    local output_suffix=$2
    
    echo -e "${GREEN}📊 Running experiment on ${network}...${NC}"
    
    EXPERIMENT_NETWORK=$network \
    EXPERIMENT_RUNS=$EXPERIMENT_RUNS \
    ETH_USD_PRICE=$ETH_USD_PRICE \
    npx ts-node scripts/19_sdk_experiment_runner.ts
    
    # Rename output file
    if [ -f "sdk_experiment_data.csv" ]; then
        mv sdk_experiment_data.csv "data/experiment_${network}_${output_suffix}.csv"
        echo -e "${GREEN}✅ Data saved to data/experiment_${network}_${output_suffix}.csv${NC}\n"
    fi
}

# Parse command line arguments
MODE=${1:-all}

case $MODE in
    local)
        echo -e "${YELLOW}🏠 Running LOCAL experiment (Anvil)${NC}\n"
        
        # Check if Anvil is running
        if ! nc -z localhost 8545 2>/dev/null; then
            echo -e "${RED}❌ Anvil is not running on port 8545${NC}"
            echo -e "${YELLOW}💡 Start Anvil with: anvil --fork-url \$SEPOLIA_RPC_URL${NC}"
            exit 1
        fi
        
        # Deploy contracts if needed
        echo -e "${BLUE}📦 Checking local deployment...${NC}"
        # Add deployment check/script here if needed
        
        run_experiment "local" "$(date +%Y%m%d_%H%M%S)"
        ;;
        
    sepolia)
        echo -e "${YELLOW}🌐 Running SEPOLIA experiment${NC}\n"
        
        # Verify environment
        if [ -z "$SEPOLIA_RPC_URL" ]; then
            echo -e "${RED}❌ SEPOLIA_RPC_URL not set${NC}"
            exit 1
        fi
        
        run_experiment "sepolia" "$(date +%Y%m%d_%H%M%S)"
        ;;
        
    mainnet)
        echo -e "${YELLOW}⛓️  Running MAINNET experiment (OP + Ethereum)${NC}\n"
        
        # Verify environment
        if [ -z "$OPTIMISM_RPC_URL" ]; then
            echo -e "${RED}❌ OPTIMISM_RPC_URL not set${NC}"
            exit 1
        fi
        
        # Run on Optimism
        run_experiment "optimism" "$(date +%Y%m%d_%H%M%S)"
        
        # TODO: Add Ethereum mainnet if needed
        ;;
        
    all)
        echo -e "${YELLOW}🔄 Running FULL experiment suite${NC}\n"
        
        # 1. Local
        if nc -z localhost 8545 2>/dev/null; then
            run_experiment "local" "$(date +%Y%m%d_%H%M%S)"
        else
            echo -e "${YELLOW}⚠️  Skipping local (Anvil not running)${NC}\n"
        fi
        
        # 2. Sepolia
        if [ -n "$SEPOLIA_RPC_URL" ]; then
            run_experiment "sepolia" "$(date +%Y%m%d_%H%M%S)"
        else
            echo -e "${YELLOW}⚠️  Skipping Sepolia (RPC not configured)${NC}\n"
        fi
        
        # 3. Mainnet
        if [ -n "$OPTIMISM_RPC_URL" ]; then
            run_experiment "optimism" "$(date +%Y%m%d_%H%M%S)"
        else
            echo -e "${YELLOW}⚠️  Skipping Mainnet (RPC not configured)${NC}\n"
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Invalid mode: $MODE${NC}"
        echo -e "Usage: $0 {local|sepolia|mainnet|all}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Experiment complete!${NC}"
echo -e "${BLUE}📂 Results saved in data/ directory${NC}"
