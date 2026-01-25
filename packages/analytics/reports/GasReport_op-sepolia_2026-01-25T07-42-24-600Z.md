# 🏆 AAStar Gasless 深度分析报告 (v4.2)
- **Network**: op-sepolia
- **Generated**: 1/25/2026, 2:42:24 PM
- **Source Data**: 676 latest transactions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Core Metrics Breakdown (按角色分层)


### Overall Performance
- **Sample Size**: 676 transactions
- **Avg Gas Used**: 412933 units
- **L1 Cost (Expense)**: $0.0012
- **Protocol Revenue**: $0.0013 (Based on 10% Markup Model)
- **Net Profit**: **$0.0001** (Margin: 9.1%)
- **Efficiency Index**: **9.02%**

### Paymaster V4 (Basic)
- **Sample Size**: 658 transactions
- **Avg Gas Used**: 419389 units
- **L1 Cost (Expense)**: $0.0012
- **Protocol Revenue**: $0.0013 (Based on 10% Markup Model)
- **Net Profit**: **$0.0001** (Margin: 9.1%)
- **Efficiency Index**: **6.53%**

### SuperPaymaster (Premium)
- **Sample Size**: 18 transactions
- **Avg Gas Used**: 176928 units
- **L1 Cost (Expense)**: $0.0001
- **Protocol Revenue**: $0.0001 (Based on 10% Markup Model)
- **Net Profit**: **$0.0000** (Margin: 9.1%)
- **Efficiency Index**: **100.00%**

## 2. 指标定义与解释 (Definitions)

### Efficiency Index (效率指数)
- **定义**: `Intrinsic Gas / Actual Gas Used`
- **含义**: 衡量 Paymaster 合约逻辑引入的额外开销 (Overhead)。
- **解读**: **越高越好**。100% 代表零开销（如 EOA 交易），数值越低代表合约去中心化逻辑越复杂。

### L1 Actual Cost (L1 实际支出)
- **定义**: `Gas Used * Effective Gas Price * ETH Price`
- **含义**: 协议为这笔交易向以太坊网络支付的真实过路费。

### Protocol Profit (协议利润)
- **公式**: `Revenue - L1 Cost`
- **Revenue 模型**: `L1 Cost * 1.10` (固定 10% 服务费率)
- **计算示例**: 若 L1 成本为 $1.00，则向用户收取 $1.10，利润为 $0.10。
  > [!TIP] 之前的负利润是因为旧日志中 Token 计价偏差导致，现已校准为标准模型。

### Comprehensive Efficiency Score (综合效率得分)
- **定义**: 结合了“相对 L2 成本”和“相对竞品溢价”的加权评分。
- **公式**: `100 - (Vs_L2_Penalty) - (Vs_Competitor_Penalty)`
- **当前得分**: **${efficiency.efficiencyScore}/100**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
