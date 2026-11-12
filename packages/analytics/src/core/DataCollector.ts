/**
 * DataCollector - 链上数据采集与缓存
 * 
 * 功能：
 * - 根据 tx hash 查询链上数据
 * - 解析 Event Logs
 * - 查询相关合约状态
 * - 实现缓存机制避免重复 RPC 调用
 */

import { createPublicClient, http, zeroAddress, type PublicClient, type Hash, type TransactionReceipt, type Chain, type Address, type Abi } from 'viem';
import { sepolia } from 'viem/chains';
import { SuperPaymasterABI, xPNTsTokenABI } from '@aastar/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EventDecoder, type DecodedPaymasterEvent } from '../utils/EventDecoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OnChainData {
  txHash: Hash;
  blockNumber: bigint;
  blockTimestamp: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'reverted';
  
  // Paymaster Events
  paymasterEvents: DecodedPaymasterEvent[];
  
  // 协议相关状态
  aPNTsPriceUSD?: bigint;      // SuperPaymaster 中的 aPNTs 价格
  exchangeRate?: bigint;        // Operator 的汇率
  
  // 原始数据
  receipt: TransactionReceipt;
}

export class DataCollector {
  private client: PublicClient;
  private cacheDir: string;
  private cacheEnabled: boolean;
  private superPaymasterAddress: string;
  /** Cause keys already warned for a failed historical read. One warning per cause, not per tx. */
  private readonly warnedReadCauses = new Set<string>();

