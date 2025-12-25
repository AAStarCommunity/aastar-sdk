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

`test:full_sdk` 可以在任意 EVM 网络上运行，只需修改配置文件：

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

#### 步骤3: 运行测试时指定配置

修改 `scripts/99_final_v2_regression.ts` 第26行：

```typescript
// 默认（Anvil本地）
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// 切换到Sepolia
dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });
```

---

### 方法2: 使用环境变量覆盖（推荐）

直接在命令行传递参数：

```bash
# Sepolia测试
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
ADMIN_KEY=0xYourKey \
REGISTRY_ADDRESS=0x... \
pnpm run test:full_sdk
```

---

## 📝 详细命令说明

### 1. **完整协议回归测试** - `test:full_anvil`

```bash
pnpm run test:full_anvil
```

**特点**:
- 🔄 自动重启 Anvil（干净状态）
- 📦 自动部署所有合约
- 🧪 运行 17 个独立测试脚本
- ⚠️ **仅支持 Anvil**（使用 anvil 特殊 RPC 功能）

### 2. **SDK功能验证** - `test:full_sdk`

```bash
pnpm run test:full_sdk
```

**特点**:
- 🌐 **支持任意 EVM 网络**（Anvil/Sepolia/Mainnet）
- 🚀 快速执行（~30秒）
- ✅ 自动检测并初始化测试环境

---

## 📊 测试覆盖率对比

| 测试套件 | 场景数 | 分支覆盖 | 网络支持 | 执行时间 |
|---------|-------|---------|---------|---------|
| `test:full_anvil` | 72 | 95% | Anvil | 5-10分钟 |
| `test:full_sdk` | 6 | SDK核心 | **任意** | ~30秒 |

---

## 🔗 相关资源

- **SDK开发指南**: [`README.md`](../README.md)
- **架构设计**: [`docs/task_breakdown.md`](./task_breakdown.md)

---

**由 AAStarCommunity 维护 | 最后更新: 2025-12-25**
