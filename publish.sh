#!/bin/bash
# publish.sh

# 支持通过第一个参数传入 OTP，例如: ./publish.sh 576329
OTP=$1

# 如果没有传入参数，则交互式询问
if [ -z "$OTP" ]; then
    echo -n "请输入最新的 NPM OTP 验证码: "
    read OTP
fi

# 检查 OTP 是否依然为空
if [ -z "$OTP" ]; then
    echo "错误: 未提供 OTP 验证码，发布取消。"
    exit 1
fi

echo "🚀 开始发布所有包..."
echo "执行命令: pnpm publish -r --no-git-checks --access public --otp $OTP"

# 执行发布命令
pnpm publish -r --no-git-checks --access public --otp "$OTP"

if [ $? -eq 0 ]; then
    echo "✅ 发布完成！"
else
    echo "❌ 发布过程中出现错误。"
    exit 1
fi
