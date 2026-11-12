/**
 * DataCollector - 链上数据采集与缓存
 * 
 * 功能：
 * - 根据 tx hash 查询链上数据
 * - 解析 Event Logs
 * - 查询相关合约状态
 * - 实现缓存机制避免重复 RPC 调用
 *
 * Historical eth_calls are pinned to the receipt's block number only.
 * viem's readContract cannot pin a call to a block hash. This collector
 * targets confirmed history and does not detect a reorg between the receipt
 * fetch and later pricing reads.
 */

import { createPublicClient, http, zeroAddress, type PublicClient, type Hash, type TransactionReceipt, type Chain, type Address, type Abi } from 'viem';
import { sepolia } from 'viem/chains';
import { SuperPaymasterABI, getCanonicalAddresses, xPNTsTokenABI } from '@aastar/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EventDecoder, type DecodedPaymasterEvent } from '../utils/EventDecoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cache entries written before this field existed stored OnChainData at the
 * top level and could freeze a failed historical read. v2 also stores the
 * configured SuperPaymaster and the normalized allowlist; a different trust
 * set, or a v1 entry with no trust context, is a miss. v3 adds
 * `pricedSponsored` so a cached price cannot be paired with an earlier
 * impostor event. Bump when the shape changes.
 */
const CACHE_SCHEMA_VERSION = 3;

/**
 * version() strings whose operators() / aPNTsPriceUSD() match the ABI we decode.
 * operators() outputs are the same 9 named fields from v5.3.3 (git adb444ad;
 * docs/release_plan_v0.19.0-beta.md dropped exchangeRate) through SuperPaymaster.json
 * at 5.4.2 (e257dd6a) and SuperPaymaster-5.5.0.full.json. xPNTsToken is the address
 * field. aPNTsPriceUSD() is `() returns (uint256)` on both shipped ABIs.
 * superPaymasterAbiCompat.test.ts: no function shared by 5.4.2 and 5.5.0 changed outputs.
 * On-chain strings tied to those ABIs in this repo: CHANGELOG SuperPaymaster-5.4.1,
 * docs readback SuperPaymaster-5.4.2, fork e2e SuperPaymaster-5.5.0, and the 5.5.0
 * line's version() SuperPaymaster-5.5.1 (docs/sp550-cutover, same vendored ABI).
 * 5.3.3 / 5.4.0-beta share the tuple but this repo never quotes their version()
 * string, so they stay outside the set.
 */
const SUPPORTED_SP_VERSIONS = new Set([
  'SuperPaymaster-5.4.1',
  'SuperPaymaster-5.4.2',
  'SuperPaymaster-5.5.0',
  'SuperPaymaster-5.5.1',
]);

type HistoricalRead = { value: bigint | undefined; retryable: boolean };

/**
 * Explicit address, or the chain's canonical SuperPaymaster.
 * Throws when the chain has no canonical entry and no address was passed.
 */
export function resolveSuperPaymasterAddress(chain: Chain, explicit?: string): string {
  if (explicit) return explicit;
  const canonical = getCanonicalAddresses(chain.id)?.superPaymaster;
  if (!canonical) {
    throw new Error(`No canonical SuperPaymaster for chain ${chain.id} (${chain.name}). Pass superPaymasterAddress.`);
  }
  return canonical;
}

/**
 * TransactionSponsored log that `aPNTsPriceUSD` and `exchangeRate` were read for.
 * `logIndex` is the index in `receipt.logs`. `paymasterEvents` may still contain
 * earlier logs from other emitters; do not pair those with these prices.
 */
export interface PricedSponsored {
  logIndex: number;
  operator: string;
}

export interface OnChainData {
  txHash: Hash;
  blockNumber: bigint;
  blockTimestamp: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'reverted';
  
  // Paymaster Events. May include logs from emitters that were not priced.
  paymasterEvents: DecodedPaymasterEvent[];
  /** Absent when no trusted TransactionSponsored log was priced. */
  pricedSponsored?: PricedSponsored;
  
