/**
 * TrendAnalyzer - 历史趋势与预测分析器
 * 
 * 功能：
 * - 分析历史 Gas 价格波动趋势
 * - 识别高成本高峰期
 * - 提供未来成本预测（基于移动平均）
 */

import { CostBreakdown } from '../core/CostCalculator.js';

export interface TrendMetrics {
  gasPriceTrend: 'rising' | 'falling' | 'stable';
  avgGasPriceGwei: number;
  volatility: number;         // 波动率
  predictedNextGasGwei: number;
  bestHourToExecute: number;  // 建议执行交易的时段 (0-23)
}

export class TrendAnalyzer {
  /**
   * 分析指标移动平均与预测
   */
  async analyzeTrend(breakdowns: CostBreakdown[]): Promise<TrendMetrics> {
    if (breakdowns.length < 2) {
      return {
        gasPriceTrend: 'stable',
        avgGasPriceGwei: 0,
        volatility: 0,
        predictedNextGasGwei: 0,
        bestHourToExecute: 12
      };
    }

    // 1. 提取 Gas 价格（WEI）并转换为 Gwei
    // 注意：CostBreakdown 的 intrinsic 只有 gasUsed，我们需要从经济层拿到实际 effectiveGasPrice
    // 假设经济层包含 l1EthCost / gasUsed 得到的有效价
    const gasPrices = breakdowns.map(b => {
      const priceWei = b.intrinsic.gasUsed > 0n ? b.economic.l1EthCost / b.intrinsic.gasUsed : 0n;
      return Number(priceWei) / 1e9;
    });

    const avg = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;

    // 2. 趋势判断 (简单判断前后两半部分)
    const middle = Math.floor(gasPrices.length / 2);
    const firstHalfAvg = gasPrices.slice(0, middle).reduce((a, b) => a + b, 0) / middle;
    const lastHalfAvg = gasPrices.slice(middle).reduce((a, b) => a + b, 0) / (gasPrices.length - middle);

    let trend: TrendMetrics['gasPriceTrend'] = 'stable';
    if (lastHalfAvg > firstHalfAvg * 1.1) trend = 'rising';
    else if (lastHalfAvg < firstHalfAvg * 0.9) trend = 'falling';

    // 3. 波动率 (标准差 / 平均值)
    const squareDiffs = gasPrices.map(p => Math.pow(p - avg, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / gasPrices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = stdDev / (avg || 1);

    // 4. 时段统计 (找出平均价格最低的小时)
    const hourStats = new Array(24).fill(0).map(() => ({ total: 0, count: 0 }));
    breakdowns.forEach((b, i) => {
      const hour = new Date(Number(b.meta.timestamp) * 1000).getUTCHours();
      hourStats[hour].total += gasPrices[i];
      hourStats[hour].count++;
    });

    let minAvg = Infinity;
    let bestHour = 0;
    hourStats.forEach((stat, hour) => {
      if (stat.count > 0) {
        const hourAvg = stat.total / stat.count;
        if (hourAvg < minAvg) {
          minAvg = hourAvg;
          bestHour = hour;
        }
      }
    });

    return {
      gasPriceTrend: trend,
      avgGasPriceGwei: avg,
      volatility,
      predictedNextGasGwei: lastHalfAvg, // 简单使用最新均值作为下一笔预测
      bestHourToExecute: bestHour
    };
  }

  /**
   * 生成优化方案建议
   */
  generateOptimizations(metrics: TrendMetrics): string[] {
    const suggestions: string[] = [];
    
    if (metrics.gasPriceTrend === 'rising') {
      suggestions.push("⚠️ Gas 价格呈上升趋势，建议合并交易或延迟非紧急操作。");
    }
    
    if (metrics.volatility > 0.5) {
      suggestions.push("🛡️ 市场波动较大，建议设置合理的 maxPriorityFeePerGas 以防止 UserOp 卡死。");
    }

    suggestions.push(`⏰ 根据历史调研，UTC ${metrics.bestHourToExecute}:00 是该网络成本最低的时段。`);
    
    return suggestions;
  }
}
