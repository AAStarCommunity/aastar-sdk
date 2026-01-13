#!/bin/bash
# 提取第一个参数作为网络名（去掉 --network= 前缀）
NETWORK_ARG="$1"
if [[ "$NETWORK_ARG" == --network=* ]]; then
    NETWORK="${NETWORK_ARG#--network=}"
else
    NETWORK="${NETWORK_ARG:-sepolia}"
fi

# 将 NETWORK 环境变量传递给 TypeScript，并转发所有参数
NETWORK="$NETWORK" pnpm tsx scripts/l4-setup.ts "$@"