  // 协议相关状态
  /**
   * End-of-block snapshot of SuperPaymaster.aPNTsPriceUSD() at `blockNumber`.
   * An eth_call at that block sees state after every transaction in the block,
   * so this can differ from the price the UserOp executed against if a later
   * transaction updated it. Not reconstructed back to execution time.
   */
  aPNTsPriceUSD?: bigint;
  /**
   * End-of-block snapshot of the operator token's exchangeRate() at `blockNumber`.
   * Same caveat as `aPNTsPriceUSD`: a later transaction in the block can change
   * the rate. Not reconstructed back to execution time.
   */
  exchangeRate?: bigint;
  
  // 原始数据
  receipt: TransactionReceipt;
}

export class DataCollector {
  private client: PublicClient;
  private cacheDir: string;
  private cacheEnabled: boolean;
  private superPaymasterAddress: string;
  /**
   * Extra SuperPaymaster addresses whose TransactionSponsored logs may be priced.
   * Copied and normalized at construction. A later edit of the caller's array
   * must not change trust or the cache key while a read is in flight.
   */
  private readonly paymasterAllowlist: readonly string[];
  /** Cause keys already warned for a failed historical read. One warning per cause, not per tx. */
  private readonly warnedReadCauses = new Set<string>();

  constructor(rpcUrl: string, chain: Chain = sepolia, superPaymasterAddress?: string, cacheDir?: string, enableCache = true, client?: PublicClient, paymasterAllowlist?: readonly string[]) {
    this.client = client ?? createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    
    this.superPaymasterAddress = resolveSuperPaymasterAddress(chain, superPaymasterAddress);
    this.paymasterAllowlist = normalizeAllowlist(paymasterAllowlist);
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
      const paymasterEvents = decodePaymasterEvents(receipt.logs);

      // 查询协议状态（如果是 SuperPaymaster 交易）
      let aPNTsPriceUSD: bigint | undefined;
      let exchangeRate: bigint | undefined;
      let pricedSponsored: PricedSponsored | undefined;

      const superEvent = paymasterEvents.find(e => e.type === 'TransactionSponsored');
      // End-of-block snapshot, not execution-time state. eth_call at
      // receipt.blockNumber includes later transactions in the same block,
      // so these fields can differ from the values the UserOp saw. Do not
      // reconstruct tx-time pricing.
      let retryableRead = false;
      if (superEvent && superEvent.type === 'TransactionSponsored') {
        // Any contract can emit this event shape. Price only a log whose
        // address is the configured SuperPaymaster or the constructor allowlist.
        const trusted = this.findTrustedSponsoredLog(receipt.logs);
        if (!trusted) {
          // Trust is local config, not chain state. Don't cache the skip, or a
          // later allowlist could not price this same receipt.
          this.warnReadOnce(
            'transaction-sponsored:untrusted-address',
            `TransactionSponsored log is not ${this.superPaymasterAddress} or the constructor allowlist; leaving aPNTsPriceUSD and exchangeRate undefined`,
          );
          retryableRead = true;
        } else {
          pricedSponsored = { logIndex: trusted.logIndex, operator: trusted.operator };
          const pricing = await this.readSponsoredPricing(
            trusted.address,
            trusted.operator,
            receipt.blockNumber,
          );
          aPNTsPriceUSD = pricing.aPNTsPriceUSD;
          exchangeRate = pricing.exchangeRate;
          retryableRead = pricing.retryable;
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
        pricedSponsored,
        aPNTsPriceUSD,
        exchangeRate,
        receipt,
      };

      // A retryable RPC / pruned-history miss must not freeze undefined fields.
      if (this.cacheEnabled && !retryableRead) {
        this.saveToCache(txHash, data);
      }

      return data;

    } catch (error) {
      console.error(`❌ 获取链上数据失败 (${txHash}):`, error);
      return null;
    }
  }

  /**
   * First TransactionSponsored log emitted by the configured SuperPaymaster or the allowlist.
   * Comparison is case-insensitive. A leading impostor log is ignored.
   */
  private findTrustedSponsoredLog(logs: TransactionReceipt['logs']): { address: Address; operator: Address; logIndex: number } | undefined {
    for (const log of logs) {
      if (!this.isTrustedPaymaster(log.address)) continue;
      const decoded = EventDecoder.decode(log);
      if (decoded?.type !== 'TransactionSponsored') continue;
      return { address: log.address, operator: decoded.operator as Address, logIndex: receiptLogIndex(log) };
    }
    return undefined;
  }

