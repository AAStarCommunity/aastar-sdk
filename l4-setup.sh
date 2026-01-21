#!/bin/bash
set -e

# Parse arguments
NETWORK="sepolia"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env|--network) NETWORK="$2"; shift ;;
        --network=*) NETWORK="${1#*=}" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "🔧 Running l4-setup for network: $NETWORK"
pnpm tsx scripts/l4-setup.ts --network=$NETWORK
