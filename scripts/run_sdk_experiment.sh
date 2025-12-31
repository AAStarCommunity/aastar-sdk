#!/bin/bash
# SDK Experiment Runner
# Runs performance metrics and experiment scenarios

echo "🚀 Running SDK Experiment Runner..."
echo "Target: .env.sepolia"

# Ensure we are in the project root or scripts dir
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Run with tsx (pnpm)
pnpm tsx scripts/19_sdk_experiment_runner.ts
