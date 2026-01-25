/**
 * PriceOracle - ETH 价格查询与缓存
 * 
 * 支持：
 * - CoinGecko API (主要)
 * - 本地缓存 (每小时更新)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PriceCache {
  eth_usd: number;
  apnts_usd: number;
  timestamp: number; // Unix timestamp
}

export class PriceOracle {
  private cacheFile: string;
  private cacheDuration: number; // 缓存有效期（秒）

  constructor(cacheFile?: string, cacheDuration = 3600) {
    this.cacheFile = cacheFile || path.resolve(__dirname, '../../../data/eth_price_cache.json');
    this.cacheDuration = cacheDuration;
  }

  /**
   * 获取 ETH 价格（USD）
   */
  async getEthPrice(): Promise<number> {
    // 检查缓存
    const cached = this.loadCache();
    const now = Math.floor(Date.now() / 1000);

    if (cached && (now - cached.timestamp) < this.cacheDuration) {
      console.log(`💵 使用缓存 ETH 价格: $${cached.eth_usd} (更新于 ${new Date(cached.timestamp * 1000).toISOString()})`);
      return cached.eth_usd;
    }

    // 从 CoinGecko 获取
    try {
      const ethPrice = await this.fetchETHFromCoinGecko();
      const currentAPNTs = cached?.apnts_usd || 0.02; // 默认 0.02

      this.saveCache({ 
        eth_usd: ethPrice, 
        apnts_usd: currentAPNTs,
        timestamp: now 
      });
      return ethPrice;
    } catch (error) {
      console.warn('⚠️  无法获取价格，使用默认值');
      return 3300; // 默认值
    }
  }

  /**
   * 获取 aPNTs 价格（USD）
   * 未来可扩展为从 SuperPaymaster 合约查询
   */
  async getAPNTsPrice(): Promise<number> {
    const cached = this.loadCache();
    const now = Math.floor(Date.now() / 1000);

    if (cached && (now - cached.timestamp) < this.cacheDuration) {
      return cached.apnts_usd || 0.02;
    }

    // 默认保持 0.02，但预留更新逻辑
    return 0.02;
  }

  /**
   * 从 CoinGecko API 获取 ETH 价格
   */
  private async fetchETHFromCoinGecko(): Promise<number> {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko API 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.ethereum.usd;
  }

  /**
   * 加载缓存
   */
  private loadCache(): PriceCache | null {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const content = fs.readFileSync(this.cacheFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }

  /**
   * 保存缓存
   */
  private saveCache(cache: PriceCache): void {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️  缓存保存失败:', e);
    }
  }
}
