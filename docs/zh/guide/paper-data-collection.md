# 论文数据采集指南 (PhD Data Collection Guide)

本文档为 AAStar 系统论文中的数据采集提供标准化指南。所有实验数据必须通过 `aastar-sdk` 获取，以确保真实性与可重复性。

## 1. 实验设置 (Environmental Setup)

### 网络环境
- **Local**: 使用 `anvil` 进行基准测试（无网络延迟）。
- **Testnet**: 使用 `Sepolia` 进行公链环境验证。
- **L2**: 使用 `Optimism` (或 OP Sepolia) 进行低 Gas 性能测试。

### 账户准备
确保 `.env.v3` 中配置了以下地址：
- `TEST_SIMPLE_ACCOUNT_A`: 标准 AA 账户。
- `TEST_SIMPLE_ACCOUNT_B`: AOA (V4) 实验账户。
- `TEST_SIMPLE_ACCOUNT_C`: SuperPaymaster 实验账户。

---

## 2. 核心指标 (Key Metrics)

实验脚本会自动采集以下维度：

| 指标 | 英文名称 | 采集方式 |
| :--- | :--- | :--- |
| **Gas 消耗** | Gas Usage | `receipt.gasUsed` |
| **延迟** | Latency | `Date.now() - start` (毫秒) |
| **交易成本** | Tx Cost | `gasUsed * effectiveGasPrice` |
| **吞吐量** | Throughput | 批量运行时的 `count / total_time` |

---

## 3. 自动化运行 (Automation)

直接使用统一脚本运行：

```bash
# 运行所有配置的网络（推荐）
./scripts/run_automated_experiment.sh all

# 仅运行本地测试
./scripts/run_automated_experiment.sh local

# 仅运行 Sepolia 测试
./scripts/run_automated_experiment.sh sepolia
```

## 4. 数据导出与处理

数据会自动保存至 `sdk_experiment_data.csv`。

**建议流程**:
1. 每个场景运行 30 次 (`EXPERIMENT_RUNS=30`) 以获取统计显著性。
2. 使用 `pandas` 或 `Excel` 计算均值 (Mean) 与标准差 (Std Dev)。
3. 使用 `scripts/collect_industry_baseline.ts` 获取对比组（EOA, Pimlico）数据。

---

## 5. 常规检查清单

- [ ] RPC 节点是否连通。
- [ ] 实验账户是否有足够的 Gas 余额 (或代币)。
- [ ] `PRIVATE_KEY_JASON` 是否已在本地导出。
- [ ] 是否已清理旧的 CSV 数据。

---

> [!IMPORTANT]
> **严禁**手动修改 CSV 数据。所有偏差应在论文的 "Limitations" 或 "Discussion" 章节中说明。
