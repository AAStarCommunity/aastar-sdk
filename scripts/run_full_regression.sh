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

# 1.5 Unit Testing Phase (SDK)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧩 Phase 1.5: SDK Unit Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm --filter @aastar/enduser --filter @aastar/operator --filter @aastar/admin test

# 2. Execution Phase (Gasless Tests)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Phase 2: Gasless Transactions (L4)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/run_l4_gasless_regression.sh --network $ENV

# 2.5 Cryptography Verification Phase (EIP-2537)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Phase 2.5: EIP-2537 Precompile Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$ENV" == "sepolia" || "$ENV" == "op-sepolia" ]]; then
    pnpm run test:eip2537 -- --network $ENV --json --out packages/analytics/data/historical/eip2537_checks.jsonl
    echo "✅ Logged to packages/analytics/data/historical/eip2537_checks.jsonl"
else
    echo "⏭️  Skipped (only supported on sepolia/op-sepolia envs)"
fi

# 3. Analytics Phase
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Phase 3: Gas Analytics & Reporting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsx packages/analytics/src/gas-analyzer-v4.ts

echo "✅ Full Regression Cycle Complete!"
