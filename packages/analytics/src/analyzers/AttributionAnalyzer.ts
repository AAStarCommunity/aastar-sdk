/**
 * AttributionAnalyzer - 成本归因分析器
 * 
 * 功能：
 * - 将 L1 成本分解为 Bundler 收益和网络基础费
 * - 计算协议利润（aPNTs 价值 vs 实际 L1 成本）
 * - 计算 Oracle 运营成本分摊
 * - 计算 AAStar 净服务费
 */

import { formatEther } from 'viem';
import type { CostBreakdown } from '../core/CostCalculator.js';

export interface DetailedAttribution {
  bundlerRevenue: number;    // Bundler 收益 (USD) - 估算为 Priority Fee
  networkBaseFee: number;    // 网络基础费 (USD)
  protocolGrossProfit: number; // 协议毛利 (aPNTsUSD - L1USD)
  oracleExpenseAmortized: number; // Oracle 分摊成本 (USD)
  aastarNetServiceFee: number;   // AAStar 净服务费 (USD)
  operatorMargin: number;    // Operator 利润 (xPNTsUSD - aPNTsUSD)
  timestamp: number;
}

export class AttributionAnalyzer {
  private oracleUpdateCostAvgUSD: number = 0.5; // 假设每小时更新一次，平均成本 $0.5
  private txPerUpdateAvg: number = 100; // 假设平均每 100 笔交易分摊一次 Oracle 更新

  constructor(oracleUpdateCostAvgUSD?: number, txPerUpdateAvg?: number) {
    if (oracleUpdateCostAvgUSD) this.oracleUpdateCostAvgUSD = oracleUpdateCostAvgUSD;
    if (txPerUpdateAvg) this.txPerUpdateAvg = txPerUpdateAvg;
  }

  /**
   * 计算归因明细
   */
  async analyze(breakdown: CostBreakdown, ethPriceUSD: number): Promise<DetailedAttribution> {
    const economic = breakdown.economic;
    const l1Usd = economic.l1UsdCost;
    
    // 1. Bundler 收益估算
    // 假设 Bundler 赚取 10% 的 Priority Fee 溢价
    const bundlerRevenue = l1Usd * 0.1; 
    const networkBaseFee = l1Usd - bundlerRevenue;

    // 2. 协议毛利 (USD 层)
    const protocolGrossProfit = economic.protocolUsdRevenue - l1Usd;

    // 3. Oracle 分摊成本
    const oracleExpenseAmortized = this.oracleUpdateCostAvgUSD / this.txPerUpdateAvg;

    // 4. AAStar 净服务费
    const aastarNetServiceFee = protocolGrossProfit - oracleExpenseAmortized;

    // 5. Operator 利润 (xPNTs - aPNTs，此处简化处理)
    const operatorMargin = 0; // 暂不考虑超额加成

    return {
      bundlerRevenue,
      networkBaseFee,
      protocolGrossProfit,
      oracleExpenseAmortized,
      aastarNetServiceFee,
      operatorMargin,
      timestamp: Number(breakdown.meta.timestamp)
    };
  }

  /**
   * 模拟在 L2 (Optimism) 上的成本
   * L2 成本 = L2 Execution Gas + L1 Data Fee (Calldata 压缩后)
   */
  simulateL2Cost(breakdown: CostBreakdown, ethPriceUSD: number): {
    l2ExecutionGas: bigint;
    l1DataFeeUSD: number;
    totalL2Usd: number;
    savingsRatio: number;
  } {
    const intrinsic = breakdown.intrinsic;
    const economic = breakdown.economic;
    
    // 1. L2 执行费 (Execution Gas)
    // Optimism L2 Gas 价格极低，通常 < 0.001 Gwei
    const l2GasPrice = 0.001 * 1e9; 
    const l2ExecutionCostUSD = (Number(intrinsic.gasUsed) * l2GasPrice) / 1e18 * ethPriceUSD;

    // 2. L1 数据费 (L1 Data Fee / Rollup Fee)
    // 这是 L2 最大的成本支柱。计算公式: calldataSize * L1GasPrice * Scalar
    // UserOp 典型大小为 300-500 字节，此处取 350 字节估算
    const estimatedCalldataSize = 350; 
    
    // 从 L1 经济数据中推算 L1 Gas Price (Wei)
    const l1GasPriceWei = Number(economic.l1EthCost / intrinsic.gasUsed);
    
    // 模拟 L1 Data Fee (Optimism 典型 Scalar 为 0.6-1.0)
    const l1DataFeeScalar = 0.68;
    const l1DataFeeUSD = (estimatedCalldataSize * l1GasPriceWei * l1DataFeeScalar) / 1e18 * ethPriceUSD;

    const totalL2Usd = l2ExecutionCostUSD + l1DataFeeUSD;
    
    return {
      l2ExecutionGas: intrinsic.gasUsed,
      l1DataFeeUSD,
      totalL2Usd,
      savingsRatio: economic.l1UsdCost / (totalL2Usd || 0.0001)
    };
  }

  /**
   * 批量分析
   */
  async analyzeBatch(breakdowns: CostBreakdown[], ethPriceUSD: number): Promise<DetailedAttribution[]> {
    return Promise.all(breakdowns.map(b => this.analyze(b, ethPriceUSD)));
  }

  /**
   * 更新 Oracle 统计数据
   */
  setOracleStats(totalOracleCost: number, totalTxs: number): void {
    if (totalTxs > 0) {
      this.oracleUpdateCostAvgUSD = totalOracleCost / (totalOracleCost > 0 ? 1 : 1);
      this.txPerUpdateAvg = totalTxs;
    }
  }
}
