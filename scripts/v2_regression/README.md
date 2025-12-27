# V2 Regression Test Suite

本目录包含 SuperPaymaster V3 的完整回归测试套件。

## 测试流程

### 自动化运行（推荐）

```bash
# 运行完整回归测试套件
npm run test:regression

# 或使用 shell 脚本
bash scripts/run_regression.sh
```

### 单步运行

```bash
# Step 00: 环境验证（必须先运行）
npm run test:regression:00

# Step 01: 账号准备与资金分发
npm run test:regression:01

# Step 02: Operator 入驻与质押
npm run test:regression:02
```

## 测试脚本说明

### 00_validate_env.ts ✅
**目的**: 验证 `.env.v3` 中的地址与实际部署的合约地址一致

**验证项**:
- Registry → GTokenStaking
- GTokenStaking → GToken
- Registry → MySBT
- SuperPaymaster → aPNTs
- SuperPaymaster → Registry

**失败处理**: 如果发现地址不匹配，脚本会报错并显示正确的地址，需要手动更新 `.env.v3`

### 01_setup_and_fund.ts ✅
**目的**: 准备测试账号并分发资金

**操作**:
- 为 Admin、Operator、Community、User 账号分发 ETH
- 为 Operator 铸造 GToken 和 aPNTs

### 02_operator_onboarding.ts ✅
**目的**: 验证 Operator 完整入驻流程

**操作**:
1. 检查并注册 `ROLE_COMMUNITY`（前置条件）
2. 注册 `ROLE_PAYMASTER_SUPER`
3. 配置 Operator Billing 设置

**验证点**:
- Registry 前置条件检查（Community → Paymaster）
- SBT 自动 mint 逻辑
- SuperPaymaster 配置

### 03_community_registry.ts ✅
**目的**: 测试社区注册流程

**操作**:
1. 检查 Community 是否已注册 `ROLE_COMMUNITY`
2. 如未注册，则创建社区 roleData 并注册
3. 验证 SBT 是否自动 mint

**验证点**:
- Community 角色注册逻辑
- SBT 自动 mint
- 社区信息存储

### 04_enduser_flow.ts ⚠️
**目的**: 测试最终用户流程

**操作**:
1. 检查并注册 `ROLE_ENDUSER`
2. 验证 SBT 是否 mint
3. 检查用户 reputation

**已知问题**: MySBT revert（调试中）

### 05_admin_audit.ts ✅
**目的**: 验证管理员权限和系统状态

**操作**:
1. 读取所有核心角色的 isActive 状态
2. 显示系统关键配置
3. 审计 Operator 的完整状态

**验证点**:
- Registry 角色激活状态
- SuperPaymaster 配置
- Operator 账单设置

## 环境要求

1. **Anvil 本地节点**: 确保 Anvil 正在运行
   ```bash
   anvil
   ```

2. **合约已部署**: 使用 `DeployV3FullLocal.s.sol` 部署完整堆栈
   ```bash
   cd ../SuperPaymaster/contracts
   forge script script/v3/DeployV3FullLocal.s.sol --broadcast --rpc-url http://127.0.0.1:8545
   ```

3. **环境配置**: 确保 `.env.v3` 包含所有必要的地址
   ```bash
   # 运行环境验证
   npm run test:env
   ```

## 故障排查

### 地址不匹配错误

如果看到 `❌ MISMATCH!` 错误：

1. 运行环境验证查看正确地址：
   ```bash
   npm run test:regression:00
   ```

2. 手动更新 `.env.v3` 中的地址

3. 重新运行回归测试

### "Already member" 错误

如果遇到 SBT 状态不同步：

```bash
# 清理 SBT 状态
npx tsx scripts/cleanup_sbt.ts

# 重新运行回归测试
npm run test:regression
```

## 最佳实践

1. **每次部署后运行环境验证**:
   ```bash
   npm run test:env
   ```

2. **定期清理测试状态**:
   ```bash
   npx tsx scripts/cleanup_sbt.ts
   ```

3. **使用完整回归套件验证变更**:
   ```bash
   npm run test:regression
   ```
