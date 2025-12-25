# 🚀 AAStar SDK 测试命令完整指南

本文档提供所有测试命令的详细说明，包括如何在不同网络间切换。

---

## 📋 快速参考

### 主要测试命令

| 命令 | 用途 | 网络依赖 | 时间 |
|------|------|---------|------|
| `pnpm run test:full_anvil` | 完整协议回归（72场景） | Anvil专用 | 5-10分钟 |
| `pnpm run test:full_sdk` | SDK功能验证（6场景） | **任意网络** | ~30秒 |
| `pnpm run test:init` | 环境初始化 | Anvil | ~2分钟 |

---

## 🌐 网络切换指南（适用于 `test:full_sdk`）

`test:full_sdk` 可以在任意EVM网络上运行，只需修改配置文件：

### 方法1: 使用不同的 `.env` 文件

#### 步骤1: 创建网络专用配置文件

```bash
# Sepolia测试网配置
cp .env.v3 .env.sepolia

# Mainnet配置
cp .env.v3 .env.mainnet
```

#### 步骤2: 编辑配置文件

**`.env.sepolia` 示例**:
```bash
# 网络RPC
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# 管理员私钥（请从加密存储中读取，不要硬编码！）
ADMIN_KEY=0x...

# Sepolia上的合约地址
REGISTRY_ADDRESS=0x1234...
GTOKEN_ADDRESS=0x5678...
GTOKEN_STAKING_ADDRESS=0x9abc...
SUPER_PAYMASTER_ADDRESS=0xdef0...
APNTS_ADDRESS=0x1111...
MYSBT_ADDRESS=0x2222...
```

**`.env.mainnet` 示例**:
```bash
# Mainnet RPC
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# 管理员私钥
ADMIN_KEY=0x...

# Mainnet合约地址
REGISTRY_ADDRESS=0xMainnetRegistry...
GTOKEN_ADDRESS=0xMainnetGToken...
GTOKEN_STAKING_ADDRESS=0xMainnetStaking...
SUPER_PAYMASTER_ADDRESS=0xMainnetPaymaster...
APNTS_ADDRESS=0xMainnetAPNTs...
MYSBT_ADDRESS=0xMainnetSBT...
```

#### 步骤3: 运行测试时指定配置

修改 `scripts/99_final_v2_regression.ts` 第26行：

```typescript
// 默认（Anvil本地）
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// 切换到Sepolia
dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// 切换到Mainnet
dotenv.config({ path: path.resolve(process.cwd(), '.env.mainnet') });
```

---

### 方法2: 使用环境变量覆盖（推荐）

无需修改代码，直接在命令行传递参数：

```bash
# Sepolia测试
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
ADMIN_KEY=0xYourKey \
REGISTRY_ADDRESS=0x... \
pnpm run test:full_sdk

# Mainnet测试（只读操作）
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
ADMIN_KEY=0xYourKey \
REGISTRY_ADDRESS=0x... \
pnpm run test:full_sdk
```

---

### 方法3: 创建网络专用脚本（最佳实践）

在 `package.json` 中添加：

```json
{
  "scripts": {
    "test:sdk:sepolia": "dotenv -e .env.sepolia -- tsx scripts/99_final_v2_regression.ts",
    "test:sdk:mainnet": "dotenv -e .env.mainnet -- tsx scripts/99_final_v2_regression.ts"
  }
}
```

然后安装 `dotenv-cli`:
```bash
pnpm add -D dotenv-cli
```

使用：
```bash
pnpm run test:sdk:sepolia
pnpm run test:sdk:mainnet
```

---

## 📝 详细命令说明

### 1. **完整协议回归测试** - `test:full_anvil`

```bash
pnpm run test:full_anvil
```

**特点**:
- 🔄 自动重启Anvil（干净状态）
- 📦 自动部署所有合约
- 🔄 自动同步配置和ABI
- 🧪 运行17个独立测试脚本
- ⚠️ **仅支持Anvil**（使用 `anvil_setBalance`, `anvil_impersonateAccount` 等特殊功能）

**覆盖范围**:
- 72个完整场景
- 95%分支覆盖率
- 包含所有协议功能（Admin、Staking、Slashing、Credit、DVT、SBT等）

