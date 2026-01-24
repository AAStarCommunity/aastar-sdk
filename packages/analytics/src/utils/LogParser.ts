/**
 * LogParser - 批量解析历史测试日志
 * 
 * 功能：
 * - 遍历 logs/*.log 文件
 * - 提取 transaction hash, userOp hash, test type
 * - 支持 Anvil 和 Sepolia 两种环境
 * - 返回标准化的交易记录
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TransactionRecord {
  txHash: string;           // 交易哈希
  userOpHash?: string;      // UserOperation 哈希
  testType: string;         // 测试类型 (jason1-gasless, anni-gasless, etc.)
  network: 'anvil' | 'sepolia' | 'op-sepolia'; // 网络环境
  timestamp: Date;          // 日志时间戳
  logFile: string;          // 来源日志文件
  success: boolean;         // 是否成功
}

export class LogParser {
  private logsDir: string;

  constructor(logsDir?: string) {
    this.logsDir = logsDir || path.resolve(__dirname, '../../../../logs');
  }

  /**
   * 解析所有日志文件
   */
  async parseAll(): Promise<TransactionRecord[]> {
    const logFiles = this.getLogFiles();
    const records: TransactionRecord[] = [];

    for (const logFile of logFiles) {
      const fileRecords = await this.parseFile(logFile);
      records.push(...fileRecords);
    }

    console.log(`✅ 解析完成：从 ${logFiles.length} 个日志文件中提取 ${records.length} 条交易记录`);
    return records;
  }

  /**
   * 解析单个日志文件
   */
  private async parseFile(filePath: string): Promise<TransactionRecord[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // 从文件名提取网络和时间戳
    let network: 'anvil' | 'sepolia' | 'op-sepolia' = 'sepolia';
    if (fileName.includes('anvil')) network = 'anvil';
    if (fileName.includes('op-sepolia')) network = 'op-sepolia';

    const timestampMatch = fileName.match(/(\d{8}_\d{6})/);
    const timestamp = timestampMatch 
      ? this.parseTimestamp(timestampMatch[1])
      : new Date(fs.statSync(filePath).mtime);

    const records: TransactionRecord[] = [];
    const lines = content.split('\n');

    let currentTest: string | null = null;
    let currentSuccess = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 识别测试类型
      const testMatch = line.match(/📋 Test: (.+)/);
      if (testMatch) {
        currentTest = testMatch[1].trim();
        currentSuccess = false;
        continue;
      }

      // 提取交易哈希
      const txHashMatch = line.match(/(?:Transaction|transaction):\s*(0x[a-fA-F0-9]{64})/);
      if (txHashMatch && currentTest) {
        const txHash = txHashMatch[1];
        
        // 尝试查找关联的 UserOp Hash
        const userOpHash = this.findUserOpHash(lines, i);

        records.push({
          txHash,
          userOpHash,
          testType: currentTest,
          network,
          timestamp,
          logFile: fileName,
          success: true, // 如果记录了 tx，默认认为成功
        });
      }

      // 检测成功标志
      if (line.includes('🎉') || line.includes('SUCCESS') || line.includes('✅')) {
        currentSuccess = true;
      }

      // 提取 UserOp Hash（独立出现的情况）
      const userOpMatch = line.match(/UserOp(?:\s+submitted!?)?\s+Hash:\s*(0x[a-fA-F0-9]{64})/i);
      if (userOpMatch && currentTest) {
        const userOpHash = userOpMatch[1];
        
        // 检查是否已有对应的 tx 记录
        const existing = records.find(r => r.userOpHash === userOpHash);
        if (!existing) {
          // 尝试向后查找对应的 tx hash
          const txHash = this.findTxHash(lines, i);
          
          if (txHash) {
            records.push({
              txHash,
              userOpHash,
              testType: currentTest,
              network,
              timestamp,
              logFile: fileName,
              success: true,
            });
          }
        }
      }
    }

    return records;
  }

  /**
   * 在指定行附近查找 UserOp Hash
   */
  private findUserOpHash(lines: string[], startLine: number): string | undefined {
    const searchRange = 20; // 向前后各搜索20行
    
    for (let i = Math.max(0, startLine - searchRange); i < Math.min(lines.length, startLine + searchRange); i++) {
      const match = lines[i].match(/UserOp(?:\s+submitted!?)?\s+Hash:\s*(0x[a-fA-F0-9]{64})/i);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * 在指定行之后查找 Transaction Hash
   */
  private findTxHash(lines: string[], startLine: number): string | undefined {
    const searchRange = 30; // 向后搜索30行
    
    for (let i = startLine; i < Math.min(lines.length, startLine + searchRange); i++) {
      const match = lines[i].match(/(?:Transaction|transaction):\s*(0x[a-fA-F0-9]{64})/);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * 解析时间戳字符串
   */
  private parseTimestamp(timestampStr: string): Date {
    // 格式: YYYYMMDD_HHMMSS
    const year = parseInt(timestampStr.substring(0, 4));
    const month = parseInt(timestampStr.substring(4, 6)) - 1;
    const day = parseInt(timestampStr.substring(6, 8));
    const hour = parseInt(timestampStr.substring(9, 11));
    const minute = parseInt(timestampStr.substring(11, 13));
    const second = parseInt(timestampStr.substring(13, 15));
    
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * 获取所有日志文件路径
   */
  private getLogFiles(): string[] {
    if (!fs.existsSync(this.logsDir)) {
      throw new Error(`日志目录不存在: ${this.logsDir}`);
    }

    const files = fs.readdirSync(this.logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => path.join(this.logsDir, f))
      .sort(); // 按文件名排序

    return files;
  }

  /**
   * 统计概览
   */
  getStatistics(records: TransactionRecord[]): {
    total: number;
    byNetwork: Record<string, number>;
    byTestType: Record<string, number>;
    successRate: number;
  } {
    const byNetwork: Record<string, number> = {};
    const byTestType: Record<string, number> = {};
    let successCount = 0;

    for (const record of records) {
      byNetwork[record.network] = (byNetwork[record.network] || 0) + 1;
      byTestType[record.testType] = (byTestType[record.testType] || 0) + 1;
      if (record.success) successCount++;
    }

    return {
      total: records.length,
      byNetwork,
      byTestType,
      successRate: records.length > 0 ? successCount / records.length : 0,
    };
  }
}
