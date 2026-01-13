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

// ========== Re-export ABIs (Raw Arrays) ==========
// ========== Re-export ABIs (Raw Arrays) ==========

function extractAbi(artifact: any) {
  // If it's an array, it IS the ABI. If it's an object, try .abi. 
  // If .abi is undefined but it's not an array, it might be an older format or unexpected, 
  // but strictly checking Array.isArray helps standard foundry artifacts vs hardhat artifacts.
  return Array.isArray(artifact) ? artifact : artifact.abi;
}

export const RegistryABI = extractAbi(RegistryABIData);
export const GTokenABI = extractAbi(GTokenABIData);
export const GTokenStakingABI = extractAbi(GTokenStakingABIData);
export const SuperPaymasterABI = extractAbi(SuperPaymasterABIData);
export const PaymasterFactoryABI = extractAbi(PaymasterFactoryABIData);
export const PaymasterV4ABI = extractAbi(PaymasterABIData);
export const PaymasterABI = extractAbi(PaymasterABIData);
export const EntryPointABI = extractAbi(EntryPointABIData);
export const SimpleAccountABI = extractAbi(SimpleAccountABIData);
export const SimpleAccountFactoryABI = extractAbi(SimpleAccountFactoryABIData);
export const xPNTsTokenABI = extractAbi(xPNTsTokenABIData);
export const xPNTsFactoryABI = extractAbi(xPNTsFactoryABIData);
export const MySBTABI = extractAbi(MySBTABIData);
export const ReputationSystemABI = extractAbi(ReputationSystemABIData);
export const DVTValidatorABI = extractAbi(DVTValidatorABIData);
export const BLSAggregatorABI = extractAbi(BLSAggregatorABIData);
export const BLSValidatorABI = extractAbi(BLSValidatorABIData);

// ========== Artifacts (Flattened) ==========
export const RegistryArtifact = RegistryABIData;
export const GTokenArtifact = GTokenABIData;
export const GTokenStakingArtifact = GTokenStakingABIData;
export const SuperPaymasterArtifact = SuperPaymasterABIData;
export const PaymasterFactoryArtifact = PaymasterFactoryABIData;
export const PaymasterV4Artifact = PaymasterABIData;
export const PaymasterArtifact = PaymasterABIData;
export const EntryPointArtifact = EntryPointABIData;
export const SimpleAccountArtifact = SimpleAccountABIData;
export const SimpleAccountFactoryArtifact = SimpleAccountFactoryABIData;
export const xPNTsTokenArtifact = xPNTsTokenABIData;
export const xPNTsFactoryArtifact = xPNTsFactoryABIData;
export const MySBTArtifact = MySBTABIData;
export const ReputationSystemArtifact = ReputationSystemABIData;
export const DVTValidatorArtifact = DVTValidatorABIData;
export const BLSAggregatorArtifact = BLSAggregatorABIData;
export const BLSValidatorArtifact = BLSValidatorABIData;

// ========== Abis Namespace (Unified Access) ==========
export const Abis = {
    Registry: RegistryABI,
    GToken: GTokenABI,
    GTokenStaking: GTokenStakingABI,
    SuperPaymaster: SuperPaymasterABI,
    PaymasterFactory: PaymasterFactoryABI,
    Paymaster: PaymasterABI,
    EntryPoint: EntryPointABI,
    SimpleAccount: SimpleAccountABI,
    SimpleAccountFactory: SimpleAccountFactoryABI,
    xPNTsToken: xPNTsTokenABI,
    xPNTsFactory: xPNTsFactoryABI,
    MySBT: MySBTABI,
    ReputationSystem: ReputationSystemABI,
    DVTValidator: DVTValidatorABI,
    BLSAggregator: BLSAggregatorABI,
    BLSValidator: BLSValidatorABI,
} as const;



