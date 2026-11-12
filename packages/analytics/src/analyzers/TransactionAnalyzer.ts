/**
 * TransactionAnalyzer - 单笔交易深度分析
 * 
 * 功能：
 * - 生成详细的交易成本报告
 * - 对比行业基准
 * - 支持命令行输入
 */

import { DataCollector } from '../core/DataCollector.js';
import { CostCalculator } from '../core/CostCalculator.js';
import { BenchmarkLoader, type L2Benchmark, type PaymasterBenchmark } from '../core/BenchmarkLoader.js';
import { PriceOracle } from '../utils/PriceOracle.js';
import { sepolia } from 'viem/chains';
import type { Chain, Hash, PublicClient } from 'viem';

export interface TransactionAnalyzerOptions {
  chain?: Chain;
  superPaymasterAddress?: string;
  paymasterAllowlist?: readonly string[];
  /** Injected RPC client. Production CLIs omit this and use `rpcUrl`. */
  client?: PublicClient;
  cacheDir?: string;
  enableCache?: boolean;
  priceOracle?: { getEthPrice(): Promise<number>; getAPNTsPrice(): Promise<number> };
  benchmarkLoader?: { loadAll(): Promise<{ l2: L2Benchmark[]; paymasters: PaymasterBenchmark[] }> };
}

/** Flags shared by the transaction-analysis CLIs. */
export function readAnalyzeOverrides(args: readonly string[]): {
  superPaymasterAddress?: string;
  paymasterAllowlist?: string[];
} {
  const superPaymasterAddress = flagValue(args, '--super-paymaster');
  const allowlist = flagValue(args, '--allowlist');
  return {
    superPaymasterAddress,
    paymasterAllowlist: allowlist?.split(',').map((item) => item.trim()).filter((item) => item.length > 0),
  };
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export class TransactionAnalyzer {
  private collector: DataCollector;
  private calculator: CostCalculator;
  private benchmarkLoader: { loadAll(): Promise<{ l2: L2Benchmark[]; paymasters: PaymasterBenchmark[] }> };
  private priceOracle: { getEthPrice(): Promise<number>; getAPNTsPrice(): Promise<number> };

  constructor(rpcUrl: string, options: TransactionAnalyzerOptions = {}) {
    const chain = options.chain ?? sepolia;
    this.collector = new DataCollector(
      rpcUrl,
      chain,
      options.superPaymasterAddress,
      options.cacheDir,
      options.enableCache ?? true,
      options.client,
      options.paymasterAllowlist,
    );
    this.calculator = new CostCalculator();
    this.benchmarkLoader = options.benchmarkLoader ?? new BenchmarkLoader();
    this.priceOracle = options.priceOracle ?? new PriceOracle();
  }

  /**
   * 分析单笔交易
   */
  async analyze(txHash: Hash): Promise<string> {
    console.log(`\n🔍 分析交易: ${txHash}\n`);

    // 1. 获取 ETH 价格
    const ethPrice = await this.priceOracle.getEthPrice();
    this.calculator.updatePrices(ethPrice, 0.02);

    // 2. 获取链上数据
    console.log('📡 获取链上数据...');
    const onChainData = await this.collector.enrichFromChain(txHash);

    if (!onChainData) {
      return `❌ 未找到交易: ${txHash}`;
    }

    // 3. 成本计算
    const apntsPrice = await this.priceOracle.getAPNTsPrice();
    this.calculator.updatePrices(ethPrice, apntsPrice);
    const cost = this.calculator.calculate(onChainData);

    // 4. 加载基准数据
    const { l2, paymasters } = await this.benchmarkLoader.loadAll();

    // 5. 生成报告
    let report = `# 交易成本详细分析\n\n`;
    report += `**交易哈希**: ${txHash}\n`;
    report += `**区块**: ${cost.meta.blockNumber}\n`;
    report += `**时间**: ${new Date(Number(cost.meta.timestamp) * 1000).toISOString()}\n`;
    report += `**模式**: ${cost.meta.mode === 'super' ? 'SuperPaymaster' : 'Paymaster'}\n\n`;

    // 1. 学术层分析
    report += `## 🧬 Layer 1: Intrinsic (学术/纯 Gas 效率)\n\n`;
    report += `| 项目 | 数值 |\n`;
    report += `| :--- | :--- |\n`;
    report += `| **总 Gas 消耗** | ${cost.intrinsic.gasUsed.toString()} gas |\n`;
    report += `| **核心 UserOp 消耗** | ${cost.intrinsic.aPNTsConsumed.toString()} gas |\n`;
    report += `| **协议附加开销** | ${cost.intrinsic.overheadGas.toString()} gas |\n`;
    report += `| **效率指数** | **${cost.intrinsic.efficiency.toFixed(2)}%** |\n\n`;
    
    // 2. 经济层分析
    report += `## 💵 Layer 2: Economic (市场/经济成本)\n\n`;
    report += `| 项目 | 数值 |\n`;
    report += `| :--- | :--- |\n`;
    report += `| **ETH 实际支出** | ${Number(cost.economic.l1EthCost) / 1e18} ETH |\n`;
    report += `| **USD 实际支出** | $${cost.economic.l1UsdCost.toFixed(4)} |\n`;
    report += `| **协议收入 (Revenue)** | $${cost.economic.protocolUsdRevenue.toFixed(4)} |\n`;
    const profit = cost.economic.protocolUsdProfit;
    if (profit >= 0) {
      report += `| **协议利润 (Profit)** | **$${profit.toFixed(4)}** |\n\n`;
    } else {
      report += `| **协议补贴 (Subsidy)** | **$${Math.abs(profit).toFixed(4)}** |\n\n`;
    }

    // 行业对比
    report += `## 📊 行业对比\n\n`;
    report += `### vs L2 平台\n\n`;
    report += `| 平台 | 成本/Op | vs AAStar |\n`;
    report += `| :--- | :--- | :--- |\n`;
    
    for (const bench of l2.slice(0, 5)) {
      const ratio = bench.perUserOp / cost.economic.l1UsdCost;
      const indicator = ratio < 1 ? '✅ 更便宜' : '❌ 更贵';
      report += `| ${bench.name} | $${bench.perUserOp.toFixed(4)} | ${ratio.toFixed(1)}x (${indicator}) |\n`;
    }

    report += `\n### vs 其他 Paymaster\n\n`;
    report += `| 方案 | 平均成本/Op | vs AAStar |\n`;
    report += `| :--- | :--- | :--- |\n`;
    
    for (const bench of paymasters.slice(0, 5)) {
      const ratio = bench.avgCostPerOp / cost.economic.l1UsdCost;
      const indicator = ratio < 1 ? '✅ 更便宜' : '❌ 更贵';
      report += `| ${bench.name} | $${bench.avgCostPerOp.toFixed(4)} | ${ratio.toFixed(1)}x (${indicator}) |\n`;
    }

    report += `\n---\n*分析基于动态 ETH ($${ethPrice.toFixed(2)}) 与 aPNTs ($${apntsPrice.toFixed(3)}) 价格。报告生成于: ${new Date().toISOString()}*\n`;

    return report;
  }
}
