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
export const RegistryABI = RegistryABIData.abi;
export const RegistryArtifact = RegistryABIData;

export const GTokenABI = GTokenABIData.abi;
export const GTokenArtifact = GTokenABIData;

export const GTokenStakingABI = GTokenStakingABIData.abi;
export const GTokenStakingArtifact = GTokenStakingABIData;

export const SuperPaymasterABI = SuperPaymasterABIData.abi;
export const SuperPaymasterArtifact = SuperPaymasterABIData;

export const PaymasterFactoryABI = PaymasterFactoryABIData.abi;
export const PaymasterFactoryArtifact = PaymasterFactoryABIData;

// Paymaster V4 (使用 Paymaster.json)
export const PaymasterV4ABI = PaymasterABIData.abi;
export const PaymasterV4Artifact = PaymasterABIData;
export const PaymasterABI = PaymasterABIData.abi;
export const PaymasterArtifact = PaymasterABIData;

// ========== AA Standard ==========
export const EntryPointABI = EntryPointABIData.abi;
export const EntryPointArtifact = EntryPointABIData;

export const SimpleAccountABI = SimpleAccountABIData.abi;
export const SimpleAccountArtifact = SimpleAccountABIData;

export const SimpleAccountFactoryABI = SimpleAccountFactoryABIData.abi;
export const SimpleAccountFactoryArtifact = SimpleAccountFactoryABIData;

// ========== Token System ==========
export const xPNTsTokenABI = xPNTsTokenABIData.abi;
export const xPNTsTokenArtifact = xPNTsTokenABIData;

export const xPNTsFactoryABI = xPNTsFactoryABIData.abi;
export const xPNTsFactoryArtifact = xPNTsFactoryABIData;

export const MySBTABI = MySBTABIData.abi;
export const MySBTArtifact = MySBTABIData;

// ========== Identity & Reputation ==========
export const ReputationSystemABI = ReputationSystemABIData.abi;
export const ReputationSystemArtifact = ReputationSystemABIData;

// ========== Monitoring System ==========
export const DVTValidatorABI = DVTValidatorABIData.abi;
export const DVTValidatorArtifact = DVTValidatorABIData;

export const BLSAggregatorABI = BLSAggregatorABIData.abi;
export const BLSAggregatorArtifact = BLSAggregatorABIData;

export const BLSValidatorABI = BLSValidatorABIData.abi;
export const BLSValidatorArtifact = BLSValidatorABIData;



