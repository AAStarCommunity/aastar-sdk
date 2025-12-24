/**
 * Smart Contract ABIs (Standardized Naming)
 */

// Core System
import RegistryABIData from './Registry.json';
import GTokenABIData from './GToken.json';
import GTokenStakingABIData from './GTokenStaking.json';
import SuperPaymasterABIData from './SuperPaymaster.json';
import PaymasterFactoryABIData from './PaymasterFactory.json';
import EntryPointABIData from './EntryPoint.json';

// Token System
import xPNTsTokenABIData from './xPNTsToken.json';
import xPNTsFactoryABIData from './xPNTsFactory.json';
import MySBTABIData from './MySBT.json';

// Identity & Reputation
import ReputationSystemABIData from './ReputationSystem.json';

// Monitoring System
import DVTValidatorABIData from './DVTValidator.json';
import BLSAggregatorABIData from './BLSAggregator.json';

// Legacy/Third-party (Standardized)
import PaymasterABIData from './Paymaster.json';
import SimpleAccountABIData from './SimpleAccount.json';
import SimpleAccountFactoryABIData from './SimpleAccountFactory.json';

// New Versions & Extensions
import SimpleAccountV08ABIData from './SimpleAccountV08.json';
import SimpleAccountFactoryV08ABIData from './SimpleAccountFactoryV08.json';
import Simple7702AccountABIData from './Simple7702Account.json';

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
