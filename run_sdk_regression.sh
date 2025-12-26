#!/bin/bash
# SDK回归测试启动脚本（自动初始化环境）
# 用途：确保Anvil运行、合约部署、配置同步后再运行SDK测试

set -e

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting SDK Regression Test (with auto-init)...${NC}"

# 1. 检查Anvil是否运行
if ! curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545 > /dev/null 2>&1; then
  
  echo -e "${YELLOW}⚠️  Anvil not running. Initializing environment...${NC}"
  
  # 运行完整初始化
  ./run_full_regression.sh --init-only
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Environment initialization failed.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Environment initialized.${NC}"
else
  echo -e "${GREEN}✅ Anvil is running.${NC}"
  
  # Check if contracts are deployed by testing GToken address
  GTOKEN_CODE=$(curl -s -X POST http://127.0.0.1:8545 \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["'"$(grep GTOKEN_ADDRESS .env.v3 | cut -d= -f2)"'","latest"],"id":1}' \
    | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$GTOKEN_CODE" = "0x" ] || [ -z "$GTOKEN_CODE" ]; then
    echo -e "${YELLOW}⚠️  Contracts not deployed. Running initialization...${NC}"
    pnpm test:init
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Contract initialization failed.${NC}"
      exit 1
    fi
    echo -e "${GREEN}✅ Contracts initialized.${NC}"
  else
    echo -e "${GREEN}✅ Contracts already deployed.${NC}"
  fi
fi

# 2. 运行SDK回归测试
echo -e "${YELLOW}🧪 Running SDK Regression Test...${NC}"
pnpm tsx scripts/99_final_v2_regression.ts

if [ $? -eq 0 ]; then
  echo -e "${GREEN}🎉 SDK Regression Test Passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ SDK Regression Test Failed.${NC}"
  exit 1
fi
