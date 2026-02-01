#!/bin/bash
# dry-run-publish.sh

echo "🔍 正在模拟发布前的源码完整性验证..."

# 从 README.md 中提取官方记录的哈希值
DOC_HASH=$(grep -m 1 "Current Code Integrity Hash (v" README.md | grep -oE '[a-f0-9]{64}' | head -n 1)
# 计算当前代码真实的哈希值
REAL_HASH=$(git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum | grep -oE '[a-f0-9]{64}' | head -n 1)

if [ "$DOC_HASH" != "$REAL_HASH" ]; then
    echo "❌ 模拟验证失败: 哈希值不匹配！"
    echo "文档记录: $DOC_HASH"
    echo "当前实际: $REAL_HASH"
    echo "请运行 ./update-version.sh 同步哈希后再试。"
    exit 1
fi

echo "✅ 完整性校验通过。开始模拟发布..."
pnpm publish -r --dry-run
