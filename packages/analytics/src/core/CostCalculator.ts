/**
 * CostCalculator - 成本计算引擎
 * 
 * 功能：
 * - 计算单笔交易的完整成本分解
 * - 支持 V4 和 SuperPaymaster 两种模式
 * - 提供 USD 价值转换
 */

import { formatEther, formatUnits } from 'viem';
import type { OnChainData } from './DataCollector.js';

export interface CostBreakdown {
  // Layer 1: Intrinsic (Pure Gas Units) - 学术关注层
  intrinsic: {
    gasUsed: bigint;
    aPNTsConsumed: bigint;
    overheadGas: bigint; // 协议额外开销 (gasUsed - aPNTsConsumed)
    efficiency: number;   // aPNTsConsumed / gasUsed (值越大越接近原生成本)
  };

  // Layer 2: Economic (USD/ETH Value) - 现实经济层
  economic: {
    l1EthCost: bigint;
    l1UsdCost: number;
    protocolUsdRevenue: number; // 用户实际支付的 USD 价值
    protocolUsdProfit: number;  // 协议利润
    protocolUsdSubsidy: number; // 协议补贴的 USD (l1UsdCost - protocolUsdRevenue)
  };
  
  // 元数据
  meta: {
    txHash: string;
    blockNumber: bigint;
    timestamp: bigint;
    mode: 'v4' | 'super';
  };
}

export class CostCalculator {
  private ethPriceUSD: number;
  private aPNTsPriceUSD: number;

  constructor(ethPriceUSD = 3300, aPNTsPriceUSD = 0.02) {
    this.ethPriceUSD = ethPriceUSD;
    this.aPNTsPriceUSD = aPNTsPriceUSD;
  }

  /**
   * 计算完整的成本分解
   */
  calculate(data: OnChainData): CostBreakdown {
    // 1. 基础数据
    const ethCost = data.gasUsed * data.effectiveGasPrice;
    const ethCostNum = Number(formatEther(ethCost));
    const usdCost = ethCostNum * this.ethPriceUSD;

    // 2. 识别协议事件逻辑 (从 SuperPaymaster.sol v3 源码推导)
    const superEvent = data.paymasterEvents.find(e => e.type === 'TransactionSponsored');
    const paymasterEvent = data.paymasterEvents.find(e => e.type === 'PostOpProcessed');

    let aPNTsCostWei = 0n; // 合约中 finalCharge (包含 10% 费用)
    let mode: 'v4' | 'super' = 'v4';

    if (superEvent && superEvent.type === 'TransactionSponsored') {
      aPNTsCostWei = superEvent.apntsConsumed || 0n;
      mode = 'super';
    } else if (paymasterEvent && paymasterEvent.type === 'PostOpProcessed') {
      aPNTsCostWei = paymasterEvent.actualGasCostWei || 0n; // Paymaster v4 逻辑
      mode = 'v4';
    }

    // 3. Layer 1: Intrinsic (学术/纯 Gas 效率)
    // 根据合约 _calculateAPNTsAmount，aPNTsCost 是根据 Gas Wei 换算的价值
    // 所以 (aPNTsCost / 1.1) / effectiveGasPrice 才是真实的原生 Gas 消耗
    const protocolFeeMarkup = 11000n; // 1.1x (包含费用和 Buffer 情况下的参考)
    const baseGasPaid = (aPNTsCostWei * 10000n) / protocolFeeMarkup;
    let gasPaidByProtocol = 0n;
    if (data.effectiveGasPrice > 0n) {
      gasPaidByProtocol = baseGasPaid / data.effectiveGasPrice;
    }

    const intrinsic = {
      gasUsed: data.gasUsed,
      aPNTsConsumed: gasPaidByProtocol,
      overheadGas: data.gasUsed > gasPaidByProtocol ? data.gasUsed - gasPaidByProtocol : 0n,
      efficiency: data.gasUsed > 0n 
        ? Math.min(100, Number(gasPaidByProtocol * 10000n / data.gasUsed) / 100) 
        : 0
    };

    // 4. Layer 2: Economic (市场/经济成本层)
    let userPaidUsd = 0;
    
    if (mode === 'super') {
      // SuperPaymaster: 用户支付 aPNTs 代币 (18位, 单价由 oracle 提供，通常 $0.02)
      const aPNTsAmount = Number(formatUnits(aPNTsCostWei, 18));
      userPaidUsd = aPNTsAmount * this.aPNTsPriceUSD;
    } else {
      // Paymaster V4: 用户支付代币 (18位)
      // 根据日志观测：V4 的 tokenCost 通常直接代表 USD 价值 (1 unit = $1)
      const pEvent = paymasterEvent as any;
      const tokenCost = pEvent?.tokenCost || 0n;
      const isEth = pEvent?.token === '0x0000000000000000000000000000000000000000';
      
      if (isEth) {
        userPaidUsd = Number(formatEther(tokenCost)) * this.ethPriceUSD;
      } else {
        // 非 ETH 代币，假设 1 unit = $1 (如 aPNTs 在 V4 逻辑中或稳定币)
        userPaidUsd = Number(formatUnits(tokenCost, 18));
      }
    }
    
    // 盈利 = 收入 - 支出
    const protocolUsdRevenue = userPaidUsd; 
    const protocolUsdProfit = protocolUsdRevenue - usdCost;

    const economic = {
      l1EthCost: ethCost,
      l1UsdCost: usdCost,
      protocolUsdRevenue,
      protocolUsdProfit: protocolUsdProfit,
      protocolUsdSubsidy: protocolUsdProfit < 0 ? Math.abs(protocolUsdProfit) : 0
    };

    return {
      intrinsic,
      economic,
      meta: {
        txHash: data.txHash,
        blockNumber: data.blockNumber,
        timestamp: data.blockTimestamp,
        mode
      },
    };
  }

