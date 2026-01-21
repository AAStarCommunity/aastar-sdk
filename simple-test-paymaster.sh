#!/bin/bash
set -e

echo "🧪 Simple Paymaster Demo Suite (Gasless)"
echo "======================================="
echo ""

# Parse arguments
NETWORK="sepolia"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env|--network) NETWORK="$2"; shift ;;
        *) NETWORK="$1" ;;
    esac
    shift
done

echo "📡 Network: $NETWORK"
echo ""

# Run the demo with the network argument (requires simple-gasless-demo.ts to support it, which we fixed earlier)
npx tsx examples/simple-gasless-demo.ts --network "$NETWORK"
