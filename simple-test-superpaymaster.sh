#!/bin/bash
set -e

echo "🧪 Simple SuperPaymaster Demo Suite"
echo "==================================="
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

# Run the demo with the network argument
npx tsx examples/simple-superpaymaster-demo.ts --network "$NETWORK"


