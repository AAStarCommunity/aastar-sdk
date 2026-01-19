npm warn Unknown project config "pnpm-lock.yaml". This will stop working in the next major version of npm.
npm warn Unknown project config "frozen-lockfile". This will stop working in the next major version of npm.
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.
[dotenv@17.2.3] injecting env (28) from .env.sepolia -- tip: ⚙️  write to custom object with { processEnv: myObject }
# 🏆 AAStar Gasless 深度分析报告 (v4.1)

💵 使用缓存 ETH 价格: $3211.75 (更新于 2026-01-19T04:47:21.000Z)
✅ 解析完成：从 46 个日志文件中提取 30 条交易记录

📡 正在处理 30 笔交易数据...

📊 进度: 5/30
📊 进度: 10/30
📊 进度: 15/30
📊 进度: 20/30
📊 进度: 25/30
📊 进度: 30/30

🔮 正在执行成本归因分析...

📈 正在分析历史趋势...

⚖️  正在对比行业基准数据...
⚠️  使用默认 L2 基准数据
⚠️  使用默认 L2 基准数据

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. 核心指标：双层分析模型

### Layer 1: Intrinsic (学术/纯 Gas 层)
- **平均 EVM Gas 消耗**: 166963 units
- **效率指数 (Efficiency)**: **100.00%**

### Layer 2: Economic (市场/经济成本层)
- **L1 实际平均支出**: $0.5995 (ETH @ $3211.75)
- **协议平均单笔收入**: $0.8433 (折后净额)
- **协议平均单笔利润**: **$0.2438** (利润率: 28.9%)
  > [!NOTE] 利润包含 10% 协议费率及系统溢价收入，已扣除 PostOp 退还给用户的 Buffer。
- **综合效率得分**: **80/100**

## 2. 趋势预测与优化建议

- **Gas 价格趋势**: STABLE
- **平均 Gas 价格**: 1.12 Gwei (波动率: 4.8%)
- **最优执行时段**: UTC 2:00

**优化建议**:
- ⏰ 根据历史调研，UTC 2:00 是该网络成本最低的时段。

## 3. L2 迁移预测 (Optimism Simulation)

如果当前交易在 **Optimism Sepolia** 上运行：
- **预计总成本**: $0.0013 (L1 存储费: $0.0009)
- **预计节省倍数**: **403.7x**

## 4. 竞争力矩阵 (USD/Op)

| 方案名称 | 成本/UserOp | 方案类型 |
| :--- | :--- | :--- |
| **AAStar (Optimism Sim)** | $0.0013 | Our Protocol |
| alchemy | $0.0029 | Competitor |
| OP Mainnet | $0.0200 | L2 Platform |
| coinbase | $0.0363 | Competitor |
| pimlico | $0.0365 | Competitor |
| biconomy | $0.0625 | Competitor |
| **AAStar (Current)** | $0.5995 | Our Protocol |
| Arbitrum One | $0.6400 | L2 Platform |
| stackup | $1.5202 | Competitor |
| Starknet | $8.5000 | L2 Platform |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*报告自动生成于 packages/analytics/src/gas-analyzer-v4.ts*

