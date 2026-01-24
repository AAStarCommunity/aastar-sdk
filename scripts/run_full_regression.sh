#!/bin/bash
set -e

# Default env
ENV="sepolia"

# Parse args
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env) ENV="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting Full Regression Pipeline on $ENV..."

# 1. Setup Phase (Idempotent)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛠️ Phase 1: Environment Setup (L4)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Ensure we use the correct config
export NETWORK=$ENV
npx tsx scripts/l4-setup.ts --network=$ENV

# 2. Execution Phase (Gasless Tests)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Phase 2: Gasless Transactions (L4)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/run_l4_gasless_regression.sh --network $ENV

# 3. Analytics Phase
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Phase 3: Gas Analytics & Reporting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsx packages/analytics/src/gas-analyzer-v4.ts

echo "✅ Full Regression Cycle Complete!"
