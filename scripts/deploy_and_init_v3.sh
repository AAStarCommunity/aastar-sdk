#!/bin/bash
set -e

# Defaults
ENV_MODE="anvil"
BROADCAST=""
VERIFY=""

# Parse args
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env) ENV_MODE="$2"; shift ;;
        --broadcast) BROADCAST="--broadcast" ;;
        --verify) VERIFY="--verify" ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting Deployment for Environment: $ENV_MODE"

CONTRACTS_DIR="../SuperPaymaster"
SDK_DIR="$(pwd)"

if [ "$ENV_MODE" == "sepolia" ]; then
    ENV_FILE=".env.sepolia"
    DEPLOY_SCRIPT="DeployV3FullSepolia.s.sol:DeployV3FullSepolia"
    RPC_VAR="SEPOLIA_RPC_URL"
    # Ensure SEPOLIA_RPC_URL is available
    source $ENV_FILE
    RPC_URL_VAL="$SEPOLIA_RPC_URL"
else
    ENV_FILE=".env.anvil"
    DEPLOY_SCRIPT="DeployV3FullLocal.s.sol:DeployV3FullLocal"
    RPC_VAR="RPC_URL"
    # Ensure local RPC default
    source $ENV_FILE
    RPC_URL_VAL="${RPC_URL:-http://127.0.0.1:8545}"
fi

echo "   📂 Using Env File: $ENV_FILE"
echo "   📜 Deploy Script: $DEPLOY_SCRIPT"
echo "   📡 RPC: $RPC_URL_VAL"

# Export env vars for Forge (using set -a to export sourced vars)
set -a
source $ENV_FILE
set +a
export REVISION_ENV="$ENV_MODE"

cd $CONTRACTS_DIR

echo "   🧱 Building Contracts..."
forge build

echo "   📦 Deploying Contracts..."
# Run Deployment and capture output
DEPLOY_LOG="deploy_output_${ENV_MODE}.log"

echo "   🔎 Debug: PWD=$(pwd)"
echo "   🔎 Debug: Checking script file exists... (${DEPLOY_SCRIPT%%:*})"
ls -l "contracts/script/${DEPLOY_SCRIPT%%:*}" || echo "❌ Script file NOT found!"

forge script "contracts/script/$DEPLOY_SCRIPT" --rpc-url "$RPC_URL_VAL" $BROADCAST $VERIFY -vvvv | tee $DEPLOY_LOG

echo "   📝 Parsing Deployed Addresses..."
# Parse common addresses from log
GTOKEN=$(grep "GTOKEN_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
STAKING=$(grep "STAKING_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
REGISTRY=$(grep "REGISTRY_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
SBT=$(grep "MYSBT_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
REPUTATION=$(grep "REPUTATION_SYSTEM_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
APNTS=$(grep "APNTS_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')
PAYMASTER=$(grep "SUPERPAYMASTER_ADDRESS=" $DEPLOY_LOG | awk -F'= ' '{print $2}')

# Validate critical addresses
if [ -z "$REGISTRY" ] || [ -z "$PAYMASTER" ]; then
    echo "❌ Failed to parse addresses from deployment log. Check $DEPLOY_LOG"
    # Don't exit on parsing failure if we just want to re-run init on existing deployment? 
    # But for fresh deploy script, checking is good.
    exit 1
fi

echo "   ✅ Parsed Addresses:"
echo "      Registry: $REGISTRY"
echo "      Paymaster: $PAYMASTER"
echo "      GToken: $GTOKEN"

# Update Env File (Idempotent update)
cd $SDK_DIR
TARGET_ENV="$ENV_FILE"

# Function to update or append env var
update_env() {
    key=$1
    val=$2
    if grep -q "^$key=" "$TARGET_ENV"; then
        sed -i '' "s/^$key=.*/$key=$val/" "$TARGET_ENV"
    else
        echo "$key=$val" >> "$TARGET_ENV"
    fi
}

echo "   💾 Updating $TARGET_ENV..."
update_env "GTOKEN_ADDRESS" "$GTOKEN"
update_env "STAKING_ADDRESS" "$STAKING"
update_env "GTOKENSTAKING_ADDRESS" "$STAKING" # Alias
update_env "REGISTRY_ADDRESS" "$REGISTRY"
update_env "MYSBT_ADDRESS" "$SBT"
update_env "REPUTATION_SYSTEM_ADDRESS" "$REPUTATION"
update_env "APNTS_ADDRESS" "$APNTS"
update_env "SUPERPAYMASTER_ADDRESS" "$PAYMASTER"
update_env "SUPER_PAYMASTER" "$PAYMASTER" # Alias

# Re-source env to pick up new addresses for next scripts
source $TARGET_ENV
export GTOKEN_ADDRESS="$GTOKEN"
export SUPERPAYMASTER_ADDRESS="$PAYMASTER"
export APNTS_ADDRESS="$APNTS"

cd $CONTRACTS_DIR

echo "   ⚙️  Running Initialization (InitializeV3Roles)..."
forge script contracts/script/InitializeV3Roles.s.sol:InitializeV3Roles --rpc-url "$RPC_URL_VAL" $BROADCAST -vvvv

echo "   ⚙️  Running Configuration (ConfigureSuperPaymaster)..."
forge script contracts/script/ConfigureSuperPaymaster.s.sol:ConfigureSuperPaymaster --rpc-url "$RPC_URL_VAL" $BROADCAST -vvvv

echo "   📝 Extracting ABIs..."
cd $SDK_DIR
./extract_abis.sh

echo "🎉 Deployment & Initialization Complete!"

