/**
 * 测试 LogParser - 验证日志解析功能
 */

import { LogParser } from './utils/LogParser.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🧪 测试 LogParser 模块\n');

  const parser = new LogParser();
  
  try {
    // 解析所有日志
    const records = await parser.parseAll();
    
    // 统计分析
    const stats = parser.getStatistics(records);
    
    console.log('\n📊 解析统计：\n');
    console.log(`总交易数: ${stats.total}`);
    console.log(`成功率: ${(stats.successRate * 100).toFixed(1)}%\n`);
    
    console.log('按网络分布:');
    for (const [network, count] of Object.entries(stats.byNetwork)) {
      console.log(`  ${network}: ${count}`);
    }
    
    console.log('\n按测试类型分布:');
    for (const [type, count] of Object.entries(stats.byTestType)) {
      console.log(`  ${type}: ${count}`);
    }
    
    // 输出前 5 条记录示例
    console.log('\n📝 示例记录 (前 5 条):\n');
    records.slice(0, 5).forEach((record, i) => {
      console.log(`${i + 1}. ${record.testType} (${record.network})`);
      console.log(`   TX: ${record.txHash}`);
      console.log(`   UserOp: ${record.userOpHash || 'N/A'}`);
      console.log(`   时间: ${record.timestamp.toISOString()}`);
      console.log(`   来源: ${record.logFile}\n`);
    });
    
    // 导出 CSV
    const csvPath = path.resolve(__dirname, '../../../packages/analytics/data/parsed_transactions.csv');
    const csv = [
      'txHash,userOpHash,testType,network,timestamp,logFile,success',
      ...records.map(r => 
        `${r.txHash},${r.userOpHash || ''},${r.testType},${r.network},${r.timestamp.toISOString()},${r.logFile},${r.success}`
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csv, 'utf8');
    console.log(`✅ CSV 已导出: ${csvPath}`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

main();