**适用场景**:
- 本地开发验证
- CI/CD集成测试
- 完整功能回归

---

### 2. **SDK功能验证** - `test:full_sdk`

```bash
pnpm run test:full_sdk
```

**特点**:
- 🌐 **支持任意EVM网络**（Anvil/Sepolia/Mainnet）
- 🚀 快速执行（~30秒）
- 🔍 验证SDK核心架构
- ✅ 自动初始化（检测Anvil，自动运行 `test:init`）

**测试场景** (6个核心):
1. ✅ Operator Staking (质押)
2. ✅ Paymaster Deposit (存款-Push模式)
3. ✅ Community Registration (社区注册)
4. ✅ SBT Minting (SBT铸造)
5. ✅ Admin Slashing (惩罚)
6. ✅ Credit Query (信用查询)

**网络切换**: 参见上方 [🌐 网络切换指南](#🌐-网络切换指南（适用于-test_full_sdk）)

---

### 3. **环境初始化** - `test:init`

```bash
pnpm run test:init
```

**功能**:
- 重启Anvil节点
- 部署所有合约到本地
- 提取ABI到 `packages/core/src/abis/`
- 同步配置到 `.env.v3`

**用途**:
- 手动调试前的环境准备
- 合约更新后重新部署

---

### 4. **专项测试命令**

#### 协议管理测试
```bash
pnpm run test:admin
```
测试角色配置、费用设置、暂停等管理功能。

#### 信用系统测试
```bash
pnpm run test:credit
```
测试信用限额、债务跟踪、自动还款。

#### 重入攻击测试
```bash
pnpm run test:reentrancy
```
测试重入保护机制。

---

## 🔧 常见问题排查

### 问题1: SDK测试失败，提示 "Contract not found"

**原因**: 合约地址在目标网络上不存在

**解决**:
```bash
# 1. 检查.env配置
cat .env.v3

# 2. 验证合约是否部署
cast code $REGISTRY_ADDRESS --rpc-url $RPC_URL

# 3. 如果未部署，需先部署合约（Sepolia/Mainnet）
cd ../SuperPaymaster
forge script script/v3/DeployV3Sepolia.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

### 问题2: RPC速率限制

**解决**: 使用付费RPC节点（Alchemy/Infura）或降低并发：

```typescript
// 在测试脚本中添加延迟
await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
```

### 问题3: Gas不足（Sepolia/Mainnet）

**解决**: 确保测试账户有足够ETH：

```bash
# 查看余额
cast balance $ADMIN_ADDRESS --rpc-url $RPC_URL

# Sepolia水龙头
# https://sepoliafaucet.com/
# https://www.alchemy.com/faucets/ethereum-sepolia
```

---

## 📊 测试覆盖率对比

| 测试套件 | 场景数 | 分支覆盖 | 网络支持 | 执行时间 |
|---------|-------|---------|---------|---------|
| `test:full_anvil` | 72 | 95% | Anvil | 5-10分钟 |
| `test:full_sdk` | 6 | SDK核心 | **任意** | ~30秒 |
| 专项测试 | 1-5/个 | 特定功能 | 视情况 | 10-60秒 |

---

## 🎯 推荐工作流

### 本地开发
```bash
# 1. 启动环境
pnpm run test:init

# 2. 快速SDK验证
pnpm run test:full_sdk

# 3. 完整回归（发版前）
pnpm run test:full_anvil
```

### 测试网验证
```bash
# 1. 配置Sepolia环境
cp .env.v3 .env.sepolia
# 编辑 .env.sepolia，填入Sepolia合约地址

# 2. 运行SDK测试
dotenv -e .env.sepolia -- pnpm run test:full_sdk
```

### 生产环境只读验证
```bash
# 仅查询，不执行交易
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY \
REGISTRY_ADDRESS=0xMainnetAddr \
pnpm run test:full_sdk
```

---

## 🔗 相关资源

- **SDK开发指南**: [`README.md`](../README.md)
- **合约部署**: [`../SuperPaymaster/README.md`](../../SuperPaymaster/README.md)
- **架构设计**: [`docs/task_breakdown.md`](./task_breakdown.md)

---

**由 AAStarCommunity 维护 | 最后更新: 2025-12-24**
