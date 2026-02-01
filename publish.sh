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

echo "🔍 正在验证 SDK 源码完整性..."

# 从 README.md 中提取官方记录的哈希值
DOC_HASH=$(grep -m 1 "Current Code Integrity Hash (v" README.md | grep -oE '[a-f0-9]{64}' | head -n 1)
# 计算当前代码真实的哈希值
REAL_HASH=$(git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum | grep -oE '[a-f0-9]{64}' | head -n 1)

if [ "$DOC_HASH" != "$REAL_HASH" ]; then
    echo "❌ 严重错误: 发布终止！"
    echo "本地源码已被修改，导致哈希值不匹配："
    echo "文档记录: $DOC_HASH"
    echo "当前实际: $REAL_HASH"
    echo "请运行 ./update-version.sh 同步版本和哈希，并 Commit 之后再重试发布。"
    exit 1
fi

echo "✅ 完整性校验通过。"

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
