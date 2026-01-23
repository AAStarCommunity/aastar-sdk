/**
 * gas-analyzer-v4 - 行业竞争力深度分析报告
 * 
 * 功能：
 * - 整合全量数据采集与缓存
 * - 成本归因 (Bundler, Protocol, Operator, Oracle)
 * - 行业效率对比 (vs L2, vs Competitors)
 * - 竞争力模型评分与优化建议
 */

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
  if (!fs.existsSync(configPath)) {
      // Try fallback to SuperPaymaster
      const fallbackPath = path.resolve(process.cwd(), `../../projects/SuperPaymaster/deployments/config.${networkArg}.json`);
      if (fs.existsSync(fallbackPath)) {
          configPath = fallbackPath;
          console.log(`ℹ️  Using config from SuperPaymaster: ${configPath}`);
      } else {
          console.warn(`⚠️  Config file not found for ${networkArg}. using defaults/hardcoded address.`);
      }
  }
  
  let spAddress = '0xe74304CC5860b950a45967e12321Dff8B5CdcaA0'; // Default Sepolia
  if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.superPaymaster) spAddress = config.superPaymaster;
  }
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
  
  console.log(`\n📡 正在处理 ${txHashes.length} 笔交易数据...\n`);
  const onChainData = await collector.enrichBatch(txHashes, 5);
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
  const efficiency = await comparisonAnalyzer.analyzeEfficiency(avg.avgUsdCost);
  const matrix = await comparisonAnalyzer.getComparisonMatrix(avg.avgUsdCost);
  const l2Sim = attributionAnalyzer.simulateL2Cost(breakdowns[0], ethPrice);

  // 5. 生成报告
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('## 1. 核心指标：双层分析模型\n');
  
  console.log('### Layer 1: Intrinsic (学术/纯 Gas 层)');
  console.log(`- **平均 EVM Gas 消耗**: ${avg.avgGasUsed.toFixed(0)} units`);
  console.log(`- **效率指数 (Efficiency)**: **${(avg.avgEfficiency).toFixed(2)}%**`);
  
  console.log('\n### Layer 2: Economic (市场/经济成本层)');
  console.log(`- **L1 实际平均支出**: $${avg.avgUsdCost.toFixed(4)} (ETH @ $${ethPrice.toFixed(2)})`);
  console.log(`- **协议平均单笔收入**: $${avg.avgUsdRevenue.toFixed(4)} (折后净额)`);
  console.log(`- **协议平均单笔利润**: **$${avg.avgUsdProfit.toFixed(4)}** (利润率: ${(avg.avgUsdProfit / avg.avgUsdRevenue * 100).toFixed(1)}%)`);
  console.log(`  > [!NOTE] 利润包含 10% 协议费率及系统溢价收入，已扣除 PostOp 退还给用户的 Buffer。`);
  console.log(`- **综合效率得分**: **${efficiency.efficiencyScore}/100**`);
  
  console.log('\n## 2. 趋势预测与优化建议\n');
  console.log(`- **Gas 价格趋势**: ${trend.gasPriceTrend.toUpperCase()}`);
  console.log(`- **平均 Gas 价格**: ${trend.avgGasPriceGwei.toFixed(2)} Gwei (波动率: ${(trend.volatility*100).toFixed(1)}%)`);
  console.log(`- **最优执行时段**: UTC ${trend.bestHourToExecute}:00`);
  console.log('\n**优化建议**:');
  suggestions.forEach(s => console.log(`- ${s}`));

  console.log('\n## 3. L2 迁移预测 (Optimism Simulation)\n');
  console.log(`如果当前交易在 **Optimism Sepolia** 上运行：`);
  console.log(`- **预计总成本**: $${l2Sim.totalL2Usd.toFixed(4)} (L1 存储费: $${l2Sim.l1DataFeeUSD.toFixed(4)})`);
  console.log(`- **预计节省倍数**: **${l2Sim.savingsRatio.toFixed(1)}x**\n`);

  // 注入 L2 模拟数据并重新排序
  matrix.push({
    name: 'AAStar (Optimism Sim)',
    cost: l2Sim.totalL2Usd,
    type: 'Our Protocol',
    diffPercent: 0 // 占位
  });
  
  matrix.sort((a, b) => a.cost - b.cost);

  console.log('## 4. 竞争力矩阵 (USD/Op)\n');
  console.log('| 方案名称 | 成本/UserOp | 方案类型 |');
  console.log('| :--- | :--- | :--- |');
  matrix.forEach(m => {
    // 高亮我们的方案
    const isOur = m.name.includes('AAStar') ? '**' : '';
    console.log(`| ${isOur}${m.name}${isOur} | $${m.cost.toFixed(4)} | ${m.type} |`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n*报告自动生成于 packages/analytics/src/gas-analyzer-v4.ts*\n');
}

main().catch(console.error);
