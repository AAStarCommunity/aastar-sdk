# Shared-Config 参考指南

## 概述

`lib/shared-config` 是作为**参考和学习资料**添加的git submodule,用于了解AAStar社区的最佳实践和配置组织方式。

**重要**: 这不是一个npm依赖,而是一个学习参考。`@aastar/core`模块应该借鉴其设计,但不直接导入。

---

## Shared-Config 结构分析

### 核心文件

1. **`contract-addresses.ts`** - 合约地址的单一真相来源
   - 按网络组织(Sepolia, Mainnet, Optimism等)
   - 包含所有V3合约地址
   - **借鉴点**: 统一的地址管理模式

2. **`contracts.ts`** - 合约配置和元数据
   - 合约名称、版本、部署信息
   - **借鉴点**: 合约元数据组织方式

3. **`contract-versions.ts`** - 版本管理
   - 链上版本验证
   - **借鉴点**: 版本追踪机制

4. **`communities.ts`** - 社区配置
   - 社区列表和元数据
   - **借鉴点**: 社区数据结构

5. **`networks.ts`** - 网络配置
   - RPC端点、Chain ID等
   - **借鉴点**: 多链配置模式

6. **`constants.ts`** - 常量定义
   - 协议参数、魔数等
   - **借鉴点**: 常量集中管理

7. **`branding.ts`** - 品牌资源
   - Logo、颜色等
   - **借鉴点**: 品牌一致性

8. **`abis/`** - ABI文件
   - 所有合约的ABI
   - **借鉴点**: ABI组织方式

---

## 当前Core模块状态

`@aastar/core` 已经有类似的文件:
- ✅ `contract-addresses.ts` - 已存在
- ✅ `contracts.ts` - 已存在  
- ✅ `contract-versions.ts` - 已存在
- ✅ `communities.ts` - 已存在
- ✅ `abis/` - 已存在

**结论**: Core模块已经借鉴了shared-config的组织方式,无需额外迁移。

---

## 使用建议

### 1. 作为参考资料

当需要了解最新的合约地址、版本或配置时:

```bash
cd lib/shared-config
git pull origin main
# 查看最新配置
cat src/contract-addresses.ts
```

### 2. 同步更新

定期检查shared-config的更新,手动同步到core:

```bash
# 查看shared-config的变更
cd lib/shared-config
git log --oneline -10

# 手动更新core模块相应文件
```

### 3. 学习最佳实践

参考shared-config的:
- 类型定义方式
- 配置组织结构
- 文档注释风格
- 导出模式

---

## 维护指南

### 更新Submodule

```bash
# 更新到最新版本
git submodule update --remote lib/shared-config

# 提交submodule更新
git add lib/shared-config
git commit -m "chore: update shared-config reference"
```

### 不要导入

❌ **错误做法**:
```typescript
import { CONTRACTS } from '../../lib/shared-config/src';
```

✅ **正确做法**:
```typescript
// 在 @aastar/core 中维护自己的配置
export const CONTRACTS = {
  // 借鉴 shared-config 的结构,但独立维护
};
```

---

## 总结

- **Submodule目的**: 参考学习,不是依赖
- **Core模块**: 独立维护,借鉴设计
- **更新策略**: 手动同步,保持独立性
- **最佳实践**: 学习结构,不直接导入
