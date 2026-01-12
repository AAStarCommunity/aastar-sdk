# 🚀 AAStar SDK Demo - 快速开始指南

## 📋 前置要求

在运行演示之前，您需要准备以下内容：

### 1. Sepolia 测试网 Supplier 账户

您需要一个在 Sepolia 测试网上有足够余额的账户作为"资金提供者"（Supplier）：

- **ETH 余额**: 至少 0.5 ETH（用于充值测试账户和 Gas 费）
- **GToken 余额**: 至少 200 GToken（用于充值测试账户）

> 💡 **如何获取测试 ETH**:
> - Sepolia Faucet: https://sepoliafaucet.com/
> - Alchemy Faucet: https://sepoliafaucet.com/
> - Infura Faucet: https://www.infura.io/faucet/sepolia

### 2. 环境配置文件

在 `scripts/experiment/stage3/` 目录下创建 `.env.sepolia` 文件：

```env
# RPC 配置
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Supplier 账户（用于充值）
PRIVATE_KEY_SUPPLIER=0x...your_supplier_private_key

# 合约地址（官方测试网部署）
REGISTRY_ADDR=0xf265d21c2cE6B2fA5d6eD1A2d7b032F03516BE19
STAKING_ADDR=0xB8C4Ed4906baF13Cb5fE49B1A985B76BAccEEC06
SUPER_PAYMASTER=0xd6EACcC89522f1d507d226495adD33C5A74b6A45
GTOKEN_ADDR=0xfc5671D606e8dd65EA39FB3f519443B7DAB40570
XPNTS_FACTORY_ADDR=0xbECF67cdf55b04E8090C0170AA2936D07e2b3708
```

> 💡 **合约地址说明**:
> - 以上是 AAStar 官方在 Sepolia 测试网的部署地址
> - 您也可以自己部署合约并使用自己的地址
> - 部署脚本位于 `SuperPaymaster/contracts/script/deployment/`

> ⚠️ **安全提示**: 
> - 不要将 `.env.sepolia` 提交到 Git
> - 仅使用测试网私钥，不要使用主网私钥
> - Supplier 账户仅用于演示，不要存放大量资金

### 3. 依赖安装

```bash
cd scripts/experiment/stage3
pnpm install
```

## 🎯 运行演示

### 启动服务器

```bash
pnpm demo
```

您应该看到：
```
🚀 Demo Server running at http://localhost:3000
📄 Open http://localhost:3000 in your browser
```

### 打开浏览器

访问 `http://localhost:3000`

## 📖 使用流程

### Step 1: Generate Accounts (生成账户)

- **功能**: 生成 3 个测试账户（Alice, Bob, Charlie）
- **输出**: 
  - 账户地址
  - 私钥（可用于后续创建 AA Account）
- **Console 日志**:
  ```
  🎲 Generating accounts...
  ✅ Generated accounts:
     Alice: 0x...
     Private Key: 0x1234...abcd
  ```

### Step 2: Fund Accounts (批量充值)

- **功能**: 使用 Supplier 账户为所有测试账户充值
- **充值内容**:
  - 0.05 ETH（用于 Gas 费）
  - 50 GToken（用于质押和注册）
- **依赖**: 需要 Supplier 账户有足够余额
- **Console 日志**:
  ```
  💰 Funding accounts...
     Using Supplier: 0x...
     Target ETH: 0.05 per account
     Target GToken: 50 per account
  
     📤 Funding ETH...
        [1/3] Funding Alice...
        [2/3] Funding Bob...
        [3/3] Funding Charlie...
  
     🪙 Funding GToken...
        [1/3] Funding Alice with GToken...
        ...
  
     📊 Final Balances:
        Alice: 0.0500 ETH, 50.00 GToken
        Bob: 0.0500 ETH, 50.00 GToken
        Charlie: 0.0500 ETH, 50.00 GToken
  ```

### Step 3: Launch Community (启动社区)

- **功能**: 使用 Alice 账户创建 DAO 和 Token
- **输出**:
  - Community Address
  - Token Address
  - 交易哈希
- **Console 日志**:
  ```
  🏛️ Launching community...
     Admin: Alice (0x...)
     Community Name: DemoDAO
     🚀 Calling launch()...
  ✅ Community launched!
     Community Address: 0x...
     Token Address: 0x...
     Transactions: 3
  ```

### Step 4: Setup Operator (设置运营商)

- **功能**: 使用 Bob 账户注册为 SuperPaymaster 运营商
- **质押**: 50 GToken
- **Console 日志**:
  ```
  ⚙️ Setting up operator...
     Operator: Bob (0x...)
     🔧 Calling onboardOperator()...
  ✅ Operator setup complete!
     Transactions: 2
  ```

### Step 5: Onboard User (用户入驻)

- **功能**: 使用 Charlie 账户加入社区
- **输出**: SBT ID
- **Console 日志**:
  ```
  👤 Onboarding user...
     User: Charlie (0x...)
     Community: 0x...
  ✅ User onboarded!
     SBT ID: 1
  ```

### Step 6: Benchmark Transactions (基准测试)

- **功能**: 对比不同方案的 Gas 消耗
- **对比项**:
  - EOA Transfer (基准)
  - Standard AA (Sponsored)
  - Paymaster V4
  - SuperPaymaster V3
- **输出**: Gas 对比表格

## 🔍 监控和调试

### 查看 Console 日志

所有步骤都会在服务器终端输出详细日志：

```bash
# 启动服务器后，您会看到实时日志
🎲 Generating accounts...
✅ Generated accounts:
   Alice: 0x...
   ...

💰 Funding accounts...
   Using Supplier: 0x...
   [1/3] Funding Alice...
   ...
```

### 查看浏览器日志

在浏览器的右侧面板，您可以看到：
- **Transaction Log**: 实时交易记录
- **Benchmark Results**: Gas 对比表格

## ⚠️ 常见问题

### Q: "Cannot find package 'express'"

**A**: 运行 `pnpm install` 安装依赖

### Q: "Insufficient funds for gas"

**A**: 检查 Supplier 账户余额：
```bash
# 查看 Supplier 余额
cast balance $SUPPLIER_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

### Q: "RoleDataFactory is not defined"

**A**: 已修复，重启服务器即可

### Q: Funding 一直 loading

**A**: 
1. 检查 Console 日志查看进度
2. 确认 Supplier 账户有足够余额
3. 确认 RPC URL 正常工作

### Q: 如何使用生成的账户创建 AA Account?

**A**: 生成的账户私钥可以用于：
```typescript
import { privateKeyToAccount } from 'viem/accounts';

// 使用 Alice 的私钥
const alice = privateKeyToAccount('0x...');

// 部署 SimpleAccount
// ... 使用 alice 作为 owner
```

## 📊 预期结果

完成所有步骤后，您应该看到：

1. **3 个账户**，每个都有 ETH 和 GToken
2. **1 个社区** (DemoDAO) 和对应的 Token
3. **1 个运营商** (Bob) 已注册
4. **1 个用户** (Charlie) 已入驻并获得 SBT
5. **Gas 对比表格**，显示不同方案的开销

## 🎓 下一步

- 查看 [refactored/README.md](./refactored/README.md) 了解如何使用 SDK APIs
- 查看 [demo_server.ts](./demo_server.ts) 了解后端实现
- 修改参数（账户数量、充值金额等）自定义演示

## 📞 获取帮助

如果遇到问题：
1. 检查 Console 日志
2. 确认 `.env.sepolia` 配置正确
3. 确认 Supplier 账户有足够余额
4. 查看浏览器 Network 面板的 API 请求
