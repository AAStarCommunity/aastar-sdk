# 論文數據採集指南 (PhD Data Collection Guide)

本文檔為 AAStar 系統論文中的數據採集提供標準化指南。所有實驗數據必須通過 `aastar-sdk` 獲取，以確保真實性與可重複性。

## 1. 實驗設置 (Environmental Setup)

### 網絡環境
- **Local**: 使用 `anvil` 進行基準測試（無網絡延遲）。
- **Testnet**: 使用 `Sepolia` 進行公鏈環境驗證。
- **L2**: 使用 `Optimism` (或 OP Sepolia) 進行低 Gas 性能測試。

### 賬戶準備
確保 `.env.v3` 中配置了以下地址：
- `TEST_SIMPLE_ACCOUNT_A`: 標準 AA 賬戶。
- `TEST_SIMPLE_ACCOUNT_B`: AOA (V4) 實驗賬戶。
- `TEST_SIMPLE_ACCOUNT_C`: SuperPaymaster 實驗賬戶。

---

## 2. 核心指標 (Key Metrics)

實驗腳本會自動採集以下維度：

| 指標 | 英文名稱 | 採集方式 |
| :--- | :--- | :--- |
| **Gas 消耗** | Gas Usage | `receipt.gasUsed` |
| **延遲** | Latency | `Date.now() - start` (毫秒) |
| **交易成本** | Tx Cost | `gasUsed * effectiveGasPrice` |
| **吞吐量** | Throughput | 批量運行時的 `count / total_time` |

---

## 3. 自動化運行 (Automation)

直接使用統一腳本運行：

```bash
# 運行所有配置的網絡（推薦）
./scripts/run_automated_experiment.sh all

# 僅運行本地測試
./scripts/run_automated_experiment.sh local

# 僅運行 Sepolia 測試
./scripts/run_automated_experiment.sh sepolia
```

## 4. 數據導出與處理

數據會自動保存至 `sdk_experiment_data.csv`。

**建議流程**:
1. 每個場景運行 30 次 (`EXPERIMENT_RUNS=30`) 以獲取統計顯著性。
2. 使用 `pandas` 或 `Excel` 計算均值 (Mean) 與標準差 (Std Dev)。
3. 使用 `scripts/collect_industry_baseline.ts` 獲取對比組（EOA, Pimlico）數據。

---

## 5. 常規檢查清單

- [ ] RPC 節點是否連通。
- [ ] 實驗賬戶是否有足夠的 Gas 餘額 (或代幣)。
- [ ] `PRIVATE_KEY_JASON` 是否已在本地導出。
- [ ] 是否已清理舊的 CSV 數據。

---

> [!IMPORTANT]
> **嚴禁**手動修改 CSV 數據。所有偏差應在論文的 "Limitations" 或 "Discussion" 章節中說明。
