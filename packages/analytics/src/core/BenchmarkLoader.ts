/**
 * BenchmarkLoader - 加载行业基准数据
 * 
 * 数据源：
 * - l2fees.info (L2 Gas 费用)
 * - bundlebear.com (Paymaster 市场数据)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface L2Benchmark {
  name: string;
  perUserOp: number; // USD per UserOp
  source: string;
  updatedAt: string;
}

export interface PaymasterBenchmark {
  name: string;
  totalUserOps: number;
  totalGasSpendUSD: number;
  avgCostPerOp: number;
  source: string;
  updatedAt: string;
}

export class BenchmarkLoader {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.resolve(__dirname, '../../../../packages/analytics/data');
  }

  /**
   * 加载 L2 基准数据
   */
  async loadL2Benchmarks(): Promise<L2Benchmark[]> {
    const cacheFile = path.join(this.cacheDir, 'industry_baseline_latest.json');

    // 检查缓存
    if (fs.existsSync(cacheFile)) {
      try {
        const content = fs.readFileSync(cacheFile, 'utf8');
        const data = JSON.parse(content);
        
        if (data.chains && Array.isArray(data.chains)) {
          return data.chains
            .filter((c: any) => c.perUserOp > 0)
            .map((c: any) => ({
              name: c.name,
              perUserOp: c.perUserOp,
              source: 'l2fees.info',
              updatedAt: data.updatedAt || new Date().toISOString(),
            }));
        }
      } catch (e) {
        console.warn('⚠️  缓存数据解析失败');
      }
    }

    // Fallback 数据（基于用户提供的数据）
    console.log('⚠️  使用默认 L2 基准数据');
    return [
      { name: 'OP Mainnet', perUserOp: 0.02, source: 'bundlebear.com', updatedAt: '2026-01-19' },
      { name: 'Arbitrum One', perUserOp: 0.64, source: 'bundlebear.com', updatedAt: '2026-01-19' },
      { name: 'Starknet', perUserOp: 8.5, source: 'estimated', updatedAt: '2026-01-19' },
    ];
  }

  /**
   * 加载标准交易基准（ERC20 Transfer, ETH Transfer）
   */
  async loadStandardBaselines(ethPriceUSD: number): Promise<any> {
    const baselines = [
      { name: 'L1 ETH Transfer', gas: 21000n, gasPriceGwei: 20 },
      { name: 'L1 ERC20 Transfer', gas: 65000n, gasPriceGwei: 20 },
      { name: 'L2 ERC20 Transfer (OP)', gas: 1500n, gasPriceGwei: 0.001 },
    ];

    return baselines.map(b => ({
      ...b,
      costUSD: Number(b.gas * BigInt(b.gasPriceGwei * 1e9)) / 1e18 * ethPriceUSD
    }));
  }

  /**
   * 加载 Paymaster 基准数据
   */
  async loadPaymasterBenchmarks(): Promise<PaymasterBenchmark[]> {
    // 基于用户提供的 bundlebear.com 数据
    return [
      {
        name: 'coinbase',
        totalUserOps: 61837832,
        totalGasSpendUSD: 2243553.08,
        avgCostPerOp: 2243553.08 / 61837832,
        source: 'bundlebear.com',
        updatedAt: '2026-01-19',
      },
      {
        name: 'pimlico',
        totalUserOps: 56165368,
        totalGasSpendUSD: 2051280.65,
        avgCostPerOp: 2051280.65 / 56165368,
        source: 'bundlebear.com',
        updatedAt: '2026-01-19',
      },
      {
        name: 'alchemy',
        totalUserOps: 569875845,
        totalGasSpendUSD: 1676185.56,
        avgCostPerOp: 1676185.56 / 569875845,
        source: 'bundlebear.com',
        updatedAt: '2026-01-19',
      },
      {
        name: 'biconomy',
        totalUserOps: 18949700,
        totalGasSpendUSD: 1184230.93,
        avgCostPerOp: 1184230.93 / 18949700,
        source: 'bundlebear.com',
        updatedAt: '2026-01-19',
      },
      {
        name: 'stackup',
        totalUserOps: 536473,
        totalGasSpendUSD: 815563.05,
        avgCostPerOp: 815563.05 / 536473,
        source: 'bundlebear.com',
        updatedAt: '2026-01-19',
      },
    ];
  }

  /**
   * 保存基准数据到缓存
   */
  async saveBenchmarks(l2: L2Benchmark[], paymasters: PaymasterBenchmark[]): Promise<void> {
    const data = {
      updatedAt: new Date().toISOString(),
      l2Benchmarks: l2,
      paymasterBenchmarks: paymasters,
    };

    const cacheFile = path.join(this.cacheDir, 'benchmarks_cache.json');
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ 基准数据已缓存: ${cacheFile}`);
  }

  /**
   * 获取所有基准数据
   */
  async loadAll(): Promise<{
    l2: L2Benchmark[];
    paymasters: PaymasterBenchmark[];
  }> {
    const l2 = await this.loadL2Benchmarks();
    const paymasters = await this.loadPaymasterBenchmarks();

    return { l2, paymasters };
  }
}
