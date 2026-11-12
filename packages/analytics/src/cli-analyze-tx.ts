/**
 * CLI 工具 - 单笔交易分析
 * 
 * 用法: npx tsx packages/analytics/src/cli-analyze-tx.ts 0x...
 */

import { readAnalyzeOverrides, TransactionAnalyzer } from './analyzers/TransactionAnalyzer.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 请提供交易哈希');
    console.log('\n用法: npx tsx packages/analytics/src/cli-analyze-tx.ts 0x... [--super-paymaster 0x...] [--allowlist 0x...,0x...]\n');
    process.exit(1);
  }

  const txHash = args[0] as `0x${string}`;
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL_SEPOLIA;

  if (!rpcUrl) {
    throw new Error('缺少 RPC URL，请设置 SEPOLIA_RPC_URL 或 RPC_URL_SEPOLIA');
  }

  const analyzer = new TransactionAnalyzer(rpcUrl, readAnalyzeOverrides(args));
  const report = await analyzer.analyze(txHash);

  console.log('\n' + report);

  // 保存报告
  const reportPath = path.resolve(__dirname, `../../../packages/analytics/reports/full/tx_${txHash.slice(0, 10)}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n📄 报告已保存: ${reportPath}\n`);
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
