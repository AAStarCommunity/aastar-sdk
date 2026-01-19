#!/bin/bash
# update-version.sh

NEW_VERSION=$1

# 如果没有提供参数，提示输入
if [ -z "$NEW_VERSION" ]; then
    # 读取当前版本作为参考
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    echo "当前版本: $CURRENT_VERSION"
    read -p "请输入新版本号: " NEW_VERSION
fi

if [ -z "$NEW_VERSION" ]; then
    echo "❌ 错误: 版本号不能为空"
    exit 1
fi

# 调用 Node.js 脚本处理实际逻辑
node scripts/update_versions.js "$NEW_VERSION"
