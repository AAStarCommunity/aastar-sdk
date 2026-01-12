#!/bin/bash
# 从 SuperPaymaster 部署输出提取地址到 .env.v3
# 用法: ./extract_addresses_to_env.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$SCRIPT_DIR"
CONTRACTS_DIR="$SDK_DIR/../SuperPaymaster"

echo "🔍 Extracting addresses from deployment output..."

# 重新部署并捕获输出
cd "$CONTRACTS_DIR"
DEPLOY_OUTPUT=$(forge script contracts/script/DeployV3FullLocal.s.sol:DeployV3FullLocal --fork-url http://localhost:8545 --broadcast 2>&1)

# 提取地址
REGISTRY=$(echo "$DEPLOY_OUTPUT" | grep "REGISTRY=" | tail -1 | awk '{print $NF}')
GTOKEN=$(echo "$DEPLOY_OUTPUT" | grep "GTOKEN=" | tail -1 | awk '{print $NF}')
STAKING=$(echo "$DEPLOY_OUTPUT" | grep "STAKING=" | tail -1 | awk '{print $NF}')
PAYMASTER=$(echo "$DEPLOY_OUTPUT" | grep "PAYMASTER=" | grep -v "PAYMASTER_V4" | tail -1 | awk '{print $NF}')
APNTS=$(echo "$DEPLOY_OUTPUT" | grep "APNTS=" | tail -1 | awk '{print $NF}')
MYSBT=$(echo "$DEPLOY_OUTPUT" | grep "MYSBT=" | tail -1 | awk '{print $NF}')
REP_SYSTEM=$(echo "$DEPLOY_OUTPUT" | grep "REP_SYSTEM=" | tail -1 | awk '{print $NF}')
DVT_VALIDATOR=$(echo "$DEPLOY_OUTPUT" | grep "DVT_VALIDATOR=" | tail -1 | awk '{print $NF}')
XPNTS_FACTORY=$(echo "$DEPLOY_OUTPUT" | grep "XPNTS_FACTORY=" | tail -1 | awk '{print $NF}')
PAYMASTER_V4=$(echo "$DEPLOY_OUTPUT" | grep "PAYMASTER_V4=" | tail -1 | awk '{print $NF}')
ENTRYPOINT=$(echo "$DEPLOY_OUTPUT" | grep "ENTRYPOINT=" | tail -1 | awk '{print $NF}')
BLS_AGGREGATOR=$(echo "$DEPLOY_OUTPUT" | grep "BLS_AGGREGATOR=" | tail -1 | awk '{print $NF}')
ALICE_ACCOUNT=$(echo "$DEPLOY_OUTPUT" | grep "ALICE_ACCOUNT=" | tail -1 | awk '{print $NF}')

# 生成 .env.v3
cat > "$SDK_DIR/.env.v3" << EOF
# V3 Local Deployment Addresses (Anvil) - Auto-extracted
RPC_URL=http://127.0.0.1:8545
ADMIN_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Core V3 Contracts
REGISTRY_ADDRESS=$REGISTRY
GTOKEN_ADDRESS=$GTOKEN
GTOKENSTAKING_ADDRESS=$STAKING
SUPER_PAYMASTER=$PAYMASTER
PAYMASTER_FACTORY_ADDRESS=0x0000000000000000000000000000000000000000
APNTS_ADDRESS=$APNTS
MYSBT_ADDRESS=$MYSBT
REP_SYSTEM_ADDRESS=$REP_SYSTEM
ENTRYPOINT_ADDRESS=$ENTRYPOINT

# V4 and Additional Contracts
PAYMASTER_V4_ADDRESS=$PAYMASTER_V4
BLS_AGGREGATOR_ADDRESS=$BLS_AGGREGATOR
DVT_VALIDATOR_ADDRESS=$DVT_VALIDATOR
XPNTS_FACTORY_ADDRESS=$XPNTS_FACTORY
ALICE_ACCOUNT_ADDRESS=$ALICE_ACCOUNT
EOF

echo "✅ .env.v3 generated successfully!"
echo ""
echo "📋 Deployed Contracts:"
echo "  Registry: $REGISTRY"
echo "  GToken: $GTOKEN"
echo "  SuperPaymaster: $PAYMASTER"
echo "  PaymasterV4: $PAYMASTER_V4"
echo "  aPNTs: $APNTS"
echo "  MySBT: $MYSBT"
echo ""
echo "🚀 Ready to run tests!"
