/**
 * Smart Contract ABIs (Unified Naming)
 * 
 * 命名策略：
 * - 文件名：统一无版本号（如 BLSAggregator.json）
 * - 版本信息：通过 ABI 中的 version() 函数获取
 * - 同步时自动去除版本号后缀（V3 等）
 */

// Core System
import RegistryABIData from './Registry.json' with { type: 'json' };
import GTokenABIData from './GToken.json' with { type: 'json' };
import GTokenStakingABIData from './GTokenStaking.json' with { type: 'json' };
import SuperPaymasterABIData from './SuperPaymaster.json' with { type: 'json' };
import PaymasterFactoryABIData from './PaymasterFactory.json' with { type: 'json' };
import PaymasterABIData from './Paymaster.json' with { type: 'json' };

// AA Standard (从 out/ 提取)
import EntryPointABIData from './EntryPoint.json' with { type: 'json' };
import SimpleAccountABIData from './SimpleAccount.json' with { type: 'json' };
import SimpleAccountFactoryABIData from './SimpleAccountFactory.json' with { type: 'json' };

// Token System
import xPNTsTokenABIData from './xPNTsToken.json' with { type: 'json' };
import xPNTsFactoryABIData from './xPNTsFactory.json' with { type: 'json' };
import MySBTABIData from './MySBT.json' with { type: 'json' };

// Identity & Reputation
import ReputationSystemABIData from './ReputationSystem.json' with { type: 'json' };

// Monitoring System
import DVTValidatorABIData from './DVTValidator.json' with { type: 'json' };
import BLSAggregatorABIData from './BLSAggregator.json' with { type: 'json' };
import BLSValidatorABIData from './BLSValidator.json' with { type: 'json' };

// ========== Re-export ABIs - Core System ==========
export const RegistryABI = RegistryABIData;
export const GTokenABI = GTokenABIData;
export const GTokenStakingABI = GTokenStakingABIData;
export const SuperPaymasterABI = SuperPaymasterABIData;
export const PaymasterFactoryABI = PaymasterFactoryABIData;

// Paymaster V4 (使用 Paymaster.json)
export const PaymasterV4ABI = PaymasterABIData;
export const PaymasterABI = PaymasterABIData;

// ========== AA Standard ==========
export const EntryPointABI = EntryPointABIData;
export const SimpleAccountABI = SimpleAccountABIData;
export const SimpleAccountFactoryABI = SimpleAccountFactoryABIData;

// ========== Token System ==========
export const xPNTsTokenABI = xPNTsTokenABIData;
export const xPNTsFactoryABI = xPNTsFactoryABIData;
export const MySBTABI = MySBTABIData;

// ========== Identity & Reputation ==========
export const ReputationSystemABI = ReputationSystemABIData;

// ========== Monitoring System ==========
export const DVTValidatorABI = DVTValidatorABIData;
export const BLSAggregatorABI = BLSAggregatorABIData;
export const BLSValidatorABI = BLSValidatorABIData;



