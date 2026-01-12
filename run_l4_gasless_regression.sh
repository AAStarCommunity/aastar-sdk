#!/bin/bash
# L4 Gasless Regression Test Suite
# Usage: ./run_l4_gasless_regression.sh [--env sepolia|op-sepolia]

set -e

# Configuration
ENV="sepolia"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env) ENV="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

NETWORK="$ENV"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          AAStar SDK L4 Gasless Regression                    ║${NC}"
echo -e "${BLUE}║          Environment: ${ENV}                                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}\n"

# 1. Setup Phase
echo -e "${YELLOW}Stage 1: Setup & Funding...${NC}"
pnpm tsx scripts/l4-setup.ts --network=$NETWORK

# 2. Verification Phase
echo -e "\n${YELLOW}Stage 2: Verification Tests...${NC}"
pnpm tsx tests/regression/l4-runner.ts --network=$NETWORK

echo -e "\n${GREEN}✅ L4 Gasless Regression Complete${NC}"
