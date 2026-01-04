/**
 * Smart Contract ABIs (Unified Naming)
 * 
 * 命名策略：
 * - 文件名：使用 SuperPaymaster 原始名称（带版本号，如 BLSAggregatorV3.json）
 * - 导出别名：提供无版本号别名（向后兼容）
 * - 避免文件重复：只保留一个文件，通过导出别名支持多种引用方式
 */

// Core System (V3 版本)
import RegistryABIData from './Registry.json' with { type: 'json' };
import GTokenABIData from './GToken.json' with { type: 'json' };
import GTokenStakingABIData from './GTokenStaking.json' with { type: 'json' };
import SuperPaymasterV3ABIData from './SuperPaymasterV3.json' with { type: 'json' };
import PaymasterFactoryABIData from './PaymasterFactory.json' with { type: 'json' };
import PaymasterV4_2ABIData from './PaymasterV4_2.json' with { type: 'json' };

// AA Standard (从 out/ 提取)
import EntryPointABIData from './EntryPoint.json' with { type: 'json' };
import SimpleAccountABIData from './SimpleAccount.json' with { type: 'json' };
import SimpleAccountFactoryABIData from './SimpleAccountFactory.json' with { type: 'json' };

// Token System
import xPNTsTokenABIData from './xPNTsToken.json' with { type: 'json' };
import xPNTsFactoryABIData from './xPNTsFactory.json' with { type: 'json' };
import MySBTABIData from './MySBT.json' with { type: 'json' };

// Identity & Reputation (V3 版本)
import ReputationSystemV3ABIData from './ReputationSystemV3.json' with { type: 'json' };

// Monitoring System (V3 版本)
import DVTValidatorV3ABIData from './DVTValidatorV3.json' with { type: 'json' };
import BLSAggregatorV3ABIData from './BLSAggregatorV3.json' with { type: 'json' };
import BLSValidatorABIData from './BLSValidator.json' with { type: 'json' };

// ========== Re-export ABIs - Core System ==========
export const RegistryABI = RegistryABIData;
export const GTokenABI = GTokenABIData;
export const GTokenStakingABI = GTokenStakingABIData;

// SuperPaymaster - 使用 V3，提供别名
export const SuperPaymasterV3ABI = SuperPaymasterV3ABIData;
export const SuperPaymasterABI = SuperPaymasterV3ABIData; // 别名（无版本号）

// PaymasterFactory
export const PaymasterFactoryABI = PaymasterFactoryABIData;

// Paymaster V4 (使用 V4_2 作为当前标准)
export const PaymasterV4_2ABI = PaymasterV4_2ABIData;
export const PaymasterV4ABI = PaymasterV4_2ABIData; // 别名

// ========== AA Standard ==========
export const EntryPointABI = EntryPointABIData;
export const SimpleAccountABI = SimpleAccountABIData;
export const SimpleAccountFactoryABI = SimpleAccountFactoryABIData;

// ========== Token System ==========
export const xPNTsTokenABI = xPNTsTokenABIData; // 用于所有 xPNTs 实例（aPNTs, bPNTs 等）
export const aPNTsABI = xPNTsTokenABIData; // 别名：aPNTs
export const xPNTsFactoryABI = xPNTsFactoryABIData;
export const MySBTABI = MySBTABIData;

// ========== Identity & Reputation ==========
// 使用 V3，提供别名
export const ReputationSystemV3ABI = ReputationSystemV3ABIData;
export const ReputationSystemABI = ReputationSystemV3ABIData; // 别名（无版本号）

// ========== Monitoring System ==========
// 使用 V3，提供别名
export const DVTValidatorV3ABI = DVTValidatorV3ABIData;
export const DVTValidatorABI = DVTValidatorV3ABIData; // 别名（无版本号）

export const BLSAggregatorV3ABI = BLSAggregatorV3ABIData;
export const BLSAggregatorABI = BLSAggregatorV3ABIData; // 别名（无版本号）

export const BLSValidatorABI = BLSValidatorABIData;


