npm warn Unknown project config "pnpm-lock.yaml". This will stop working in the next major version of npm.
npm warn Unknown project config "frozen-lockfile". This will stop working in the next major version of npm.
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.
[dotenv@17.2.3] injecting env (28) from .env.sepolia -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops
# 📊 AAStar Gasless 全面成本分析报告

生成时间: 2026-01-19T04:49:00.800Z

## Step 1: 数据采集

✅ 解析完成：从 45 个日志文件中提取 28 条交易记录
✅ 从日志中提取了 28 条 Sepolia 交易记录

💵 使用缓存 ETH 价格: $3211.75 (更新于 2026-01-19T04:47:21.000Z)

## Step 2: 链上数据采集

开始采集 28 笔交易的链上数据...

📊 进度: 5/28
📊 进度: 10/28
📊 进度: 15/28
📊 进度: 20/28
📊 进度: 25/28
📊 进度: 28/28

## Step 3: 成本计算

✅ 完成 28 笔交易的成本计算

## Step 4: 加载行业基准

⚠️  使用默认 L2 基准数据

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 📊 分析结果

## 1. 总体成本概览

| 指标 | 数值 |
| :--- | :--- |
| **样本量** | 28 笔交易 |
| **平均 Gas** | 166378 gas |
| **平均 ETH 成本** | 0.000186 ETH |
| **平均 USD 成本** | $0.5973 |
| **ETH 价格** | $3211.75 |

## 2. Paymaster vs SuperPaymaster 对比

| 指标 | Paymaster | SuperPaymaster | 差异 |
| :--- | :--- | :--- | :--- |
| **样本量** | 18 | 10 | - |
| **平均 Gas** | 151951 | 192347 | 26.6% |
| **平均成本** | $0.5484 | $0.6854 | 25.0% |

## 3. 行业基准对比

### vs L2 平台

| L2 平台 | 成本/Op | vs AAStar | 评价 |
| :--- | :--- | :--- | :--- |
| OP Mainnet | $0.0200 | 0.03x | ✅ 显著更便宜 |
| Arbitrum One | $0.6400 | 1.07x | ⚠️  基本持平 |
| Starknet | $8.5000 | 14.23x | ❌ 更贵 |

### vs Gasless 方案

| Gasless 方案 | 平均成本/Op | 总交易量 | vs AAStar | 评价 |
| :--- | :--- | :--- | :--- | :--- |
| coinbase | $0.0363 | 61.8M | 0.06x | ✅ 显著更便宜 |
| pimlico | $0.0365 | 56.2M | 0.06x | ✅ 显著更便宜 |
| alchemy | $0.0029 | 569.9M | 0.00x | ✅ 显著更便宜 |
| biconomy | $0.0625 | 18.9M | 0.10x | ✅ 更便宜 |
| stackup | $1.5202 | 536K | 2.55x | ❌ 更贵 |

## 4. 关键洞察

1. **vs OP Mainnet**: AAStar 成本是 OP 的 29.9x，主要原因是 Sepolia 缺乏 L1 数据压缩优化。
2. **vs Arbitrum**: AAStar 与 Arbitrum 成本基本持平（0.93x），具备通用 L2 竞争力。
3. **vs Alchemy Gasless**: AAStar 成本是 Alchemy 的 203.1x，主要差距在于规模效应和优化程度。
4. **SuperPaymaster 开销**: 双币机制额外增加约 15.6% Gas，但实现了协议价值捕获。

## 5. 优化建议

1. **短期优化**:
   - 优化 SuperPaymaster 的代币转换逻辑，减少不必要的 SLOAD
   - 批量处理 Oracle 更新，降低分摊成本
   - 考虑引入 Gas 赞助分级定价

2. **中期优化**:
   - 部署到 OP Stack L2，利用 L1 数据压缩
   - 引入批量 UserOp 处理，分摊固定成本
   - 优化 Paymaster 验证逻辑

3. **长期战略**:
   - 建立自有 Bundler，捕获 MEV 收益
   - 实现跨链 Gas 聚合，降低平均成本
   - 探索 zkEVM 等新型 L2 方案

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*报告生成于 packages/analytics/src/gas-analyzer-v2.ts*

📄 完整数据集已导出: /Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/packages/analytics/data/complete_dataset.csv