  constructor(rpcUrl: string, chain: Chain = sepolia, superPaymasterAddress: string = '0xe74304CC5860B950A45967E12321Dff8B5CdcaA0', cacheDir?: string, enableCache = true, client?: PublicClient) {
    this.client = client ?? createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    
    this.superPaymasterAddress = superPaymasterAddress;
    this.cacheDir = cacheDir || path.resolve(__dirname, '../../../../data/transaction_cache');
    this.cacheEnabled = enableCache;
    
    if (this.cacheEnabled && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // ... (enrichFromChain remains same)

  /**
   * 从链上获取交易数据（带缓存）
   */
  async enrichFromChain(txHash: Hash): Promise<OnChainData | null> {
    // 检查缓存
    if (this.cacheEnabled) {
      const cached = this.loadFromCache(txHash);
      if (cached) {
        return cached;
      }
    }

    try {
      // 获取 Receipt
      const receipt = await this.client.getTransactionReceipt({ hash: txHash });
      
      if (!receipt) {
        console.warn(`⚠️  未找到交易: ${txHash}`);
        return null;
      }

      // 获取区块信息
      const block = await this.client.getBlock({ blockNumber: receipt.blockNumber });

      // 解析 Event Logs
      const paymasterEvents = EventDecoder.decodeAll(receipt.logs);

      // 查询协议状态（如果是 SuperPaymaster 交易）
      let aPNTsPriceUSD: bigint | undefined;
      let exchangeRate: bigint | undefined;

      const superEvent = paymasterEvents.find(e => e.type === 'TransactionSponsored');
      if (superEvent && superEvent.type === 'TransactionSponsored') {
        // Historical cost: pin both reads to the tx block. The SuperPaymaster is the
        // event log's address. Since v5.3.3 exchangeRate lives on operators(operator).xPNTsToken.
        const sponsoredLog = receipt.logs.find((log) => {
          const decoded = EventDecoder.decode(log);
          return decoded?.type === 'TransactionSponsored';
        });
        const spAddress = sponsoredLog?.address;
        if (!spAddress) {
          this.warnReadOnce(
            'transaction-sponsored:missing-log',
            'TransactionSponsored decoded without a log address; leaving aPNTsPriceUSD and exchangeRate undefined',
          );
        } else {
          aPNTsPriceUSD = await this.readAPNTsPriceUSD(spAddress, receipt.blockNumber);
          exchangeRate = await this.readOperatorExchangeRate(
            spAddress,
            superEvent.operator as Address,
            receipt.blockNumber,
          );
        }
      }

      const data: OnChainData = {
        txHash,
        blockNumber: receipt.blockNumber,
        blockTimestamp: block.timestamp,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status,
        paymasterEvents,
        aPNTsPriceUSD,
        exchangeRate,
        receipt,
      };

      // 保存到缓存
      if (this.cacheEnabled) {
        this.saveToCache(txHash, data);
      }

      return data;

    } catch (error) {
      console.error(`❌ 获取链上数据失败 (${txHash}):`, error);
      return null;
    }
  }

  /**
   * aPNTsPriceUSD() at `blockNumber`. Failure leaves the field undefined.
   */
  private async readAPNTsPriceUSD(spAddress: Address, blockNumber: bigint): Promise<bigint | undefined> {
    try {
      return await this.readAtBlock({
        address: spAddress,
        abi: SuperPaymasterABI as Abi,
        functionName: 'aPNTsPriceUSD',
        blockNumber,
      }) as bigint;
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        `aPNTsPriceUSD:${kind}`,
        `aPNTsPriceUSD() on ${spAddress} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return undefined;
    }
  }

  /**
   * operators(operator).xPNTsToken, then that token's exchangeRate(), both at `blockNumber`.
   * A zero token is not a failed read: the rate stays undefined and nothing is logged.
   */
  private async readOperatorExchangeRate(spAddress: Address, operator: Address, blockNumber: bigint): Promise<bigint | undefined> {
    let token: Address | undefined;
    try {
      const operatorData = await this.readAtBlock({
        address: spAddress,
        abi: SuperPaymasterABI as Abi,
        functionName: 'operators',
        args: [operator],
        blockNumber,
      });
      token = xPNTsTokenFromOperator(operatorData);
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        `operators:${kind}`,
        `operators(${operator}) on ${spAddress} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return undefined;
    }

    if (!token || token.toLowerCase() === zeroAddress) {
      return undefined;
    }

    try {
      return await this.readAtBlock({
        address: token,
        abi: xPNTsTokenABI as Abi,
        functionName: 'exchangeRate',
        blockNumber,
      }) as bigint;
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        `exchangeRate:${kind}`,
        `exchangeRate() on ${token} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return undefined;
    }
  }

  private readAtBlock(call: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    blockNumber: bigint;
  }) {
    return this.client.readContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args ?? [],
      blockNumber: call.blockNumber,
    } as Parameters<PublicClient['readContract']>[0]);
  }

  private warnReadOnce(cause: string, detail: string): void {
    if (this.warnedReadCauses.has(cause)) return;
    this.warnedReadCauses.add(cause);
    console.warn(`⚠️  ${cause}: ${detail}`);
  }

  /**
   * 获取 Oracle 更新历史（用于计算分摊成本）
   */
  async getOracleUpdates(fromBlock: bigint, toBlock: bigint): Promise<any[]> {
    const CHUNK_SIZE = 5n; // Alchemy 免费版限制极严
    
    const allLogs: any[] = [];
    
    try {
      for (let current = fromBlock; current < toBlock; current += CHUNK_SIZE) {
        const end = current + CHUNK_SIZE - 1n > toBlock ? toBlock : current + CHUNK_SIZE - 1n;
        
        const logs = await this.client.getLogs({
          address: this.superPaymasterAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'PriceUpdated',
            inputs: [
              { type: 'uint256', name: 'price', indexed: false },
              { type: 'uint256', name: 'updatedAt', indexed: false }
            ]
          },
          fromBlock: current,
          toBlock: end
        });
        
        allLogs.push(...logs);
        
        // 如果抓到了足够的数据就提前停止，避免扫描太多块
        if (allLogs.length >= 20) break;
      }
      
      return allLogs;
    } catch (error) {
      console.error('❌ 获取 Oracle 更新历史失败:', error);
      return allLogs;
    }
  }

  /**
   * 批量获取数据
   */
  async enrichBatch(txHashes: Hash[], concurrency = 5): Promise<OnChainData[]> {
    const results: OnChainData[] = [];
    
    for (let i = 0; i < txHashes.length; i += concurrency) {
      const batch = txHashes.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(hash => this.enrichFromChain(hash))
      );
      
      results.push(...batchResults.filter((r): r is OnChainData => r !== null));
      
      console.log(`📊 进度: ${Math.min(i + concurrency, txHashes.length)}/${txHashes.length}`);
    }

    return results;
  }

  /**
   * 从缓存加载
   */
  private loadFromCache(txHash: Hash): OnChainData | null {
    const cachePath = this.getCachePath(txHash);
    
    if (fs.existsSync(cachePath)) {
      try {
        const content = fs.readFileSync(cachePath, 'utf8');
        const data = JSON.parse(content, (key, value) => {
          // 恢复 BigInt
          if (typeof value === 'string' && /^\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        });
        
        return data as OnChainData;
      } catch (e) {
        console.warn(`⚠️  缓存读取失败: ${txHash}`);
      }
    }
    
    return null;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(txHash: Hash, data: OnChainData): void {
    const cachePath = this.getCachePath(txHash);
    
    try {
      const content = JSON.stringify(data, (key, value) => {
        // 序列化 BigInt
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      }, 2);
      
      fs.writeFileSync(cachePath, content, 'utf8');
    } catch (e) {
      console.warn(`⚠️  缓存保存失败: ${txHash}`);
    }
  }

  /**
   * 获取缓存文件路径
   */
  private getCachePath(txHash: Hash): string {
    return path.join(this.cacheDir, `${txHash}.json`);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
      console.log(`🗑️  已清空缓存: ${files.length} 个文件`);
    }
  }
}

function xPNTsTokenFromOperator(data: unknown): Address | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as { xPNTsToken?: unknown } & { [index: number]: unknown };
  const named = record.xPNTsToken;
  const positional = record[3];
  const token = typeof named === 'string' ? named : positional;
  return typeof token === 'string' ? token as Address : undefined;
}

function readFailureKind(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/pruned|missing trie node|historical state|state is not available|archive/i.test(msg)) {
    return 'pruned-history';
  }
  if (/not found|could not be found|does not exist|unknown selector|function selector/i.test(msg)) {
    return 'missing-getter';
  }
  if (/reverted|revert/i.test(msg)) {
    return 'reverted';
  }
  return 'read-failed';
}

function errorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.length > 200 ? msg.slice(0, 200) : msg;
}
