# SDK ABI 维护计划

## 命名策略（最终版）

**统一无版本号命名**：
- 文件名：`BLSAggregator.json`（无 V3 后缀）
- 版本信息：通过 ABI 的 `version()` 函数获取
- 同步时自动去除版本号后缀

## 最终 ABI 配置（20个）

### 从 SuperPaymaster 同步（16个）

#### 核心合约（13个）
来源：`SuperPaymaster/abis/*.json`（同步时去除版本号）

- BLSAggregator.json ← BLSAggregatorV3.json
- BLSValidator.json
- DVTValidator.json ← DVTValidatorV3.json
- GToken.json
- GTokenStaking.json
- MySBT.json
- PaymasterFactory.json
- PaymasterV4_2.json
- Registry.json
- ReputationSystem.json ← ReputationSystemV3.json
- SuperPaymaster.json ← SuperPaymasterV3.json
- xPNTsFactory.json
- xPNTsToken.json

#### AA 标准（3个）
来源：`SuperPaymaster/out/*.sol/*.json`（提取 `.abi` 字段）

- EntryPoint.json
- SimpleAccount.json
- SimpleAccountFactory.json

### SDK 自维护（4个）

- SimpleAccountV08.json
- SimpleAccountFactoryV08.json
- Simple7702Account.json
- Eip7702Support.json
- SenderCreator.json
- LegacyAccount.json
- UserOperationLib.json

## 自动同步流程

### 触发
每次运行回归测试前自动同步：
```bash
pnpm tsx scripts/phase1_verify_contracts.ts
```

### 同步步骤

**步骤1**：合约地址
- `SuperPaymaster/deployments/sepolia.json` → SDK `.env.sepolia`

**步骤2.1**：核心合约 ABI（13个）
- `SuperPaymaster/abis/*.json` → SDK `packages/core/src/abis/`
- **自动去除版本号**：`BLSAggregatorV3.json` → `BLSAggregator.json`

**步骤2.2**：AA 标准 ABI（3个）
- 从 `SuperPaymaster/out/` 提取纯 ABI 数组

**步骤3**：环境配置（可选）
- 提示手动复制 `.env.sepolia`

## 典型使用场景

### 场景1：更新核心合约（最常见）

```bash
# 在 SuperPaymaster 修改合约
cd SuperPaymaster
forge build
./extract_abis.sh

# 切换到 SDK，运行测试（自动同步）
cd ../aastar-sdk
pnpm tsx scripts/phase1_verify_contracts.ts
```

**自动执行**：
1. 同步合约地址
2. 同步 ABI（自动去除版本号）
3. 验证合约环境

### 场景2：查看合约版本

```typescript
import { SuperPaymasterABI } from '@aastar/core';
import { createPublicClient } from 'viem';

const version = await client.readContract({
  address: superPaymasterAddress,
  abi: SuperPaymasterABI,
  functionName: 'version'
});
// 返回: "SuperPaymaster-3.2.0"
```

## 维护检查清单

### 每次合约更新后
- [ ] SuperPaymaster 编译成功
- [ ] `extract_abis.sh` 已运行
- [ ] SDK 测试自动同步 ABI
- [ ] SDK 构建成功（`pnpm build`）

### 定期检查
- [ ] 确认无重复 ABI 文件
- [ ] 确认 `index.ts` 导出完整
- [ ] 确认命名统一（无版本号后缀）

## 总结

**核心原则**：
1. **单一数据源**：SuperPaymaster 是唯一来源
2. **自动同步**：每次测试前自动更新
3. **统一命名**：文件名无版本号，版本信息在 ABI 内
4. **无重复**：一个合约一个 ABI 文件

**日常使用**：
```bash
# 更新合约 → 编译 → 运行 SDK 测试 → 自动同步 ✅
pnpm tsx scripts/phase1_verify_contracts.ts
```

大多数时候只更新13个核心 ABI，AA 标准和辅助 ABI 基本不变。
