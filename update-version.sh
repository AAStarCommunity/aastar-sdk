#!/bin/bash
# update-version.sh

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
    read -p "请输入新版本号 (当前版本 0.16.8): " NEW_VERSION
fi

if [ -z "$NEW_VERSION" ]; then
    echo "❌ 错误: 版本号不能为空"
    exit 1
fi

echo "🔄 正在将所有包版本更新为: $NEW_VERSION ..."

# 使用 Node.js 脚本来安全地处理 JSON，避免 sed 在不同系统下的兼容性问题
node -e "
const fs = require('fs');
const path = require('path');

// 查找所有 package.json 文件
const rootPkg = 'package.json';
const packagesDir = 'packages';
let pkgFiles = [rootPkg];

if (fs.existsSync(packagesDir)) {
    const subPackages = fs.readdirSync(packagesDir)
        .map(p => path.join(packagesDir, p, 'package.json'))
        .filter(p => fs.existsSync(p));
    pkgFiles = pkgFiles.concat(subPackages);
}

pkgFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const pkg = JSON.parse(content);
        const oldVersion = pkg.version;
        pkg.version = '$NEW_VERSION';
        fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
        console.log(\"✅ Updated ${file}: ${oldVersion} -> $NEW_VERSION\");
    } catch (e) {
        console.error(\"❌ Failed to update ${file}: ${e.message}\");
    }
});
"

echo "🎉 所有版本号已更新。现在可以运行 ./publish.sh 进行发布了。"