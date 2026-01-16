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
export const RegistryABI = (RegistryABIData as any).abi || RegistryABIData;
export const RegistryArtifact = RegistryABIData;

export const GTokenABI = (GTokenABIData as any).abi || GTokenABIData;
export const GTokenArtifact = GTokenABIData;

export const GTokenStakingABI = (GTokenStakingABIData as any).abi || GTokenStakingABIData;
export const GTokenStakingArtifact = GTokenStakingABIData;

export const SuperPaymasterABI = (SuperPaymasterABIData as any).abi || SuperPaymasterABIData;
export const SuperPaymasterArtifact = SuperPaymasterABIData;

export const PaymasterFactoryABI = (PaymasterFactoryABIData as any).abi || PaymasterFactoryABIData;
export const PaymasterFactoryArtifact = PaymasterFactoryABIData;

// Paymaster V4 (使用 Paymaster.json)
export const PaymasterV4ABI = (PaymasterABIData as any).abi || PaymasterABIData;
export const PaymasterV4Artifact = PaymasterABIData;
export const PaymasterABI = (PaymasterABIData as any).abi || PaymasterABIData;
export const PaymasterArtifact = PaymasterABIData;

// ========== AA Standard ==========
export const EntryPointABI = (EntryPointABIData as any).abi || EntryPointABIData;
export const EntryPointArtifact = EntryPointABIData;

export const SimpleAccountABI = (SimpleAccountABIData as any).abi || SimpleAccountABIData;
export const SimpleAccountArtifact = SimpleAccountABIData;

export const SimpleAccountFactoryABI = (SimpleAccountFactoryABIData as any).abi || SimpleAccountFactoryABIData;
export const SimpleAccountFactoryArtifact = SimpleAccountFactoryABIData;

// ========== Token System ==========
export const xPNTsTokenABI = (xPNTsTokenABIData as any).abi || xPNTsTokenABIData;
export const xPNTsTokenArtifact = xPNTsTokenABIData;

export const xPNTsFactoryABI = (xPNTsFactoryABIData as any).abi || xPNTsFactoryABIData;
export const xPNTsFactoryArtifact = xPNTsFactoryABIData;

export const MySBTABI = (MySBTABIData as any).abi || MySBTABIData;
export const MySBTArtifact = MySBTABIData;

// ========== Identity & Reputation ==========
export const ReputationSystemABI = (ReputationSystemABIData as any).abi || ReputationSystemABIData;
export const ReputationSystemArtifact = ReputationSystemABIData;

// ========== Monitoring System ==========
export const DVTValidatorABI = (DVTValidatorABIData as any).abi || DVTValidatorABIData;
export const DVTValidatorArtifact = DVTValidatorABIData;

export const BLSAggregatorABI = (BLSAggregatorABIData as any).abi || BLSAggregatorABIData;
export const BLSAggregatorArtifact = BLSAggregatorABIData;

export const BLSValidatorABI = (BLSValidatorABIData as any).abi || BLSValidatorABIData;
export const BLSValidatorArtifact = BLSValidatorABIData;



