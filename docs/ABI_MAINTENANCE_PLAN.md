# SDK ABI 维护计划（最终版）

## 实际使用场景

**大多数时候**：更新自己维护的合约，从 `SuperPaymaster/abis/` 同步新 ABI

**偶尔**：AA 标准合约更新时，从 `SuperPaymaster/out/` 提取新版本

## 最终 ABI 配置（23个）

### 从 SuperPaymaster 同步（16个）

#### 核心合约（13个）- 经常更新
来源：`SuperPaymaster/abis/*.json`

- BLSAggregatorV3.json
- BLSValidator.json
- DVTValidatorV3.json
- GToken.json
- GTokenStaking.json
- MySBT.json
- PaymasterFactory.json
- PaymasterV4_2.json
- Registry.json
- ReputationSystemV3.json
- SuperPaymasterV3.json
- xPNTsFactory.json
- xPNTsToken.json

#### AA 标准（3个）- 偶尔更新
来源：`SuperPaymaster/out/*.sol/*.json`（提取 `.abi` 字段）

- EntryPoint.json
- SimpleAccount.json
- SimpleAccountFactory.json

### SDK 自维护（7个）- 基本不变

- SimpleAccountV08.json
- SimpleAccountFactoryV08.json
- Simple7702Account.json
- Eip7702Support.json
- SenderCreator.json
- LegacyAccount.json
- UserOperationLib.json

## 命名策略（统一且无重复）

### 文件命名
- 使用 SuperPaymaster 原始名称（带版本号）
- 例如：`BLSAggregatorV3.json`、`SuperPaymasterV3.json`

### 导出别名
在 `packages/core/src/abis/index.ts` 中提供无版本号别名：

```typescript
// 文件：BLSAggregatorV3.json
export const BLSAggregatorV3ABI = BLSAggregatorV3ABIData;
export const BLSAggregatorABI = BLSAggregatorV3ABIData; // 别名（向后兼容）
```

### 优势
- ✅ 文件系统无重复
- ✅ 代码向后兼容（可用 `BLSAggregatorABI` 或 `BLSAggregatorV3ABI`）
- ✅ 版本清晰可追溯

## 自动同步流程

### 触发时机
每次运行回归测试前自动同步：
```bash
pnpm tsx scripts/phase1_verify_contracts.ts
```

### 同步内容
`scripts/sync_contract_addresses.ts` 自动执行：

**步骤1**：合约地址同步
- `SuperPaymaster/deployments/sepolia.json` → SDK `.env.sepolia`

**步骤2.1**：核心合约 ABI（13个）
- `SuperPaymaster/abis/*.json` → SDK `packages/core/src/abis/`
- **覆盖更新**（大多数时候只有这一步）

**步骤2.2**：AA 标准 ABI（3个）
- `SuperPaymaster/out/EntryPoint.sol/EntryPoint.json` → 提取 `.abi` → SDK
- `SuperPaymaster/out/SimpleAccount.sol/SimpleAccount.json` → 提取 `.abi` → SDK
- `SuperPaymaster/out/SimpleAccountFactory.sol/SimpleAccountFactory.json` → 提取 `.abi` → SDK
- **仅在 AA 合约更新时生效**

**步骤3**：环境配置（可选）
- 提示手动复制 `.env.sepolia`（谨慎操作）

## 典型工作流

### 场景1：更新核心合约（最常见）

1. 在 SuperPaymaster 修改合约（如 Registry.sol）
2. 编译：`forge build`
3. 运行 `extract_abis.sh`（自动更新 `abis/Registry.json`）
4. 切换到 SDK，运行测试：
   ```bash
   pnpm tsx scripts/phase1_verify_contracts.ts
   ```
5. 自动同步最新 ABI ✅

### 场景2：更新 AA 合约（偶尔）

1. SuperPaymaster 更新 AA 合约依赖
2. 编译：`forge build`（更新 `out/` 目录）
3. 切换到 SDK，运行测试：
   ```bash
   pnpm tsx scripts/phase1_verify_contracts.ts
   ```
4. 自动提取最新 AA ABI ✅

### 场景3：添加新合约

1. SuperPaymaster 添加新合约
2. 更新 `extract_abis.sh` 包含新合约
3. 编译并提取 ABI
4. 更新 SDK `sync_contract_addresses.ts`（如需要）
5. 更新 SDK `packages/core/src/abis/index.ts` 添加导出

## 维护检查清单

### 每次合约更新后
- [ ] SuperPaymaster 编译成功
- [ ] `extract_abis.sh` 已运行
- [ ] SDK 测试自动同步 ABI
- [ ] SDK 构建成功（`pnpm build`）

### 定期检查
- [ ] 确认无重复 ABI 文件
- [ ] 确认 `index.ts` 导出完整
- [ ] 确认命名一致性（V3 后缀）

## 文件清单

### 已删除（避免重复）
- ❌ BLSAggregator.json（保留 V3 版本）
- ❌ DVTValidator.json（保留 V3 版本）
- ❌ ReputationSystem.json（保留 V3 版本）
- ❌ SuperPaymaster.json（保留 V3 版本）
- ❌ Paymaster.json（已有 V4）
- ❌ aPNTs.json（xPNTsToken 别名）

### 保留（23个，无重复）
见上文分类

## 总结

**核心原则**：
1. **单一数据源**：SuperPaymaster 是合约地址和 ABI 的唯一来源
2. **自动同步**：每次测试前自动更新，无需手动维护
3. **统一命名**：文件带版本号，导出提供别名
4. **无重复**：一个合约一个 ABI 文件

**日常使用**：
- 更新合约 → 编译 → 运行 SDK 测试 → 自动同步 ✅
- 大多数时候只更新13个核心 ABI
- AA 标准和辅助 ABI 基本不变
