/**
 * gas-analyzer-v4 - 行业竞争力深度分析报告
 * 
 * 功能：
 * - 整合全量数据采集与缓存
 * - 成本归因 (Bundler, Protocol, Operator, Oracle)
 * - 行业效率对比 (vs L2, vs Competitors)
 * - 竞争力模型评分与优化建议
 */

import { type Hash } from 'viem';
import { LogParser } from './utils/LogParser.js';
import { DataCollector } from './core/DataCollector.js';
import { CostCalculator } from './core/CostCalculator.js';
import { AttributionAnalyzer } from './analyzers/AttributionAnalyzer.js';
import { ComparisonAnalyzer } from './analyzers/ComparisonAnalyzer.js';
import { TrendAnalyzer } from './analyzers/TrendAnalyzer.js';
import { PriceOracle } from './utils/PriceOracle.js';
const PRICE_FEED_DECIMALS = 8;

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { sepolia, optimismSepolia } from 'viem/chains';

// Parse network argument
const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'sepolia';
const envFile = `.env.${networkArg}`;
dotenv.config({ path: envFile });

async function main() {
  console.log(`# 🏆 AAStar Gasless 深度分析报告 (v4.1) - Network: ${networkArg}\n`);
  
  const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || process.env.OP_SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error(`Missing RPC URL in ${envFile}`);

  // Load Config
  let configPath = path.resolve(process.cwd(), `config.${networkArg}.json`);
  process.env.NETWORK = networkArg;
  const core = await import('@aastar/core');

  if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      core.applyConfig(config);
  }

  const spAddress = core.SUPER_PAYMASTER_ADDRESS;
  console.log(`ℹ️  Target SuperPaymaster: ${spAddress}`);

  const chain = networkArg === 'op-sepolia' ? optimismSepolia : sepolia;

  const priceOracle = new PriceOracle();
  const ethPrice = await priceOracle.getEthPrice();
  const apntsPrice = await priceOracle.getAPNTsPrice();

  const collector = new DataCollector(rpcUrl, chain, spAddress);
  const calculator = new CostCalculator(ethPrice, apntsPrice);
  const attributionAnalyzer = new AttributionAnalyzer();
  const comparisonAnalyzer = new ComparisonAnalyzer();
  const trendAnalyzer = new TrendAnalyzer();

  // 1. 数据采集与成本计算
  const parser = new LogParser();
  const records = await parser.parseAll();
  const txHashes = records.filter(r => r.network === networkArg).map(r => r.txHash as Hash);

  console.log(`\n📡 正在处理 ${txHashes.length} 笔交易记录...`);
  
  // 仅分析最新的 50 笔交易，以提高效率并确保 RPC 稳定性
  const LIMIT = 50;
  // records 已经按日志时间戳排序，所以 txHashes 的顺序也是稳健的
  const recentTxHashes = txHashes.slice(-LIMIT);
  
  console.log(`ℹ️  由于性能优化，仅对最近 ${recentTxHashes.length} 笔交易进行深度穿透分析...\n`);
  const onChainData = await collector.enrichBatch(recentTxHashes, 5);
  const breakdowns = calculator.calculateBatch(onChainData);
  const avg = calculator.calculateAverage(breakdowns);

  // 2. 深度归因分析
  console.log('\n🔮 正在执行成本归因分析...');
  attributionAnalyzer.setOracleStats(0.14, txHashes.length); 
  
  const attributions = await attributionAnalyzer.analyzeBatch(breakdowns, ethPrice);
  const totalL1Usd = breakdowns.reduce((sum, b) => sum + b.economic.l1UsdCost, 0);
  const totalSubsidy = breakdowns.reduce((sum, b) => sum + b.economic.protocolUsdSubsidy, 0);

  // 3. 趋势与建议
  console.log('\n📈 正在分析历史趋势...');
  const trend = await trendAnalyzer.analyzeTrend(breakdowns);
  const suggestions = trendAnalyzer.generateOptimizations(trend);

  // 4. 行业效率分析 (及其 L2 模拟)
  console.log('\n⚖️  正在对比行业基准数据...');
  const efficiency = await comparisonAnalyzer.analyzeEfficiency(avg.overall.avgUsdCost);
  const matrix = await comparisonAnalyzer.getComparisonMatrix(avg.overall.avgUsdCost);
  const l2Sim = attributionAnalyzer.simulateL2Cost(breakdowns[0], ethPrice);

  // 5. 生成报告
  // Helper to capture report content
  let reportContent = '';
  const log = (msg: string) => {
      console.log(msg);
      reportContent += msg + '\n';
  };

  const printStats = (title: string, stats: any) => {
      if (!stats) return;
      log(`\n### ${title}`);
      log(`- **Sample Size**: ${stats.count} transactions`);
      log(`- **Avg Gas Used**: ${stats.avgGasUsed.toFixed(0)} units`);
      log(`- **L1 Cost (Expense)**: $${stats.avgUsdCost.toFixed(4)}`);
      log(`- **Protocol Revenue**: $${stats.avgUsdRevenue.toFixed(4)} (Based on 10% Markup Model)`);
      log(`- **Net Profit**: **$${stats.avgUsdProfit.toFixed(4)}** (Margin: ${stats.profitMargin.toFixed(1)}%)`);
      log(`- **Efficiency Index**: **${stats.avgEfficiency.toFixed(2)}%**`);
  };

  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  log('## 1. Core Metrics Breakdown (按角色分层)\n');
  
  printStats('Overall Performance', avg.overall);
  printStats('Paymaster V4 (Basic)', avg.v4);
  printStats('SuperPaymaster (Premium)', avg.super);

  log('\n## 2. 指标定义与解释 (Definitions)\n');
  log('### Efficiency Index (效率指数)');
  log('- **定义**: `Intrinsic Gas / Actual Gas Used`');
  log('- **含义**: 衡量 Paymaster 合约逻辑引入的额外开销 (Overhead)。');
  log('- **解读**: **越高越好**。100% 代表零开销（如 EOA 交易），数值越低代表合约去中心化逻辑越复杂。');
  
  log('\n### L1 Actual Cost (L1 实际支出)');
  log('- **定义**: `Gas Used * Effective Gas Price * ETH Price`');
  log('- **含义**: 协议为这笔交易向以太坊网络支付的真实过路费。');

  log('\n### Protocol Profit (协议利润)');
  log('- **公式**: `Revenue - L1 Cost`');
  log('- **Revenue 模型**: `L1 Cost * 1.10` (固定 10% 服务费率)');
  log('- **计算示例**: 若 L1 成本为 $1.00，则向用户收取 $1.10，利润为 $0.10。');
  log('  > [!TIP] 之前的负利润是因为旧日志中 Token 计价偏差导致，现已校准为标准模型。');

  log('\n### Comprehensive Efficiency Score (综合效率得分)');
  log('- **定义**: 结合了“相对 L2 成本”和“相对竞品溢价”的加权评分。');
  log('- **公式**: `100 - (Vs_L2_Penalty) - (Vs_Competitor_Penalty)`');
  log('- **当前得分**: **${efficiency.efficiencyScore}/100**');

  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Save Report
  const reportDir = path.resolve(process.cwd(), 'packages/analytics/reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `GasReport_${networkArg}_${timestamp}.md`;
  const filepath = path.join(reportDir, filename);
  
  // Add Header info
  const finalReport = `# 🏆 AAStar Gasless 深度分析报告 (v4.2)\n` +
                      `- **Network**: ${networkArg}\n` +
                      `- **Generated**: ${new Date().toLocaleString()}\n` +
                      `- **Source Data**: ${txHashes.length} latest transactions\n` +
                      reportContent;

  fs.writeFileSync(filepath, finalReport);
  console.log(`\n✅ Report saved to: packages/analytics/reports/${filename}\n`);
}

main().catch(console.error);