  /** Configured SuperPaymaster, or an address passed in the constructor allowlist. */
  private isTrustedPaymaster(address: string | undefined): boolean {
    if (!address) return false;
    const candidate = address.toLowerCase();
    if (candidate === this.superPaymasterAddress.toLowerCase()) return true;
    return this.paymasterAllowlist.some((allowed) => allowed.toLowerCase() === candidate);
  }

  /**
   * version() at `blockNumber`, then aPNTsPriceUSD() and operators().xPNTsToken.exchangeRate()
   * only when that string is in SUPPORTED_SP_VERSIONS.
   */
  private async readSponsoredPricing(spAddress: Address, operator: Address, blockNumber: bigint): Promise<{
    aPNTsPriceUSD?: bigint;
    exchangeRate?: bigint;
    retryable: boolean;
  }> {
    let version: string;
    try {
      version = await this.readAtBlock({
        address: spAddress,
        abi: SuperPaymasterABI as Abi,
        functionName: 'version',
        blockNumber,
      }) as string;
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        'exchangeRate:unsupported-version:unreadable',
        `version() on ${spAddress} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return { retryable: isRetryableKind(kind) };
    }

    if (!SUPPORTED_SP_VERSIONS.has(version)) {
      this.warnReadOnce(
        `exchangeRate:unsupported-version:${version}`,
        `SuperPaymaster ${spAddress} version ${JSON.stringify(version)} is not in the verified operators() set; leaving aPNTsPriceUSD and exchangeRate undefined`,
      );
      return { retryable: false };
    }

    const price = await this.readAPNTsPriceUSD(spAddress, blockNumber);
    const rate = await this.readOperatorExchangeRate(spAddress, operator, blockNumber);
    return {
      aPNTsPriceUSD: price.value,
      exchangeRate: rate.value,
      retryable: price.retryable || rate.retryable,
    };
  }

  /**
   * aPNTsPriceUSD() at `blockNumber`. Failure leaves the field undefined.
   */
  private async readAPNTsPriceUSD(spAddress: Address, blockNumber: bigint): Promise<HistoricalRead> {
    try {
      const value = await this.readAtBlock({
        address: spAddress,
        abi: SuperPaymasterABI as Abi,
        functionName: 'aPNTsPriceUSD',
        blockNumber,
      }) as bigint;
      return { value, retryable: false };
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        `aPNTsPriceUSD:${kind}`,
        `aPNTsPriceUSD() on ${spAddress} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return { value: undefined, retryable: isRetryableKind(kind) };
    }
  }

  /**
   * operators(operator).xPNTsToken (named output), then that token's exchangeRate(), both at `blockNumber`.
   * A zero token is permanent: the rate stays undefined and nothing is logged.
   */
  private async readOperatorExchangeRate(spAddress: Address, operator: Address, blockNumber: bigint): Promise<HistoricalRead> {
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
      return { value: undefined, retryable: isRetryableKind(kind) };
    }

    if (token === undefined) {
      this.warnReadOnce(
        'operators:missing-token-field',
        `operators(${operator}) on ${spAddress} decoded without xPNTsToken; leaving exchangeRate undefined`,
      );
      return { value: undefined, retryable: false };
    }

    if (token.toLowerCase() === zeroAddress) {
      return { value: undefined, retryable: false };
    }

