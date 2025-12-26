/**
 * Smart Contract ABIs (Standardized Naming)
 */

// Core System
import RegistryABIData from './Registry.json' with { type: 'json' };
import GTokenABIData from './GToken.json' with { type: 'json' };
import GTokenStakingABIData from './GTokenStaking.json' with { type: 'json' };
import SuperPaymasterABIData from './SuperPaymaster.json' with { type: 'json' };
import PaymasterFactoryABIData from './PaymasterFactory.json' with { type: 'json' };
import EntryPointABIData from './EntryPoint.json' with { type: 'json' };

// Token System
import xPNTsTokenABIData from './xPNTsToken.json' with { type: 'json' };
import xPNTsFactoryABIData from './xPNTsFactory.json' with { type: 'json' };
import MySBTABIData from './MySBT.json' with { type: 'json' };

// Identity & Reputation
import ReputationSystemABIData from './ReputationSystem.json' with { type: 'json' };

// Monitoring System
import DVTValidatorABIData from './DVTValidator.json' with { type: 'json' };
import BLSAggregatorABIData from './BLSAggregator.json' with { type: 'json' };

// Legacy/Third-party (Standardized)
import PaymasterABIData from './Paymaster.json' with { type: 'json' };
import SimpleAccountABIData from './SimpleAccount.json' with { type: 'json' };
import SimpleAccountFactoryABIData from './SimpleAccountFactory.json' with { type: 'json' };

// New Versions & Extensions
import SimpleAccountV08ABIData from './SimpleAccountV08.json' with { type: 'json' };
import SimpleAccountFactoryV08ABIData from './SimpleAccountFactoryV08.json' with { type: 'json' };
import Simple7702AccountABIData from './Simple7702Account.json' with { type: 'json' };

// Re-export ABIs - Core System
export const RegistryABI = RegistryABIData;
export const GTokenABI = GTokenABIData;
export const GTokenStakingABI = GTokenStakingABIData;
export const SuperPaymasterABI = SuperPaymasterABIData;
export const PaymasterFactoryABI = PaymasterFactoryABIData;
export const EntryPointABI = EntryPointABIData;

// Re-export ABIs - Token System
export const xPNTsTokenABI = xPNTsTokenABIData;
export const xPNTsFactoryABI = xPNTsFactoryABIData;
export const MySBTABI = MySBTABIData;

// Re-export ABIs - Identity & Reputation
export const ReputationSystemABI = ReputationSystemABIData;

// Re-export ABIs - Monitoring System
export const DVTValidatorABI = DVTValidatorABIData;
export const BLSAggregatorABI = BLSAggregatorABIData;

// Re-export ABIs - Legacy/Third-party
export const PaymasterABI = PaymasterABIData;
export const SimpleAccountABI = SimpleAccountABIData;
export const SimpleAccountFactoryABI = SimpleAccountFactoryABIData;

// Re-export ABIs - New Versions & Extensions
export const SimpleAccountV08ABI = SimpleAccountV08ABIData;
export const SimpleAccountFactoryV08ABI = SimpleAccountFactoryV08ABIData;
export const Simple7702AccountABI = Simple7702AccountABIData;

// Legacy Aliases for compatibility (if needed)
export const SuperPaymasterV3ABI = SuperPaymasterABIData;
export const ReputationSystemV3ABI = ReputationSystemABIData;
export const PaymasterV4ABI = PaymasterABIData;
