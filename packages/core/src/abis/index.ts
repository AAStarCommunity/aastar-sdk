/**
 * Smart Contract ABIs
 */

// Core System
import RegistryABIData from './Registry.json';
import GTokenABIData from './GToken.json';
import GTokenStakingABIData from './GTokenStaking.json';
import SuperPaymasterV2ABIData from './SuperPaymasterV2.json';
import PaymasterFactoryABIData from './PaymasterFactory.json';

// Token System
import xPNTsTokenABIData from './xPNTsToken.json';
import xPNTsFactoryABIData from './xPNTsFactory.json';
import MySBTABIData from './MySBT.json';

// Monitoring System
import DVTValidatorABIData from './DVTValidator.json';
import BLSAggregatorABIData from './BLSAggregator.json';

// Legacy/Third-party
import PaymasterV4ABIData from './PaymasterV4.json';
import SimpleAccountABIData from './SimpleAccount.json';
import SimpleAccountFactoryABIData from './SimpleAccountFactory.json';

// Re-export ABIs - Core System
export const RegistryABI = RegistryABIData;
export const GTokenABI = GTokenABIData;
export const GTokenStakingABI = GTokenStakingABIData;
export const SuperPaymasterV2ABI = SuperPaymasterV2ABIData;
export const PaymasterFactoryABI = PaymasterFactoryABIData;

// Re-export ABIs - Token System
export const xPNTsTokenABI = xPNTsTokenABIData;
export const xPNTsFactoryABI = xPNTsFactoryABIData;
export const MySBTABI = MySBTABIData;

// Re-export ABIs - Monitoring System
export const DVTValidatorABI = DVTValidatorABIData;
export const BLSAggregatorABI = BLSAggregatorABIData;

// Re-export ABIs - Legacy/Third-party
export const PaymasterV4ABI = PaymasterV4ABIData;
export const SimpleAccountABI = SimpleAccountABIData;
export const SimpleAccountFactoryABI = SimpleAccountFactoryABIData;