    try {
      const value = await this.readAtBlock({
        address: token,
        abi: xPNTsTokenABI as Abi,
        functionName: 'exchangeRate',
        blockNumber,
      }) as bigint;
      return { value, retryable: false };
    } catch (error) {
      const kind = readFailureKind(error);
      this.warnReadOnce(
        `exchangeRate:${kind}`,
        `exchangeRate() on ${token} at block ${blockNumber} failed (${kind}): ${errorMessage(error)}`,
      );
      return { value: undefined, retryable: isRetryableKind(kind) };
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
        const parsed = JSON.parse(content, (key, value) => {
          // 恢复 BigInt
          if (typeof value === 'string' && /^\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        });

        if (parsed?.schemaVersion !== CACHE_SCHEMA_VERSION || !parsed?.data || !this.cacheTrustMatches(parsed.trust)) {
          return null;
        }

        return parsed.data as OnChainData;
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
      const content = JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, trust: this.cacheTrust(), data }, (key, value) => {
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
   * Identity of the emitters this collector will price. The allowlist was
   * normalized when the collector was constructed.
   */
  private cacheTrust(): { superPaymaster: string; allowlist: string[] } {
    return {
      superPaymaster: this.superPaymasterAddress.toLowerCase(),
      allowlist: [...this.paymasterAllowlist],
    };
  }

  private cacheTrustMatches(stored: unknown): boolean {
    if (!stored || typeof stored !== 'object') return false;
    const current = this.cacheTrust();
    const trust = stored as { superPaymaster?: unknown; allowlist?: unknown };
    if (trust.superPaymaster !== current.superPaymaster) return false;
    if (!Array.isArray(trust.allowlist) || trust.allowlist.length !== current.allowlist.length) return false;
    return trust.allowlist.every((item, index) => item === current.allowlist[index]);
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

function decodePaymasterEvents(logs: TransactionReceipt['logs']): DecodedPaymasterEvent[] {
  const events: DecodedPaymasterEvent[] = [];
  for (const log of logs) {
    const decoded = EventDecoder.decode(log);
    if (!decoded) continue;
    if (decoded.type === 'TransactionSponsored') {
      events.push({ ...decoded, logIndex: receiptLogIndex(log) });
    } else {
      events.push(decoded);
    }
  }
  return events;
}

function receiptLogIndex(log: { logIndex?: number | bigint | string | null }): number {
  const index = log.logIndex;
  if (typeof index === 'number' && Number.isInteger(index)) return index;
  if (typeof index === 'bigint') return Number(index);
  if (typeof index === 'string' && index !== '') return Number(index);
  return -1;
}

/** Lowercase, dedupe, and sort. The result is a new array the caller cannot mutate. */
function normalizeAllowlist(allowlist: readonly string[] | undefined): string[] {
  return [...new Set((allowlist ?? []).map((item) => item.toLowerCase()))].sort();
}

function xPNTsTokenFromOperator(data: unknown): Address | undefined {
  // Prefer a named field when the decoder attached one. viem 2.43's
  // decodeFunctionResult returns a positional array for multi-output functions,
  // so the name is resolved on the ABI and then applied to that slot.
  if (data && typeof data === 'object' && 'xPNTsToken' in data) {
    const named = (data as { xPNTsToken?: unknown }).xPNTsToken;
    if (typeof named === 'string') return named as Address;
  }
  const index = operatorOutputIndex('xPNTsToken');
  if (index < 0 || !Array.isArray(data)) return undefined;
  const token = data[index];
  return typeof token === 'string' ? token as Address : undefined;
}

function operatorOutputIndex(name: string): number {
  const fn = (SuperPaymasterABI as readonly { type?: string; name?: string; outputs?: { name?: string }[] }[])
    .find((item) => item.type === 'function' && item.name === 'operators');
  return fn?.outputs?.findIndex((output) => output.name === name) ?? -1;
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown };
    for (const piece of [record.shortMessage, record.details, record.message]) {
      if (typeof piece === 'string' && piece) parts.push(piece);
    }
    current = record.cause;
  }
  return parts.length > 0 ? parts.join(' ') : String(error);
}

function readFailureKind(error: unknown): string {
  const msg = errorText(error);
  // Checked first: "header/block/state not found" must not match the getter rule.
  if (isBlockStateOrHeaderMiss(msg)) return 'block-state-header';
  if (isExplicitMissingGetter(msg)) return 'missing-getter';
  if (/reverted|revert/i.test(msg)) return 'reverted';
  return 'read-failed';
}

function isBlockStateOrHeaderMiss(msg: string): boolean {
  return /pruned|missing trie node|historical state|archive node/i.test(msg)
    || /\b(header|block|state)\b.{0,40}\b(not found|unavailable|missing|unknown|not available)\b/i.test(msg)
    || /\b(not found|unavailable|missing|unknown|not available)\b.{0,40}\b(header|block|state)\b/i.test(msg);
}

function isExplicitMissingGetter(msg: string): boolean {
  return /function\b[^.\n]{0,120}\b(does not exist|not found|could not be found)|unknown selector|function selector|selector not found|AbiFunctionNotFound/i.test(msg);
}

/** Only a confirmed missing getter or unknown selector is permanent. */
function isRetryableKind(kind: string): boolean {
  return kind !== 'missing-getter';
}

function errorMessage(error: unknown): string {
  const msg = errorText(error);
  return msg.length > 200 ? msg.slice(0, 200) : msg;
}
