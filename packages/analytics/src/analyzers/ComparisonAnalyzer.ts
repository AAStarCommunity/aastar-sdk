/**
 * ComparisonAnalyzer - 行业对比分析器
 * 
 * 功能：
 * - 对比 AAStar 与 L2 方案的效率
 * - 对比 AAStar 与主流 Paymaster (Pimlico, Alchemy) 的溢价
 * - 计算竞争力得分 (Competitive Score)
 */

import { BenchmarkLoader, L2Benchmark, PaymasterBenchmark } from '../core/BenchmarkLoader.js';

export interface EfficiencyMetrics {
  vsL2Average: number;       // vs L2 平均成本的倍数
  vsPaymasterAverage: number; // vs 主流 Paymaster 的溢价倍数
  efficiencyScore: number;    // 综合效率得分 (0-100)
  recommendation: string;     // 战略指标建议
}

export class ComparisonAnalyzer {
  private loader: BenchmarkLoader;

  constructor(loader?: BenchmarkLoader) {
    this.loader = loader || new BenchmarkLoader();
  }

  /**
   * 分析竞争力
   * @param aastarAvgUSD AAStar 平均每笔 UserOp 的美元成本
   */
  async analyzeEfficiency(aastarAvgUSD: number): Promise<EfficiencyMetrics> {
    const { l2, paymasters } = await this.loader.loadAll();
    
    // 1. 计算 L2 平均水平 (排除极端异常值)
    const validL2 = l2.filter(b => b.perUserOp < 5); // 排除极端昂贵的示例
    const l2Avg = validL2.reduce((sum, b) => sum + b.perUserOp, 0) / validL2.length;
    const vsL2Ratio = aastarAvgUSD / l2Avg;

    // 2. 计算 Paymaster 平均水平
    const pmAvg = paymasters.reduce((sum, b) => sum + b.avgCostPerOp, 0) / paymasters.length;
    const vsPaymasterRatio = aastarAvgUSD / pmAvg;

    // 3. 综合评分 (逻辑：vs L2 越接近 1 分越高，vs Paymaster 越低分越高)
    // 基础分 100。
    // 如果比 L2 贵，扣分。如果比主流 Paymaster 贵，显著扣分。
    let efficiencyScore = 100;
    if (vsL2Ratio > 1.5) efficiencyScore -= 20;
    if (vsL2Ratio > 3) efficiencyScore -= 20;
    if (vsPaymasterRatio > 5) efficiencyScore -= 30;
    if (vsPaymasterRatio > 10) efficiencyScore -= 20;

    // 4. 生成建议
    let recommendation = "";
    if (efficiencyScore >= 80) {
      recommendation = "✅ 极具竞争力。当前成本结构已达到行业最优水平，建议扩大商用。";
    } else if (efficiencyScore >= 50) {
      recommendation = "⚠️  中等效率。与主流方案仍有差距，建议通过 L2 数据压缩或批量处理进行优化。";
    } else {
      recommendation = "❌ 效率较低。当前成本显著高于行业水平，需重点优化 SuperPaymaster 的逻辑开销，并考虑迁移到更廉价的 L1 结算层。";
    }

    return {
      vsL2Average: vsL2Ratio,
      vsPaymasterAverage: vsPaymasterRatio,
      efficiencyScore: Math.max(0, efficiencyScore),
      recommendation
    };
  }

  /**
   * 生成竞争力矩阵数据 (用于 UI/图表)
   */
  async getComparisonMatrix(aastarAvgUSD: number): Promise<any[]> {
    const { l2, paymasters } = await this.loader.loadAll();
    
    const matrix = [
      { name: 'AAStar (Current)', cost: aastarAvgUSD, type: 'Our Protocol', color: '#ff4d4f' }
    ];

    l2.forEach(b => {
      matrix.push({ name: b.name, cost: b.perUserOp, type: 'L2 Platform', color: '#1890ff' });
    });

    paymasters.forEach(b => {
      matrix.push({ name: b.name, cost: b.avgCostPerOp, type: 'Competitor', color: '#52c41a' });
    });

    return matrix.sort((a, b) => a.cost - b.cost);
  }
}