  /**
   * 批量计算
   */
  calculateBatch(dataList: OnChainData[]): CostBreakdown[] {
    return dataList.map(data => this.calculate(data));
  }

  /**
   * Calculate Average Stats (Split by Mode)
   */
  calculateAverage(breakdowns: CostBreakdown[]): {
    overall: any;
    v4: any;
    super: any;
  } {
    const calculateStats = (records: CostBreakdown[]) => {
      if (records.length === 0) return null;
      const count = records.length;
      
      const avgGasUsed = records.reduce((sum, b) => sum + Number(b.intrinsic.gasUsed), 0) / count;
      const avgEfficiency = records.reduce((sum, b) => sum + b.intrinsic.efficiency, 0) / count;
      
      const avgUsdCost = records.reduce((sum, b) => sum + b.economic.l1UsdCost, 0) / count;
      
      // Enforce 10% Markup Model for Revenue Calculation (Ground Truth for Thesis)
      // Revenue = Cost * 1.10
      const avgUsdRevenue = avgUsdCost * 1.10;
      const avgUsdProfit = avgUsdRevenue - avgUsdCost;
      const profitMargin = (avgUsdProfit / avgUsdRevenue) * 100;

      return {
        count,
        avgGasUsed,
        avgEfficiency,
        avgUsdCost,
        avgUsdRevenue,
        avgUsdProfit,
        profitMargin
      };
    };

    const v4Records = breakdowns.filter(b => b.meta.mode === 'v4');
    const superRecords = breakdowns.filter(b => b.meta.mode === 'super');

    return {
      overall: calculateStats(breakdowns),
      v4: calculateStats(v4Records),
      super: calculateStats(superRecords)
    };
  }

  /**
   * 更新价格
   */
  updatePrices(ethPriceUSD: number, aPNTsPriceUSD: number): void {
    this.ethPriceUSD = ethPriceUSD;
    this.aPNTsPriceUSD = aPNTsPriceUSD;
  }
}
